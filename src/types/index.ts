export type DetectionClassification =
  | 'NORMAL VIEW'
  | 'VIEWPOINT SHIFT DETECTED'
  | 'ROTATION DETECTED'
  | 'ZOOM CHANGE DETECTED'
  | 'SCENE CHANGE DETECTED'
  | 'LIGHTING VARIATION'
  | 'INSUFFICIENT FEATURES'
  | 'ANALYSIS UNCERTAIN';

export interface Keypoint {
  x: number;
  y: number;
  response: number;
  angle: number; // in radians
  octave: number;
}

export interface FeatureDescriptorSet {
  keypoints: Keypoint[];
  descriptors: Uint8Array; // 32 bytes per keypoint (256 bits)
  width: number;
  height: number;
  averageLuminance: number;
  contrastStdDev: number;
}

export interface MatchPair {
  queryIdx: number; // index in current frame
  trainIdx: number; // index in reference frame
  distance: number; // Hamming distance
  pt1: [number, number]; // [x, y] in reference
  pt2: [number, number]; // [x, y] in current
  isInlier: boolean;
  reprojectionError?: number;
}

export interface TransformationParameters {
  translationX: number; // horizontal pixels
  translationY: number; // vertical pixels
  translationDistance: number; // euclidean distance in pixels
  translationPercent: number; // % of frame diagonal
  rotationDegrees: number; // angle in degrees (-180 to +180)
  scaleChange: number; // ratio (e.g. 1.05 = +5% zoom, 0.92 = zoom out)
  reprojectionError: number; // RMSE of inliers
  matrix: [
    [number, number, number],
    [number, number, number],
    [number, number, number]
  ];
}

export interface FrameAnalysisResult {
  id: string;
  frameNumber: number;
  timestamp: string; // "00:04.200"
  timestampSeconds: number;
  sceneConsistencyScore: number; // 0-100%
  featuresDetected: number;
  validMatches: number;
  inliersCount: number;
  inlierRatio: number; // 0.0 - 1.0
  transformation: TransformationParameters;
  luminanceDelta: number; // current - reference (-255 to +255)
  contrastDelta: number;
  classification: DetectionClassification;
  confidenceScore: number; // 0-100%
  processingTimeMs: number;
  matchedPoints: MatchPair[];
  status: 'nominal' | 'alert' | 'warning' | 'info';
  details: string;
  sourceFrameUrl?: string;
  confirmedEvent?: boolean;
}

export interface AnalysisConfig {
  frameIntervalSeconds: number; // video extraction interval (default 0.5s)
  translationThresholdPx: number; // e.g. 15px
  translationThresholdPercent: number; // e.g. 3.0%
  rotationThresholdDeg: number; // e.g. 2.5°
  zoomThresholdPercent: number; // e.g. 5.0%
  minSceneConsistencyPercent: number; // e.g. 45%
  minKeypointsRequired: number; // e.g. 25
  brightnessTolerancePercent: number; // e.g. 15%
  consecutiveConfirmationCount: number; // e.g. 2 frames to confirm event
  useClahe: boolean;
  maxFeatures: number;
  ransacThresholdPx: number;
  ransacIterations: number;
}

export interface ReferenceScene {
  id: string;
  name: string;
  width: number;
  height: number;
  dataUrl: string;
  features?: FeatureDescriptorSet;
  averageLuminance: number;
  contrastStdDev: number;
  timestamp: string;
  fileSizeFormatted: string;
}

export interface VideoFrameItem {
  id: string;
  frameNumber: number;
  timestampSeconds: number;
  timestampFormatted: string;
  dataUrl: string;
  width: number;
  height: number;
  file?: File;
}

export interface ConsistencyReport {
  generatedAt: string;
  referenceSceneName: string;
  referenceDimensions: string;
  totalFramesProcessed: number;
  normalFrames: number;
  viewpointShiftEvents: number;
  rotationEvents: number;
  zoomEvents: number;
  sceneChangeEvents: number;
  lightingOnlyEvents: number;
  insufficientFeatureFrames: number;
  averageSceneConsistency: number;
  averageProcessingTimeMs: number;
  monitoringDurationFormatted: string;
  thresholdsUsed: AnalysisConfig;
  events: Array<{
    id: string;
    frameNumber: number;
    timestamp: string;
    classification: DetectionClassification;
    consistencyScore: number;
    confidenceScore: number;
    translationPx: number;
    rotationDeg: number;
    scaleChange: number;
    details: string;
  }>;
  summaryExecutive: string;
}

export interface AnalysisSessionRecord {
  id: string; // e.g. "analysis_1730793600000_a1b2c"
  createdAt: string; // ISO date string
  formattedDate: string; // Human-readable date & time e.g. "Nov 5, 2026, 04:45 AM"
  sessionName: string; // e.g. "Surveillance Analysis #1"
  referenceScene: {
    id: string;
    name: string;
    width: number;
    height: number;
    dataUrl: string;
    averageLuminance: number;
    contrastStdDev: number;
    timestamp: string;
    fileSizeFormatted: string;
  };
  footageDetails: {
    name: string;
    totalFrames: number;
    durationFormatted: string;
    thumbnailUrl: string;
    framesSummary: Array<{
      id: string;
      frameNumber: number;
      timestampFormatted: string;
      timestampSeconds: number;
      dataUrl: string;
    }>;
  };
  summary: {
    dominantClassification: DetectionClassification;
    sceneConsistencyScore: number; // 0-100%
    confidenceScore: number; // 0-100%
    status: 'nominal' | 'alert' | 'warning' | 'info';
    maxTranslationPx: number;
    maxTranslationX: number;
    maxTranslationY: number;
    maxRotationDeg: number;
    maxScaleChangePct: number;
    anomaliesCount: number;
    normalFramesCount: number;
    totalFramesCount: number;
    executiveSummary: string;
  };
  results: FrameAnalysisResult[];
  configUsed: AnalysisConfig;
}

export interface BenchmarkScenario {
  id: string;
  title: string;
  facility: string; // e.g. "Hospital Intensive Care", "Chemistry Research Lab", "College Examination Hall", "Server Room CCTV"
  description: string;
  expectedClassification: DetectionClassification;
  referenceImage: string;
  testFrames: Array<{
    title: string;
    url: string;
    expected: DetectionClassification;
    description: string;
  }>;
}
