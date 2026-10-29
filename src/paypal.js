import { config } from './config.js';
import { createId } from './store.js';

let tokenCache = { value: null, expiresAt: 0 };

function requireCredentials() {
  if (!config.paypalClientId || !config.paypalClientSecret) {
    throw new Error('PayPal Sandbox credentials are not configured.');
  }
}

export async function getPayPalToken() {
  requireCredentials();

  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.value;
  }

  const basicAuth = Buffer.from(
    `${config.paypalClientId}:${config.paypalClientSecret}`,
  ).toString('base64');

  const response = await fetch(`${config.paypalApiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'PayPal authentication failed.');
  }

  tokenCache = {
    value: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };

  return tokenCache.value;
}

export async function paypalRequest(endpoint, options = {}) {
  const accessToken = await getPayPalToken();

  const response = await fetch(`${config.paypalApiBase}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': options.requestId || createId('req'),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(payload.message || payload.error_description || `PayPal ${response.status}`);
    error.details = payload;
    throw error;
  }

  return payload;
}

export function formatMoney(value) {
  return Math.max(5, Number(value) || 0).toFixed(2);
}

export async function verifyWebhook(headers, event) {
  if (!config.paypalWebhookId) return false;

  const result = await paypalRequest('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: config.paypalWebhookId,
      webhook_event: event,
    }),
  });

  return result.verification_status === 'SUCCESS';
}
