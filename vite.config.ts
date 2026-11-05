import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function apiPlugin(): Plugin {
  const DATA_DIR = path.resolve(__dirname, 'data');
  const DB_FILE = path.join(DATA_DIR, 'monitoring_database.json');

  const ensureDb = () => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(
          {
            sessions: [],
            reports: [],
            events: [],
            lastUpdated: new Date().toISOString(),
          },
          null,
          2
        ),
        'utf-8'
      );
    }
  };

  const readDb = () => {
    ensureDb();
    try {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch {
      return { sessions: [], reports: [], events: [], lastUpdated: new Date().toISOString() };
    }
  };

  const writeDb = (data: any) => {
    ensureDb();
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  };

  return {
    name: 'monitoring-api-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost:3000');
        const pathname = url.pathname;

        if (req.method === 'GET' && pathname === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'online',
              system: 'Camera Viewpoint Shift & Scene Consistency Engine',
              uptimeSeconds: process.uptime(),
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        if (req.method === 'GET' && pathname === '/api/history') {
          const db = readDb();
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: true,
              sessionsCount: db.sessions?.length || 0,
              sessions: db.sessions || [],
              eventsCount: db.events?.length || 0,
              recentEvents: (db.events || []).slice(-100),
            })
          );
          return;
        }

        if (req.method === 'GET' && pathname.startsWith('/api/history/')) {
          const id = decodeURIComponent(pathname.replace('/api/history/', ''));
          const db = readDb();
          const session = (db.sessions || []).find((s: any) => s.id === id);
          if (!session) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: 'Session not found' }));
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, session }));
          return;
        }

        if (req.method === 'DELETE' && pathname.startsWith('/api/history/')) {
          const id = decodeURIComponent(pathname.replace('/api/history/', ''));
          const db = readDb();
          db.sessions = (db.sessions || []).filter((s: any) => s.id !== id);
          writeDb(db);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Session deleted' }));
          return;
        }

        if (req.method === 'DELETE' && pathname === '/api/history') {
          const db = readDb();
          db.sessions = [];
          db.events = [];
          writeDb(db);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Database history cleared' }));
          return;
        }

        if (req.method === 'GET' && pathname === '/api/reports/latest') {
          const db = readDb();
          const reports = db.reports || [];
          const latest = reports.length > 0 ? reports[reports.length - 1] : null;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, report: latest }));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            let parsed: any = {};
            try {
              parsed = JSON.parse(body);
            } catch {}

            if (pathname === '/api/history') {
              const sessionData = parsed;
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

              if (db.sessions.length > 200) {
                db.sessions = db.sessions.slice(0, 200);
              }

              writeDb(db);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, sessionId: sessionData?.id }));
              return;
            }

            if (pathname === '/api/reports') {
              const db = readDb();
              db.reports = db.reports || [];
              db.reports.push(parsed);
              if (db.reports.length > 50) db.reports = db.reports.slice(-50);
              writeDb(db);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, message: 'Report saved to database' }));
              return;
            }

            next();
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
