import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import purchaseRequestRoutes from './routes/purchaseRequest.routes.js';
import taskRoutes from './routes/task.routes.js';
import rfqRoutes from './routes/rfq.routes.js';
import poRoutes from './routes/po.routes.js';
import vendorRoutes from './routes/vendor.routes.js';
import masterRoutes from './routes/master.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { runStartupMigrations } from './services/dbMigrate.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.listen(PORT, async () => {
  try {
    await runStartupMigrations();
    console.log('Database migrations checked.');
  } catch (err) {
    console.error('Startup migration failed:', err.message);
  }
  console.log(`P2P API server running on http://localhost:${PORT}`);
});
