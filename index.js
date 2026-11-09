import { appendLog, dshHome, log, resolveConfig } from './lib/config.js';
import { buildContextText, buildSectionText } from './lib/prompt.js';
import { attachRoutes } from './lib/router.js';
import { CONTEXT_NAME, SECTION_NAME, enforceAssembly } from './lib/assemble.js';
import { runSelftest } from './lib/selftest.js';

export const name = 'think-zh';

export const inject = ['systemPrompt'];

export { CONTEXT_NAME, SECTION_NAME, enforceAssembly };

function alreadyRegistered(error) {
  return /already registered/i.test(String(error && error.message ? error.message : error));
}

export function registerPromptSection(ctx, patchConfig, home = dshHome()) {
  const cfg = resolveConfig(patchConfig, home);
  ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: cfg.sectionOrder,
    interpolate: false,
    text: () => buildSectionText(resolveConfig(patchConfig, home)),
  });
  log('section 已注册', cfg);
}

export function registerPromptContext(ctx, patchConfig, home = dshHome()) {
  const cfg = resolveConfig(patchConfig, home);
  ctx.systemPrompt.context({
    name: CONTEXT_NAME,
    order: cfg.contextOrder,
    text: () => buildContextText(resolveConfig(patchConfig, home)),
  });
  log('context 已注册', cfg);
}

function safeRegister(ctx, patchConfig, home) {
  for (const register of [registerPromptSection, registerPromptContext]) {
    try {
      register(ctx, patchConfig, home);
    } catch (error) {
      if (!alreadyRegistered(error)) {
        console.warn(`[think-zh] 注册提示段落失败：${error && error.message ? error.message : String(error)}`);
      }
    }
  }
}

export function installAssembleGuard(ctx, patchConfig, home = dshHome()) {
  const runner = async (...args) => {
    const [assembly] = args;
    const next = args.length >= 3 ? args[args.length - 1] : null;
    let out = assembly;
    if (typeof next === 'function') {
      try {
        out = await next();
      } catch {
        out = assembly;
      }
    }
    return enforceAssembly(out, patchConfig, home);
  };

  try {
    ctx.on('system-prompt/assemble', runner, { global: true, prepend: true });
    return true;
  } catch {
    return false;
  }
}

export function apply(ctx, config = {}) {
  const patchConfig = config && typeof config === 'object' ? config : {};
  const home = dshHome();

  appendLog(`apply 进入：patch=${JSON.stringify(patchConfig)}`, home);

  safeRegister(ctx, patchConfig, home);
  installAssembleGuard(ctx, patchConfig, home);
  attachRoutes(ctx, patchConfig, home);

  log('装配完成', resolveConfig(patchConfig, home));

  try {
    ctx.on('session/created', () => safeRegister(ctx, patchConfig, home), { global: true });
  } catch {

  }

  globalThis.__dshThinkZhRegister = (targetCtx) => {
    try {
      registerPromptSection(targetCtx, patchConfig, home);
      registerPromptContext(targetCtx, patchConfig, home);
      return true;
    } catch {
      return false;
    }
  };
}

export const plugin = { name, inject, apply };
export default plugin;

if (process.argv.includes('--selftest')) {
  const result = await runSelftest({ patchConfig: {} });
  process.exit(result.ok ? 0 : 1);
}
