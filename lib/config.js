import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PLUGIN_NAME = 'dsh-think-zh';
export const STATE_FILE = 'think-zh.json';

export const STRENGTHS = ['soft', 'normal', 'hard', 'max'];

export const DEFAULTS = {

  enabled: true,

  strength: 'hard',

  perTurn: true,

  codeVerbatim: true,

  customText: '',

  sectionOrder: 10250,

  contextOrder: 900,

  verbose: false,
};

export function dshHome() {
  const env = process.env.DSH_HOME;
  if (typeof env === 'string' && env.trim()) return env.trim();
  return path.join(os.homedir(), '.dsh');
}

export function statePath(home = dshHome()) {
  return path.join(home, STATE_FILE);
}

function asBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off'].includes(v)) return false;
  }
  return undefined;
}

export function normalizeConfig(raw = {}) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;

  const enabled = asBool(raw.enabled);
  if (enabled !== undefined) out.enabled = enabled;

  const perTurn = asBool(raw.perTurn);
  if (perTurn !== undefined) out.perTurn = perTurn;

  const codeVerbatim = asBool(raw.codeVerbatim);
  if (codeVerbatim !== undefined) out.codeVerbatim = codeVerbatim;

  const verbose = asBool(raw.verbose);
  if (verbose !== undefined) out.verbose = verbose;

  if (typeof raw.strength === 'string') {
    const s = raw.strength.trim().toLowerCase();
    if (STRENGTHS.includes(s)) out.strength = s;
  }

  for (const key of ['sectionOrder', 'contextOrder']) {
    const n = Number(raw[key]);
    if (Number.isFinite(n)) out[key] = n;
  }

  if (typeof raw.customText === 'string') out.customText = raw.customText;
  return out;
}

export function readState(home = dshHome()) {
  try {
    const file = statePath(home);
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeState(patch, home = dshHome()) {
  const file = statePath(home);
  const next = { ...readState(home), ...patch };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
  return next;
}

export function resolveConfig(patchConfig, home = dshHome()) {
  return normalizeConfig({ ...(patchConfig || {}), ...readState(home) });
}

export function log(message, cfg) {
  if (cfg && cfg.verbose) console.log(`[think-zh] ${message}`);
}

export function appendLog(message, home = dshHome()) {
  try {
    fs.appendFileSync(path.join(home, 'think-zh.log'), `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch {

  }
}
