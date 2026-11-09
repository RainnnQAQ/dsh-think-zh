import {
  STRENGTHS,
  appendLog,
  dshHome,
  readState,
  resolveConfig,
  statePath,
  writeState,
} from './config.js';
import { buildContextText, buildSectionText } from './prompt.js';

const PREFIX = '/api/think-zh';

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 1), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function paramsOf(request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      if (body && typeof body === 'object' && !Array.isArray(body)) Object.assign(params, body);
    } catch {

    }
  }
  return params;
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

export function statusPayload(patchConfig, home = dshHome()) {
  const config = resolveConfig(patchConfig, home);
  const state = readState(home);
  return {
    ok: true,
    config,
    state,
    overridden: Object.keys(state).length > 0,
    source: Object.keys(state).length > 0 ? 'state-file' : 'patch',
    statePath: statePath(home),
    home,
    strengths: STRENGTHS,
    sectionText: buildSectionText(config),
    contextText: buildContextText(config),
  };
}

export function createRoutes(patchConfig, home = dshHome()) {
  return [
    {
      path: `${PREFIX}/status`,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async () => {
        try {
          return json(statusPayload(patchConfig, home));
        } catch (error) {
          return json({ ok: false, error: error && error.message ? error.message : String(error) }, 500);
        }
      },
    },
    {
      path: `${PREFIX}/set`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          const params = await paramsOf(request);
          const patch = {};

          const enabled = asBool(params.enabled);
          if (enabled !== undefined) patch.enabled = enabled;

          const perTurn = asBool(params.perTurn);
          if (perTurn !== undefined) patch.perTurn = perTurn;

          const verbatim = asBool(params.codeVerbatim);
          if (verbatim !== undefined) patch.codeVerbatim = verbatim;

          if (typeof params.strength === 'string') {
            const strength = params.strength.trim().toLowerCase();
            if (!STRENGTHS.includes(strength)) {
              return json({ ok: false, error: `强度只能是 ${STRENGTHS.join(' / ')}` }, 400);
            }
            patch.strength = strength;
          }

          if (typeof params.customText === 'string') {
            patch.customText = params.customText;
            if (params.customText.trim()) patch.enabled = true;
          }

          if (Object.keys(patch).length === 0) {
            return json({ ok: false, error: '没有可写的字段（enabled / strength / perTurn / codeVerbatim / customText）' }, 400);
          }

          writeState(patch, home);
          return json(statusPayload(patchConfig, home));
        } catch (error) {
          return json({ ok: false, error: error && error.message ? error.message : String(error) }, 500);
        }
      },
    },
    {
      path: `${PREFIX}/reset`,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: async () => {
        try {
          writeState(
            { enabled: undefined, strength: undefined, perTurn: undefined, codeVerbatim: undefined, customText: undefined },
            home,
          );
          return json(statusPayload(patchConfig, home));
        } catch (error) {
          return json({ ok: false, error: error && error.message ? error.message : String(error) }, 500);
        }
      },
    },
  ];
}

export function attachRoutes(ctx, patchConfig, home = dshHome()) {
  const register = (scope) => {

    let connection = null;
    try {
      connection = scope && scope.connection;
    } catch {
      return false;
    }
    if (!connection || typeof connection.fetch?.register !== 'function') return false;
    let count = 0;
    for (const route of createRoutes(patchConfig, home)) {
      try {
        connection.fetch.register({ ...route });
        count += 1;
      } catch (error) {
        console.warn(`[think-zh] 路由注册失败 ${route.path}：${error && error.message ? error.message : String(error)}`);
      }
    }
    if (count > 0) {
      try {
        appendLog(`设置页路由已注册 ${count} 条（/api/think-zh/status|set|reset）`, home);
      } catch {

      }
    }
    return count > 0;
  };

  try {
    if (register(ctx)) return true;
    if (typeof ctx.inject !== 'function') return false;
    ctx.inject(['connection'], (scope) => {
      try {
        register(scope || ctx);
      } catch {

      }
    });
    return false;
  } catch {
    return false;
  }
}
