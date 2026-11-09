/**
 * Image Preprocessing Module
 * Includes Grayscale conversion, CLAHE (Contrast Limited Adaptive Histogram Equalization),
 * Gaussian / Box smoothing for noise-robust descriptor sampling, and multi-scale pyramid generation.
 */

export interface PreprocessedImage {
  width: number;
  height: number;
  grayscale: Uint8Array;
  clahe: Uint8Array;
  smoothed: Uint8Array; // 5x5 smoothed version for noise-robust BRIEF descriptors
  meanLuminance: number;
  contrastStdDev: number;
}

export interface PyramidLevel {
  level: number;
  scale: number; // e.g. 1.0, 0.8, 0.64
  width: number;
  height: number;
  image: PreprocessedImage;
}

/**
 * Fast separable 5x5 Gaussian approximation filter for noise reduction.
 * Kernel: [1, 4, 6, 4, 1] / 16 in each dimension.
 */
export function smooth5x5(input: Uint8Array, width: number, height: number): Uint8Array {
  const temp = new Uint8Array(width * height);
  const output = new Uint8Array(width * height);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const xm2 = Math.max(0, x - 2);
      const xm1 = Math.max(0, x - 1);
      const xp1 = Math.min(width - 1, x + 1);
      const xp2 = Math.min(width - 1, x + 2);

      const val = (
        input[rowOffset + xm2] +
        input[rowOffset + xm1] * 4 +
        input[rowOffset + x] * 6 +
        input[rowOffset + xp1] * 4 +
        input[rowOffset + xp2]
      ) >> 4;

      temp[rowOffset + x] = val;
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    const ym2 = Math.max(0, y - 2) * width;
    const ym1 = Math.max(0, y - 1) * width;
    const y0 = y * width;
    const yp1 = Math.min(height - 1, y + 1) * width;
    const yp2 = Math.min(height - 1, y + 2) * width;

    for (let x = 0; x < width; x++) {
      const val = (
        temp[ym2 + x] +
        temp[ym1 + x] * 4 +
        temp[y0 + x] * 6 +
        temp[yp1 + x] * 4 +
        temp[yp2 + x]
      ) >> 4;

      output[y0 + x] = val;
    }
  }

  return output;
}

/**
 * Bilinear downscaling for multi-scale pyramid levels.
 */
export function downscaleBilinear(
  input: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  const output = new Uint8Array(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const sy = dy * yRatio;
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcH - 1, y0 + 1);
    const wy = sy - y0;

    for (let dx = 0; dx < dstW; dx++) {
      const sx = dx * xRatio;
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcW - 1, x0 + 1);
      const wx = sx - x0;

      const p00 = input[y0 * srcW + x0];
      const p10 = input[y0 * srcW + x1];
      const p01 = input[y1 * srcW + x0];
      const p11 = input[y1 * srcW + x1];

      const top = p00 * (1 - wx) + p10 * wx;
      const bottom = p01 * (1 - wx) + p11 * wx;
      output[dy * dstW + dx] = Math.round(top * (1 - wy) + bottom * wy);
    }
  }

  return output;
}

/**
 * Converts RGBA image data to grayscale Uint8Array and computes luminance statistics.
 */
export function preprocessImageData(
  imageData: ImageData,
  applyClahe: boolean = true,
  clipLimit: number = 2.5
): PreprocessedImage {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  const grayscale = new Uint8Array(pixelCount);

  let sumLuminance = 0;
  let sumSqLuminance = 0;

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // Rec. 601 Luma formula: Y = 0.299*R + 0.587*G + 0.114*B
    const gray = (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114 + 500) / 1000 | 0;
    grayscale[j] = gray;
    sumLuminance += gray;
    sumSqLuminance += gray * gray;
  }

  const meanLuminance = sumLuminance / pixelCount;
  const variance = Math.max(0, sumSqLuminance / pixelCount - meanLuminance * meanLuminance);
  const contrastStdDev = Math.sqrt(variance);

  const claheData = applyClahe
    ? runClahe(grayscale, width, height, 8, 8, clipLimit)
    : grayscale;

  const smoothed = smooth5x5(claheData, width, height);

  return {
    width,
    height,
    grayscale,
    clahe: claheData,
    smoothed,
    meanLuminance,
    contrastStdDev,
  };
}

/**
 * Creates multi-scale pyramid levels for scale/zoom invariance.
 */
export function buildImagePyramid(
  baseImage: PreprocessedImage,
  numLevels: number = 3,
  scaleFactor: number = 1.25
): PyramidLevel[] {
  const levels: PyramidLevel[] = [
    {
      level: 0,
      scale: 1.0,
      width: baseImage.width,
      height: baseImage.height,
      image: baseImage,
    },
  ];

  let currentW = baseImage.width;
  let currentH = baseImage.height;
  let currentGray = baseImage.grayscale;
  let currentScale = 1.0;

  for (let l = 1; l < numLevels; l++) {
    currentScale /= scaleFactor;
    const nextW = Math.max(64, Math.floor((currentW / scaleFactor) / 2) * 2);
    const nextH = Math.max(48, Math.floor((currentH / scaleFactor) / 2) * 2);

    const downscaledGray = downscaleBilinear(currentGray, currentW, currentH, nextW, nextH);
    const clahe = runClahe(downscaledGray, nextW, nextH, 6, 6, 2.5);
    const smoothed = smooth5x5(clahe, nextW, nextH);

    levels.push({
      level: l,
      scale: currentScale,
      width: nextW,
      height: nextH,
      image: {
        width: nextW,
        height: nextH,
        grayscale: downscaledGray,
        clahe,
        smoothed,
        meanLuminance: baseImage.meanLuminance,
        contrastStdDev: baseImage.contrastStdDev,
      },
    });

    currentW = nextW;
    currentH = nextH;
    currentGray = downscaledGray;
  }

  return levels;
}

