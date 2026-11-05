import React from 'react';
import { Sliders, RotateCcw, Info, Check, ShieldAlert } from 'lucide-react';
import { AnalysisConfig } from '../types';
import { DEFAULT_CONFIG } from '../computer_vision/cv_pipeline';

interface ConfigurationPanelProps {
  config: AnalysisConfig;
  onChangeConfig: (newConfig: AnalysisConfig) => void;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  config,
  onChangeConfig,
}) => {
  const updateField = <K extends keyof AnalysisConfig>(key: K, value: AnalysisConfig[K]) => {
    onChangeConfig({
      ...config,
      [key]: value,
    });
  };

  const handleReset = () => {
    onChangeConfig({ ...DEFAULT_CONFIG });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Computer Vision & Threshold Configuration
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Calibrate geometric tolerances, consecutive-frame confirmation filters, and lighting variation thresholds for the specific monitoring environment.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to Defaults</span>
          </button>
        </div>
      </div>

      {/* Grid of Config Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Geometric Shift Tolerances */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Sliders className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Geometric Tolerances (Camera Movement)
            </h2>
          </div>

          {/* Translation Threshold (px) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">
                Translation Shift Threshold (px)
              </span>
              <span className="font-mono text-sky-400 tabular-nums">
                {config.translationThresholdPx} px
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={config.translationThresholdPx}
              onChange={(e) => updateField('translationThresholdPx', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-sky-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Displacement distance above this threshold triggers VIEWPOINT SHIFT DETECTED.
            </p>
          </div>

          {/* Rotation Threshold (deg) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">
                Rotation Angle Threshold (°)
              </span>
              <span className="font-mono text-sky-400 tabular-nums">
                {config.rotationThresholdDeg}°
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="15.0"
              step="0.5"
              value={config.rotationThresholdDeg}
              onChange={(e) => updateField('rotationThresholdDeg', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-sky-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              In-plane camera rotation angle (e.g. loosened mount) triggering ROTATION DETECTED.
            </p>
          </div>

          {/* Zoom / Scale Threshold (%) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">
                Zoom / Scale Change Threshold (%)
              </span>
              <span className="font-mono text-sky-400 tabular-nums">
                ±{config.zoomThresholdPercent}%
              </span>
            </div>
            <input
              type="range"
              min="2.0"
              max="25.0"
              step="0.5"
              value={config.zoomThresholdPercent}
              onChange={(e) => updateField('zoomThresholdPercent', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-sky-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Optical or digital zoom focal scale variation triggering ZOOM CHANGE DETECTED.
            </p>
          </div>
        </div>

        {/* Section 2: Consistency, Lighting & Noise Filters */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldAlert className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Consistency, Photometrics & Noise Control
            </h2>
          </div>

          {/* Minimum Scene Consistency (%) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">
                Minimum Scene Consistency Score (%)
              </span>
              <span className="font-mono text-emerald-400 tabular-nums">
                {config.minSceneConsistencyPercent}%
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="80"
              step="1"
              value={config.minSceneConsistencyPercent}
              onChange={(e) => updateField('minSceneConsistencyPercent', parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-emerald-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              If inlier consensus drops below this value without geometric explanation, classified as SCENE CHANGE DETECTED.
            </p>
          </div>

          {/* Brightness Variation Tolerance (%) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">
                Brightness Variation Tolerance (%)
              </span>
              <span className="font-mono text-sky-400 tabular-nums">
                {config.brightnessTolerancePercent}%
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              step="1"
              value={config.brightnessTolerancePercent}
              onChange={(e) => updateField('brightnessTolerancePercent', parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-sky-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Luminance changes below this tolerance are classified as nominal; larger stable shifts are classified as LIGHTING VARIATION without false camera-shift alarms.
            </p>
          </div>

          {/* Consecutive Confirmation Count */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-300">
                Consecutive-Frame Confirmation Count
              </span>
              <span className="font-mono text-purple-400 tabular-nums">
                {config.consecutiveConfirmationCount} frames
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={config.consecutiveConfirmationCount}
              onChange={(e) => updateField('consecutiveConfirmationCount', parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-purple-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Suppresses 1-frame transient occlusions (e.g. someone walking by) before confirming an event.
            </p>
          </div>
        </div>

        {/* Section 3: Feature Detection & CLAHE */}
        <div className="md:col-span-2 rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Info className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              ORB Feature & Preprocessing Tuning
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-300 block">
                Max Keypoints Extracted: {config.maxFeatures}
              </span>
              <input
                type="range"
                min="100"
                max="800"
                step="50"
                value={config.maxFeatures}
                onChange={(e) => updateField('maxFeatures', parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-sky-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">Target FAST-9 corners per frame</p>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-300 block">
                Min Features Required: {config.minKeypointsRequired}
              </span>
              <input
                type="range"
                min="15"
                max="80"
                step="5"
                value={config.minKeypointsRequired}
                onChange={(e) => updateField('minKeypointsRequired', parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded appearance-none accent-sky-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">Below this warns INSUFFICIENT FEATURES</p>
            </div>

            <div className="space-y-2 pt-1">
              <span className="text-xs font-medium text-slate-300 block">
                CLAHE Contrast Normalization
              </span>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useClahe}
                  onChange={(e) => updateField('useClahe', e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-sky-400 focus:ring-0"
                />
                <span>Enable adaptive histogram equalization</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Crucial for challenging CCTV illumination shifts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
