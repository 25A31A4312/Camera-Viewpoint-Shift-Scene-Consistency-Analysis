/**
 * Unified Computer Vision Pipeline
 * Orchestrates image loading, preprocessing, ORB feature extraction,
 * BFMatching, RANSAC estimation, and viewpoint shift classification.
 */

import {
  AnalysisConfig,
  FeatureDescriptorSet,
  FrameAnalysisResult,
  ReferenceScene,
  VideoFrameItem,
} from '../types';
import { extractOrbFeatures } from './feature_extractor';
import { matchFeatures } from './feature_matcher';
import { estimateTransformationRansac } from './homography_estimator';
import { extractImageData, preprocessImageData } from './image_preprocessing';
import { classifyFrameViewpoint } from './viewpoint_detector';

export const DEFAULT_CONFIG: AnalysisConfig = {
  frameIntervalSeconds: 0.5,
  translationThresholdPx: 14.0,
  translationThresholdPercent: 2.8,
  rotationThresholdDeg: 2.0,
  zoomThresholdPercent: 5.0,
  minSceneConsistencyPercent: 45,
  minKeypointsRequired: 20,
  brightnessTolerancePercent: 12.0,
  consecutiveConfirmationCount: 2,
  useClahe: true,
  maxFeatures: 450,
  ransacThresholdPx: 4.5,
  ransacIterations: 600,
};

/**
 * Processes a reference image: extracts ORB features and computes baseline statistics.
 */
export async function processReferenceScene(
  source: HTMLImageElement | HTMLCanvasElement,
  name: string,
  fileSizeFormatted: string = 'N/A'
): Promise<ReferenceScene> {
  const { imageData, width, height, canvas } = extractImageData(source, 640);
  const preprocessed = preprocessImageData(imageData, true);
  const features = extractOrbFeatures(preprocessed, 500);

  return {
    id: `ref_${Date.now()}`,
    name,
    width,
    height,
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    features,
    averageLuminance: Number(preprocessed.meanLuminance.toFixed(1)),
    contrastStdDev: Number(preprocessed.contrastStdDev.toFixed(1)),
    timestamp: new Date().toLocaleTimeString(),
    fileSizeFormatted,
  };
}

/**
 * Analyzes a single incoming frame against the established reference scene.
 */
