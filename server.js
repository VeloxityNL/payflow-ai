import express from 'express';
import path from 'path';
import { config, ROOT_DIR } from './src/config.js';
import { getPayPalToken } from './src/paypal.js';
import { apiRouter } from './src/routes/api.js';

const app = express();
const publicDir = path.join(ROOT_DIR, 'public');

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

/** Lightweight health endpoint used by deployment and demo checks. */
app.get('/health', async (req, res) => {
  let paypalSandbox = false;
  let localAI = false;

  try {
    await getPayPalToken();
    paypalSandbox = true;
  } catch {
    paypalSandbox = false;
  }

  try {
    const response = await fetch('http://127.0.0.1:11434/v1/models');
    localAI = response.ok;
  } catch {
    localAI = false;
  }

  res.json({
    ok: true,
    project: 'PayFlow AI',
    paypalSandbox,
    localAI,
  });
});

app.use('/api', apiRouter);
app.use(express.static(publicDir, { maxAge: 0, etag: false }));

/** SPA fallback for direct browser navigation. */
app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`PayFlow AI listening on 127.0.0.1:${config.port}`);
});
