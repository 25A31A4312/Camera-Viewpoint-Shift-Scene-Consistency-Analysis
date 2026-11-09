# Project T248: Camera Viewpoint Shift & Scene Consistency Analysis

Industrial-grade, fully functional Computer Vision web application for detecting unexpected changes in a fixed CCTV camera's viewpoint by comparing incoming footage against an uploaded reference scene.

All detection results are calculated using actual image and video feature processing: ORB (Oriented FAST and Rotated BRIEF) feature detection, Hamming distance Brute-Force Matching (BFMatcher), RANSAC geometric homography estimation, and Contrast Limited Adaptive Histogram Equalization (CLAHE).

---

## 1. Core Computer Vision Architecture

The system implements a multi-stage computer vision pipeline designed for fixed surveillance cameras in hospitals, colleges, offices, and laboratories:

```
[Incoming Video / Frames]              [Reference Baseline Scene]
           │                                       │
           ▼                                       ▼
 [CLAHE / Grayscale Normalization]       [CLAHE / Grayscale Normalization]
           │                                       │
           ▼                                       ▼
  [FAST-9 Corner Detection]               [FAST-9 Corner Detection]
  [Harris Response Scoring & NMS]         [Harris Response Scoring & NMS]
  [Intensity Centroid Orientation]        [Intensity Centroid Orientation]
  [Steered 256-bit BRIEF Descriptors]     [Steered 256-bit BRIEF Descriptors]
           │                                       │
           └───────────────────┬───────────────────┘
                               ▼
            [Hamming Distance BFMatcher with Cross-Check]
            [Lowe's Ratio Test Filtering (d1 / d2 < 0.78)]
                               │
                               ▼
               [RANSAC 2D Similarity Estimation]
                     (500+ consensus iterations)
                               │
                               ▼
          [Ordinary Least Squares Refit on All Inliers]
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
 [Physical Geometric Parameters]        [Photometric Discrimination]
 - Translation dx, dy (px)              - Mean Luminance Δ
 - Translation Distance (% diag)        - Contrast Variance Δ
 - Rotation Angle θ (degrees)           - Geometric Invariant Check
 - Scale / Zoom Factor s (ratio)
 - Inlier Consensus Ratio
 - Inlier Reprojection RMSE
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
                  [Viewpoint Classification]
             - NORMAL VIEW
             - VIEWPOINT SHIFT DETECTED
             - ROTATION DETECTED
             - ZOOM CHANGE DETECTED
             - SCENE CHANGE DETECTED
             - LIGHTING VARIATION (No false camera shift!)
             - INSUFFICIENT FEATURES
             - ANALYSIS UNCERTAIN
                               │
                               ▼
            [Consecutive-Frame Confirmation Filter]
```

---

## 2. Key Modules & Features

### A. Dashboard Overview
- Real-time KPIs calculated from actual frame analyses: Total Analyzed Frames, Viewpoint Shifts Detected, Rotation/Zoom Anomalies, and Average Scene Consistency.
- Fixed CCTV monitoring state badge.
- Recent frame activity table with millisecond timestamps and coordinates.

### B. Baseline Reference Scene Management
- Upload JPG, JPEG, PNG, BMP, and WEBP reference images.
- Automatic extraction and display of visual anchor count, image dimensions, and luminance profile.
- Pre-packaged calibrated baseline presets for Office Corridors, Hospital ICU, Chemistry Laboratories, and College Examination Halls.

### C. Video & Frame Ingestion
- **Video Files**: MP4, WEBM, MOV, AVI, and MKV with configurable frame sampling interval (0.1s – 2.0s). Preserves video timestamps.
- **Image Sequences**: Multi-image batch upload sorted chronologically.
- **Surveillance Stream Simulator**: Synthesizes a 12-frame CCTV sequence testing vibration, camera shift, tilt, zoom change, and illumination drops.

### D. Live Analysis & Vector Matching Visualization
- Interactive HTML5 canvas rendering ORB keypoints on reference and current frames.
- Green vector lines for confirmed RANSAC geometric inliers; amber lines for discarded outliers.
- Aligned difference perspective overlay displaying sub-pixel camera shifts.
- Scrubber controls with Play/Pause, step-by-step frame inspection, and 1x/2x/4x speed selector.
- 6 comprehensive metric cards: Translation (dx, dy), Rotation (°), Zoom (%), Inliers / Matches, Reprojection RMSE, and Luminance Δ.

### E. Configuration & Tolerances
- Configurable translation threshold (px and % diagonal).
- Configurable rotation threshold (°).
- Configurable zoom/scale tolerance (%).
- Minimum scene consistency threshold (%).
- Brightness variation tolerance (%).
- Consecutive-frame confirmation count to prevent false alarms from temporary 1-frame occlusions.

### F. Validation Benchmark Suite (8 Required Test Scenarios)
Built-in automated testing suite validating compliance against all 8 specifications:
1. **Normal Scene Consistency** &rarr; `NORMAL VIEW`
2. **Camera Rotation** &rarr; `ROTATION DETECTED`
3. **Camera Translation (Shift)** &rarr; `VIEWPOINT SHIFT DETECTED`
4. **Zoom Change** &rarr; `ZOOM CHANGE DETECTED`
5. **Lighting Variation** &rarr; `LIGHTING VARIATION` (geometric stability confirmed, no false camera-shift alarm!)
6. **Unexpected Scene Change** &rarr; `SCENE CHANGE DETECTED`
7. **Insufficient Visual Features** &rarr; `INSUFFICIENT FEATURES`
8. **Multiple Chronological Frames** &rarr; Sequential timestamp ordering and history verification.

### G. Formal Scene Consistency Reports
- Audit-grade executive summary narrative.
- Responsive vector charts: Consistency score timeline and camera translation displacement.
- Anomaly event logs with full diagnostics.
- Instant Export to CSV, Export to JSON, and Print / PDF generation.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js, Express, Vite dev middleware
- **Computer Vision**: In-browser zero-dependency ORB feature extractor, Hamming BFMatcher, RANSAC geometric estimator, CLAHE contrast normalizer
- **Storage**: Persistent JSON database in `data/monitoring_database.json` and client-side localStorage cache

---

## 4. Setup & Running Locally

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
# Clone or navigate to the project directory
cd /path/to/project

# Install dependencies
npm install
```

### Development
```bash
npm run dev
```
The server will start at `http://localhost:3000`.

### Production Build
```bash
npm run build
npm start
```
