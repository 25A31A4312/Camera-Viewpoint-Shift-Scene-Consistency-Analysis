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
};
