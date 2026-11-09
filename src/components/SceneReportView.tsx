import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Maximize2,
  Sun,
  ShieldCheck,
  TrendingUp,
  Clock,
  Layers,
  FileSpreadsheet,
  FileJson,
  X,
  ExternalLink,
  Copy,
  Check,
  Calendar,
  History,
} from 'lucide-react';
import {
  AnalysisConfig,
  AnalysisSessionRecord,
  FrameAnalysisResult,
  ReferenceScene,
} from '../types';
import { StorageService } from '../services/storage_service';

interface SceneReportViewProps {
  results: FrameAnalysisResult[];
  reference: ReferenceScene | null;
  config: AnalysisConfig;
  historySessions?: AnalysisSessionRecord[];
}

export const SceneReportView: React.FC<SceneReportViewProps> = ({
  results,
  reference,
  config,
  historySessions = [],
}) => {
  // Determine initial session selection: live if results exist, otherwise most recent historical session
  const [selectedSource, setSelectedSource] = useState<string>(() => {
    if (results && results.length > 0) return 'live';
    if (historySessions && historySessions.length > 0) return historySessions[0].id;
    return 'sample';
  });

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [printFeedback, setPrintFeedback] = useState<{
    type: 'success' | 'info' | 'warn';
    message: string;
  } | null>(null);

  // Fallback sample baseline data if no analyses exist yet
  const sampleResults: FrameAnalysisResult[] = [
    {
      id: 'sample_frame_1',
      frameNumber: 1,
      timestamp: '00:00.000',
      timestampSeconds: 0,
      sceneConsistencyScore: 98.4,
      featuresDetected: 342,
      validMatches: 280,
      inliersCount: 268,
      inlierRatio: 0.957,
      transformation: {
        translationX: 0.4,
        translationY: -0.2,
        translationDistance: 0.45,
        translationPercent: 0.08,
        rotationDegrees: 0.05,
        scaleChange: 1.001,
        reprojectionError: 0.82,
        matrix: [[1, 0, 0.4], [0, 1, -0.2], [0, 0, 1]],
      },
      luminanceDelta: 1.2,
      contrastDelta: 0.4,
      classification: 'NORMAL VIEW',
      cameraStatus: 'Stable',
      confidenceScore: 99.2,
      processingTimeMs: 14.5,
      matchedPoints: [],
      status: 'nominal',
      details: 'Baseline calibration nominal. Sub-pixel viewpoint stability confirmed.',
    },
    {
      id: 'sample_frame_2',
      frameNumber: 2,
      timestamp: '00:01.500',
      timestampSeconds: 1.5,
      sceneConsistencyScore: 94.1,
      featuresDetected: 338,
      validMatches: 265,
      inliersCount: 250,
      inlierRatio: 0.943,
      transformation: {
        translationX: 2.1,
        translationY: 0.8,
        translationDistance: 2.25,
        translationPercent: 0.41,
        rotationDegrees: -0.22,
        scaleChange: 0.998,
        reprojectionError: 0.94,
        matrix: [[1, 0, 2.1], [0, 1, 0.8], [0, 0, 1]],
      },
      luminanceDelta: -3.5,
      contrastDelta: -1.1,
      classification: 'NORMAL VIEW',
      cameraStatus: 'Stable',
      confidenceScore: 97.8,
      processingTimeMs: 15.1,
      matchedPoints: [],
      status: 'nominal',
      details: 'Normal scene geometry maintained within tolerance.',
    },
    {
      id: 'sample_frame_3',
      frameNumber: 3,
      timestamp: '00:03.000',
      timestampSeconds: 3.0,
      sceneConsistencyScore: 68.3,
      featuresDetected: 310,
      validMatches: 195,
      inliersCount: 162,
      inlierRatio: 0.83,
      transformation: {
        translationX: 24.8,
        translationY: 12.3,
        translationDistance: 27.68,
        translationPercent: 5.1,
        rotationDegrees: 1.15,
        scaleChange: 1.012,
        reprojectionError: 2.45,
        matrix: [[1, 0, 24.8], [0, 1, 12.3], [0, 0, 1]],
      },
      luminanceDelta: -4.1,
      contrastDelta: -0.8,
      classification: 'VIEWPOINT SHIFT DETECTED',
      cameraStatus: 'Shift Detected',
      confidenceScore: 94.5,
      processingTimeMs: 16.2,
      matchedPoints: [],
      status: 'alert',
      details: 'Displacement exceeds 15.0px threshold. Physical camera mount displacement detected.',
    },
    {
      id: 'sample_frame_4',
      frameNumber: 4,
      timestamp: '00:04.500',
      timestampSeconds: 4.5,
      sceneConsistencyScore: 88.5,
      featuresDetected: 325,
      validMatches: 240,
      inliersCount: 218,
      inlierRatio: 0.908,
      transformation: {
        translationX: 1.8,
        translationY: 0.5,
        translationDistance: 1.87,
        translationPercent: 0.35,
        rotationDegrees: 4.85,
        scaleChange: 1.003,
        reprojectionError: 1.12,
        matrix: [[1, 0, 1.8], [0, 1, 0.5], [0, 0, 1]],
      },
      luminanceDelta: 2.1,
      contrastDelta: 0.2,
      classification: 'ROTATION DETECTED',
      cameraStatus: 'Rotation Detected',
      confidenceScore: 96.0,
      processingTimeMs: 14.8,
      matchedPoints: [],
      status: 'alert',
      details: 'Axial camera rotation of 4.85° identified by RANSAC consensus.',
    },
    {
      id: 'sample_frame_5',
      frameNumber: 5,
      timestamp: '00:06.000',
      timestampSeconds: 6.0,
      sceneConsistencyScore: 91.2,
      featuresDetected: 330,
      validMatches: 252,
      inliersCount: 236,
      inlierRatio: 0.936,
      transformation: {
        translationX: 0.9,
        translationY: -0.4,
        translationDistance: 0.98,
        translationPercent: 0.18,
        rotationDegrees: 0.12,
        scaleChange: 1.002,
        reprojectionError: 0.88,
        matrix: [[1, 0, 0.9], [0, 1, -0.4], [0, 0, 1]],
      },
      luminanceDelta: 42.6,
      contrastDelta: 14.5,
      classification: 'LIGHTING VARIATION',
      cameraStatus: 'Stable',
      confidenceScore: 98.4,
      processingTimeMs: 15.0,
      matchedPoints: [],
      status: 'info',
      details: 'Global illumination shift detected (+42.6 luminance). Camera viewpoint remains stable.',
    },
  ];

  // Resolve effective data source
  let effectiveResults: FrameAnalysisResult[] = results;
  let effectiveReference: ReferenceScene | null = reference;
  let effectiveConfig: AnalysisConfig = config;
  let sourceLabel = 'Current Active Analysis';

  if (selectedSource === 'live' && results && results.length > 0) {
    effectiveResults = results;
    effectiveReference = reference;
    effectiveConfig = config;
    sourceLabel = `Live Session (${results.length} Frames)`;
  } else if (selectedSource !== 'live' && selectedSource !== 'sample') {
    const historical = historySessions.find((s) => s.id === selectedSource);
    if (historical) {
      effectiveResults = historical.results;
      effectiveReference = {
        id: historical.referenceScene.id,
        name: historical.referenceScene.name,
        width: historical.referenceScene.width,
        height: historical.referenceScene.height,
        dataUrl: historical.referenceScene.dataUrl,
        averageLuminance: historical.referenceScene.averageLuminance,
        contrastStdDev: historical.referenceScene.contrastStdDev,
        timestamp: historical.referenceScene.timestamp,
        fileSizeFormatted: historical.referenceScene.fileSizeFormatted,
      };
      effectiveConfig = historical.configUsed;
      sourceLabel = `${historical.sessionName} (${historical.formattedDate})`;
    }
  } else if (results.length === 0) {
    if (historySessions.length > 0) {
      const first = historySessions[0];
      effectiveResults = first.results;
      effectiveReference = {
        id: first.referenceScene.id,
        name: first.referenceScene.name,
        width: first.referenceScene.width,
        height: first.referenceScene.height,
        dataUrl: first.referenceScene.dataUrl,
        averageLuminance: first.referenceScene.averageLuminance,
        contrastStdDev: first.referenceScene.contrastStdDev,
        timestamp: first.referenceScene.timestamp,
        fileSizeFormatted: first.referenceScene.fileSizeFormatted,
      };
      effectiveConfig = first.configUsed;
      sourceLabel = `${first.sessionName} (${first.formattedDate})`;
    } else {
      effectiveResults = sampleResults;
      effectiveReference = reference || {
        id: 'sample_ref',
        name: 'Surveillance Camera Baseline #01',
        width: 1280,
        height: 720,
        dataUrl: '',
        averageLuminance: 128,
        contrastStdDev: 42,
        timestamp: new Date().toLocaleTimeString(),
        fileSizeFormatted: '1.2 MB',
      };
      sourceLabel = 'Sample Surveillance Audit Benchmark';
    }
  }

  // Generate formal report structure
  const report = StorageService.generateReport(
    effectiveResults,
    effectiveReference,
    effectiveConfig
  );

  // CSV Export
  const handleExportCsv = () => {
    StorageService.exportToCsv(effectiveResults, report);
    setPrintFeedback({
      type: 'success',
      message: 'CSV Audit Log downloaded successfully.',
    });
  };

  // JSON Export
  const handleExportJson = () => {
    StorageService.exportToJson(report, effectiveResults);
    setPrintFeedback({
      type: 'success',
      message: 'JSON Audit Report downloaded successfully.',
    });
  };

  // Download Standalone Printable Document (HTML/PDF Ready)
  const handleDownloadPrintableHtml = () => {
    StorageService.downloadPrintableReport(
      report,
      effectiveResults,
      report.referenceSceneName
    );
    setPrintFeedback({
      type: 'success',
      message:
        'Print-ready audit report (.html) downloaded. Open it in any browser and choose "Save as PDF" or Print!',
    });
  };

  // Primary Print & Save handler
  const handlePrint = () => {
    // 1. Immediately provide print-ready download so users in iframe have 100% reliable output
    StorageService.downloadPrintableReport(
      report,
      effectiveResults,
      report.referenceSceneName
    );

    // 2. Open action modal for interactive choices & direct printer trigger
    setIsPrintModalOpen(true);

    // 3. Attempt direct window.print() inside try/catch
    try {
      window.print();
      setPrintFeedback({
        type: 'success',
        message: 'Print dialog requested. Printable report also saved to your downloads!',
      });
    } catch (err) {
      console.warn('Direct window.print() suppressed by iframe sandbox:', err);
      setPrintFeedback({
        type: 'info',
        message:
          'Print dialog was blocked by iframe permissions. Your print-ready audit document has been downloaded and is ready to open/print!',
      });
    }
  };

  // Copy Executive Summary
  const handleCopySummary = async () => {
    const text = `
=== CAMERA VIEWPOINT SHIFT & SCENE CONSISTENCY REPORT ===
Generated: ${report.generatedAt}
Baseline: ${report.referenceSceneName}
Total Frames Evaluated: ${report.totalFramesProcessed}
Average Scene Consistency: ${report.averageSceneConsistency}%
Normal Frames: ${report.normalFrames}
Viewpoint Shifts: ${report.viewpointShiftEvents}
Rotations: ${report.rotationEvents}
Zoom Changes: ${report.zoomEvents}
Lighting Shifts: ${report.lightingOnlyEvents}

Executive Audit Summary:
${report.summaryExecutive}

Calibration:
Translation Threshold: ${report.thresholdsUsed.translationThresholdPx} px
Rotation Threshold: ${report.thresholdsUsed.rotationThresholdDeg}°
Zoom Threshold: ±${report.thresholdsUsed.zoomThresholdPercent}%
Min Consistency: ${report.thresholdsUsed.minSceneConsistencyPercent}%
Algorithm: ORB + RANSAC Consensus
=========================================================
`.trim();

    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      // fallback
    }
  };

  // Compute SVG chart points for consistency timeline
  const chartWidth = 720;
  const chartHeight = 160;
  const padding = 30;

  const consistencyPoints = effectiveResults
    .map((r, i) => {
      const x =
        padding +
        (i / Math.max(1, effectiveResults.length - 1)) * (chartWidth - 2 * padding);
      const y =
        chartHeight -
        padding -
        (r.sceneConsistencyScore / 100) * (chartHeight - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  const translationPoints = effectiveResults
    .map((r, i) => {
      const maxTrans = Math.max(
        40,
        ...effectiveResults.map((res) => res.transformation.translationDistance)
      );
      const x =
        padding +
        (i / Math.max(1, effectiveResults.length - 1)) * (chartWidth - 2 * padding);
      const y =
        chartHeight -
        padding -
        (r.transformation.translationDistance / maxTrans) *
          (chartHeight - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-6 print:text-black">
      {/* Top Action & Session Selector Bar */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sky-400" />
              <h1 className="text-lg font-bold text-white tracking-tight">
                Scene Consistency & Viewpoint Shift Report
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Generated on {report.generatedAt} · Reference:{' '}
              <span className="text-slate-200 font-medium">
                {report.referenceSceneName}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Session Selector if multiple histories exist */}
            {historySessions && historySessions.length > 0 && (
              <div className="flex items-center gap-1.5 mr-1">
                <History className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-sky-500 max-w-[200px] truncate"
                  title="Select analysis record to audit"
                >
                  {results && results.length > 0 && (
                    <option value="live">Current Live Run ({results.length} frames)</option>
                  )}
                  {historySessions.map((s, idx) => (
                    <option key={s.id} value={s.id}>
                      #{historySessions.length - idx}: {s.sessionName} ({s.formattedDate})
                    </option>
                  ))}
                  {results.length === 0 && historySessions.length === 0 && (
                    <option value="sample">Sample Benchmark Audit</option>
                  )}
                </select>
              </div>
            )}

            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Export numerical data as CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Download CSV</span>
            </button>

            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              title="Export complete structured audit as JSON"
            >
              <FileJson className="h-3.5 w-3.5 text-sky-400" />
              <span>Download JSON</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 active:bg-sky-500 rounded transition-all inline-flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-sky-500/20"
              title="Print directly or save print-ready PDF audit report"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Informational Status Feedback Banner */}
        {printFeedback && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs animate-fade-in">
            <span
              className={
                printFeedback.type === 'success'
                  ? 'text-emerald-400 flex items-center gap-1.5'
                  : 'text-sky-300 flex items-center gap-1.5'
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {printFeedback.message}
            </span>
            <button
              onClick={() => setPrintFeedback(null)}
              className="text-slate-400 hover:text-white ml-2 text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Executive Summary Card */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">
              Executive Audit Summary · {sourceLabel}
            </span>
            <h2 className="text-base font-bold text-white mt-0.5">
              Monitoring Findings & Viewpoint Consistency
            </h2>
          </div>
          <button
            onClick={handleCopySummary}
            className="text-xs text-slate-400 hover:text-sky-400 transition-colors inline-flex items-center gap-1 self-start sm:self-auto px-2 py-1 bg-slate-800/60 rounded border border-slate-800"
          >
            {copySuccess ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Summary</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60 p-4 rounded border border-slate-800/80">
          {report.summaryExecutive}
        </p>

        {/* 7 Summary Stat Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Total Evaluated</span>
            <span className="text-base font-bold text-white font-mono tabular-nums">
              {report.totalFramesProcessed}
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Normal Frames</span>
            <span className="text-base font-bold text-emerald-400 font-mono tabular-nums">
              {report.normalFrames}
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Viewpoint Shifts</span>
            <span className="text-base font-bold text-amber-400 font-mono tabular-nums">
              {report.viewpointShiftEvents}
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Rotation Events</span>
            <span className="text-base font-bold text-orange-400 font-mono tabular-nums">
              {report.rotationEvents}
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Zoom Anomalies</span>
            <span className="text-base font-bold text-purple-400 font-mono tabular-nums">
              {report.zoomEvents}
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Lighting Shifts</span>
            <span className="text-base font-bold text-sky-400 font-mono tabular-nums">
              {report.lightingOnlyEvents}
            </span>
          </div>

          <div className="p-3 rounded bg-slate-950/40 border border-slate-800/60">
            <span className="text-[11px] text-slate-500 block">Avg Consistency</span>
            <span className="text-base font-bold text-emerald-400 font-mono tabular-nums">
              {report.averageSceneConsistency}%
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics: Consistency & Translation Timeline Charts */}
      {effectiveResults.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Consistency Chart */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Scene Consistency Over Timeline
              </span>
              <span className="text-[11px] font-mono text-emerald-400">
                Avg: {report.averageSceneConsistency}%
              </span>
            </div>

            <div className="h-44 w-full bg-slate-950/80 rounded border border-slate-800/80 p-2 flex items-center justify-center">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-full"
              >
                {/* Horizontal reference grid lines */}
                <line
                  x1={padding}
                  y1={padding}
                  x2={chartWidth - padding}
                  y2={padding}
                  stroke="#334155"
                  strokeDasharray="3 3"
                />
                <line
                  x1={padding}
                  y1={chartHeight / 2}
                  x2={chartWidth - padding}
                  y2={chartHeight / 2}
                  stroke="#334155"
                  strokeDasharray="3 3"
                />
                <line
                  x1={padding}
                  y1={chartHeight - padding}
                  x2={chartWidth - padding}
                  y2={chartHeight - padding}
                  stroke="#475569"
                />

                {/* Threshold line */}
                <line
                  x1={padding}
                  y1={
                    chartHeight -
                    padding -
                    (effectiveConfig.minSceneConsistencyPercent / 100) *
                      (chartHeight - 2 * padding)
                  }
                  x2={chartWidth - padding}
                  y2={
                    chartHeight -
                    padding -
                    (effectiveConfig.minSceneConsistencyPercent / 100) *
                      (chartHeight - 2 * padding)
                  }
                  stroke="#ef4444"
                  strokeDasharray="4 2"
                  strokeWidth="1.5"
                />

                {/* Consistency Polyline */}
                <polyline
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                  points={consistencyPoints}
                />
              </svg>
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Start: Frame #1</span>
              <span className="text-red-400">
                --- Min Threshold ({effectiveConfig.minSceneConsistencyPercent}%)
              </span>
              <span>End: Frame #{effectiveResults.length}</span>
            </div>
          </div>

          {/* Translation Distance Chart */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Camera Translation Displacement (px)
              </span>
              <span className="text-[11px] font-mono text-amber-400">
                Thr: {effectiveConfig.translationThresholdPx}px
              </span>
            </div>

            <div className="h-44 w-full bg-slate-950/80 rounded border border-slate-800/80 p-2 flex items-center justify-center">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-full"
              >
                <line
                  x1={padding}
                  y1={padding}
                  x2={chartWidth - padding}
                  y2={padding}
                  stroke="#334155"
                  strokeDasharray="3 3"
                />
                <line
                  x1={padding}
                  y1={chartHeight / 2}
                  x2={chartWidth - padding}
                  y2={chartHeight / 2}
                  stroke="#334155"
                  strokeDasharray="3 3"
                />
                <line
                  x1={padding}
                  y1={chartHeight - padding}
                  x2={chartWidth - padding}
                  y2={chartHeight - padding}
                  stroke="#475569"
                />

                {/* Displacement Polyline */}
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  points={translationPoints}
                />
              </svg>
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>Start (0 px)</span>
              <span>Timeline Horizon ({report.monitoringDurationFormatted})</span>
              <span>Frame #{effectiveResults.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Formal Anomaly Events Breakdown Table */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">
            Detected Anomaly Events ({report.events.length})
          </h3>
          <span className="text-xs text-slate-500 font-mono">Audit Trail</span>
        </div>

        {report.events.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-medium border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-normal">Frame</th>
                  <th className="py-2.5 px-4 font-normal">Timestamp</th>
                  <th className="py-2.5 px-4 font-normal">Classification</th>
                  <th className="py-2.5 px-4 font-normal">Consistency</th>
                  <th className="py-2.5 px-4 font-normal">Shift Distance</th>
                  <th className="py-2.5 px-4 font-normal">Rotation Angle</th>
                  <th className="py-2.5 px-4 font-normal">Zoom Factor</th>
                  <th className="py-2.5 px-4 font-normal">Diagnostic Log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {report.events.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-medium text-white">
                      #{e.frameNumber}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {e.timestamp}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium border border-amber-500/20 text-amber-400 bg-amber-500/10">
                        {e.classification}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold tabular-nums text-sky-400">
                      {e.consistencyScore}%
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                      {e.translationPx} px
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                      {e.rotationDeg}°
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                      {(e.scaleChange * 100).toFixed(1)}%
                    </td>
                    <td
                      className="py-2.5 px-4 text-slate-400 max-w-sm truncate"
                      title={e.details}
                    >
                      {e.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs">
            No viewpoint shift anomalies or security exceptions recorded. Camera
            maintained full viewpoint stability.
          </div>
        )}
      </div>

      {/* Configuration Parameters Appendix */}
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-4 text-xs text-slate-400">
        <span className="font-semibold text-slate-300 block mb-2">
          Regulatory & Calibration Appendix
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400">
          <div>Translation Thr: {effectiveConfig.translationThresholdPx} px</div>
          <div>Rotation Thr: {effectiveConfig.rotationThresholdDeg}°</div>
          <div>Zoom Thr: ±{effectiveConfig.zoomThresholdPercent}%</div>
          <div>Min Consistency: {effectiveConfig.minSceneConsistencyPercent}%</div>
          <div>Brightness Tolerance: {effectiveConfig.brightnessTolerancePercent}%</div>
          <div>Consecutive Count: {effectiveConfig.consecutiveConfirmationCount}</div>
          <div>Algorithm: ORB + RANSAC</div>
          <div>Engine Version: Production CV-v248</div>
        </div>
      </div>

      {/* Interactive Print & Export Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 print:hidden animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">
                  Print & Save Scene Audit Report
                </h3>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p className="leading-relaxed">
                Your print-ready report has been prepared for{' '}
                <strong className="text-white">{report.referenceSceneName}</strong>{' '}
                ({effectiveResults.length} frames evaluated).
              </p>

              <div className="p-3.5 rounded-lg bg-sky-950/40 border border-sky-800/60 text-sky-200 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-sky-300">
                  <CheckCircle2 className="h-4 w-4 text-sky-400 shrink-0" />
                  <span>Printable Document Ready</span>
                </div>
                <p className="text-[11px] text-sky-300/80">
                  A standalone, print-optimized document has been downloaded to your system.
                  Opening this document in Chrome, Edge, or Firefox lets you directly choose{' '}
                  <strong className="text-white">"Save as PDF"</strong> or select your printer.
                </p>
              </div>
            </div>

            {/* Action Grid */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleDownloadPrintableHtml}
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Download className="h-4 w-4" />
                <span>Download Standalone Printable Report (.html / PDF Ready)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    try {
                      window.print();
                    } catch (e) {
                      console.warn(e);
                    }
                  }}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs transition-colors border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-sky-400" />
                  <span>Direct Browser Print</span>
                </button>

                <button
                  onClick={handleCopySummary}
                  className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs transition-colors border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{copySuccess ? 'Copied!' : 'Copy Summary Text'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleExportCsv}
                  className="py-1.5 px-3 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded text-xs border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Download CSV</span>
                </button>

                <button
                  onClick={handleExportJson}
                  className="py-1.5 px-3 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded text-xs border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileJson className="h-3.5 w-3.5 text-sky-400" />
                  <span>Download JSON</span>
                </button>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-1.5 text-xs text-slate-400 hover:text-white font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
