/**
 * Geometric Transformation & RANSAC Estimator Module
 * Estimates 2D geometric transformation (Translation dx/dy, Rotation theta, Scale s)
 * between reference and current frames using RANSAC inlier consensus and least-squares refit.
 */

import { MatchPair, TransformationParameters } from '../types';

export interface RansacResult {
  transformation: TransformationParameters;
  inliersCount: number;
  inlierRatio: number;
  spatialSpreadRatio: number;
  reprojectionError: number;
  updatedMatches: MatchPair[];
  success: boolean;
  message?: string;
}

/**
 * Solves a 2D similarity transform from 2 point correspondences:
 * [x'] = [ a  -b ] [x] + [tx]
 * [y'] = [ b   a ] [y] + [ty]
 */
function solveSimilarity2Points(
  p1: [number, number],
  p1Prime: [number, number],
  p2: [number, number],
  p2Prime: [number, number]
): { a: number; b: number; tx: number; ty: number } | null {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const denom = dx * dx + dy * dy;

  if (denom < 1e-6) {
    return null; // degenerate points (coincident)
  }

  const dxPrime = p1Prime[0] - p2Prime[0];
  const dyPrime = p1Prime[1] - p2Prime[1];

  const a = (dx * dxPrime + dy * dyPrime) / denom;
  const b = (dx * dyPrime - dy * dxPrime) / denom;

  const tx = p1Prime[0] - (a * p1[0] - b * p1[1]);
  const ty = p1Prime[1] - (b * p1[0] + a * p1[1]);

  return { a, b, tx, ty };
}

/**
 * Refits 2D similarity transform on all inliers via Ordinary Least Squares (OLS)
 */
function refitSimilarityLeastSquares(
  inliers: MatchPair[]
): { a: number; b: number; tx: number; ty: number } {
  const n = inliers.length;
  if (n < 2) {
    return { a: 1, b: 0, tx: 0, ty: 0 };
  }

  // System of equations:
  // For each point:
  // x' = a*x - b*y + tx
  // y' = b*x + a*y + ty
  let s_x = 0, s_y = 0, s_xp = 0, s_yp = 0;
  let s_xx = 0, s_yy = 0;
  let s_x_xp = 0, s_y_yp = 0, s_y_xp = 0, s_x_yp = 0;

  for (let i = 0; i < n; i++) {
    const x = inliers[i].pt1[0];
    const y = inliers[i].pt1[1];
    const xp = inliers[i].pt2[0];
    const yp = inliers[i].pt2[1];

    s_x += x;
    s_y += y;
    s_xp += xp;
    s_yp += yp;
    s_xx += x * x;
    s_yy += y * y;
    s_x_xp += x * xp;
    s_y_yp += y * yp;
    s_y_xp += y * xp;
    s_x_yp += x * yp;
  }

  const mx = s_x / n;
  const my = s_y / n;
  const mxp = s_xp / n;
  const myp = s_yp / n;

  let numA = 0;
  let numB = 0;
  let den = 0;

  for (let i = 0; i < n; i++) {
    const u = inliers[i].pt1[0] - mx;
    const v = inliers[i].pt1[1] - my;
    const up = inliers[i].pt2[0] - mxp;
    const vp = inliers[i].pt2[1] - myp;

    numA += u * up + v * vp;
    numB += u * vp - v * up;
    den += u * u + v * v;
  }

  if (den < 1e-6) {
    return { a: 1, b: 0, tx: mxp - mx, ty: myp - my };
  }

  const a = numA / den;
  const b = numB / den;
  const tx = mxp - (a * mx - b * my);
  const ty = myp - (b * mx + a * my);

  return { a, b, tx, ty };
}

/**
 * Estimates geometric transformation using RANSAC.
 */
