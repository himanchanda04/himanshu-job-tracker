import express              from 'express';
import cors                 from 'cors';
import authRouter           from './routes/auth.js';
import applicationsRouter   from './routes/applications.js';
import exportRouter         from './routes/export.js';
import { authenticate }     from './middleware/auth.js';
import { startAutoDiscardJob } from './middleware/autoDiscard.js';

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  // In production set CORS_ORIGIN to your Vercel URL, e.g. https://your-app.vercel.app
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',         authRouter);
app.use('/api/applications', authenticate, applicationsRouter);
app.use('/api/export',       authenticate, exportRouter);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', ts: new Date().toISOString() })
);

// ─── Start ────────────────────────────────────────────────────────────────────

startAutoDiscardJob();

app.listen(PORT, () =>
  console.log(`Server running → http://localhost:${PORT}`)
);
