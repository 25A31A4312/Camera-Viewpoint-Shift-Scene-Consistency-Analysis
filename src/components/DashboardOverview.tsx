import React from 'react';
import {
  Camera,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RotateCw,
  Maximize2,
  Sun,
  ShieldCheck,
  ArrowRight,
  Layers,
  Clock,
  Cpu,
  Zap,
  Info,
} from 'lucide-react';
import { AnalysisConfig, FrameAnalysisResult, ReferenceScene } from '../types';
import { ActiveTab } from './Navbar';

interface DashboardOverviewProps {
  results: FrameAnalysisResult[];
  reference: ReferenceScene | null;
  config: AnalysisConfig;
  onNavigate: (tab: ActiveTab) => void;
  onRunBenchmark: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  results,
  reference,
  config,
  onNavigate,
  onRunBenchmark,
}) => {
  const totalFrames = results.length;
  const normalFrames = results.filter(r => r.classification === 'NORMAL VIEW').length;
  const shiftFrames = results.filter(r => r.classification === 'VIEWPOINT SHIFT DETECTED').length;
  const rotationFrames = results.filter(r => r.classification === 'ROTATION DETECTED').length;
  const zoomFrames = results.filter(r => r.classification === 'ZOOM CHANGE DETECTED').length;
  const sceneChangeFrames = results.filter(r => r.classification === 'SCENE CHANGE DETECTED').length;
  const lightingFrames = results.filter(r => r.classification === 'LIGHTING VARIATION').length;
  const insufficientFrames = results.filter(r => r.classification === 'INSUFFICIENT FEATURES').length;

  const totalAnomalies = shiftFrames + rotationFrames + zoomFrames + sceneChangeFrames;

  const averageConsistency = totalFrames > 0
    ? Math.round(results.reduce((acc, r) => acc + r.sceneConsistencyScore, 0) / totalFrames)
    : null;

  const averageProcessingTimeMs = totalFrames > 0
    ? Math.round(results.reduce((acc, r) => acc + r.processingTimeMs, 0) / totalFrames)
    : null;

  const averageInliers = totalFrames > 0
    ? Math.round(results.reduce((acc, r) => acc + r.inliersCount, 0) / totalFrames)
    : null;

  const averageFeatures = totalFrames > 0
    ? Math.round(results.reduce((acc, r) => acc + r.featuresDetected, 0) / totalFrames)
    : null;

  const estimatedFps = averageProcessingTimeMs && averageProcessingTimeMs > 0
    ? (1000 / averageProcessingTimeMs).toFixed(1)
    : 'N/A';

  const latestResult = results.length > 0 ? results[results.length - 1] : null;

  // Accurate Monitoring Status derivation
  const getAccurateStatus = () => {
    if (!reference) {
      return {
        label: 'STANDBY · NO REFERENCE ESTABLISHED',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        summary: 'Awaiting reference image upload to calibrate visual anchors.',
      };
    }

    if (totalFrames === 0) {
      return {
        label: 'MONITORING STANDBY (AWAITING FOOTAGE)',
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        summary: 'Baseline reference active. Load video footage or image frames to begin real-time analysis.',
      };
    }

    switch (latestResult?.classification) {
      case 'NORMAL VIEW':
        return {
          cameraStatus: 'Stable',
          label: 'CAMERA STATUS: STABLE · NOMINAL VIEWPOINT',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
          summary: 'Camera viewpoint is aligned with calibrated baseline within established tolerances.',
        };
      case 'VIEWPOINT SHIFT DETECTED':
        return {
          cameraStatus: 'Shift Detected',
          label: 'CAMERA STATUS: SHIFT DETECTED · DISPLACEMENT ALERT',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          summary: `Physical camera translation detected (${latestResult.transformation.translationDistance}px shift: dx=${latestResult.transformation.translationX}px, dy=${latestResult.transformation.translationY}px).`,
        };
      case 'ROTATION DETECTED':
        return {
          cameraStatus: 'Rotation Detected',
          label: 'CAMERA STATUS: ROTATION DETECTED · ORIENTATION ALERT',
          color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
          summary: `Camera rotated by ${latestResult.transformation.rotationDegrees}° around optical axis.`,
        };
      case 'ZOOM CHANGE DETECTED':
        return {
          cameraStatus: 'Zoom Detected',
          label: 'CAMERA STATUS: ZOOM DETECTED · SCALE SHIFT',
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
          summary: `Optical or digital zoom shifted to ${(latestResult.transformation.scaleChange * 100).toFixed(1)}%.`,
        };
      case 'SCENE CHANGE DETECTED':
        return {
          cameraStatus: 'Scene Discrepancy',
          label: 'CAMERA STATUS: SCENE DISCREPANCY DETECTED',
          color: 'text-red-400 bg-red-500/10 border-red-500/30',
          summary: 'Substantial structural difference or severe occlusion between incoming frame and baseline.',
        };
      case 'LIGHTING VARIATION':
        return {
          cameraStatus: 'Stable',
          label: 'CAMERA STATUS: STABLE · LIGHTING VARIATION (GEOMETRY CONFIRMED)',
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
          summary: `Illumination shifted (ΔL: ${latestResult.luminanceDelta}), but camera geometric alignment is confirmed stable. No movement alert.`,
        };
      case 'INSUFFICIENT FEATURES':
        return {
          cameraStatus: 'Insufficient Features',
          label: 'CAMERA STATUS: INSUFFICIENT FEATURES',
          color: 'text-amber-300 bg-amber-400/10 border-amber-400/30',
          summary: `Frame contains only ${latestResult.featuresDetected} keypoints (< ${config.minKeypointsRequired} required).`,
        };
      case 'ANALYSIS UNCERTAIN':
        return {
          cameraStatus: 'Uncertain',
          label: 'CAMERA STATUS: UNCERTAIN (HOMOGRAPHY UNVERIFIED)',
          color: 'text-slate-300 bg-slate-700/30 border-slate-600/40',
          summary: 'RANSAC consensus not established. Geometric homography could not be verified.',
        };
      default:
        return {
          cameraStatus: 'Active',
          label: 'ACTIVE MONITORING',
          color: 'text-slate-400 bg-slate-800 border-slate-700',
          summary: 'Camera frames under automated surveillance evaluation.',
        };
    }
  };

  const status = getAccurateStatus();

  // SVG Trend Chart Dimensions
  const chartW = 600;
  const chartH = 120;
  const pad = 24;

  const trendPoints = totalFrames > 1
    ? results.map((r, i) => {
        const x = pad + (i / (totalFrames - 1)) * (chartW - 2 * pad);
        const y = chartH - pad - (r.sceneConsistencyScore / 100) * (chartH - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ')
    : '';

  return (
    <div className="space-y-6">
      {/* Top Banner / Accurate Monitoring Status */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Monitoring Status
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded border font-semibold ${status.color}`}>
                {status.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {reference ? reference.name : 'No Reference Scene Calibrated'}
            </h1>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              {status.summary}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('reference')}
              className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
            >
              {reference ? 'Manage Baseline' : 'Upload Reference'}
            </button>
            <button
              onClick={() => onNavigate('analysis')}
              className="px-3.5 py-2 text-xs font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 rounded font-semibold transition-colors"
            >
              Open Live Analysis
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metric Cards (With N/A for empty states) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Evaluated Frames</span>
            <Layers className="h-4 w-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            {totalFrames}
          </div>
          <div className="text-xs text-slate-500">
            {totalFrames > 0 ? 'Sequential timeline' : 'No frames loaded'}
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Scene Consistency</span>
            <TrendingUp className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 font-mono tabular-nums">
            {averageConsistency !== null ? `${averageConsistency}%` : 'N/A'}
          </div>
          <div className="text-xs text-slate-500">
            {totalFrames > 0 ? 'Inlier consensus avg' : 'Requires frame evaluation'}
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Normal Frames</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
            {normalFrames}
          </div>
          <div className="text-xs text-slate-500">
            {totalFrames > 0
              ? `${((normalFrames / totalFrames) * 100).toFixed(0)}% of footage`
              : 'N/A'}
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Viewpoint Shifts</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
            {totalAnomalies}
          </div>
          <div className="text-xs text-slate-500">
            {totalFrames > 0
              ? `${shiftFrames} shift · ${rotationFrames} rot · ${zoomFrames} zoom`
              : 'N/A'}
          </div>
        </div>
      </div>

      {/* Scene Consistency Trend Chart on Dashboard */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Scene Consistency Trend Over Time
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            {averageConsistency !== null ? (
              <>
                <span className="text-slate-400">Mean: <strong className="text-sky-400">{averageConsistency}%</strong></span>
                <span aria-hidden="true" className="text-slate-700">·</span>
                <span className="text-red-400">Threshold: {config.minSceneConsistencyPercent}%</span>
              </>
            ) : (
              <span className="text-slate-500">Trend Data: N/A</span>
            )}
          </div>
        </div>

        {totalFrames > 1 ? (
          <div className="space-y-2">
            <div className="h-32 w-full bg-slate-950/80 rounded border border-slate-800/80 p-2 flex items-center justify-center">
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-full">
                {/* Horizontal grid lines */}
                <line x1={pad} y1={pad} x2={chartW - pad} y2={pad} stroke="#1e293b" strokeDasharray="3 3" />
                <line x1={pad} y1={chartH / 2} x2={chartW - pad} y2={chartH / 2} stroke="#1e293b" strokeDasharray="3 3" />
                <line x1={pad} y1={chartH - pad} x2={chartW - pad} y2={chartH - pad} stroke="#334155" />

                {/* Minimum Consistency Threshold Line */}
                <line
                  x1={pad}
                  y1={chartH - pad - (config.minSceneConsistencyPercent / 100) * (chartH - 2 * pad)}
                  x2={chartW - pad}
                  y2={chartH - pad - (config.minSceneConsistencyPercent / 100) * (chartH - 2 * pad)}
                  stroke="#ef4444"
                  strokeDasharray="4 2"
                  strokeWidth="1.2"
                />

                {/* Consistency Polyline */}
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  points={trendPoints}
                />
              </svg>
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Start: Frame #1 ({results[0].timestamp})</span>
              <span className="text-red-400">--- Min Threshold ({config.minSceneConsistencyPercent}%)</span>
              <span>Latest: Frame #{totalFrames} ({results[totalFrames - 1].timestamp})</span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            {totalFrames === 1
              ? 'Only 1 frame evaluated. Add more frames to view the continuous consistency trend.'
              : 'Scene consistency trend chart will render automatically once video footage or sequential frames are processed.'}
          </div>
        )}
      </div>

      {/* Actual Computer Vision Processing Statistics */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Actual Computer Vision Processing Statistics
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Client-Side ORB/RANSAC Engine
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Avg Latency</span>
            <div className="text-sm font-semibold text-white font-mono tabular-nums">
              {averageProcessingTimeMs !== null ? `${averageProcessingTimeMs} ms` : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500 block">Per frame decode & fit</span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Throughput</span>
            <div className="text-sm font-semibold text-sky-400 font-mono tabular-nums">
              {estimatedFps !== 'N/A' ? `${estimatedFps} FPS` : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500 block">Estimated processing rate</span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Avg Features</span>
            <div className="text-sm font-semibold text-white font-mono tabular-nums">
              {averageFeatures !== null ? averageFeatures : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500 block">FAST-9 keypoints / frame</span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Avg RANSAC Inliers</span>
            <div className="text-sm font-semibold text-emerald-400 font-mono tabular-nums">
              {averageInliers !== null ? averageInliers : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500 block">Geometric consensus</span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Frame Resolution</span>
            <div className="text-sm font-semibold text-white font-mono">
              {reference ? `${reference.width}×${reference.height}` : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500 block">Active processing canvas</span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Lighting Tolerance</span>
            <div className="text-sm font-semibold text-slate-300 font-mono tabular-nums">
              ±{config.brightnessTolerancePercent}%
            </div>
            <span className="text-[10px] text-slate-500 block">CLAHE Normalized</span>
          </div>
        </div>
      </div>

      {/* 2-Column Split: Latest Detection vs Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Detection Event */}
        <div className="lg:col-span-2 rounded-lg border border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h2 className="text-sm font-semibold text-slate-200">
              Latest Analyzed Frame
            </h2>
            {latestResult && (
              <span className="text-xs font-mono text-slate-400">
                Frame #{latestResult.frameNumber} · {latestResult.timestamp}
              </span>
            )}
          </div>

          {latestResult ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-slate-500">Camera Status:</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold font-mono border ${
                        latestResult.cameraStatus === 'Stable'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : latestResult.cameraStatus === 'Shift Detected'
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                          : latestResult.cameraStatus === 'Rotation Detected'
                          ? 'text-orange-400 bg-orange-500/10 border-orange-500/30'
                          : 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                      }`}
                    >
                      {latestResult.cameraStatus || 'Stable'}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {latestResult.classification}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 block mb-0.5">Consistency / Conf</span>
                  <div className="text-base font-bold text-sky-400 font-mono tabular-nums">
                    {latestResult.sceneConsistencyScore}%
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Conf: {latestResult.confidenceScore}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800/80 leading-relaxed">
                {latestResult.details}
              </p>

              {/* Transformation Parameters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60">
                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">Translation</span>
                  <span className="text-xs font-semibold text-slate-200 font-mono tabular-nums">
                    {latestResult.transformation.translationDistance} px
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    dx: {latestResult.transformation.translationX} / dy: {latestResult.transformation.translationY}
                  </span>
                </div>

                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">Rotation</span>
                  <span className="text-xs font-semibold text-slate-200 font-mono tabular-nums">
                    {latestResult.transformation.rotationDegrees > 0 ? `+${latestResult.transformation.rotationDegrees}` : latestResult.transformation.rotationDegrees}°
                  </span>
                  <span className="text-[10px] text-slate-500 block">Optical plane</span>
                </div>

                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">Zoom Ratio</span>
                  <span className="text-xs font-semibold text-slate-200 font-mono tabular-nums">
                    {(latestResult.transformation.scaleChange * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Scale: {latestResult.transformation.scaleChange}x
                  </span>
                </div>

                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">Homography Inliers</span>
                  <span className="text-xs font-semibold text-emerald-400 font-mono tabular-nums">
                    {latestResult.inliersCount} / {latestResult.validMatches}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Ratio: {(latestResult.inlierRatio * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => onNavigate('analysis')}
                  className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium"
                >
                  <span>View feature match vector lines</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs space-y-2">
              <Camera className="h-8 w-8 mx-auto text-slate-600 mb-2" />
              <span>No frames analyzed yet in this session.</span>
              <div className="mt-3">
                <button
                  onClick={onRunBenchmark}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs border border-slate-700"
                >
                  Run Validation Benchmark Suite
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Launch & Monitoring Scope */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">
              Quick Actions
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => onNavigate('analysis')}
                className="w-full text-left p-3 rounded border border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 transition-colors"
              >
                <div className="text-xs font-medium text-white">Upload CCTV Video or Frames</div>
                <div className="text-[11px] text-slate-500">Extract frames and evaluate viewpoint stability</div>
              </button>

              <button
                onClick={onRunBenchmark}
                className="w-full text-left p-3 rounded border border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 transition-colors"
              >
                <div className="text-xs font-medium text-sky-400">Run Validation Benchmark Suite</div>
                <div className="text-[11px] text-slate-500">Test all 8 camera scenarios (rotation, shift, zoom, lighting)</div>
              </button>

              <button
                onClick={() => onNavigate('report')}
                className="w-full text-left p-3 rounded border border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 transition-colors"
              >
                <div className="text-xs font-medium text-slate-200">Export Scene Consistency Report</div>
                <div className="text-[11px] text-slate-500">Generate executive summary, CSV and JSON files</div>
              </button>
            </div>
          </div>

          {/* Deployment Environments */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4 text-xs text-slate-400 space-y-2">
            <span className="font-semibold text-slate-300 block">Surveillance Environments</span>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-300">
              <span className="px-2 py-0.5 bg-slate-800 rounded">Hospitals & Labs</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded">Colleges & Halls</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded">Office Corridors</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded">Server Vaults</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-200">
            Recent Frame Activity
          </h2>
          <button
            onClick={() => onNavigate('events')}
            className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 font-medium"
          >
            <span>View All Records ({results.length})</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-medium border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-normal">Frame</th>
                  <th className="py-2.5 px-4 font-normal">Timestamp</th>
                  <th className="py-2.5 px-4 font-normal">Classification</th>
                  <th className="py-2.5 px-4 font-normal">Consistency</th>
                  <th className="py-2.5 px-4 font-normal">Inliers</th>
                  <th className="py-2.5 px-4 font-normal">Translation</th>
                  <th className="py-2.5 px-4 font-normal">Rotation</th>
                  <th className="py-2.5 px-4 font-normal">Zoom</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {results.slice(-8).reverse().map((r) => {
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-white">#{r.frameNumber}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">{r.timestamp}</td>
                      <td className="py-2.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium border border-slate-700 text-slate-300 bg-slate-800/40">
                          {r.classification}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold tabular-nums text-sky-400">
                        {r.sceneConsistencyScore}%
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-400">
                        {r.inliersCount} / {r.validMatches}
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                        {r.transformation.translationDistance} px
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                        {r.transformation.rotationDegrees}°
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                        {(r.transformation.scaleChange * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs">
            No activity records available.
          </div>
        )}
      </div>
    </div>
  );
};
