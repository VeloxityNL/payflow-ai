import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { ROOT_DIR } from './config.js';

const STATE_FILE = path.join(ROOT_DIR, 'data', 'state.json');

export function createId(prefix = 'pf') {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

export async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch {
    return { projects: [], events: [] };
  }
}

export async function writeState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

/** Keep a concise audit trail for judges and demo users. */
export async function addEvent(type, message, meta = {}) {
  const state = await readState();

  state.events.unshift({
    id: createId('evt'),
    type,
    message,
    meta,
    at: new Date().toISOString(),
  });

  state.events = state.events.slice(0, 100);
  await writeState(state);
}