export function estimateTransformationRansac(
  matches: MatchPair[],
  frameWidth: number,
  frameHeight: number,
  options: {
    maxIterations?: number;
    distanceThresholdPx?: number;
    minInliersRatio?: number;
  } = {}
): RansacResult {
  const {
    maxIterations = 600,
    distanceThresholdPx = 4.5,
  } = options;

  const totalMatches = matches.length;
  const frameDiagonal = Math.sqrt(frameWidth * frameWidth + frameHeight * frameHeight);

  // Identity fallback
  const defaultTransformation: TransformationParameters = {
    translationX: 0,
    translationY: 0,
    translationDistance: 0,
    translationPercent: 0,
    rotationDegrees: 0,
    scaleChange: 1.0,
    reprojectionError: 0,
    matrix: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
  };

  if (totalMatches < 4) {
    return {
      transformation: defaultTransformation,
      inliersCount: 0,
      inlierRatio: 0,
      spatialSpreadRatio: 0,
      reprojectionError: 999,
      updatedMatches: matches.map(m => ({ ...m, isInlier: false })),
      success: false,
      message: `Insufficient matches (${totalMatches}) for RANSAC estimation`,
    };
  }

  let bestInliersMask = new Uint8Array(totalMatches);
  let maxInlierCount = 0;
  let bestModel = { a: 1, b: 0, tx: 0, ty: 0 };

  // Run RANSAC iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    // Pick 2 distinct random points
    const idx1 = Math.floor(Math.random() * totalMatches);
    let idx2 = Math.floor(Math.random() * totalMatches);
    if (idx1 === idx2) {
      idx2 = (idx1 + 1) % totalMatches;
    }

    const m1 = matches[idx1];
    const m2 = matches[idx2];

    const model = solveSimilarity2Points(m1.pt1, m1.pt2, m2.pt1, m2.pt2);
    if (!model) continue;

    // Reject unreasonable scale (e.g. scale < 0.2 or scale > 5.0)
    const scale = Math.sqrt(model.a * model.a + model.b * model.b);
    if (scale < 0.2 || scale > 5.0) continue;

    // Count inliers
    let currentInliers = 0;
    const currentMask = new Uint8Array(totalMatches);

    for (let i = 0; i < totalMatches; i++) {
      const x = matches[i].pt1[0];
      const y = matches[i].pt1[1];
      const xp = matches[i].pt2[0];
      const yp = matches[i].pt2[1];

      // Projected point
      const projX = model.a * x - model.b * y + model.tx;
      const projY = model.b * x + model.a * y + model.ty;

      const errDist = Math.sqrt((projX - xp) * (projX - xp) + (projY - yp) * (projY - yp));

      if (errDist <= distanceThresholdPx) {
        currentMask[i] = 1;
        currentInliers++;
      }
    }

    if (currentInliers > maxInlierCount) {
      maxInlierCount = currentInliers;
      bestInliersMask = currentMask;
      bestModel = model;

      // Early termination if very high consensus reached
      if (maxInlierCount > totalMatches * 0.85 && maxInlierCount >= 20) {
        break;
      }
    }
  }

  if (maxInlierCount < 3) {
    return {
      transformation: defaultTransformation,
      inliersCount: maxInlierCount,
      inlierRatio: maxInlierCount / Math.max(1, totalMatches),
      spatialSpreadRatio: 0,
      reprojectionError: 999,
      updatedMatches: matches.map(m => ({ ...m, isInlier: false })),
      success: false,
      message: 'RANSAC failed to find consensus among matched features',
    };
  }

  // Gather inliers for final least-squares refit
  const inlierPairs: MatchPair[] = [];
  for (let i = 0; i < totalMatches; i++) {
    if (bestInliersMask[i] === 1) {
      inlierPairs.push(matches[i]);
    }
  }

  // Refine model parameters with all consensus inliers
  const refined = refitSimilarityLeastSquares(inlierPairs);

  // Compute final reprojection error over inliers
  let sumSqErr = 0;
  let minX = frameWidth;
  let maxX = 0;
  let minY = frameHeight;
  let maxY = 0;

  const updatedMatches: MatchPair[] = matches.map((m) => {
    const x = m.pt1[0];
    const y = m.pt1[1];
    const xp = m.pt2[0];
    const yp = m.pt2[1];

    const projX = refined.a * x - refined.b * y + refined.tx;
    const projY = refined.b * x + refined.a * y + refined.ty;
    const err = Math.sqrt((projX - xp) * (projX - xp) + (projY - yp) * (projY - yp));
    const isInlier = err <= distanceThresholdPx;

    if (isInlier) {
      sumSqErr += err * err;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    return {
      ...m,
      isInlier,
      reprojectionError: err,
    };
  });

  const finalInliersCount = updatedMatches.filter(m => m.isInlier).length;
  const inlierRatio = finalInliersCount / Math.max(1, totalMatches);
  const rmse = finalInliersCount > 0 ? Math.sqrt(sumSqErr / finalInliersCount) : 0;

  const spreadWidth = Math.max(0, maxX - minX);
  const spreadHeight = Math.max(0, maxY - minY);
  const spatialSpreadRatio = finalInliersCount > 0
    ? Number(((spreadWidth * spreadHeight) / Math.max(1, frameWidth * frameHeight)).toFixed(3))
    : 0;

  // Extract physical geometric parameters
  const scale = Math.sqrt(refined.a * refined.a + refined.b * refined.b);
  const rotRad = Math.atan2(refined.b, refined.a);
  const rotDeg = (rotRad * 180) / Math.PI;

  // Optical center decoupling:
  // p' = M * p + [tx, ty]^T
  // The camera's optical center is c = (frameWidth / 2, frameHeight / 2)
  // Projected optical center is c' = M * c + [tx, ty]^T
  // The true physical camera pan/tilt translation is c' - c
  const cx = frameWidth / 2;
  const cy = frameHeight / 2;
  const projCx = refined.a * cx - refined.b * cy + refined.tx;
  const projCy = refined.b * cx + refined.a * cy + refined.ty;
  const translationX = projCx - cx;
  const translationY = projCy - cy;
  const translationDist = Math.sqrt(translationX * translationX + translationY * translationY);
  const translationPercent = frameDiagonal > 0 ? (translationDist / frameDiagonal) * 100 : 0;

  const transformation: TransformationParameters = {
    translationX: Number(translationX.toFixed(2)),
    translationY: Number(translationY.toFixed(2)),
    translationDistance: Number(translationDist.toFixed(2)),
    translationPercent: Number(translationPercent.toFixed(2)),
    rotationDegrees: Number(rotDeg.toFixed(2)),
    scaleChange: Number(scale.toFixed(4)),
    reprojectionError: Number(rmse.toFixed(2)),
    matrix: [
      [Number(refined.a.toFixed(5)), Number((-refined.b).toFixed(5)), Number(refined.tx.toFixed(2))],
      [Number(refined.b.toFixed(5)), Number(refined.a.toFixed(5)), Number(refined.ty.toFixed(2))],
      [0, 0, 1],
    ],
  };

  return {
    transformation,
    inliersCount: finalInliersCount,
    inlierRatio: Number(inlierRatio.toFixed(3)),
    spatialSpreadRatio,
    reprojectionError: Number(rmse.toFixed(2)),
    updatedMatches,
    success: true,
  };
}
