import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import purchaseRequestRoutes from './routes/purchaseRequest.routes.js';
import taskRoutes from './routes/task.routes.js';
import rfqRoutes from './routes/rfq.routes.js';
import poRoutes from './routes/po.routes.js';
import vendorRoutes from './routes/vendor.routes.js';
import masterRoutes from './routes/master.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { runStartupMigrations } from './services/dbMigrate.js';
import { testSmtpConnection, sendTestEmail } from './services/emailService.js';
import { sendWhatsAppHsm, buildWorkflowWhatsAppParams, normalizeWhatsAppTo, getWhatsAppPublicBaseUrl } from './services/whatsappService.js';
import { pingDatabase } from './config/db.js';
import { authenticate } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

/** Built SPA (vite outDir: out) — client/out/index.html */
const CLIENT_OUT = path.resolve(__dirname, '../../client/out');

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
);
// Quotation PDFs are sent as base64 (~1.37x file size); allow up to ~5MB files
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await pingDatabase();
    res.json({
      status: 'ok',
      database: 'connected',
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      dbHost: process.env.INSTANCE_CONNECTION_NAME || process.env.CLOUD_SQL_CONNECTION_NAME
        ? `socket:/cloudsql/${process.env.INSTANCE_CONNECTION_NAME || process.env.CLOUD_SQL_CONNECTION_NAME}`
        : process.env.DB_HOST || 'localhost',
      dbName: process.env.DB_NAME || 'p2p_system',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'unreachable',
      detail: err.message || String(err),
      code: err.code || undefined,
      hasJwtSecret: Boolean(process.env.JWT_SECRET),
      dbHost: process.env.INSTANCE_CONNECTION_NAME || process.env.CLOUD_SQL_CONNECTION_NAME
        ? `socket:/cloudsql/${process.env.INSTANCE_CONNECTION_NAME || process.env.CLOUD_SQL_CONNECTION_NAME}`
        : process.env.DB_HOST || 'localhost',
      dbName: process.env.DB_NAME || 'p2p_system',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api/health/smtp', async (_req, res) => {
  try {
    const ok = await testSmtpConnection();
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'error',
      smtp: ok ? 'connected' : 'failed',
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || null,
      user: process.env.SMTP_USER || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      smtp: 'failed',
      detail: err.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

app.post('/api/health/smtp/send-test', authenticate, async (req, res) => {
  try {
    const to =
      (typeof req.body?.to === 'string' && req.body.to.trim()) ||
      req.user?.email ||
      process.env.PR_NOTIFY_EMAIL?.split(',')[0]?.trim();

    if (!to) {
      return res.status(400).json({ message: 'No recipient. Pass { "to": "email@example.com" }.' });
    }

    const info = await sendTestEmail(to);
    res.json({
      status: 'ok',
      to,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

app.post('/api/health/whatsapp/send-test', authenticate, async (req, res) => {
  try {
    const to =
      (typeof req.body?.to === 'string' && req.body.to.trim()) ||
      process.env.WHATSAPP_DEFAULT_TO ||
      process.env.WHATSAPP_NOTIFY_PHONES?.split(',')[0]?.trim();

    if (!to) {
      return res.status(400).json({
        message: 'No phone. Pass { "to": "9198xxxxxxxx" } or set WHATSAPP_DEFAULT_TO.',
      });
    }

    const phone = normalizeWhatsAppTo(to);
    const parameters = buildWorkflowWhatsAppParams({
      appName: 'P2P',
      documentNumber: 'TEST-PR',
      title: 'WhatsApp connectivity test',
      stage: 'Test Notification',
      actionUrl: `${getWhatsAppPublicBaseUrl()}/tasks`,
      requesterName: req.user?.name || 'P2P System',
    });

    const result = await sendWhatsAppHsm({ to: phone, parameters });
    res.json({
      status: 'ok',
      to: phone,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message || String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/rfq', rfqRoutes);
app.use('/api/po', poRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/masters', masterRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

if (fs.existsSync(path.join(CLIENT_OUT, 'index.html'))) {
  app.use(express.static(CLIENT_OUT, { index: 'index.html' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(CLIENT_OUT, 'index.html'));
  });
  console.log(`Serving frontend from ${CLIENT_OUT}`);
} else {
  console.warn(`Frontend build not found at ${CLIENT_OUT} — run: npm run build --prefix client`);
}

app.listen(PORT, async () => {
  try {
    await runStartupMigrations();
    console.log('Database migrations checked.');
  } catch (err) {
    console.error('Startup migration failed:', err.message);
  }

  try {
    await testSmtpConnection();
  } catch (err) {
    console.error('SMTP connection test failed unexpectedly:', err.message);
  }

  console.log(`P2P API server running on http://localhost:${PORT}`);
  if (fs.existsSync(path.join(CLIENT_OUT, 'index.html'))) {
    console.log(`Open app: http://localhost:${PORT}/`);
  }
});