export function analyzeFrameAgainstReference(
  currentSource: HTMLImageElement | HTMLCanvasElement | ImageData,
  reference: ReferenceScene,
  config: AnalysisConfig,
  frameNumber: number,
  timestampSeconds: number,
  sourceFrameUrl?: string,
  inputFingerprint?: string
): FrameAnalysisResult {
  const startTime = performance.now();

  if (!reference.features) {
    throw new Error('Reference scene features not extracted');
  }

  // 1. Preprocess incoming frame
  let currImageData: ImageData;
  let currWidth: number;
  let currHeight: number;

  if (currentSource instanceof ImageData) {
    currImageData = currentSource;
    currWidth = currentSource.width;
    currHeight = currentSource.height;
  } else {
    const extracted = extractImageData(currentSource, 640);
    currImageData = extracted.imageData;
    currWidth = extracted.width;
    currHeight = extracted.height;
  }

  const preprocessed = preprocessImageData(currImageData, config.useClahe);

  // 2. Extract ORB features
  const currFeatures = extractOrbFeatures(preprocessed, config.maxFeatures);

  // 3. Match against reference features
  const matches = matchFeatures(currFeatures, reference.features, {
    ratioThreshold: 0.78,
    maxHammingDistance: 75,
    crossCheck: true,
  });

  // 4. Estimate geometric transformation using RANSAC
  const ransacResult = estimateTransformationRansac(
    matches,
    currWidth,
    currHeight,
    {
      maxIterations: config.ransacIterations,
      distanceThresholdPx: config.ransacThresholdPx,
    }
  );

  // 5. Compute Photometric Deltas
  const luminanceDelta = preprocessed.meanLuminance - reference.averageLuminance;
  const contrastDelta = preprocessed.contrastStdDev - reference.contrastStdDev;

  // 6. Viewpoint classification decision
  const decision = classifyFrameViewpoint(
    ransacResult,
    currFeatures.keypoints.length,
    reference.features.keypoints.length,
    luminanceDelta,
    contrastDelta,
    config
  );

  const processingTimeMs = Math.round(performance.now() - startTime);

  // Format timestamp (MM:SS.mmm)
  const mins = Math.floor(timestampSeconds / 60);
  const secs = Math.floor(timestampSeconds % 60);
  const ms = Math.floor((timestampSeconds % 1) * 1000);
  const formattedTimestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;

  const fingerprint =
    inputFingerprint ||
    `fp_${reference.id.substring(0, 8)}_f${frameNumber}_t${timestampSeconds.toFixed(1)}s_${currFeatures.keypoints.length}kp_${Math.random().toString(36).substring(2, 6)}`;

  return {
    id: `frame_${frameNumber}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    frameNumber,
    timestamp: formattedTimestamp,
    timestampSeconds: Number(timestampSeconds.toFixed(3)),
    sceneConsistencyScore: decision.sceneConsistencyScore,
    featuresDetected: currFeatures.keypoints.length,
    validMatches: matches.length,
    inliersCount: ransacResult.inliersCount,
    inlierRatio: ransacResult.inlierRatio,
    transformation: ransacResult.transformation,
    luminanceDelta: Number(luminanceDelta.toFixed(1)),
    contrastDelta: Number(contrastDelta.toFixed(1)),
    classification: decision.classification,
    cameraStatus: decision.cameraStatus,
    confidenceScore: decision.confidenceScore,
    processingTimeMs,
    matchedPoints: ransacResult.updatedMatches,
    status: decision.status,
    details: decision.details,
    homographyQuality: decision.homographyQuality,
    sourceFrameUrl,
    inputFingerprint: fingerprint,
  };
}

/**
 * Extracts sequential frames from a video file at configurable time intervals.
 */
export async function extractFramesFromVideo(
  videoFile: File,
  intervalSeconds: number = 0.5,
  onProgress?: (progress: number, currentFrame: number) => void
): Promise<VideoFrameItem[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const url = URL.createObjectURL(videoFile);
    video.src = url;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!duration || isNaN(duration) || duration <= 0) {
        URL.revokeObjectURL(url);
        reject(new Error('Invalid video duration or corrupted video file'));
        return;
      }

      const frames: VideoFrameItem[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context initialization failed'));
        return;
      }

      canvas.width = Math.min(640, video.videoWidth || 640);
      canvas.height = Math.round(canvas.width * ((video.videoHeight || 480) / (video.videoWidth || 640)));

      let currentTime = 0;
      let frameIndex = 1;
      let isSeeking = false;

      const captureFrame = () => {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

          const mins = Math.floor(currentTime / 60);
          const secs = Math.floor(currentTime % 60);
          const ms = Math.floor((currentTime % 1) * 1000);
          const timestampFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;

          frames.push({
            id: `vid_frame_${frameIndex}_${Date.now()}`,
            frameNumber: frameIndex,
            timestampSeconds: currentTime,
            timestampFormatted,
            dataUrl,
            width: canvas.width,
            height: canvas.height,
          });

          if (onProgress) {
            onProgress(Math.min(100, Math.round((currentTime / duration) * 100)), frameIndex);
          }

          frameIndex++;
          currentTime += intervalSeconds;
          seekNext();
        } catch (err: any) {
          URL.revokeObjectURL(url);
          reject(new Error(`Failed to capture frame: ${err?.message || 'Capture error'}`));
        }
      };

      const seekNext = () => {
        if (currentTime > duration) {
          URL.revokeObjectURL(url);
          resolve(frames);
          return;
        }

        if (Math.abs(video.currentTime - currentTime) < 0.001 && video.readyState >= 2) {
          captureFrame();
        } else {
          isSeeking = true;
          video.currentTime = Math.min(currentTime, duration);
        }
      };

      video.onseeked = () => {
        if (isSeeking) {
          isSeeking = false;
          captureFrame();
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Failed to decode video: ${video.error?.message || 'Unknown video error'}`));
      };

      // Start extraction loop
      seekNext();
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video file. Please check video format.'));
    };
  });
}
