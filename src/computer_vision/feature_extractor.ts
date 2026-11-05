/**
 * ORB (Oriented FAST and Rotated BRIEF) Feature Extractor
 * Robust multi-scale corner detection with adaptive FAST-9 thresholds,
 * Harris response ranking, intensity centroid orientation, and noise-smoothed steered BRIEF descriptors.
 */

import { Keypoint, FeatureDescriptorSet } from '../types';
import { PreprocessedImage, buildImagePyramid } from './image_preprocessing';

// 16 pixels on Bresenham circle of radius 3
const FAST_OFFSETS: [number, number][] = [
  [0, -3],  // 0
  [1, -3],  // 1
  [2, -2],  // 2
  [3, -1],  // 3
  [3, 0],   // 4
  [3, 1],   // 5
  [2, 2],   // 6
  [1, 3],   // 7
  [0, 3],   // 8
  [-1, 3],  // 9
  [-2, 2],  // 10
  [-3, 1],  // 11
  [-3, 0],  // 12
  [-3, -1], // 13
  [-2, -2], // 14
  [-1, -3], // 15
];

// Pre-computed circular mask for patch radius 15 for Intensity Centroid
const CENTROID_RADIUS = 15;
const CENTROID_MASK: Array<[number, number]> = [];
for (let dy = -CENTROID_RADIUS; dy <= CENTROID_RADIUS; dy++) {
  for (let dx = -CENTROID_RADIUS; dx <= CENTROID_RADIUS; dx++) {
    if (dx * dx + dy * dy <= CENTROID_RADIUS * CENTROID_RADIUS) {
      CENTROID_MASK.push([dx, dy]);
    }
  }
}

// 256 Steered BRIEF test pairs sampled from standard Gaussian distribution (patch size 31x31)
function generateBriefPairs(): Array<{ p: [number, number]; q: [number, number] }> {
  const pairs: Array<{ p: [number, number]; q: [number, number] }> = [];
  let seed = 123456789;
  const nextRandom = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const nextGaussian = () => {
    const u1 = Math.max(1e-7, nextRandom());
    const u2 = nextRandom();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  };

  const sigma = 6.2;
  for (let i = 0; i < 256; i++) {
    const px = Math.max(-14, Math.min(14, Math.round(nextGaussian() * sigma)));
    const py = Math.max(-14, Math.min(14, Math.round(nextGaussian() * sigma)));
    const qx = Math.max(-14, Math.min(14, Math.round(nextGaussian() * sigma)));
    const qy = Math.max(-14, Math.min(14, Math.round(nextGaussian() * sigma)));
    pairs.push({ p: [px, py], q: [qx, qy] });
  }
  return pairs;
}

const BRIEF_PAIRS = generateBriefPairs();

/**
 * Computes Harris corner response at pixel (x, y) over a 5x5 window.
 * Returns det(M) - 0.04 * trace(M)^2.
 */
function computeHarrisResponse(
  img: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number
): number {
  let Ixx = 0;
  let Iyy = 0;
  let Ixy = 0;

  for (let dy = -2; dy <= 2; dy++) {
    const py = y + dy;
    if (py < 1 || py >= h - 1) continue;
    const row = py * w;

    for (let dx = -2; dx <= 2; dx++) {
      const px = x + dx;
      if (px < 1 || px >= w - 1) continue;

      const gx = img[row + px + 1] - img[row + px - 1];
      const gy = img[(py + 1) * w + px] - img[(py - 1) * w + px];

      Ixx += gx * gx;
      Iyy += gy * gy;
      Ixy += gx * gy;
    }
  }

  const det = Ixx * Iyy - Ixy * Ixy;
  const trace = Ixx + Iyy;
  return det - 0.04 * trace * trace;
}

/**
 * Calculates keypoint orientation using intensity centroid moments (m01, m10).
 */
function computeOrientation(
  img: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number
): number {
  let m10 = 0;
  let m01 = 0;

  for (let i = 0; i < CENTROID_MASK.length; i++) {
    const [dx, dy] = CENTROID_MASK[i];
    const px = cx + dx;
    const py = cy + dy;

    if (px >= 0 && px < w && py >= 0 && py < h) {
      const intensity = img[py * w + px];
      m10 += dx * intensity;
      m01 += dy * intensity;
    }
  }

  return Math.atan2(m01, m10);
}

