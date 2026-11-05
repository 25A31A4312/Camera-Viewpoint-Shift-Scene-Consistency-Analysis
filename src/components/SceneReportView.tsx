import React from 'react';
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
} from 'lucide-react';
import { AnalysisConfig, FrameAnalysisResult, ReferenceScene } from '../types';
import { StorageService } from '../services/storage_service';

interface SceneReportViewProps {
  results: FrameAnalysisResult[];
  reference: ReferenceScene | null;
  config: AnalysisConfig;
}

export const SceneReportView: React.FC<SceneReportViewProps> = ({
  results,
  reference,
  config,
}) => {
  const report = StorageService.generateReport(results, reference, config);

  const handleExportCsv = () => {
    StorageService.exportToCsv(results, report);
  };

  const handleExportJson = () => {
    StorageService.exportToJson(report, results);
  };

  const handlePrint = () => {
    window.print();
  };

  // Compute SVG chart points for consistency timeline
  const chartWidth = 720;
  const chartHeight = 160;
  const padding = 30;

  const consistencyPoints = results.map((r, i) => {
    const x = padding + (i / Math.max(1, results.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - (r.sceneConsistencyScore / 100) * (chartHeight - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const translationPoints = results.map((r, i) => {
    const maxTrans = Math.max(40, ...results.map(res => res.transformation.translationDistance));
    const x = padding + (i / Math.max(1, results.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - (r.transformation.translationDistance / maxTrans) * (chartHeight - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="space-y-6 print:text-black">
      {/* Top Action Bar */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Scene Consistency & Viewpoint Shift Report
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Generated on {report.generatedAt} · Reference: {report.referenceSceneName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              disabled={results.length === 0}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Download CSV</span>
            </button>
            <button
              onClick={handleExportJson}
              disabled={results.length === 0}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileJson className="h-3.5 w-3.5 text-sky-400" />
              <span>Download JSON</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={results.length === 0}
              className="px-3 py-1.5 text-xs font-medium text-slate-950 bg-sky-400 hover:bg-sky-300 rounded transition-colors inline-flex items-center gap-1.5 font-semibold disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Executive Summary Card */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">
            Executive Audit Summary
          </span>
          <h2 className="text-base font-bold text-white mt-1">
            Monitoring Findings & Operational Stability
          </h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60 p-4 rounded border border-slate-800/80">
          {report.summaryExecutive}
        </p>

        {/* 6 Summary Stat Badges */}
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
      {results.length > 1 && (
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
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                {/* Horizontal reference grid lines */}
                <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#334155" strokeDasharray="3 3" />
                <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#334155" strokeDasharray="3 3" />
                <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#475569" />

                {/* Threshold line */}
                <line
                  x1={padding}
                  y1={chartHeight - padding - (config.minSceneConsistencyPercent / 100) * (chartHeight - 2 * padding)}
                  x2={chartWidth - padding}
                  y2={chartHeight - padding - (config.minSceneConsistencyPercent / 100) * (chartHeight - 2 * padding)}
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
              <span className="text-red-400">--- Min Threshold ({config.minSceneConsistencyPercent}%)</span>
              <span>End: Frame #{results.length}</span>
            </div>
          </div>

          {/* Translation Distance Chart */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Camera Translation Displacement (px)
              </span>
              <span className="text-[11px] font-mono text-amber-400">
                Thr: {config.translationThresholdPx}px
              </span>
            </div>

            <div className="h-44 w-full bg-slate-950/80 rounded border border-slate-800/80 p-2 flex items-center justify-center">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="#334155" strokeDasharray="3 3" />
                <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#334155" strokeDasharray="3 3" />
                <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#475569" />

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
              <span>Frame #{results.length}</span>
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
          <span className="text-xs text-slate-500 font-mono">
            Audit Trail
          </span>
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
                  <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-white">#{e.frameNumber}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">{e.timestamp}</td>
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
                    <td className="py-2.5 px-4 text-slate-400 max-w-sm truncate" title={e.details}>
                      {e.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs">
            No viewpoint shift anomalies or security exceptions recorded. Camera maintained full viewpoint stability.
          </div>
        )}
      </div>

      {/* Configuration Parameters Appendix */}
      <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-4 text-xs text-slate-400">
        <span className="font-semibold text-slate-300 block mb-2">
          Regulatory & Calibration Appendix
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400">
          <div>Translation Thr: {config.translationThresholdPx} px</div>
          <div>Rotation Thr: {config.rotationThresholdDeg}°</div>
          <div>Zoom Thr: ±{config.zoomThresholdPercent}%</div>
          <div>Min Consistency: {config.minSceneConsistencyPercent}%</div>
          <div>Brightness Tolerance: {config.brightnessTolerancePercent}%</div>
          <div>Consecutive Count: {config.consecutiveConfirmationCount}</div>
          <div>Algorithm: ORB + RANSAC</div>
          <div>Engine Version: Production CV-v248</div>
        </div>
      </div>
    </div>
  );
};
