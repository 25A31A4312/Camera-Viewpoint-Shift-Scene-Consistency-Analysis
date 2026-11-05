import React, { useState } from 'react';
import {
  AlertTriangle,
  Filter,
  Trash2,
  Search,
  CheckCircle,
  FileJson,
  FileSpreadsheet,
  X,
  ExternalLink,
  Compass,
  Cpu,
  Layers,
  Calendar,
  Clock,
  Eye,
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
  Sliders,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import {
  AnalysisSessionRecord,
  DetectionClassification,
  FrameAnalysisResult,
  ReferenceScene,
} from '../types';
import { StorageService } from '../services/storage_service';

interface AlertsAndHistoryProps {
  sessions: AnalysisSessionRecord[];
  activeResults: FrameAnalysisResult[];
  activeReference: ReferenceScene | null;
  onDeleteSession: (sessionId: string) => void;
  onClearAllHistory: () => void;
  onViewInLiveAnalysis?: (session: AnalysisSessionRecord) => void;
}

export const AlertsAndHistory: React.FC<AlertsAndHistoryProps> = ({
  sessions,
  activeResults,
  activeReference,
  onDeleteSession,
  onClearAllHistory,
  onViewInLiveAnalysis,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [inspectedFrameIndex, setInspectedFrameIndex] = useState<number>(0);
  const [frameModalResult, setFrameModalResult] = useState<FrameAnalysisResult | null>(null);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) || null;

  const eventTypes: Array<{ id: string; label: string }> = [
    { id: 'ALL', label: 'All Analyses' },
    { id: 'ANOMALIES', label: 'Anomalies Only' },
    { id: 'VIEWPOINT SHIFT DETECTED', label: 'Viewpoint Shift' },
    { id: 'ROTATION DETECTED', label: 'Rotation' },
    { id: 'ZOOM CHANGE DETECTED', label: 'Zoom' },
    { id: 'SCENE CHANGE DETECTED', label: 'Scene Discrepancy' },
    { id: 'LIGHTING VARIATION', label: 'Lighting Delta' },
    { id: 'NORMAL VIEW', label: 'Nominal View' },
  ];

  const getStatusBadge = (classification: DetectionClassification) => {
    switch (classification) {
      case 'NORMAL VIEW':
        return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'VIEWPOINT SHIFT DETECTED':
        return { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
      case 'ROTATION DETECTED':
        return { color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' };
      case 'ZOOM CHANGE DETECTED':
        return { color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
      case 'SCENE CHANGE DETECTED':
        return { color: 'text-red-400 bg-red-500/10 border-red-500/30' };
      case 'LIGHTING VARIATION':
        return { color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' };
      case 'INSUFFICIENT FEATURES':
        return { color: 'text-slate-400 bg-slate-800 border-slate-700' };
      default:
        return { color: 'text-slate-400 bg-slate-800 border-slate-700' };
    }
  };

  const filteredSessions = sessions.filter((s) => {
    // Filter by type
    if (filterType === 'ANOMALIES') {
      if (s.summary.dominantClassification === 'NORMAL VIEW') return false;
    } else if (filterType !== 'ALL' && s.summary.dominantClassification !== filterType) {
      return false;
    }

    // Filter by search term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchId = s.id.toLowerCase().includes(term);
      const matchName = s.sessionName.toLowerCase().includes(term);
      const matchRef = s.referenceScene.name.toLowerCase().includes(term);
      const matchFootage = s.footageDetails.name.toLowerCase().includes(term);
      const matchClass = s.summary.dominantClassification.toLowerCase().includes(term);
      const matchDate = s.formattedDate.toLowerCase().includes(term);
      const matchSummary = s.summary.executiveSummary.toLowerCase().includes(term);
      return (
        matchId ||
        matchName ||
        matchRef ||
        matchFootage ||
        matchClass ||
        matchDate ||
        matchSummary
      );
    }

    return true;
  });

  const exportSessionCsv = (session: AnalysisSessionRecord) => {
    const report = StorageService.generateReport(
      session.results,
      session.referenceScene,
      session.configUsed
    );
    StorageService.exportToCsv(session.results, report);
  };

  const exportSessionJson = (session: AnalysisSessionRecord) => {
    const report = StorageService.generateReport(
      session.results,
      session.referenceScene,
      session.configUsed
    );
    StorageService.exportToJson(report, session.results);
  };

  // --- VIEW 1: SINGLE SESSION INSPECTOR ---
  if (selectedSession) {
    const activeFrame =
      selectedSession.footageDetails.framesSummary[inspectedFrameIndex] ||
      selectedSession.footageDetails.framesSummary[0];
    const activeFrameResult =
      selectedSession.results[inspectedFrameIndex] || selectedSession.results[0];

    return (
      <div className="space-y-6">
        {/* Back Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedSessionId(null)}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to All Analyses</span>
            </button>
            <div>
              <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
                Historical Analysis Record
              </span>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{selectedSession.sessionName}</span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="text-xs font-mono text-slate-400 font-normal">
                  {selectedSession.formattedDate}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSessionCsv(selectedSession)}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => exportSessionJson(selectedSession)}
              className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileJson className="h-3.5 w-3.5 text-sky-400" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this historical analysis record?')) {
                  onDeleteSession(selectedSession.id);
                  setSelectedSessionId(null);
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Record</span>
            </button>
          </div>
        </div>

        {/* Executive Summary Card */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded text-xs font-bold border ${
                  getStatusBadge(selectedSession.summary.dominantClassification).color
                }`}
              >
                {selectedSession.summary.dominantClassification}
              </span>
              <span className="text-xs font-mono text-slate-400">
                ID: {selectedSession.id}
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Avg Consistency</span>
                <span className="text-base font-bold text-sky-400">
                  {selectedSession.summary.sceneConsistencyScore}%
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Confidence</span>
                <span className="text-base font-bold text-white">
                  {selectedSession.summary.confidenceScore}%
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded border border-slate-800 leading-relaxed font-sans">
            {selectedSession.summary.executiveSummary}
          </p>

          {/* Measurements Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Max Translation</span>
              <span className="text-sm font-semibold text-white font-mono">
                {selectedSession.summary.maxTranslationPx} px
              </span>
              <span className="text-[10px] text-slate-500 block">
                dx: {selectedSession.summary.maxTranslationX}px / dy:{' '}
                {selectedSession.summary.maxTranslationY}px
              </span>
            </div>

            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Max Rotation</span>
              <span className="text-sm font-semibold text-white font-mono">
                {selectedSession.summary.maxRotationDeg}°
              </span>
              <span className="text-[10px] text-slate-500 block">Optical in-plane tilt</span>
            </div>

            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Max Scale / Zoom</span>
              <span className="text-sm font-semibold text-white font-mono">
                {selectedSession.summary.maxScaleChangePct}%
              </span>
              <span className="text-[10px] text-slate-500 block">Focal length shift</span>
            </div>

            <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Evaluated Frames</span>
              <span className="text-sm font-semibold text-white font-mono">
                {selectedSession.footageDetails.totalFrames} frames
              </span>
              <span className="text-[10px] text-slate-500 block">
                {selectedSession.summary.anomaliesCount} anomalies detected
              </span>
            </div>
          </div>
        </div>

        {/* Original Visuals: Reference Image vs Original Footage Frames */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-sky-400" />
              <span>Original Scene Imagery (Preserved at Time of Analysis)</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              Frame #{inspectedFrameIndex + 1} of {selectedSession.results.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Reference Image */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Reference Baseline: {selectedSession.referenceScene.name}
                </span>
                <span className="font-mono text-slate-500">
                  {selectedSession.referenceScene.width} × {selectedSession.referenceScene.height} px
                </span>
              </div>
              <div className="rounded-lg border border-slate-800 bg-black overflow-hidden flex items-center justify-center h-64">
                {selectedSession.referenceScene.dataUrl ? (
                  <img
                    src={selectedSession.referenceScene.dataUrl}
                    alt="Original Reference"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500">No reference image stored</div>
                )}
              </div>
            </div>

            {/* Current Footage Frame */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-sky-400">
                  Current Analyzed Frame #{inspectedFrameIndex + 1} ({activeFrame?.timestampFormatted || '00:00'})
                </span>
                {activeFrameResult && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      getStatusBadge(activeFrameResult.classification).color
                    }`}
                  >
                    {activeFrameResult.classification}
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-slate-800 bg-black overflow-hidden flex items-center justify-center h-64">
                {activeFrame?.dataUrl ? (
                  <img
                    src={activeFrame.dataUrl}
                    alt={`Frame #${inspectedFrameIndex + 1}`}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-500">No frame snapshot stored</div>
                )}
              </div>
            </div>
          </div>

          {/* Frame Scrubber if multiple frames */}
          {selectedSession.results.length > 1 && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Scrub Analyzed Frames:</span>
                <span className="text-sky-400 font-mono font-semibold">
                  Frame #{inspectedFrameIndex + 1} ({activeFrame?.timestampFormatted})
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={selectedSession.results.length - 1}
                value={inspectedFrameIndex}
                onChange={(e) => setInspectedFrameIndex(parseInt(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Frame-by-Frame Audit Table for this session */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-400" />
              <span>Full Evaluated Frame Audit Log ({selectedSession.results.length} Frames)</span>
            </h3>
            <span className="text-xs text-slate-500">Click any row to inspect transformation matrix</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-medium border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-normal">Frame</th>
                  <th className="py-2.5 px-4 font-normal">Timestamp</th>
                  <th className="py-2.5 px-4 font-normal">Classification</th>
                  <th className="py-2.5 px-4 font-normal">Consistency</th>
                  <th className="py-2.5 px-4 font-normal">Shift (dx, dy)</th>
                  <th className="py-2.5 px-4 font-normal">Rotation</th>
                  <th className="py-2.5 px-4 font-normal">Zoom</th>
                  <th className="py-2.5 px-4 font-normal text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {selectedSession.results.map((r, idx) => {
                  const badge = getStatusBadge(r.classification);
                  const isCurrent = idx === inspectedFrameIndex;
                  return (
                    <tr
                      key={r.id || idx}
                      onClick={() => {
                        setInspectedFrameIndex(idx);
                        setFrameModalResult(r);
                      }}
                      className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                        isCurrent ? 'bg-sky-500/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-medium text-white">
                        #{r.frameNumber}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400">{r.timestamp}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${badge.color}`}
                        >
                          {r.classification}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold tabular-nums text-sky-400">
                        {r.sceneConsistencyScore}%
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                        {r.transformation.translationDistance} px ({r.transformation.translationX},{' '}
                        {r.transformation.translationY})
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                        {r.transformation.rotationDegrees}°
                      </td>
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                        {(r.transformation.scaleChange * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectedFrameIndex(idx);
                            setFrameModalResult(r);
                          }}
                          className="px-2 py-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 rounded border border-sky-500/20 transition-colors cursor-pointer"
                        >
                          Matrix
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transformation Matrix Modal */}
        {frameModalResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Frame #{frameModalResult.frameNumber} Transformation Matrix</span>
                  <span className="text-slate-400 font-mono text-xs">
                    ({frameModalResult.timestamp})
                  </span>
                </h4>
                <button
                  onClick={() => setFrameModalResult(null)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800 font-mono text-xs space-y-1 text-slate-300">
                {frameModalResult.transformation.matrix.map((row, ri) => (
                  <div key={ri} className="flex justify-around">
                    {row.map((val, ci) => (
                      <span key={ci} className="w-24 text-right tabular-nums">
                        {val.toFixed(4)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-400 font-mono">{frameModalResult.details}</p>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setFrameModalResult(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 rounded border border-slate-700 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VIEW 2: ALL HISTORICAL SESSIONS LIST ---
  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                Surveillance History & Audit Trail
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span className="text-xs font-mono text-slate-400">
                {sessions.length} Saved Records
              </span>
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight mt-0.5">
              Persistent Analysis History
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Every completed CCTV analysis is preserved as an independent audit record with original reference imagery, footage frames, measurements, and executive summaries. Uploading new reference images or footage never overwrites your history.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (
                  confirm(
                    'Are you sure you want to clear all historical analysis records? This cannot be undone.'
                  )
                ) {
                  onClearAllHistory();
                }
              }}
              disabled={sessions.length === 0}
              className="px-3.5 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All History</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-1">
            {eventTypes.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilterType(t.id)}
                className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterType === t.id
                    ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 bg-slate-950/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by ID, name, date, details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Sessions Grid */}
      {filteredSessions.length > 0 ? (
        <div className="space-y-4">
          {filteredSessions.map((s) => {
            const badge = getStatusBadge(s.summary.dominantClassification);
            return (
              <div
                key={s.id}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700/80 transition-all space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-medium text-slate-400">
                        {s.formattedDate}
                      </span>
                      <span aria-hidden="true" className="text-slate-700">
                        ·
                      </span>
                      <span className="text-xs font-mono text-slate-500">{s.id}</span>
                      <span aria-hidden="true" className="text-slate-700">
                        ·
                      </span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${badge.color}`}
                      >
                        {s.summary.dominantClassification}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{s.sessionName}</h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedSessionId(s.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Inspect Original Record</span>
                    </button>
                    <button
                      onClick={() => exportSessionCsv(s)}
                      title="Export CSV"
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 cursor-pointer"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                    </button>
                    <button
                      onClick={() => exportSessionJson(s)}
                      title="Export JSON"
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 cursor-pointer"
                    >
                      <FileJson className="h-3.5 w-3.5 text-sky-400" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete analysis record "${s.sessionName}"?`)) {
                          onDeleteSession(s.id);
                        }
                      }}
                      title="Delete Record"
                      className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content row: Reference Thumbnail, Footage Thumbnail, Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                  {/* Reference Image Thumbnail */}
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      Reference Baseline
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-12 w-16 bg-black rounded overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                        {s.referenceScene.dataUrl ? (
                          <img
                            src={s.referenceScene.dataUrl}
                            alt="Ref"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-600" />
                        )}
                      </div>
                      <div className="truncate text-xs">
                        <span className="font-semibold text-slate-200 block truncate">
                          {s.referenceScene.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {s.referenceScene.width}×{s.referenceScene.height}px
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footage Summary */}
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      Footage Evaluated
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="h-12 w-16 bg-black rounded overflow-hidden shrink-0 border border-slate-800 flex items-center justify-center">
                        {s.footageDetails.thumbnailUrl ? (
                          <img
                            src={s.footageDetails.thumbnailUrl}
                            alt="Footage"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Film className="h-4 w-4 text-slate-600" />
                        )}
                      </div>
                      <div className="truncate text-xs">
                        <span className="font-semibold text-slate-200 block truncate">
                          {s.footageDetails.totalFrames} frames
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Duration: {s.footageDetails.durationFormatted}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Scene Consistency & Confidence */}
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex flex-col justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      Consistency Assessment
                    </span>
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-lg font-bold text-sky-400 font-mono">
                          {s.summary.sceneConsistencyScore}%
                        </span>
                        <span className="text-[10px] text-slate-500 block">Consistency</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-white font-mono">
                          {s.summary.confidenceScore}%
                        </span>
                        <span className="text-[10px] text-slate-500 block">Confidence</span>
                      </div>
                    </div>
                  </div>

                  {/* Geometric Shifts Measured */}
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex flex-col justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block">
                      Displacement Metrics
                    </span>
                    <div className="space-y-0.5 text-[11px] font-mono text-slate-300">
                      <div>
                        <span className="text-slate-500">Shift: </span>
                        <span className="font-semibold text-white">
                          {s.summary.maxTranslationPx} px
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Rotation: </span>
                        <span className="font-semibold text-white">
                          {s.summary.maxRotationDeg}°
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Zoom: </span>
                        <span className="font-semibold text-white">
                          {s.summary.maxScaleChangePct}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Executive Summary Snippet */}
                <p className="text-xs text-slate-400 leading-relaxed truncate">
                  {s.summary.executiveSummary}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900/20 p-12 text-center space-y-3">
          <Calendar className="h-8 w-8 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-300">No Analysis History Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Run an analysis by uploading a reference scene and footage in the Dashboard or Live Analysis view. Every analysis completed will be permanently recorded here with its original imagery and metrics.
          </p>
        </div>
      )}
    </div>
  );
};
