import React, { useEffect, useState } from 'react';
import {
  ActiveTab,
  Navbar,
} from './components/Navbar';
import { DashboardOverview } from './components/DashboardOverview';
import { ReferenceManager } from './components/ReferenceManager';
import { UploadAndProcessing } from './components/UploadAndProcessing';
import { LiveAnalysisView } from './components/LiveAnalysisView';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { AlertsAndHistory } from './components/AlertsAndHistory';
import { SceneReportView } from './components/SceneReportView';
import { BenchmarkSuite } from './components/BenchmarkSuite';
import {
  AnalysisConfig,
  AnalysisSessionRecord,
  DetectionClassification,
  FrameAnalysisResult,
  ReferenceScene,
  VideoFrameItem,
} from './types';
import {
  DEFAULT_CONFIG,
  analyzeFrameAgainstReference,
  processReferenceScene,
} from './computer_vision/cv_pipeline';
import { ConsecutiveEventTracker } from './computer_vision/viewpoint_detector';
import { StorageService } from './services/storage_service';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [reference, setReference] = useState<ReferenceScene | null>(null);
  const [frames, setFrames] = useState<VideoFrameItem[]>([]);
  const [results, setResults] = useState<FrameAnalysisResult[]>([]);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [config, setConfig] = useState<AnalysisConfig>(() =>
    StorageService.loadConfig(DEFAULT_CONFIG)
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Persistent History Records across the entire application lifetime
  const [historySessions, setHistorySessions] = useState<AnalysisSessionRecord[]>([]);

  // Load persistent history records and active reference on startup
  useEffect(() => {
    // 1. Load all saved historical sessions from IndexedDB / API
    StorageService.getAllSessions().then((saved) => {
      if (Array.isArray(saved) && saved.length > 0) {
        setHistorySessions(saved);
      }
    });

    // 2. Re-hydrate saved reference scene
    const savedRef = StorageService.loadReferenceScene();
    if (savedRef && savedRef.dataUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const scene = await processReferenceScene(
            img,
            savedRef.name || 'Saved Baseline',
            savedRef.fileSizeFormatted || 'Cached'
          );
          setReference(scene);
        } catch (e) {
          console.error('Failed to rehydrate reference scene', e);
        }
      };
      img.src = savedRef.dataUrl;
    }

    // 3. Load active results if previously in progress
    const savedResults = StorageService.loadResults();
    if (savedResults.length > 0) {
      setResults(savedResults);
    }
  }, []);

  // Save config changes
  const handleConfigChange = (newConfig: AnalysisConfig) => {
    setConfig(newConfig);
    StorageService.saveConfig(newConfig);
  };

  // Update Reference Scene - NEVER erases historical analyses
  const handleReferenceUpdated = (scene: ReferenceScene | null) => {
    setReference(scene);
    StorageService.saveReferenceScene(scene);
    // Explicitly reset active results and current frames when a new reference baseline is chosen
    // This prevents stale results from previous references being displayed on the dashboard/live view
    setResults([]);
    setFrames([]);
    StorageService.clearActiveResults();
  };

  // Automated Sequential Computer Vision Analysis on incoming frames
  const runAnalysisOnFrames = async (
    incomingFrames: VideoFrameItem[],
    targetRef: ReferenceScene,
    targetConfig: AnalysisConfig
  ) => {
    setIsProcessing(true);
    setStatusMessage(`Analyzing ${incomingFrames.length} frames using ORB + RANSAC...`);

    const tracker = new ConsecutiveEventTracker();
    const newResults: FrameAnalysisResult[] = [];
    const sessionInputFingerprint = `INP_${targetRef.id.substring(0, 8)}_${incomingFrames.length}F_${Date.now().toString(36)}`;

    for (let i = 0; i < incomingFrames.length; i++) {
      const frame = incomingFrames[i];
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve) => {
        img.onload = () => {
          try {
            const frameFingerprint = `${sessionInputFingerprint}_f${frame.frameNumber}_${Math.random().toString(36).substring(2, 6)}`;
            const res = analyzeFrameAgainstReference(
              img,
              targetRef,
              targetConfig,
              frame.frameNumber,
              frame.timestampSeconds,
              frame.dataUrl,
              frameFingerprint
            );

            // Apply consecutive-frame confirmation
            const isConfirmed = tracker.processFrame(
              res.classification,
              targetConfig.consecutiveConfirmationCount
            );
            res.confirmedEvent = isConfirmed;

            newResults.push(res);
          } catch (err) {
            console.error(`Frame #${frame.frameNumber} analysis error`, err);
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = frame.dataUrl;
      });
    }

    setResults(newResults);
    setFrames(incomingFrames);
    setActiveFrameIndex(0);
    setIsProcessing(false);
    setStatusMessage(null);

    // Save active results cache
    StorageService.saveResults(newResults);

    // --- SAVE TO PERSISTENT ANALYSIS HISTORY (ISSUE 1 FIX) ---
    // Calculate comprehensive summary metrics for this specific analysis run
    let normalFramesCount = 0;
    let anomaliesCount = 0;
    let sumConsistency = 0;
    let sumConfidence = 0;
    let maxTransDist = 0;
    let maxTransX = 0;
    let maxTransY = 0;
    let maxRotDeg = 0;
    let maxScalePct = 0;

    const classificationCounts: Record<string, number> = {};

    for (const r of newResults) {
      sumConsistency += r.sceneConsistencyScore;
      sumConfidence += r.confidenceScore;
      classificationCounts[r.classification] = (classificationCounts[r.classification] || 0) + 1;

      if (r.classification === 'NORMAL VIEW') {
        normalFramesCount++;
      } else {
        anomaliesCount++;
      }

      const td = r.transformation.translationDistance || 0;
      if (td >= maxTransDist) {
        maxTransDist = td;
        maxTransX = r.transformation.translationX || 0;
        maxTransY = r.transformation.translationY || 0;
      }

      const rot = Math.abs(r.transformation.rotationDegrees || 0);
      if (rot > maxRotDeg) {
        maxRotDeg = rot;
      }

      const scaleDeviation = Math.abs((r.transformation.scaleChange || 1.0) - 1.0) * 100;
      if (scaleDeviation > maxScalePct) {
        maxScalePct = scaleDeviation;
      }
    }

    // Determine dominant classification (prioritizing alerts over normal)
    let dominantClassification: DetectionClassification = 'NORMAL VIEW';
    if (anomaliesCount > 0) {
      let maxCount = 0;
      for (const [cls, cnt] of Object.entries(classificationCounts)) {
        if (cls !== 'NORMAL VIEW' && cnt > maxCount) {
          maxCount = cnt;
          dominantClassification = cls as DetectionClassification;
        }
      }
    }

    const avgConsistency =
      newResults.length > 0 ? Math.round(sumConsistency / newResults.length) : 0;
    const avgConfidence =
      newResults.length > 0 ? Math.round(sumConfidence / newResults.length) : 0;

    const maxSec =
      incomingFrames.length > 0
        ? incomingFrames[incomingFrames.length - 1].timestampSeconds
        : 0;
    const mins = Math.floor(maxSec / 60);
    const secs = Math.floor(maxSec % 60);
    const durationFormatted = `${mins}m ${secs}s`;

    let executiveSummary = `Evaluated ${newResults.length} frames across ${durationFormatted}. `;
    if (anomaliesCount === 0) {
      executiveSummary += `Viewpoint remained strictly stable with reference baseline (${targetRef.name}). Consistency: ${avgConsistency}%. No shifts or rotations occurred.`;
    } else {
      executiveSummary += `Detected ${anomaliesCount} viewpoint anomaly frame(s). Dominant status: ${dominantClassification}. Max shift: ${maxTransDist.toFixed(1)}px, max rotation: ${maxRotDeg.toFixed(1)}°, max zoom: ${maxScalePct.toFixed(1)}%.`;
    }

    const uniqueId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const formattedDate = now.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newSessionRecord: AnalysisSessionRecord = {
      id: uniqueId,
      createdAt: now.toISOString(),
      formattedDate,
      sessionName: targetRef.name
        ? `Surveillance: ${targetRef.name}`
        : `CCTV Analysis Session #${historySessions.length + 1}`,
      referenceScene: {
        id: targetRef.id,
        name: targetRef.name,
        width: targetRef.width,
        height: targetRef.height,
        dataUrl: targetRef.dataUrl,
        averageLuminance: targetRef.averageLuminance,
        contrastStdDev: targetRef.contrastStdDev,
        timestamp: targetRef.timestamp,
        fileSizeFormatted: targetRef.fileSizeFormatted,
      },
      footageDetails: {
        name: `Surveillance Footage (${incomingFrames.length} Frames)`,
        totalFrames: incomingFrames.length,
        durationFormatted,
        thumbnailUrl: incomingFrames[0]?.dataUrl || '',
        framesSummary: incomingFrames.map((f) => ({
          id: f.id,
          frameNumber: f.frameNumber,
          timestampFormatted: f.timestampFormatted,
          timestampSeconds: f.timestampSeconds,
          dataUrl: f.dataUrl,
        })),
      },
      summary: {
        dominantClassification,
        sceneConsistencyScore: avgConsistency,
        confidenceScore: avgConfidence,
        status: anomaliesCount > 0 ? 'alert' : 'nominal',
        maxTranslationPx: Number(maxTransDist.toFixed(1)),
        maxTranslationX: Number(maxTransX.toFixed(1)),
        maxTranslationY: Number(maxTransY.toFixed(1)),
        maxRotationDeg: Number(maxRotDeg.toFixed(2)),
        maxScaleChangePct: Number(maxScalePct.toFixed(1)),
        anomaliesCount,
        normalFramesCount,
        totalFramesCount: newResults.length,
        executiveSummary,
      },
      results: newResults,
      configUsed: targetConfig,
      inputFingerprint: sessionInputFingerprint,
    };

    // Save permanently to IndexedDB and backend
    await StorageService.saveSession(newSessionRecord);

    // Update historical session list state (newest first)
    setHistorySessions((prev) => [newSessionRecord, ...prev]);
  };

  // Called when UploadAndProcessing has extracted frames
  const handleFramesReady = async (
    incomingFrames: VideoFrameItem[],
    description: string
  ) => {
    if (!reference) {
      alert('Please establish a Reference Baseline Scene first.');
      setActiveTab('reference');
      return;
    }

    await runAnalysisOnFrames(incomingFrames, reference, config);
    setActiveTab('analysis');
  };

  // Delete an individual historical session
  const handleDeleteSession = async (sessionId: string) => {
    await StorageService.deleteSession(sessionId);
    setHistorySessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  // Clear all historical records
  const handleClearAllHistory = async () => {
    await StorageService.clearAllSessions();
    setHistorySessions([]);
  };

  // View a historical record in live analysis view
  const handleViewInLiveAnalysis = (session: AnalysisSessionRecord) => {
    setResults(session.results);
    const convertedFrames: VideoFrameItem[] = session.footageDetails.framesSummary.map((f) => ({
      id: f.id,
      frameNumber: f.frameNumber,
      timestampSeconds: f.timestampSeconds,
      timestampFormatted: f.timestampFormatted,
      dataUrl: f.dataUrl,
      width: session.referenceScene.width,
      height: session.referenceScene.height,
    }));
    setFrames(convertedFrames);
    setActiveFrameIndex(0);
    setActiveTab('analysis');
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-200 flex flex-col font-sans">
      {/* 3-Zone Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        hasReference={reference !== null}
        isProcessing={isProcessing}
        totalAnalyzed={results.length}
        onRunQuickDemo={() => setActiveTab('benchmark')}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {statusMessage && (
          <div className="mb-4 p-3 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400 text-xs flex items-center gap-2 font-mono">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Tab 1: Dashboard Overview */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <DashboardOverview
              results={results}
              reference={reference}
              config={config}
              onNavigate={(tab) => setActiveTab(tab)}
              onRunBenchmark={() => setActiveTab('benchmark')}
            />

            <UploadAndProcessing
              onFramesReady={handleFramesReady}
              config={config}
              isProcessing={isProcessing}
              reference={reference}
            />
          </div>
        )}

        {/* Tab 2: Live Analysis & Vector Matching */}
        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <LiveAnalysisView
              reference={reference}
              frames={frames}
              results={results}
              activeFrameIndex={activeFrameIndex}
              onSelectFrame={(idx) => setActiveFrameIndex(idx)}
              isAnalyzing={isProcessing}
              onRunBatchAnalysis={() => {}}
            />

            <UploadAndProcessing
              onFramesReady={handleFramesReady}
              config={config}
              isProcessing={isProcessing}
              reference={reference}
            />
          </div>
        )}

        {/* Tab 3: Reference Scene Management */}
        {activeTab === 'reference' && (
          <ReferenceManager
            reference={reference}
            onReferenceUpdated={handleReferenceUpdated}
            isProcessing={isProcessing}
          />
        )}

        {/* Tab 4: Validation Benchmark Suite */}
        {activeTab === 'benchmark' && <BenchmarkSuite config={config} />}

        {/* Tab 5: Events & Audit History */}
        {activeTab === 'events' && (
          <AlertsAndHistory
            sessions={historySessions}
            activeResults={results}
            activeReference={reference}
            onDeleteSession={handleDeleteSession}
            onClearAllHistory={handleClearAllHistory}
            onViewInLiveAnalysis={handleViewInLiveAnalysis}
          />
        )}

        {/* Tab 6: Formal Scene Consistency Report */}
        {activeTab === 'report' && (
          <SceneReportView
            results={results}
            reference={reference}
            config={config}
            historySessions={historySessions}
          />
        )}

        {/* Tab 7: Configuration Panel */}
        {activeTab === 'config' && (
          <ConfigurationPanel
            config={config}
            onChangeConfig={handleConfigChange}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Project T248</span>
            <span aria-hidden="true">·</span>
            <span>Camera Viewpoint Shift & Scene Consistency Analysis</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            ORB Feature Engine · RANSAC Geometric Consensus · CLAHE Normalized · Persistent IndexedDB
          </div>
        </div>
      </footer>
    </div>
  );
}
