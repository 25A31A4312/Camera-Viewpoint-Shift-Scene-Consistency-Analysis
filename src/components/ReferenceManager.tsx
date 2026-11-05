import React, { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';
import { ReferenceScene } from '../types';
import { processReferenceScene } from '../computer_vision/cv_pipeline';

interface ReferenceManagerProps {
  reference: ReferenceScene | null;
  onReferenceUpdated: (scene: ReferenceScene | null) => void;
  isProcessing: boolean;
}

export const ReferenceManager: React.FC<ReferenceManagerProps> = ({
  reference,
  onReferenceUpdated,
  isProcessing,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasPreviewRef = useRef<HTMLCanvasElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showKeypointsOverlay, setShowKeypointsOverlay] = useState(true);

  // Draw reference image and ORB keypoint markers onto canvas
  useEffect(() => {
    if (!reference || !canvasPreviewRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasPreviewRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = reference.width;
      canvas.height = reference.height;

      // Draw original reference image
      ctx.drawImage(img, 0, 0, reference.width, reference.height);

      // Draw extracted ORB keypoints if toggled
      if (showKeypointsOverlay && reference.features?.keypoints) {
        ctx.lineWidth = 1.5;
        const kps = reference.features.keypoints;

        for (let i = 0; i < kps.length; i++) {
          const kp = kps[i];
          // Keypoint center
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
          ctx.beginPath();
          ctx.arc(kp.x, kp.y, 3, 0, Math.PI * 2);
          ctx.stroke();

          // Orientation tick line from intensity centroid
          const len = 7;
          const endX = kp.x + len * Math.cos(kp.angle);
          const endY = kp.y + len * Math.sin(kp.angle);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
          ctx.beginPath();
          ctx.moveTo(kp.x, kp.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }
    };
    img.src = reference.dataUrl;
  }, [reference, showKeypointsOverlay]);

  const handleFileUpload = async (file: File) => {
    setErrorMsg(null);

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['jpg', 'jpeg', 'png', 'webp', 'bmp'];
    if (!validExts.includes(ext || '')) {
      setErrorMsg(`Unsupported file type (.${ext}). Supported formats: JPG, JPEG, PNG, WEBP, BMP.`);
      return;
    }

    setLoading(true);
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to decode uploaded image file.'));
        img.src = objectUrl;
      });

      const formattedSize = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : `${(file.size / 1024).toFixed(1)} KB`;

      // Extract actual ORB features from uploaded image
      const scene = await processReferenceScene(img, file.name, formattedSize);
      URL.revokeObjectURL(objectUrl);
      onReferenceUpdated(scene);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error processing reference image.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Pre-configured realistic benchmark scenes
  const loadPresetScene = async (presetName: string, type: 'office' | 'hospital' | 'lab' | 'bank') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 420;
      const ctx = canvas.getContext('2d')!;

      drawPresetCctvScene(ctx, 640, 420, type);

      const scene = await processReferenceScene(canvas, `${presetName} (Calibrated Baseline)`, 'Preset Baseline (640×420)');
      onReferenceUpdated(scene);
    } catch (e: any) {
      setErrorMsg('Failed to generate preset reference scene.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Reference Scene Management
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Fixed CCTV monitoring requires an established reference baseline. Incoming video frames are compared geometrically against this baseline using ORB feature consensus.
            </p>
          </div>

          {reference && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors inline-flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Replace Reference</span>
              </button>
              <button
                onClick={() => onReferenceUpdated(null)}
                className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20 transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Reference</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Reference View / Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Preview or Drop Area */}
        <div className="lg:col-span-2 space-y-4">
          {reference ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-200">{reference.name}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-400 font-mono">{reference.width} × {reference.height} px</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-400 font-mono">{reference.fileSizeFormatted}</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showKeypointsOverlay}
                      onChange={(e) => setShowKeypointsOverlay(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-800 text-sky-400 focus:ring-0"
                    />
                    <span>Show ORB Keypoints</span>
                  </label>
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Calibrated</span>
                  </span>
                </div>
              </div>

              {/* Interactive Canvas Preview with Extracted Keypoint Overlay */}
              <div className="relative rounded overflow-hidden border border-slate-800 bg-black flex items-center justify-center min-h-[320px]">
                <canvas
                  ref={canvasPreviewRef}
                  className="max-h-[420px] w-auto object-contain"
                />
                <div className="absolute top-2 left-2 bg-slate-950/85 px-2.5 py-1 rounded border border-slate-800 text-[11px] font-mono text-sky-400">
                  {reference.features?.keypoints.length || 0} ORB Keypoints Extracted
                </div>
              </div>

              {/* Extraction Metrics */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">Visual Anchors</span>
                  <span className="text-xs font-semibold text-white font-mono tabular-nums">
                    {reference.features?.keypoints.length || 0} keypoints
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">Mean Luminance</span>
                  <span className="text-xs font-semibold text-white font-mono tabular-nums">
                    {reference.averageLuminance} / 255
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-950/40 border border-slate-800/50">
                  <span className="text-[11px] text-slate-500 block">Contrast (StdDev)</span>
                  <span className="text-xs font-semibold text-white font-mono tabular-nums">
                    {reference.contrastStdDev}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                dragActive
                  ? 'border-sky-500 bg-sky-500/10'
                  : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.bmp"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />

              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center text-sky-400 border border-slate-700">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Drop your reference CCTV image here, or{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sky-400 hover:text-sky-300 underline font-medium"
                    >
                      browse file
                    </button>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Accepts JPG, JPEG, PNG, WEBP, and BMP up to 30 MB
                  </p>
                </div>

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-sky-400 pt-2 font-mono">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Extracting ORB keypoints and descriptors...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Facility Preset Baselines */}
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">
                Calibrated CCTV Presets
              </h2>
              <span className="text-[11px] text-slate-500">1-Click Baseline</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              If you don't have an external CCTV photo file ready, initialize with one of these realistic pre-calibrated surveillance environments:
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => loadPresetScene('Office Reception & Corridor', 'office')}
                disabled={loading}
                className="w-full text-left p-3 rounded border border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 transition-colors"
              >
                <div className="text-xs font-medium text-white">Office Reception & Corridor</div>
                <div className="text-[11px] text-slate-500">Fixed camera over doorway, clock, and desks</div>
              </button>

              <button
                onClick={() => loadPresetScene('Hospital Intensive Care Corridor', 'hospital')}
                disabled={loading}
                className="w-full text-left p-3 rounded border border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 transition-colors"
              >
                <div className="text-xs font-medium text-sky-400">Hospital ICU Corridor</div>
                <div className="text-[11px] text-slate-500">Tile floors, equipment carts, and patient ward door</div>
              </button>

              <button
                onClick={() => loadPresetScene('Chemistry Research Laboratory', 'lab')}
                disabled={loading}
                className="w-full text-left p-3 rounded border border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 transition-colors"
              >
                <div className="text-xs font-medium text-emerald-400">Chemistry Research Laboratory</div>
                <div className="text-[11px] text-slate-500">Fume hood, instrument rack, glassware workbench</div>
              </button>

              <button
                onClick={() => loadPresetScene('College Examination Hall', 'bank')}
                disabled={loading}
                className="w-full text-left p-3 rounded border border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 transition-colors"
              >
                <div className="text-xs font-medium text-amber-400">College Examination Hall</div>
                <div className="text-[11px] text-slate-500">Rows of student desks, podium, and blackboard</div>
              </button>
            </div>
          </div>

          {/* Reference Best Practices Note */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-4 text-xs text-slate-400 space-y-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-sky-400" />
              <span>Reference Calibration Invariants</span>
            </span>
            <p className="text-[11px] leading-relaxed">
              The reference frame serves as the spatial ground truth. Keypoints are extracted with sub-pixel Harris response scoring to form invariant descriptors for RANSAC geometric consensus.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper procedural scene drawer for rich CCTV facilities
function drawPresetCctvScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  type: 'office' | 'hospital' | 'lab' | 'bank'
) {
  ctx.fillStyle = type === 'hospital' ? '#cbd5e1' : type === 'lab' ? '#475569' : '#334155';
  ctx.fillRect(0, 0, w, h);

  // Ceiling
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, w, 70);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(80, 20, 140, 20);
  ctx.fillRect(400, 20, 140, 20);

  // Floor
  ctx.fillStyle = type === 'hospital' ? '#94a3b8' : '#1e293b';
  ctx.fillRect(0, h - 140, w, 140);

  // Grid
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, h - 140);
    ctx.lineTo(x * 1.3 - 60, h);
    ctx.stroke();
  }

  // Large Doors / Architectural features
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(50, 70, 120, h - 210);
  ctx.fillStyle = type === 'hospital' ? '#0284c7' : '#2563eb';
  ctx.fillRect(56, 76, 108, h - 222);

  // Central Wall Structure / Signage
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(220, 100, 180, 80);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 3;
  ctx.strokeRect(220, 100, 180, 80);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(type.toUpperCase() + ' ZONE A-1', 235, 145);

  // Equipment / Desk
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(440, 170, 160, 140);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(460, 130, 90, 60);

  // Wall Clock
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(310, 50, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.stroke();
}