/**
 * Extracts FAST-9 corners on a single image plane with adaptive threshold relaxation.
 */
export function detectFastKeypointsSinglePlane(
  image: PreprocessedImage,
  targetFeatures: number = 350,
  octave: number = 0,
  scale: number = 1.0
): Keypoint[] {
  const { width, height, clahe: img } = image;
  const border = 18;

  // Adaptive threshold ladder: start nominal, relax if image has low texture or blur
  const thresholdTiers = [20, 14, 9];
  let candidates: Keypoint[] = [];

  const offsetIndices = new Int32Array(16);
  for (let i = 0; i < 16; i++) {
    offsetIndices[i] = FAST_OFFSETS[i][1] * width + FAST_OFFSETS[i][0];
  }

  const p0 = offsetIndices[0];
  const p4 = offsetIndices[4];
  const p8 = offsetIndices[8];
  const p12 = offsetIndices[12];

  for (const fastThreshold of thresholdTiers) {
    candidates = [];

    // Full dense pixel scan (stride 1)
    for (let y = border; y < height - border; y++) {
      const rowOffset = y * width;
      for (let x = border; x < width - border; x++) {
        const centerIdx = rowOffset + x;
        const centerVal = img[centerIdx];

        const highThr = centerVal + fastThreshold;
        const lowThr = centerVal - fastThreshold;

        // Correct 4-point cardinal test:
        // A 90-degree corner has 2 cardinal points in/out. Requiring >= 2 passes all corners.
        let brightCount = 0;
        let darkCount = 0;

        const v0 = img[centerIdx + p0];
        const v4 = img[centerIdx + p4];
        const v8 = img[centerIdx + p8];
        const v12 = img[centerIdx + p12];

        if (v0 > highThr) brightCount++; else if (v0 < lowThr) darkCount++;
        if (v4 > highThr) brightCount++; else if (v4 < lowThr) darkCount++;
        if (v8 > highThr) brightCount++; else if (v8 < lowThr) darkCount++;
        if (v12 > highThr) brightCount++; else if (v12 < lowThr) darkCount++;

        if (brightCount < 2 && darkCount < 2) {
          continue;
        }

        // Check full 16-point circle for 9 contiguous pixels
        let isCorner = false;

        if (brightCount >= 2) {
          let contiguous = 0;
          for (let i = 0; i < 31; i++) {
            if (img[centerIdx + offsetIndices[i % 16]] > highThr) {
              if (++contiguous >= 9) {
                isCorner = true;
                break;
              }
            } else {
              contiguous = 0;
            }
          }
        }

        if (!isCorner && darkCount >= 2) {
          let contiguous = 0;
          for (let i = 0; i < 31; i++) {
            if (img[centerIdx + offsetIndices[i % 16]] < lowThr) {
              if (++contiguous >= 9) {
                isCorner = true;
                break;
              }
            } else {
              contiguous = 0;
            }
          }
        }

        if (isCorner) {
          const response = computeHarrisResponse(img, width, height, x, y);
          // Only true corners with positive Harris curvature
          if (response > 0) {
            const angle = computeOrientation(img, width, height, x, y);
            candidates.push({
              x: Math.round(x / scale),
              y: Math.round(y / scale),
              response,
              angle,
              octave,
            });
          }
        }
      }
    }

    // If adequate keypoints were found, proceed; otherwise relax threshold to next tier
    if (candidates.length >= 30) {
      break;
    }
  }

  // Spatial Non-Maximum Suppression (NMS) to maintain uniform distribution across frame
  const cellSize = 16;
  const gridW = Math.ceil(width / cellSize);
  const gridH = Math.ceil(height / cellSize);
  const grid: Array<Keypoint | null> = new Array(gridW * gridH).fill(null);

  for (let i = 0; i < candidates.length; i++) {
    const kp = candidates[i];
    const cellX = Math.floor((kp.x * scale) / cellSize);
    const cellY = Math.floor((kp.y * scale) / cellSize);
    const cellIdx = cellY * gridW + cellX;

    if (cellIdx >= 0 && cellIdx < grid.length) {
      const existing = grid[cellIdx];
      if (!existing || kp.response > existing.response) {
        grid[cellIdx] = kp;
      }
    }
  }

  const suppressed: Keypoint[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== null) {
      suppressed.push(grid[i]!);
    }
  }

  suppressed.sort((a, b) => b.response - a.response);
  return suppressed.slice(0, targetFeatures);
}

