/**
 * Feature Matcher Module (BFMatcher with Hamming Distance)
 * Matches binary ORB descriptors using Hamming distance, Lowe's ratio test,
 * and mutual cross-checking.
 */

import { FeatureDescriptorSet, MatchPair } from '../types';

// Pre-computed 8-bit popcount lookup table for rapid Hamming distance
const POPCOUNT_LUT = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let count = 0;
  let n = i;
  while (n > 0) {
    count += n & 1;
    n >>= 1;
  }
  POPCOUNT_LUT[i] = count;
}

/**
 * Computes Hamming distance between two 32-byte (256-bit) binary descriptors.
 * Range: 0 (identical) to 256 (completely opposite).
 */
export function computeHammingDistance(
  descA: Uint8Array,
  offsetA: number,
  descB: Uint8Array,
  offsetB: number
): number {
  let dist = 0;
  for (let i = 0; i < 32; i++) {
    const xor = descA[offsetA + i] ^ descB[offsetB + i];
    dist += POPCOUNT_LUT[xor];
  }
  return dist;
}

/**
 * Matches features from current frame against reference frame using
 * Brute-Force matching with Lowe's ratio test and Hamming distance threshold.
 */
export function matchFeatures(
  currentFeatures: FeatureDescriptorSet,
  referenceFeatures: FeatureDescriptorSet,
  options: {
    ratioThreshold?: number; // Lowe's ratio test (default 0.78)
    maxHammingDistance?: number; // Maximum allowable bit difference (default 65)
    crossCheck?: boolean; // Mutual nearest neighbor check
  } = {}
): MatchPair[] {
  const {
    ratioThreshold = 0.78,
    maxHammingDistance = 75,
    crossCheck = true,
  } = options;

  const numQuery = currentFeatures.keypoints.length;
  const numTrain = referenceFeatures.keypoints.length;

  if (numQuery === 0 || numTrain === 0) {
    return [];
  }

  const queryDesc = currentFeatures.descriptors;
  const trainDesc = referenceFeatures.descriptors;

  // Forward matches: for each query (current), find best and 2nd best in train (reference)
  const forwardMatches: Array<{
    trainIdx: number;
    dist1: number;
    dist2: number;
  }> = new Array(numQuery);

  for (let q = 0; q < numQuery; q++) {
    const qOffset = q * 32;
    let bestDist = 999;
    let secondBestDist = 999;
    let bestTrainIdx = -1;

    for (let t = 0; t < numTrain; t++) {
      const tOffset = t * 32;
      const d = computeHammingDistance(queryDesc, qOffset, trainDesc, tOffset);

      if (d < bestDist) {
        secondBestDist = bestDist;
        bestDist = d;
        bestTrainIdx = t;
      } else if (d < secondBestDist) {
        secondBestDist = d;
      }
    }

    forwardMatches[q] = {
      trainIdx: bestTrainIdx,
      dist1: bestDist,
      dist2: secondBestDist,
    };
  }

  // Backward matches for cross-check (optional but highly recommended for CCTV reliability)
  let backwardBest: Int32Array | null = null;
  if (crossCheck) {
    backwardBest = new Int32Array(numTrain);
    backwardBest.fill(-1);

    for (let t = 0; t < numTrain; t++) {
      const tOffset = t * 32;
      let minD = 999;
      let minQ = -1;

      for (let q = 0; q < numQuery; q++) {
        const qOffset = q * 32;
        const d = computeHammingDistance(queryDesc, qOffset, trainDesc, tOffset);
        if (d < minD) {
          minD = d;
          minQ = q;
        }
      }
      backwardBest[t] = minQ;
    }
  }

  const matches: MatchPair[] = [];

  for (let q = 0; q < numQuery; q++) {
    const match = forwardMatches[q];
    if (match.trainIdx === -1) continue;

    // Filter 1: Maximum distance threshold
    if (match.dist1 > maxHammingDistance) continue;

    // Filter 2: Lowe's ratio test (dist1 must be significantly smaller than dist2)
    if (match.dist2 > 0 && match.dist1 / match.dist2 > ratioThreshold) {
      continue;
    }

    // Filter 3: Mutual cross-check
    if (backwardBest && backwardBest[match.trainIdx] !== q) {
      continue;
    }

    const refKp = referenceFeatures.keypoints[match.trainIdx];
    const currKp = currentFeatures.keypoints[q];

    matches.push({
      queryIdx: q,
      trainIdx: match.trainIdx,
      distance: match.dist1,
      pt1: [refKp.x, refKp.y],
      pt2: [currKp.x, currKp.y],
      isInlier: false, // will be populated by RANSAC
    });
  }

  // Sort matches by distance (highest confidence first)
  matches.sort((a, b) => a.distance - b.distance);

  return matches;
}