/**
 * Contrast Limited Adaptive Histogram Equalization (CLAHE).
 * Prevents over-amplification of noise while balancing regional illumination.
 */
export function runClahe(
  input: Uint8Array,
  width: number,
  height: number,
  gridCols: number = 8,
  gridRows: number = 8,
  clipLimitFactor: number = 2.5
): Uint8Array {
  const output = new Uint8Array(width * height);
  const tileW = Math.floor(width / gridCols);
  const tileH = Math.floor(height / gridRows);

  if (tileW < 4 || tileH < 4) {
    return input;
  }

  const cdfs: Float32Array[] = new Array(gridRows * gridCols);
  const hist = new Int32Array(256);

  for (let r = 0; r < gridRows; r++) {
    const yStart = r * tileH;
    const yEnd = r === gridRows - 1 ? height : yStart + tileH;

    for (let c = 0; c < gridCols; c++) {
      const xStart = c * tileW;
      const xEnd = c === gridCols - 1 ? width : xStart + tileW;
      const actualPixels = (yEnd - yStart) * (xEnd - xStart);

      // Build tile histogram
      hist.fill(0);
      for (let y = yStart; y < yEnd; y++) {
        const rowOffset = y * width;
        for (let x = xStart; x < xEnd; x++) {
          hist[input[rowOffset + x]]++;
        }
      }

      // Clip histogram
      const clipLimit = Math.max(1, Math.round(clipLimitFactor * (actualPixels / 256)));
      let excess = 0;
      for (let b = 0; b < 256; b++) {
        if (hist[b] > clipLimit) {
          excess += hist[b] - clipLimit;
          hist[b] = clipLimit;
        }
      }

      // Redistribute excess evenly
      const bonusPerBin = Math.floor(excess / 256);
      const remainder = excess % 256;
      for (let b = 0; b < 256; b++) {
        hist[b] += bonusPerBin;
        if (b < remainder) hist[b]++;
      }

      // Compute CDF mapping [0..255]
      const cdf = new Float32Array(256);
      let cumulative = 0;
      for (let b = 0; b < 256; b++) {
        cumulative += hist[b];
        cdf[b] = (cumulative / actualPixels) * 255;
      }
      cdfs[r * gridCols + c] = cdf;
    }
  }

  // Bilinear interpolation between neighboring tile CDFs
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    const rFloat = (y - tileH / 2) / tileH;
    let r1 = Math.floor(rFloat);
    let r2 = r1 + 1;
    const yWeight = Math.max(0, Math.min(1, rFloat - r1));

    r1 = Math.max(0, Math.min(gridRows - 1, r1));
    r2 = Math.max(0, Math.min(gridRows - 1, r2));

    for (let x = 0; x < width; x++) {
      const val = input[rowOffset + x];
      const cFloat = (x - tileW / 2) / tileW;
      let c1 = Math.floor(cFloat);
      let c2 = c1 + 1;
      const xWeight = Math.max(0, Math.min(1, cFloat - c1));

      c1 = Math.max(0, Math.min(gridCols - 1, c1));
      c2 = Math.max(0, Math.min(gridCols - 1, c2));

      const m11 = cdfs[r1 * gridCols + c1][val];
      const m12 = cdfs[r1 * gridCols + c2][val];
      const m21 = cdfs[r2 * gridCols + c1][val];
      const m22 = cdfs[r2 * gridCols + c2][val];

      const top = m11 * (1 - xWeight) + m12 * xWeight;
      const bottom = m21 * (1 - xWeight) + m22 * xWeight;
      const interpolated = top * (1 - yWeight) + bottom * yWeight;

      output[rowOffset + x] = Math.max(0, Math.min(255, Math.round(interpolated)));
    }
  }

  return output;
}

/**
 * Loads an image from dataURL or File into an HTMLImageElement.
 */
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image file'));
    img.src = url;
  });
}

/**
 * Resizes an image if needed to fit maxDimension while preserving aspect ratio.
 */
export function extractImageData(
  img: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  maxDimension: number = 640
): { imageData: ImageData; width: number; height: number; scaleFactor: number; canvas: HTMLCanvasElement } {
  const origW = img instanceof HTMLVideoElement ? img.videoWidth : img.width;
  const origH = img instanceof HTMLVideoElement ? img.videoHeight : img.height;

  let targetW = origW;
  let targetH = origH;
  let scaleFactor = 1.0;

  if (origW > maxDimension || origH > maxDimension) {
    if (origW >= origH) {
      scaleFactor = maxDimension / origW;
      targetW = maxDimension;
      targetH = Math.round(origH * scaleFactor);
    } else {
      scaleFactor = maxDimension / origH;
      targetH = maxDimension;
      targetW = Math.round(origW * scaleFactor);
    }
  }

  targetW = Math.max(32, Math.floor(targetW / 2) * 2);
  targetH = Math.max(32, Math.floor(targetH / 2) * 2);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context creation failed');
  }

  ctx.drawImage(img, 0, 0, targetW, targetH);
  const imageData = ctx.getImageData(0, 0, targetW, targetH);

  return { imageData, width: targetW, height: targetH, scaleFactor, canvas };
}