/**
 * Computes 256-bit steered BRIEF descriptors from the smoothed image plane.
 * Noise-smoothed sampling reduces bit error rates dramatically.
 */
export function computeSteeredBriefDescriptors(
  image: PreprocessedImage,
  keypoints: Keypoint[]
): Uint8Array {
  const { width, height, smoothed: img } = image;
  const count = keypoints.length;
  const descriptors = new Uint8Array(count * 32);

  for (let k = 0; k < count; k++) {
    const kp = keypoints[k];
    const cosA = Math.cos(kp.angle);
    const sinA = Math.sin(kp.angle);
    const descOffset = k * 32;

    for (let byteIdx = 0; byteIdx < 32; byteIdx++) {
      let byteVal = 0;
      const pairBase = byteIdx * 8;

      for (let bitIdx = 0; bitIdx < 8; bitIdx++) {
        const pair = BRIEF_PAIRS[pairBase + bitIdx];

        const px = Math.round(kp.x + pair.p[0] * cosA - pair.p[1] * sinA);
        const py = Math.round(kp.y + pair.p[0] * sinA + pair.p[1] * cosA);

        const qx = Math.round(kp.x + pair.q[0] * cosA - pair.q[1] * sinA);
        const qy = Math.round(kp.y + pair.q[0] * sinA + pair.q[1] * cosA);

        const safePx = Math.max(0, Math.min(width - 1, px));
        const safePy = Math.max(0, Math.min(height - 1, py));
        const safeQx = Math.max(0, Math.min(width - 1, qx));
        const safeQy = Math.max(0, Math.min(height - 1, qy));

        const valP = img[safePy * width + safePx];
        const valQ = img[safeQy * width + safeQx];

        if (valP < valQ) {
          byteVal |= (1 << bitIdx);
        }
      }

      descriptors[descOffset + byteIdx] = byteVal;
    }
  }

  return descriptors;
}

/**
 * End-to-end Multi-Scale ORB feature extraction across scale pyramid.
 */
export function extractOrbFeatures(
  image: PreprocessedImage,
  maxFeatures: number = 450
): FeatureDescriptorSet {
  // Build 2-level pyramid for zoom invariance
  const pyramid = buildImagePyramid(image, 2, 1.25);
  const allKeypoints: Keypoint[] = [];

  // Extract from octave 0 (full res)
  const kps0 = detectFastKeypointsSinglePlane(image, Math.round(maxFeatures * 0.75), 0, 1.0);
  allKeypoints.push(...kps0);

  // Extract from octave 1 (downscaled) for scale invariance
  if (pyramid.length > 1) {
    const kps1 = detectFastKeypointsSinglePlane(pyramid[1].image, Math.round(maxFeatures * 0.25), 1, pyramid[1].scale);
    allKeypoints.push(...kps1);
  }

  // Deduplicate overlapping keypoints
  const deduplicated: Keypoint[] = [];
  const minDistanceSq = 3 * 3;

  allKeypoints.sort((a, b) => b.response - a.response);

  for (let i = 0; i < allKeypoints.length && deduplicated.length < maxFeatures; i++) {
    const kp = allKeypoints[i];
    let tooClose = false;
    for (let j = 0; j < deduplicated.length; j++) {
      const existing = deduplicated[j];
      const dx = kp.x - existing.x;
      const dy = kp.y - existing.y;
      if (dx * dx + dy * dy < minDistanceSq) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      deduplicated.push(kp);
    }
  }

  const descriptors = computeSteeredBriefDescriptors(image, deduplicated);

  return {
    keypoints: deduplicated,
    descriptors,
    width: image.width,
    height: image.height,
    averageLuminance: image.meanLuminance,
    contrastStdDev: image.contrastStdDev,
  };
}
