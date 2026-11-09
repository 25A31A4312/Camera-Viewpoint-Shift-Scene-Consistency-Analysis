import React, { useRef, useState } from 'react';
import {
  Upload,
  Video,
  Images,
  Image as ImageIcon,
  Play,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Film,
  X,
  Sliders,
} from 'lucide-react';
import { AnalysisConfig, ReferenceScene, VideoFrameItem } from '../types';
import { extractFramesFromVideo } from '../computer_vision/cv_pipeline';

interface UploadAndProcessingProps {
  onFramesReady: (frames: VideoFrameItem[], sourceDescription: string) => void;
  config: AnalysisConfig;
  isProcessing: boolean;
  reference?: ReferenceScene | null;
}

export const UploadAndProcessing: React.FC<UploadAndProcessingProps> = ({
  onFramesReady,
  config,
  isProcessing,
  reference,
}) => {
  const [activeMode, setActiveMode] = useState<'single' | 'video' | 'images' | 'demo'>('single');
  const [singleImageFile, setSingleImageFile] = useState<File | null>(null);
  const [singleImagePreview, setSingleImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [frameInterval, setFrameInterval] = useState<number>(config.frameIntervalSeconds);
  const [extractionProgress, setExtractionProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const singleInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  // Single Current Image Selection
  const handleSingleImageSelect = (file: File) => {
    setErrorMsg(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext || '')) {
      setErrorMsg(`Unsupported image format (.${ext}). Supported: JPG, PNG, WEBP, BMP.`);
      return;
    }

    setSingleImageFile(file);
    const url = URL.createObjectURL(file);
    setSingleImagePreview(url);
    setStatusMessage(`Selected current frame: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
  };

  const processSingleImage = async () => {
    if (!singleImageFile && !singleImagePreview) {
      setErrorMsg('Please select a current image to compare against the reference baseline.');
      return;
    }

    setErrorMsg(null);
    setStatusMessage('Preparing image for analysis...');
    setExtractionProgress(10);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const sourceUrl = singleImagePreview || (singleImageFile ? URL.createObjectURL(singleImageFile) : '');

    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(640, img.width);
          canvas.height = Math.round(canvas.width * (img.height / img.width));
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const frameItem: VideoFrameItem = {
            id: `single_frame_${Date.now()}`,
            frameNumber: 1,
            timestampSeconds: 0.0,
            timestampFormatted: '00:00.000',
            dataUrl: canvas.toDataURL('image/jpeg', 0.92),
            width: canvas.width,
            height: canvas.height,
            file: singleImageFile || undefined,
          };

          setExtractionProgress(100);
          setStatusMessage('Frame processed.');
          onFramesReady([frameItem], `Current Frame: ${singleImageFile ? singleImageFile.name : 'Uploaded Frame'}`);
          resolve();
        } catch (err: any) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to decode the uploaded current frame.'));
      img.src = sourceUrl;
    });

    setExtractionProgress(null);
  };

  const handleVideoSelect = (file: File) => {
    setErrorMsg(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

    if (!validExts.includes(ext || '')) {
      setErrorMsg(`Unsupported video format (.${ext}). Supported: MP4, WEBM, MOV, AVI, MKV.`);
      return;
    }

    setVideoFile(file);
    setStatusMessage(`Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
  };

  const handleImagesSelect = (files: FileList | null) => {
    setErrorMsg(null);
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext || '')) {
        validFiles.push(f);
      }
    }

    // Sort chronologically by filename
    validFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    setImageFiles(validFiles);
    setStatusMessage(`Selected ${validFiles.length} sequential image frames`);
  };

  const processVideo = async () => {
    if (!videoFile) {
      setErrorMsg('Please select a video file first.');
      return;
    }

    setErrorMsg(null);
    setExtractionProgress(0);
    setStatusMessage('Extracting video frames at configured interval...');

    try {
      const frames = await extractFramesFromVideo(
        videoFile,
        frameInterval,
        (progress, count) => {
          setExtractionProgress(progress);
          setStatusMessage(`Extracted ${count} frames (${progress}%)`);
        }
      );

      if (frames.length === 0) {
        throw new Error('No usable frames could be extracted from video.');
      }

      setExtractionProgress(null);
      setStatusMessage(`Extracted ${frames.length} frames successfully.`);
      onFramesReady(frames, `Video: ${videoFile.name} (${frames.length} frames @ ${frameInterval}s)`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Video frame extraction failed.');
      setExtractionProgress(null);
    }
  };

  const processImageBatch = async () => {
    if (imageFiles.length === 0) {
      setErrorMsg('Please select at least 1 image frame.');
      return;
    }

    setErrorMsg(null);
    setStatusMessage(`Decoding ${imageFiles.length} frames...`);
    setExtractionProgress(0);

    const items: VideoFrameItem[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const timestampSec = i * frameInterval;
      const mins = Math.floor(timestampSec / 60);
      const secs = Math.floor(timestampSec % 60);
      const ms = Math.floor((timestampSec % 1) * 1000);
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;

      const img = new Image();
      const url = URL.createObjectURL(file);

      await new Promise<void>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(640, img.width);
          canvas.height = Math.round(canvas.width * (img.height / img.width));
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          items.push({
            id: `img_frame_${i + 1}_${Date.now()}`,
            frameNumber: i + 1,
            timestampSeconds: timestampSec,
            timestampFormatted: formatted,
            dataUrl: canvas.toDataURL('image/jpeg', 0.9),
            width: canvas.width,
            height: canvas.height,
            file,
          });
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });

      setExtractionProgress(Math.round(((i + 1) / imageFiles.length) * 100));
    }

    setExtractionProgress(null);
    setStatusMessage(`Processed ${items.length} frames successfully.`);
    onFramesReady(items, `Batch: ${imageFiles.length} sequential frames (@ ${frameInterval}s interval)`);
  };

  // Synthesize realistic 12-frame CCTV sequence
  // If reference image exists, dynamically transforms the reference image itself!
  const generateSyntheticCctvSequence = async () => {
    setErrorMsg(null);
    setStatusMessage('Generating 12-frame surveillance sequence...');

    const frames: VideoFrameItem[] = [];
    const w = 640;
    const h = 400;

    const frameScenarios = [
      { name: 'Normal View (Nominal)', dx: 0, dy: 0, rot: 0, scale: 1.0, light: 1.0, occl: false },
      { name: 'Normal View (Minor Lighting Drop)', dx: 0, dy: 0, rot: 0, scale: 1.0, light: 0.88, occl: false },
      { name: 'Slight Camera Vibration', dx: 6, dy: -3, rot: 0.4, scale: 1.0, light: 1.0, occl: false },
      { name: 'Viewpoint Shift (Pan + Tilt)', dx: 36, dy: -18, rot: 0.0, scale: 1.0, light: 1.0, occl: false },
      { name: 'Shift & Minor Lighting Change', dx: 38, dy: -20, rot: 0.0, scale: 1.0, light: 0.72, occl: false },
      { name: 'Camera Rotation', dx: 0, dy: 0, rot: 5.2, scale: 1.0, light: 1.0, occl: false },
      { name: 'Optical Zoom In (+18%)', dx: 0, dy: 0, rot: 0, scale: 1.18, light: 1.0, occl: false },
      { name: 'Dimmed Illumination (-45%)', dx: 0, dy: 0, rot: 0, scale: 1.0, light: 0.55, occl: false },
      { name: 'Dimmed Lighting (-50%)', dx: 0, dy: 0, rot: 0, scale: 1.0, light: 0.50, occl: false },
      { name: 'Temporary Scene Obstruction', dx: 0, dy: 0, rot: 0, scale: 1.0, light: 1.0, occl: true },
      { name: 'Camera Realigned', dx: 2, dy: -1, rot: 0.3, scale: 1.0, light: 1.0, occl: false },
      { name: 'Stable Baseline Returned', dx: 0, dy: 0, rot: 0, scale: 1.0, light: 1.0, occl: false },
    ];

    let refImageElement: HTMLImageElement | null = null;
    if (reference && reference.dataUrl) {
      refImageElement = new Image();
      refImageElement.crossOrigin = 'anonymous';
      await new Promise<void>((res) => {
        refImageElement!.onload = () => res();
        refImageElement!.onerror = () => {
          refImageElement = null;
          res();
        };
        refImageElement!.src = reference.dataUrl;
      });
    }

    for (let i = 0; i < frameScenarios.length; i++) {
      const s = frameScenarios[i];
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      ctx.save();
      if (s.rot !== 0 || s.scale !== 1.0 || s.dx !== 0 || s.dy !== 0) {
        ctx.translate(w / 2 + s.dx, h / 2 + s.dy);
        ctx.rotate((s.rot * Math.PI) / 180);
        ctx.scale(s.scale, s.scale);
        ctx.translate(-w / 2, -h / 2);
      }

      if (refImageElement) {
        ctx.drawImage(refImageElement, 0, 0, w, h);
      } else {
        drawProceduralFrame(ctx, w, h, false);
      }

      if (s.occl) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(80, 50, 480, 300);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 4;
        ctx.strokeRect(80, 50, 480, 300);
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('TEMPORARY SCENE OBSTRUCTION', 140, 190);
        ctx.font = '13px sans-serif';
        ctx.fillText('Optical landmarks blocked by physical partition', 160, 225);
      }

      ctx.restore();

      // Photometric adjustment
      if (s.light < 1.0) {
        ctx.fillStyle = `rgba(10, 15, 30, ${1.0 - s.light})`;
        ctx.fillRect(0, 0, w, h);
      }

      const timestampSec = i * 0.5;
      const mins = Math.floor(timestampSec / 60);
      const secs = Math.floor(timestampSec % 60);
      const ms = Math.floor((timestampSec % 1) * 1000);
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;

      frames.push({
        id: `synth_frame_${i + 1}_${Date.now()}`,
        frameNumber: i + 1,
        timestampSeconds: timestampSec,
        timestampFormatted: formatted,
        dataUrl: canvas.toDataURL('image/jpeg', 0.9),
        width: w,
        height: h,
      });
    }

    const desc = reference
      ? `Surveillance Sequence: 12 Perturbed Frames derived from ${reference.name}`
      : 'Surveillance Sequence (12 Chronological CCTV Frames)';

    onFramesReady(frames, desc);
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 space-y-5">
      {/* Tab Switcher for Single Frame vs Video vs Batch vs Stream */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">
            Footage & Frame Intake
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Select current footage or individual snapshot to evaluate against the established reference baseline.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded border border-slate-800/80 shrink-0 flex-wrap">
          <button
            onClick={() => setActiveMode('single')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              activeMode === 'single'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Single Current Frame
          </button>
          <button
            onClick={() => setActiveMode('video')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              activeMode === 'video'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Video File
          </button>
          <button
            onClick={() => setActiveMode('images')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              activeMode === 'images'
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sequential Batch
          </button>
          <button
            onClick={() => setActiveMode('demo')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
              activeMode === 'demo'
                ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Surveillance Stream
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Mode 0: Single Current Frame Comparison */}
      {activeMode === 'single' && (
        <div className="space-y-4">
          <input
            ref={singleInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.bmp"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleSingleImageSelect(e.target.files[0]);
              }
              e.target.value = '';
            }}
            className="hidden"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 border-2 border-dashed border-slate-800 rounded-lg p-5 text-center bg-slate-950/30 hover:border-slate-700 transition-colors flex flex-col items-center justify-center min-h-[160px]">
              {singleImagePreview ? (
                <div className="space-y-2 w-full flex flex-col items-center">
                  <div className="relative max-h-36 max-w-full overflow-hidden rounded border border-slate-700">
                    <img
                      src={singleImagePreview}
                      alt="Current Frame Preview"
                      className="max-h-36 object-contain"
                    />
                    <button
                      onClick={() => {
                        setSingleImageFile(null);
                        setSingleImagePreview(null);
                      }}
                      className="absolute top-1 right-1 p-1 bg-slate-900/80 hover:bg-red-950 text-slate-300 hover:text-red-300 rounded-full border border-slate-700"
                      title="Clear Selection"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    {singleImageFile?.name || 'Current Frame Loaded'}
                  </p>
                  <button
                    type="button"
                    onClick={() => singleInputRef.current?.click()}
                    className="text-[11px] text-sky-400 hover:underline"
                  >
                    Select different image
                  </button>
                </div>
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-sky-400 mb-2" />
                  <p className="text-xs text-slate-300 font-medium">
                    Select current image frame to compare with reference
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Direct 1-on-1 comparison: test shift, rotation, zoom, or lighting deltas
                  </p>
                  <button
                    type="button"
                    onClick={() => singleInputRef.current?.click()}
                    className="mt-3 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                  >
                    Browse Current Frame
                  </button>
                </>
              )}
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-300 block">
                  Single-Frame Verification
                </span>
                <p className="text-[11px] text-slate-500 mt-1">
                  Processes feature extraction, matching vectors, homography consensus, and viewpoint status in real-time.
                </p>
              </div>

              <button
                onClick={processSingleImage}
                disabled={!singleImagePreview || isProcessing}
                className="w-full py-2.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Analyze Current Frame</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 1: Video File */}
      {activeMode === 'video' && (
        <div className="space-y-4">
          <input
            ref={videoInputRef}
            type="file"
            accept=".mp4,.webm,.mov,.avi,.mkv"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleVideoSelect(e.target.files[0]);
              }
              e.target.value = '';
            }}
            className="hidden"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 border-2 border-dashed border-slate-800 rounded-lg p-6 text-center bg-slate-950/30 hover:border-slate-700 transition-colors">
              <Video className="h-8 w-8 mx-auto text-sky-400 mb-2" />
              <p className="text-xs text-slate-300 font-medium">
                {videoFile ? videoFile.name : 'Select or drop CCTV video footage'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Supports MP4, WEBM, MOV, AVI, MKV
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                >
                  Browse Video
                </button>
                {videoFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setVideoFile(null);
                      setStatusMessage(null);
                    }}
                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 bg-slate-900 rounded border border-slate-800 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">
                Sampling Interval
              </span>
              <p className="text-[11px] text-slate-500">
                Extract frames every {frameInterval}s from video timeline.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={frameInterval}
                  onChange={(e) => setFrameInterval(parseFloat(e.target.value))}
                  className="w-full accent-sky-400"
                />
                <span className="text-xs font-mono tabular-nums text-sky-400 w-10 text-right">
                  {frameInterval}s
                </span>
              </div>

              <button
                onClick={processVideo}
                disabled={!videoFile || isProcessing}
                className="w-full mt-2 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Film className="h-3.5 w-3.5" />
                <span>Extract & Analyze Frames</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Sequential Image Frames */}
      {activeMode === 'images' && (
        <div className="space-y-4">
          <input
            ref={imagesInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.bmp"
            onChange={(e) => {
              handleImagesSelect(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 border-2 border-dashed border-slate-800 rounded-lg p-6 text-center bg-slate-950/30 hover:border-slate-700 transition-colors">
              <Images className="h-8 w-8 mx-auto text-sky-400 mb-2" />
              <p className="text-xs text-slate-300 font-medium">
                {imageFiles.length > 0
                  ? `${imageFiles.length} frames selected`
                  : 'Select multiple image frames'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Processed in chronological order with generated timestamps
              </p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => imagesInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                >
                  Select Image Files
                </button>
                {imageFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageFiles([]);
                      setStatusMessage(null);
                    }}
                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-400 bg-slate-900 rounded border border-slate-800 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">
                Time Between Frames
              </span>
              <p className="text-[11px] text-slate-500">
                Simulated interval: {frameInterval}s
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.2"
                  max="5.0"
                  step="0.2"
                  value={frameInterval}
                  onChange={(e) => setFrameInterval(parseFloat(e.target.value))}
                  className="w-full accent-sky-400"
                />
                <span className="text-xs font-mono tabular-nums text-sky-400 w-10 text-right">
                  {frameInterval}s
                </span>
              </div>

              <button
                onClick={processImageBatch}
                disabled={imageFiles.length === 0 || isProcessing}
                className="w-full mt-2 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Process Frames</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: Synthetic Surveillance Stream */}
      {activeMode === 'demo' && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Surveillance Stream (12 Frames)
            </h3>
            <span className="text-[11px] text-slate-500">
              {reference ? `Derived from ${reference.name}` : 'Procedural CCTV Room'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Synthesizes 12 chronological CCTV frames reflecting realistic real-world camera events:
            baseline view → vibration → camera pan shift → rotation angle → zoom modification → dimmed lighting → occlusion recovery.
          </p>

          <button
            onClick={generateSyntheticCctvSequence}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors inline-flex items-center gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            <span>Generate & Analyze 12-Frame Sequence</span>
          </button>
        </div>
      )}

      {/* Progress & Status Indicator */}
      {extractionProgress !== null && (
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">{statusMessage}</span>
            <span className="text-sky-400 tabular-nums">{extractionProgress}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-400 transition-all duration-150"
              style={{ width: `${extractionProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Helper to draw clean procedural indoor scene
function drawProceduralFrame(ctx: CanvasRenderingContext2D, w: number, h: number, occluded: boolean) {
  // Wall
  ctx.fillStyle = '#475569';
  ctx.fillRect(0, 0, w, h);

  // Ceiling
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, w, 70);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(90, 20, 130, 20);
  ctx.fillRect(410, 20, 130, 20);

  // Floor
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, h - 130, w, 130);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 55) {
    ctx.beginPath();
    ctx.moveTo(x, h - 130);
    ctx.lineTo(x * 1.3 - 60, h);
    ctx.stroke();
  }

  // Doorway
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(45, 70, 115, h - 200);
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(52, 77, 101, h - 214);

  // Shelving
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(210, 100, 150, 170);
  const colors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
  for (let b = 0; b < 8; b++) {
    ctx.fillStyle = colors[b % 4];
    ctx.fillRect(216 + b * 16, 110, 12, 28);
    ctx.fillRect(216 + b * 16, 155, 12, 30);
  }

  // Clock
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(430, 120, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Desk
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(500, 190, 130, 120);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(520, 150, 75, 45);

  if (occluded) {
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(160, 90, 320, 240);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('OBSTRUCTION', 230, 210);
  }
}
