/**
 * Viewpoint Shift & Scene Consistency Decision Engine
 * Evaluates geometric transformation, inlier consensus, and photometric delta against
 * configurable thresholds to classify camera status and compute scene consistency.
 */

import {
  AnalysisConfig,
  DetectionClassification,
  FrameAnalysisResult,
  MatchPair,
  TransformationParameters,
} from '../types';
import { RansacResult } from './homography_estimator';

export interface ViewpointClassificationResult {
  classification: DetectionClassification;
  sceneConsistencyScore: number; // 0 - 100%
  confidenceScore: number; // 0 - 100%
  status: 'nominal' | 'alert' | 'warning' | 'info';
  details: string;
}

export function classifyFrameViewpoint(
  ransac: RansacResult,
  featuresDetected: number,
  referenceFeaturesCount: number,
  luminanceDelta: number,
  contrastDelta: number,
  config: AnalysisConfig
): ViewpointClassificationResult {
  const {
    transformation,
    inliersCount,
    inlierRatio,
    spatialSpreadRatio,
    reprojectionError,
    success,
  } = ransac;

  // 1. Check for Insufficient Features in either frame
  if (
    featuresDetected < config.minKeypointsRequired ||
    referenceFeaturesCount < config.minKeypointsRequired
  ) {
    const minNeeded = Math.max(1, config.minKeypointsRequired);
    const score = Math.round((Math.min(featuresDetected, referenceFeaturesCount) / minNeeded) * 25);
    return {
      classification: 'INSUFFICIENT FEATURES',
      sceneConsistencyScore: Math.max(5, score),
      confidenceScore: 35,
      status: 'warning',
      details: `Detected only ${featuresDetected} keypoints (minimum required: ${config.minKeypointsRequired}). Image lacks sufficient high-contrast texture or is out of focus.`,
    };
  }

  // Reference landmark retention ratio: fraction of reference features confirmed as inliers
  const retentionRatio = inliersCount / Math.max(1, referenceFeaturesCount);

  // 2. Check if RANSAC failed to find consensus or total inliers are critically low
  if (!success || inliersCount < 4) {
    if (featuresDetected >= config.minKeypointsRequired) {
      return {
        classification: 'SCENE CHANGE DETECTED',
        sceneConsistencyScore: Math.max(5, Math.round(retentionRatio * 100)),
        confidenceScore: 85,
        status: 'alert',
        details: `Geometric consensus failed (inliers: ${inliersCount}, retention: ${(retentionRatio * 100).toFixed(1)}%). Structural features do not match reference scene.`,
      };
    }

    return {
      classification: 'ANALYSIS UNCERTAIN',
      sceneConsistencyScore: 20,
      confidenceScore: 30,
      status: 'warning',
      details: `Unable to compute reliable geometric homography. RANSAC consensus not established.`,
    };
  }

  // 3. Multi-factor Scene Consistency Score
  // Reflects both retention of reference landmarks and geometric consensus quality
  const qualityFactor = Math.min(
    1.0,
    inlierRatio * 0.65 +
    (spatialSpreadRatio || 0.25) * 0.20 +
    Math.max(0, 1.0 - reprojectionError / 4.0) * 0.15
  );
  // Retention factor: saturated at 55% retention
  const retentionFactor = Math.min(1.0, retentionRatio / 0.55);
  const baseConsistency = Math.max(
    5,
    Math.min(100, Math.round(retentionFactor * qualityFactor * 100))
  );

  // 4. Statistical Confidence Score
  const confidenceScore = Math.min(
    99,
    Math.round(45 + Math.min(40, inliersCount * 1.5) + inlierRatio * 15)
  );

  // 5. Geometric Deviations & Normalized Violation Severities
  const translationPx = transformation.translationDistance;
  const translationPct = transformation.translationPercent;
  const absRotationDeg = Math.abs(transformation.rotationDegrees);
  const zoomDeviationPct = Math.abs(transformation.scaleChange - 1.0) * 100;
  const absLuminanceDelta = Math.abs(luminanceDelta);
  const luminanceDeltaPct = (absLuminanceDelta / 255) * 100;

  const rotSeverity = absRotationDeg / Math.max(0.1, config.rotationThresholdDeg);
  const transSeverity = Math.max(
    translationPx / Math.max(0.1, config.translationThresholdPx),
    translationPct / Math.max(0.1, config.translationThresholdPercent)
  );
  const zoomSeverity = zoomDeviationPct / Math.max(0.1, config.zoomThresholdPercent);

  const isRotationExceeded = rotSeverity >= 1.0;
  const isTranslationExceeded = transSeverity >= 1.0;
  const isZoomExceeded = zoomSeverity >= 1.0;
  const isLightingChanged = luminanceDeltaPct >= config.brightnessTolerancePercent;

  // 6. Decision Tree Hierarchy

  // Check if there is a dominant geometric transformation with valid consensus
  const hasGeometricConsensus = inliersCount >= 8 && inlierRatio >= 0.45;
  const isGeometricShift = (isRotationExceeded || isZoomExceeded || isTranslationExceeded) && hasGeometricConsensus;

  // Case A: Geometric Viewpoint Shift (Rotation, Zoom, or Translation)
  if (isGeometricShift) {
    if (rotSeverity >= transSeverity && rotSeverity >= zoomSeverity) {
      const penalty = Math.min(35, absRotationDeg * 4);
      const adjustedScore = Math.max(10, baseConsistency - penalty);
      return {
        classification: 'ROTATION DETECTED',
        sceneConsistencyScore: Math.round(adjustedScore),
        confidenceScore,
        status: 'alert',
        details: `Camera rotated by ${transformation.rotationDegrees > 0 ? '+' : ''}${transformation.rotationDegrees}° (threshold: ${config.rotationThresholdDeg}°). Shift: ${translationPx.toFixed(1)}px, Scale: ${(transformation.scaleChange * 100).toFixed(1)}%.`,
      };
    }

    if (zoomSeverity >= rotSeverity && zoomSeverity >= transSeverity) {
      const penalty = Math.min(35, zoomDeviationPct * 2.5);
      const adjustedScore = Math.max(10, baseConsistency - penalty);
      const zoomDir = transformation.scaleChange > 1.0 ? 'Zoom In' : 'Zoom Out';
      return {
        classification: 'ZOOM CHANGE DETECTED',
        sceneConsistencyScore: Math.round(adjustedScore),
        confidenceScore,
        status: 'alert',
        details: `Camera scale shifted to ${(transformation.scaleChange * 100).toFixed(1)}% (${zoomDir} by ${zoomDeviationPct.toFixed(1)}%, threshold: ${config.zoomThresholdPercent}%). Shift: ${translationPx.toFixed(1)}px.`,
      };
    }

    // Viewpoint Translation
    const penalty = Math.min(35, transSeverity * 12);
    const adjustedScore = Math.max(10, baseConsistency - penalty);
    return {
      classification: 'VIEWPOINT SHIFT DETECTED',
      sceneConsistencyScore: Math.round(adjustedScore),
      confidenceScore,
      status: 'alert',
      details: `Camera viewpoint shifted by ${translationPx.toFixed(1)}px (${translationPct.toFixed(1)}% diagonal, dx: ${transformation.translationX}px, dy: ${transformation.translationY}px). Threshold: ${config.translationThresholdPx}px.`,
    };
  }

  // Case B: Major structural scene change or heavy occlusion
  // Triggered when landmark retention collapsed or consistency is below threshold
  const isRetentionCollapsed = retentionRatio < 0.28 && inliersCount < 20;
  const isConsistencyBelowMin = baseConsistency < config.minSceneConsistencyPercent;
  const isSpatialCollapsed = (spatialSpreadRatio || 0) < 0.08 && featuresDetected >= config.minKeypointsRequired;

  if (isRetentionCollapsed || isConsistencyBelowMin || isSpatialCollapsed) {
    return {
      classification: 'SCENE CHANGE DETECTED',
      sceneConsistencyScore: Math.min(baseConsistency, 38),
      confidenceScore,
      status: 'alert',
      details: `Scene consistency dropped to ${baseConsistency}% (< ${config.minSceneConsistencyPercent}%). Reference feature retention is ${(retentionRatio * 100).toFixed(1)}%. Major visual elements blocked or replaced.`,
    };
  }

  // Case C: Normal View with Lighting Variation
  // Geometry is motionless within tolerances, but illumination changed
  if (isLightingChanged) {
    const lightDir = luminanceDelta > 0 ? 'brighter' : 'darker';
    return {
      classification: 'LIGHTING VARIATION',
      sceneConsistencyScore: baseConsistency,
      confidenceScore,
      status: 'info',
      details: `Illumination changed by ${luminanceDeltaPct.toFixed(1)}% (${lightDir}), but camera geometric viewpoint is stable (shift: ${translationPx.toFixed(1)}px, rot: ${transformation.rotationDegrees}°, scale: ${(transformation.scaleChange * 100).toFixed(1)}%).`,
    };
  }

  // Case D: Nominal View
  return {
    classification: 'NORMAL VIEW',
    sceneConsistencyScore: baseConsistency,
    confidenceScore,
    status: 'nominal',
    details: `Viewpoint matched reference scene within tolerances. Shift: ${translationPx.toFixed(1)}px, Rotation: ${transformation.rotationDegrees}°, Zoom: ${(transformation.scaleChange * 100).toFixed(1)}%.`,
  };
}

/**
 * Consecutive-Frame Confirmation Filter
 * Eliminates transient 1-frame glitches or brief occlusions (e.g. an arm passing in front of lens)
 * before issuing an official high-priority alert.
 */
export class ConsecutiveEventTracker {
  private lastAlertClassification: DetectionClassification | null = null;
  private consecutiveCount: number = 0;

  processFrame(classification: DetectionClassification, requiredConsecutive: number): boolean {
    if (
      classification === 'VIEWPOINT SHIFT DETECTED' ||
      classification === 'ROTATION DETECTED' ||
      classification === 'ZOOM CHANGE DETECTED' ||
      classification === 'SCENE CHANGE DETECTED'
    ) {
      if (this.lastAlertClassification === classification) {
        this.consecutiveCount++;
      } else {
        this.lastAlertClassification = classification;
        this.consecutiveCount = 1;
      }

      return this.consecutiveCount >= requiredConsecutive;
    } else {
      // Nominal or lighting reset
      this.lastAlertClassification = null;
      this.consecutiveCount = 0;
      return false;
    }
  }

  reset() {
    this.lastAlertClassification = null;
    this.consecutiveCount = 0;
  }
}
