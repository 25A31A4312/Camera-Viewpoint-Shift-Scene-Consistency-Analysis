/**
 * Persistent Storage & Report Generation Service
 * Manages detection session history via IndexedDB and backend SQLite/JSON DB,
 * event records, and report export (CSV & JSON).
 */

import {
  AnalysisConfig,
  AnalysisSessionRecord,
  ConsistencyReport,
  FrameAnalysisResult,
  ReferenceScene,
} from '../types';

const STORAGE_KEYS = {
  CONFIG: 't248_cv_config',
  REFERENCE: 't248_cv_reference',
  RESULTS: 't248_cv_results',
  REPORTS: 't248_cv_reports',
};

const DB_NAME = 't248_cctv_surveillance_db';
const DB_VERSION = 1;
const STORE_SESSIONS = 'analysis_sessions';

// Open / initialize IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in current environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export const StorageService = {
  /**
   * Saves an AnalysisSessionRecord to IndexedDB and syncs to backend API
   */
  async saveSession(session: AnalysisSessionRecord): Promise<void> {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        const store = tx.objectStore(STORE_SESSIONS);
        const req = store.put(session);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Failed to save session to IndexedDB, fallback to API', e);
    }

    // Sync to backend SQLite / JSON database
    try {
      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
      }).catch((err) => {
        console.warn('API sync warning:', err);
      });
    } catch {
      // ignore network errors in isolated test runs
    }
  },

  /**
   * Retrieves all historical AnalysisSessionRecords, ordered newest first
   */
  async getAllSessions(): Promise<AnalysisSessionRecord[]> {
    let sessions: AnalysisSessionRecord[] = [];

    try {
      const db = await openDatabase();
      sessions = await new Promise<AnalysisSessionRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readonly');
        const store = tx.objectStore(STORE_SESSIONS);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as AnalysisSessionRecord[]) || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Failed to retrieve sessions from IndexedDB, trying API', e);
    }

    // If IndexedDB returned empty or had an issue, fallback to backend database
    if (sessions.length === 0) {
      try {
        const res = await fetch('/api/history');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.sessions) && data.sessions.length > 0) {
            sessions = data.sessions;
            // Seed back to IndexedDB for offline speed
            try {
              const db = await openDatabase();
              const tx = db.transaction(STORE_SESSIONS, 'readwrite');
              const store = tx.objectStore(STORE_SESSIONS);
              sessions.forEach((s) => store.put(s));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // Sort descending by creation date
    return sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Retrieves a single historical session by unique ID
   */
  async getSessionById(id: string): Promise<AnalysisSessionRecord | null> {
    try {
      const db = await openDatabase();
      return await new Promise<AnalysisSessionRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readonly');
        const store = tx.objectStore(STORE_SESSIONS);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Failed to get session by id from IndexedDB', e);
    }

    // Fallback to API
    try {
      const res = await fetch(`/api/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        return data.session || null;
      }
    } catch {
      // ignore
    }

    return null;
  },

  /**
   * Deletes a specific historical session by unique ID
   */
  async deleteSession(id: string): Promise<void> {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        const store = tx.objectStore(STORE_SESSIONS);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Failed to delete session from IndexedDB', e);
    }

    // Sync delete to backend
    try {
      fetch(`/api/history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => {});
    } catch {
      // ignore
    }
  },

  /**
   * Clears all historical sessions from persistent storage
   */
  async clearAllSessions(): Promise<void> {
    try {
      const db = await openDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_SESSIONS, 'readwrite');
        const store = tx.objectStore(STORE_SESSIONS);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Failed to clear sessions from IndexedDB', e);
    }

    // Sync clear to backend
    try {
      fetch('/api/history', {
        method: 'DELETE',
      }).catch(() => {});
    } catch {
      // ignore
    }
  },

  // Save / Load Analysis Configuration
  saveConfig(config: AnalysisConfig): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to save config to localStorage', e);
    }
  },

  loadConfig(defaultConfig: AnalysisConfig): AnalysisConfig {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (data) {
        return { ...defaultConfig, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Failed to load config from localStorage', e);
    }
    return defaultConfig;
  },

  // Save / Load Reference Scene
  saveReferenceScene(scene: ReferenceScene | null): void {
    try {
      if (!scene) {
        localStorage.removeItem(STORAGE_KEYS.REFERENCE);
        return;
      }
      const toStore = {
        id: scene.id,
        name: scene.name,
        width: scene.width,
        height: scene.height,
        dataUrl: scene.dataUrl,
        averageLuminance: scene.averageLuminance,
        contrastStdDev: scene.contrastStdDev,
        timestamp: scene.timestamp,
        fileSizeFormatted: scene.fileSizeFormatted,
      };
      localStorage.setItem(STORAGE_KEYS.REFERENCE, JSON.stringify(toStore));
    } catch (e) {
      console.warn('Failed to persist reference scene', e);
    }
  },

  loadReferenceScene(): Partial<ReferenceScene> | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.REFERENCE);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load reference scene', e);
    }
    return null;
  },

  // Save / Load Frame Analysis Results for active session
  saveResults(results: FrameAnalysisResult[]): void {
    try {
      const compact = results.map((r) => ({
        id: r.id,
        frameNumber: r.frameNumber,
        timestamp: r.timestamp,
        timestampSeconds: r.timestampSeconds,
        sceneConsistencyScore: r.sceneConsistencyScore,
        featuresDetected: r.featuresDetected,
        validMatches: r.validMatches,
        inliersCount: r.inliersCount,
        inlierRatio: r.inlierRatio,
        transformation: r.transformation,
        luminanceDelta: r.luminanceDelta,
        contrastDelta: r.contrastDelta,
        classification: r.classification,
        confidenceScore: r.confidenceScore,
        processingTimeMs: r.processingTimeMs,
        status: r.status,
        details: r.details,
      }));
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(compact));
    } catch (e) {
      console.warn('Failed to save results', e);
    }
  },

  loadResults(): FrameAnalysisResult[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RESULTS);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.map((item: any) => ({
          ...item,
          matchedPoints: [],
        }));
      }
    } catch (e) {
      console.warn('Failed to load results', e);
    }
    return [];
  },

  clearActiveResults(): void {
    localStorage.removeItem(STORAGE_KEYS.RESULTS);
  },

  clearAllData(): void {
    localStorage.removeItem(STORAGE_KEYS.RESULTS);
    localStorage.removeItem(STORAGE_KEYS.REFERENCE);
  },

  /**
   * Generates a formal Scene Consistency Report from analyzed frame records
   */
  generateReport(
    results: FrameAnalysisResult[],
    reference: ReferenceScene | { name: string; width: number; height: number } | null,
    config: AnalysisConfig
  ): ConsistencyReport {
    const totalFrames = results.length;
    let normalFrames = 0;
    let viewpointShiftEvents = 0;
    let rotationEvents = 0;
    let zoomEvents = 0;
    let sceneChangeEvents = 0;
    let lightingOnlyEvents = 0;
    let insufficientFeatureFrames = 0;
    let sumConsistency = 0;
    let sumProcessingTime = 0;

    for (let i = 0; i < totalFrames; i++) {
      const r = results[i];
      sumConsistency += r.sceneConsistencyScore;
      sumProcessingTime += r.processingTimeMs;

      switch (r.classification) {
        case 'NORMAL VIEW':
          normalFrames++;
          break;
        case 'VIEWPOINT SHIFT DETECTED':
          viewpointShiftEvents++;
          break;
        case 'ROTATION DETECTED':
          rotationEvents++;
          break;
        case 'ZOOM CHANGE DETECTED':
          zoomEvents++;
          break;
        case 'SCENE CHANGE DETECTED':
          sceneChangeEvents++;
          break;
        case 'LIGHTING VARIATION':
          lightingOnlyEvents++;
          break;
        case 'INSUFFICIENT FEATURES':
          insufficientFeatureFrames++;
          break;
      }
    }

    const avgConsistency = totalFrames > 0 ? Math.round(sumConsistency / totalFrames) : 0;
    const avgProcTime = totalFrames > 0 ? Math.round(sumProcessingTime / totalFrames) : 0;

    const maxTime = results.length > 0 ? results[results.length - 1].timestampSeconds : 0;
    const mins = Math.floor(maxTime / 60);
    const secs = Math.floor(maxTime % 60);
    const durationFormatted = `${mins}m ${secs}s`;

    // Filter significant events
    const events = results
      .filter((r) => r.classification !== 'NORMAL VIEW')
      .map((r) => ({
        id: r.id,
        frameNumber: r.frameNumber,
        timestamp: r.timestamp,
        classification: r.classification,
        consistencyScore: r.sceneConsistencyScore,
        confidenceScore: r.confidenceScore,
        translationPx: r.transformation.translationDistance,
        rotationDeg: r.transformation.rotationDegrees,
        scaleChange: r.transformation.scaleChange,
        details: r.details,
      }));

    // Executive Summary
    let summaryExecutive = `Fixed Camera Monitoring Assessment: Evaluated ${totalFrames} consecutive frames across ${durationFormatted}. `;
    if (
      viewpointShiftEvents === 0 &&
      rotationEvents === 0 &&
      zoomEvents === 0 &&
      sceneChangeEvents === 0
    ) {
      summaryExecutive += `Camera viewpoint remained strictly stable and consistent with the reference baseline (Average consistency: ${avgConsistency}%). No unexpected physical shifts or rotations occurred.`;
    } else {
      const totalAlerts = viewpointShiftEvents + rotationEvents + zoomEvents + sceneChangeEvents;
      summaryExecutive += `Detected ${totalAlerts} viewpoint anomalies (${viewpointShiftEvents} translations, ${rotationEvents} rotations, ${zoomEvents} zoom changes, ${sceneChangeEvents} scene discrepancies). Average scene consistency was ${avgConsistency}%. Manual camera alignment verification is recommended.`;
    }

    return {
      generatedAt: new Date().toLocaleString(),
      referenceSceneName: reference ? reference.name : 'Unknown Scene',
      referenceDimensions: reference ? `${reference.width} × ${reference.height} px` : 'N/A',
      totalFramesProcessed: totalFrames,
      normalFrames,
      viewpointShiftEvents,
      rotationEvents,
      zoomEvents,
      sceneChangeEvents,
      lightingOnlyEvents,
      insufficientFeatureFrames,
      averageSceneConsistency: avgConsistency,
      averageProcessingTimeMs: avgProcTime,
      monitoringDurationFormatted: durationFormatted,
      thresholdsUsed: config,
      events,
      summaryExecutive,
    };
  },

  /**
   * Exports results and report to CSV format
   */
  exportToCsv(results: FrameAnalysisResult[], report: ConsistencyReport): void {
    const headers = [
      'Frame Number',
      'Timestamp',
      'Classification',
      'Consistency (%)',
      'Confidence (%)',
      'Features Detected',
      'Valid Matches',
      'Inliers Count',
      'Inlier Ratio',
      'Translation X (px)',
      'Translation Y (px)',
      'Translation Distance (px)',
      'Translation (% diag)',
      'Rotation (deg)',
      'Scale Change (ratio)',
      'Reprojection Error (RMSE)',
      'Luminance Delta',
      'Processing Time (ms)',
      'Details',
    ];

    const rows = results.map((r) => [
      r.frameNumber,
      `"${r.timestamp}"`,
      `"${r.classification}"`,
      r.sceneConsistencyScore,
      r.confidenceScore,
      r.featuresDetected,
      r.validMatches,
      r.inliersCount,
      r.inlierRatio,
      r.transformation.translationX,
      r.transformation.translationY,
      r.transformation.translationDistance,
      r.transformation.translationPercent,
      r.transformation.rotationDegrees,
      r.transformation.scaleChange,
      r.transformation.reprojectionError,
      r.luminanceDelta,
      r.processingTimeMs,
      `"${r.details.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [
      `# Camera Viewpoint Shift & Scene Consistency Analysis Report`,
      `# Generated: ${report.generatedAt}`,
      `# Reference Scene: ${report.referenceSceneName}`,
      `# Total Frames: ${report.totalFramesProcessed}, Average Consistency: ${report.averageSceneConsistency}%`,
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `camera_viewpoint_report_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Exports full report structure to JSON format
   */
  exportToJson(report: ConsistencyReport, rawResults?: FrameAnalysisResult[]): void {
    const data = {
      report,
      rawResults: rawResults?.map((r) => ({
        ...r,
        matchedPoints: undefined, // exclude raw pixel pairs to keep JSON file lightweight
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `camera_viewpoint_report_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Generates a self-contained, standalone printable HTML audit report.
   * Can be printed directly, saved as PDF, or opened offline in any browser.
   */
  generatePrintableHtml(
    report: ConsistencyReport,
    results: FrameAnalysisResult[],
    referenceName?: string
  ): string {
    const dominantAnomalies =
      report.viewpointShiftEvents +
      report.rotationEvents +
      report.zoomEvents +
      report.sceneChangeEvents;

    const statusBadge =
      dominantAnomalies === 0
        ? '<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">NOMINAL · VIEWPOINT STABLE</span>'
        : '<span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;">ALERT · ANOMALIES RECORDED</span>';

    const eventsHtml = (report.events || []).length > 0
      ? report.events.map((e) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
          <td style="padding: 8px 12px; font-family: monospace; font-weight: 600;">#${e.frameNumber}</td>
          <td style="padding: 8px 12px; font-family: monospace; color: #475569;">${e.timestamp}</td>
          <td style="padding: 8px 12px;">
            <span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 500;">
              ${e.classification}
            </span>
          </td>
          <td style="padding: 8px 12px; font-family: monospace; font-weight: 600; color: #0284c7;">${e.consistencyScore}%</td>
          <td style="padding: 8px 12px; font-family: monospace;">${e.translationPx} px</td>
          <td style="padding: 8px 12px; font-family: monospace;">${e.rotationDeg}°</td>
          <td style="padding: 8px 12px; font-family: monospace;">${(e.scaleChange * 100).toFixed(1)}%</td>
          <td style="padding: 8px 12px; color: #334155; font-size: 11px;">${e.details}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="8" style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">No viewpoint shift anomalies or security exceptions recorded. Camera maintained full viewpoint stability.</td></tr>';

    const sampleFramesHtml = results.slice(0, 50).map((r) => `
      <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
        <td style="padding: 6px 10px; font-family: monospace;">#${r.frameNumber}</td>
        <td style="padding: 6px 10px; font-family: monospace; color: #64748b;">${r.timestamp}</td>
        <td style="padding: 6px 10px;">${r.classification}</td>
        <td style="padding: 6px 10px; font-family: monospace;">${r.sceneConsistencyScore}%</td>
        <td style="padding: 6px 10px; font-family: monospace;">${r.transformation.translationDistance.toFixed(1)} px</td>
        <td style="padding: 6px 10px; font-family: monospace;">${r.transformation.rotationDegrees.toFixed(2)}°</td>
        <td style="padding: 6px 10px; font-family: monospace;">${(r.transformation.scaleChange * 100).toFixed(1)}%</td>
        <td style="padding: 6px 10px; font-family: monospace;">${r.confidenceScore}%</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CCTV Viewpoint Shift & Scene Consistency Report - ${report.referenceSceneName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .container {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    .btn-print {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-print:hover { background: #0369a1; }
    .grid-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 20px 0;
    }
    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
    }
    .stat-label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
    }
    .stat-val {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      font-family: monospace;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      border-bottom: 2px solid #cbd5e1;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .toolbar { display: none !important; }
      .page-break { page-break-before: always; }
      @page { margin: 1.5cm; size: A4 portrait; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <div>
        <strong style="color: #0284c7; font-size: 14px;">Surveillance Camera Audit System</strong>
        <span style="color: #64748b; font-size: 12px; margin-left: 8px;">Official Scene Report</span>
      </div>
      <div>
        <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
      <div>
        <h1 style="font-size: 22px; margin: 0 0 6px 0; color: #0f172a;">Camera Viewpoint Shift & Scene Consistency Report</h1>
        <p style="margin: 0; font-size: 13px; color: #64748b;">
          Audit Generated: <strong>${report.generatedAt}</strong> · Baseline: <strong>${report.referenceSceneName}</strong>
        </p>
      </div>
      <div>
        ${statusBadge}
      </div>
    </div>

    <!-- Executive Summary Box -->
    <div style="background: #f8fafc; border-left: 4px solid #0284c7; border: 1px solid #e2e8f0; border-left-width: 4px; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 6px 0; font-size: 13px; text-transform: uppercase; color: #0284c7;">Executive Audit Summary</h3>
      <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.6;">
        ${report.summaryExecutive}
      </p>
    </div>

    <!-- Summary Metrics Grid -->
    <div class="grid-stats">
      <div class="stat-card">
        <div class="stat-label">Total Evaluated</div>
        <div class="stat-val">${report.totalFramesProcessed} frames</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Normal Baseline</div>
        <div class="stat-val" style="color: #059669;">${report.normalFrames}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Viewpoint Shifts</div>
        <div class="stat-val" style="color: #d97706;">${report.viewpointShiftEvents}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Rotation Events</div>
        <div class="stat-val" style="color: #ea580c;">${report.rotationEvents}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Zoom Changes</div>
        <div class="stat-val" style="color: #7c3aed;">${report.zoomEvents}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Lighting Variations</div>
        <div class="stat-val" style="color: #0284c7;">${report.lightingOnlyEvents}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Average Consistency</div>
        <div class="stat-val" style="color: #059669;">${report.averageSceneConsistency}%</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Speed</div>
        <div class="stat-val">${report.averageProcessingTimeMs} ms</div>
      </div>
    </div>

    <!-- Anomaly Events Table -->
    <h3 style="font-size: 14px; margin: 24px 0 8px 0; color: #0f172a;">Detected Anomaly Events (${(report.events || []).length})</h3>
    <table>
      <thead>
        <tr>
          <th>Frame</th>
          <th>Time</th>
          <th>Classification</th>
          <th>Consistency</th>
          <th>Displacement</th>
          <th>Rotation</th>
          <th>Zoom</th>
          <th>Diagnostic Findings</th>
        </tr>
      </thead>
      <tbody>
        ${eventsHtml}
      </tbody>
    </table>

    <!-- Calibration Parameters -->
    <h3 style="font-size: 14px; margin: 28px 0 8px 0; color: #0f172a;">Calibration & Regulatory Parameters</h3>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; font-size: 12px; font-family: monospace; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
      <div>Translation Threshold: ${report.thresholdsUsed.translationThresholdPx} px</div>
      <div>Rotation Threshold: ${report.thresholdsUsed.rotationThresholdDeg}°</div>
      <div>Zoom Threshold: ±${report.thresholdsUsed.zoomThresholdPercent}%</div>
      <div>Min Consistency: ${report.thresholdsUsed.minSceneConsistencyPercent}%</div>
      <div>Brightness Tolerance: ${report.thresholdsUsed.brightnessTolerancePercent}%</div>
      <div>Consecutive Confirmation: ${report.thresholdsUsed.consecutiveConfirmationCount} frames</div>
      <div>Engine: ORB + RANSAC</div>
      <div>Normalizer: CLAHE Enabled</div>
      <div>Storage: Persistent IndexedDB</div>
    </div>

    ${sampleFramesHtml ? `
    <h3 style="font-size: 14px; margin: 28px 0 8px 0; color: #0f172a;">Frame-by-Frame Evaluation Log (First ${Math.min(50, results.length)})</h3>
    <table>
      <thead>
        <tr>
          <th>Frame</th>
          <th>Time</th>
          <th>Classification</th>
          <th>Consistency</th>
          <th>Shift (px)</th>
          <th>Rotation (deg)</th>
          <th>Scale (%)</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        ${sampleFramesHtml}
      </tbody>
    </table>
    ` : ''}

    <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
      <span>Camera Viewpoint Shift & Scene Consistency Verification System · T248</span>
      <span>Autonomous Optical Flow & RANSAC Certified</span>
    </div>
  </div>
</body>
</html>`;
  },

  /**
   * Downloads a self-contained, standalone printable HTML report.
   * Directly triggers download so users can open it and print/save to PDF.
   */
  downloadPrintableReport(
    report: ConsistencyReport,
    results: FrameAnalysisResult[],
    referenceName?: string
  ): void {
    const htmlContent = this.generatePrintableHtml(report, results, referenceName);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cctv_scene_audit_report_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

