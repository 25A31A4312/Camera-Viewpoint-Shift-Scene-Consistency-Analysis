import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Layers,
  Eye,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Maximize2,
  Sun,
  ShieldCheck,
  Compass,
  Zap,
} from 'lucide-react';
import {
  FrameAnalysisResult,
  ReferenceScene,
  VideoFrameItem,
} from '../types';
import {
  renderDifferenceOverlay,
  renderMatchesCanvas,
} from '../computer_vision/visualization_renderer';

interface LiveAnalysisViewProps {
  reference: ReferenceScene | null;
  frames: VideoFrameItem[];
  results: FrameAnalysisResult[];
  activeFrameIndex: number;
  onSelectFrame: (index: number) => void;
  isAnalyzing: boolean;
  onRunBatchAnalysis: () => void;
}

export const LiveAnalysisView: React.FC<LiveAnalysisViewProps> = ({
  reference,
  frames,
  results,
  activeFrameIndex,
  onSelectFrame,
  isAnalyzing,
  onRunBatchAnalysis,
}) => {
  const [viewMode, setViewMode] = useState<'matches' | 'overlay' | 'side-by-side'>('matches');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showOutliers, setShowOutliers] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const currentFrame = frames[activeFrameIndex] || null;
  const currentResult = results[activeFrameIndex] || null;

  // Auto-playback loop
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;

    const intervalMs = Math.round(1000 / (2 * playbackSpeed));
    const timer = setInterval(() => {
      onSelectFrame((activeFrameIndex + 1) % frames.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, activeFrameIndex, frames.length, playbackSpeed, onSelectFrame]);

  // Render visualization whenever active frame, result, or options change
  useEffect(() => {
    if (!reference || !currentFrame) return;

    const refImg = new Image();
    refImg.crossOrigin = 'anonymous';
    refImg.src = reference.dataUrl;

    const currImg = new Image();
    currImg.crossOrigin = 'anonymous';
    currImg.src = currentFrame.dataUrl;

    let isCancelled = false;

    Promise.all([
      new Promise<void>((resolve) => { refImg.onload = () => resolve(); }),
      new Promise<void>((resolve) => { currImg.onload = () => resolve(); }),
    ]).then(() => {
      if (isCancelled) return;

      if (viewMode === 'matches' && canvasRef.current) {
        renderMatchesCanvas(
          canvasRef.current,
          refImg,
          currImg,
          currentResult?.matchedPoints || [],
          currentResult,
          { showOutliers }
        );
      } else if (viewMode === 'overlay' && overlayCanvasRef.current) {
        renderDifferenceOverlay(
          overlayCanvasRef.current,
          refImg,
          currImg,
          currentResult
        );
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [reference, currentFrame, currentResult, viewMode, showOutliers]);

  const getClassificationColor = (classification?: string) => {
    switch (classification) {
      case 'NORMAL VIEW':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'VIEWPOINT SHIFT DETECTED':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'ROTATION DETECTED':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'ZOOM CHANGE DETECTED':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'SCENE CHANGE DETECTED':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'LIGHTING VARIATION':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  if (!reference) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-400 space-y-4">
        <ShieldCheck className="h-10 w-10 mx-auto text-amber-400" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">No Baseline Reference Established</h2>
          <p className="max-w-md mx-auto text-slate-500">
            Upload an initial reference CCTV image or choose a calibrated preset baseline to establish the visual anchors.
          </p>
        </div>
        <p className="text-[11px] text-slate-500 font-mono">
          Navigate to the "Reference Scene" tab above to upload your baseline.
        </p>
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-12 text-center text-xs text-slate-400 space-y-4">
        <Layers className="h-10 w-10 mx-auto text-sky-400" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">No Surveillance Frames Loaded</h2>
          <p className="max-w-md mx-auto text-slate-500">
            Upload video footage (MP4, WEBM, MOV), import sequential image frames, or generate a 12-frame surveillance sequence using the panel below.
          </p>
        </div>
        <div className="p-3 bg-slate-950/60 rounded border border-slate-800 max-w-lg mx-auto text-[11px] text-slate-400">
          Scroll down to "Footage & Frame Intake" below to load camera frames.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Controls: Frame Navigation & Visualization Mode */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Frame Scrubber & Playback */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectFrame(Math.max(0, activeFrameIndex - 1))}
              disabled={activeFrameIndex <= 0}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
              title="Previous Frame"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold"
              title={isPlaying ? 'Pause' : 'Play Sequence'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>

            <button
              onClick={() => onSelectFrame(Math.min(frames.length - 1, activeFrameIndex + 1))}
              disabled={activeFrameIndex >= frames.length - 1}
              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200"
              title="Next Frame"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <div className="text-xs font-mono">
              <span className="text-white font-semibold tabular-nums">
                Frame #{currentFrame?.frameNumber || 1}
              </span>
              <span className="text-slate-500"> / {frames.length}</span>
              <span aria-hidden="true" className="text-slate-600 mx-1.5">·</span>
              <span className="text-sky-400 tabular-nums">{currentFrame?.timestampFormatted}</span>
            </div>

            <div className="flex items-center gap-1 ml-2 text-[11px] font-mono">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded ${
                    playbackSpeed === spd
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          {/* Visualization Mode Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-950 rounded border border-slate-800">
              <button
                onClick={() => setViewMode('matches')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'matches'
                    ? 'bg-slate-800 text-sky-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ORB Inlier Vectors
              </button>
              <button
                onClick={() => setViewMode('overlay')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'overlay'
                    ? 'bg-slate-800 text-sky-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Difference Overlay
              </button>
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'side-by-side'
                    ? 'bg-slate-800 text-sky-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Direct Comparison
              </button>
            </div>

            {viewMode === 'matches' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-1 select-none">
                <input
                  type="checkbox"
                  checked={showOutliers}
                  onChange={(e) => setShowOutliers(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-sky-400 focus:ring-0"
                />
                <span className="text-[11px]">Show Outliers</span>
              </label>
            )}
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="mt-3">
          <input
            type="range"
            min="0"
            max={frames.length - 1}
            value={activeFrameIndex}
            onChange={(e) => onSelectFrame(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
          />
        </div>
      </div>

      {/* Main Viewport: Canvas / Images */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 overflow-hidden">
        {viewMode === 'matches' && (
          <div className="flex justify-center items-center min-h-[340px]">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto rounded border border-slate-800/80 shadow-md"
            />
          </div>
        )}

        {viewMode === 'overlay' && (
          <div className="flex flex-col items-center justify-center min-h-[340px] space-y-2">
            <canvas
              ref={overlayCanvasRef}
              className="max-w-full h-auto rounded border border-slate-800/80 shadow-md"
            />
            <p className="text-[11px] text-slate-400 font-mono">
              Difference blend mode: stationary background elements cancel out; displaced or rotated geometry highlights optical shifts.
            </p>
          </div>
        )}

        {viewMode === 'side-by-side' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2">
            <div className="space-y-1.5">
              <span className="text-xs font-mono text-slate-400 block">Baseline Reference</span>
              <img
                src={reference.dataUrl}
                alt="Reference"
                className="w-full h-[280px] object-contain rounded bg-black border border-slate-800"
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-mono text-sky-400 block">
                Current Frame #{currentFrame?.frameNumber} ({currentFrame?.timestampFormatted})
              </span>
              <img
                src={currentFrame?.dataUrl}
                alt="Current Frame"
                className="w-full h-[280px] object-contain rounded bg-black border border-slate-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* Real-time Computer Vision Metrics Dashboard */}
      {currentResult ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          {/* Header Row: Classification and Consistency Gauge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider block">
                Decision Classification
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-semibold border ${getClassificationColor(
                    currentResult.classification
                  )}`}
                >
                  {currentResult.classification}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Confidence: {currentResult.confidenceScore}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <span className="text-[11px] text-slate-500 block text-right">
                  Scene Consistency
                </span>
                <div className="text-xl font-bold text-sky-400 font-mono tabular-nums text-right">
                  {currentResult.sceneConsistencyScore}%
                </div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <span className="text-[11px] text-slate-500 block text-right">
                  Latency
                </span>
                <div className="text-xs font-mono text-slate-300 text-right">
                  {currentResult.processingTimeMs} ms
                </div>
              </div>
            </div>
          </div>

          {/* Details Narrative */}
          <div className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800/80 leading-relaxed font-sans">
            {currentResult.details}
          </div>

          {/* 6 Comprehensive Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1: Translation */}
            <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60 space-y-1">
              <span className="text-[11px] text-slate-500 block">Translation</span>
              <div className="text-sm font-semibold text-white font-mono tabular-nums">
                {currentResult.transformation.translationDistance} px
              </div>
              <span className="text-[10px] text-slate-400 font-mono block">
                dx: {currentResult.transformation.translationX} / dy: {currentResult.transformation.translationY}
              </span>
            </div>

            {/* 2: Rotation */}
            <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60 space-y-1">
              <span className="text-[11px] text-slate-500 block">Rotation</span>
              <div className="text-sm font-semibold text-white font-mono tabular-nums">
                {currentResult.transformation.rotationDegrees}°
              </div>
              <span className="text-[10px] text-slate-400 font-mono block">
                Optical plane tilt
              </span>
            </div>

            {/* 3: Scale / Zoom */}
            <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60 space-y-1">
              <span className="text-[11px] text-slate-500 block">Scale / Zoom</span>
              <div className="text-sm font-semibold text-white font-mono tabular-nums">
                {(currentResult.transformation.scaleChange * 100).toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400 font-mono block">
                Factor: {currentResult.transformation.scaleChange}x
              </span>
            </div>

            {/* 4: RANSAC Inliers */}
            <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60 space-y-1">
              <span className="text-[11px] text-slate-500 block">RANSAC Inliers</span>
              <div className="text-sm font-semibold text-white font-mono tabular-nums">
                {currentResult.inliersCount} / {currentResult.validMatches}
              </div>
              <span className="text-[10px] text-slate-400 font-mono block">
                Ratio: {(currentResult.inlierRatio * 100).toFixed(0)}%
              </span>
            </div>

            {/* 5: Reprojection Error */}
            <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60 space-y-1">
              <span className="text-[11px] text-slate-500 block">Reproj. Error</span>
              <div className="text-sm font-semibold text-white font-mono tabular-nums">
                {currentResult.transformation.reprojectionError} px
              </div>
              <span className="text-[10px] text-slate-400 font-mono block">
                Inlier RMSE residual
              </span>
            </div>

            {/* 6: Luminance Delta */}
            <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60 space-y-1">
              <span className="text-[11px] text-slate-500 block">Luminance Δ</span>
              <div className="text-sm font-semibold text-white font-mono tabular-nums">
                {currentResult.luminanceDelta > 0 ? `+${currentResult.luminanceDelta}` : currentResult.luminanceDelta}
              </div>
              <span className="text-[10px] text-slate-400 font-mono block">
                Contrast Δ: {currentResult.contrastDelta}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded border border-slate-800 bg-slate-900/30 text-center text-xs text-slate-400">
          This frame has not been evaluated yet. Run analysis to compute geometric transformation metrics.
        </div>
      )}
    </div>
  );
};
