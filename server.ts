import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'monitoring_database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure database file exists
if (!fs.existsSync(DB_FILE)) {
  const initialDb = {
    sessions: [],
    reports: [],
    events: [],
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
}

function readDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { sessions: [], reports: [], events: [], lastUpdated: new Date().toISOString() };
  }
}

function writeDb(data: any) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write database file', e);
  }
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check API
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'online',
    system: 'Camera Viewpoint Shift & Scene Consistency Engine',
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// History & Events API
app.get('/api/history', (req: Request, res: Response) => {
  const db = readDb();
  res.json({
    success: true,
    sessionsCount: db.sessions?.length || 0,
    sessions: db.sessions || [],
    eventsCount: db.events?.length || 0,
    recentEvents: (db.events || []).slice(-100),
  });
});

app.get('/api/history/:id', (req: Request, res: Response) => {
  const db = readDb();
  const session = (db.sessions || []).find((s: any) => s.id === req.params.id);
  if (!session) {
    return res.status(404).json({ success: false, message: 'Session not found' });
  }
  res.json({ success: true, session });
});

app.post('/api/history', (req: Request, res: Response) => {
  const sessionData = req.body;
  const db = readDb();
  db.sessions = db.sessions || [];

  if (sessionData && sessionData.id) {
    const existingIndex = db.sessions.findIndex((s: any) => s.id === sessionData.id);
    if (existingIndex >= 0) {
      db.sessions[existingIndex] = sessionData;
    } else {
      db.sessions.unshift(sessionData);
    }
  } else if (sessionData) {
    const newSession = {
      ...sessionData,
      id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    db.sessions.unshift(newSession);
  }

  // Keep up to 200 sessions
  if (db.sessions.length > 200) {
    db.sessions = db.sessions.slice(0, 200);
  }

  writeDb(db);
  res.json({ success: true, sessionId: sessionData?.id });
});

app.delete('/api/history/:id', (req: Request, res: Response) => {
  const db = readDb();
  db.sessions = (db.sessions || []).filter((s: any) => s.id !== req.params.id);
  writeDb(db);
  res.json({ success: true, message: 'Session deleted' });
});

app.delete('/api/history', (req: Request, res: Response) => {
  const db = readDb();
  db.sessions = [];
  db.events = [];
  writeDb(db);
  res.json({ success: true, message: 'Database history cleared' });
});

// Reports API
app.post('/api/reports', (req: Request, res: Response) => {
  const report = req.body;
  const db = readDb();
  db.reports = db.reports || [];
  db.reports.push(report);

  // Keep max 50 reports
  if (db.reports.length > 50) {
    db.reports = db.reports.slice(-50);
  }

  writeDb(db);
  res.json({ success: true, message: 'Report saved to database' });
});

app.get('/api/reports/latest', (req: Request, res: Response) => {
  const db = readDb();
  const reports = db.reports || [];
  const latest = reports.length > 0 ? reports[reports.length - 1] : null;
  res.json({ success: true, report: latest });
});

// Development vs Production serving
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Vite middleware for development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Static file serving for production
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[T248] Camera Viewpoint Shift server listening on port ${PORT}`);
  });
}

startServer();
