import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Load local environment variables without adding another dependency.
 * Secrets remain server-side in .env and are never exposed to the browser.
 */
export function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');

  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    process.env[key] ??= value;
  }
}

loadEnv();

export const config = {
  port: Number(process.env.PORT || 8810),
  publicBaseUrl: 'https://iwesley.dev/payflow-ai',
  paypalApiBase: 'https://api-m.sandbox.paypal.com',
  paypalClientId: process.env.PAYPAL_CLIENT_ID,
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET,
  paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID,
  localAiUrl: 'http://127.0.0.1:11434/v1/chat/completions',
  localAiModel: 'nivora-v0.1',
};
