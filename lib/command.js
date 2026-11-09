import { STRENGTHS, dshHome, readState, resolveConfig, statePath, writeState } from './config.js';

function renderStatus(cfg, home) {
  const state = readState(home);
  const source = Object.keys(state).length > 0 ? `文件（${statePath(home)}）` : '补丁默认值';
  return [
    `中文思考：${cfg.enabled ? '已开启' : '已关闭'}`,
    `强度：${cfg.strength}（soft / normal / hard / max）`,
    `每轮提醒：${cfg.perTurn ? '开' : '关'}`,
    `代码/命令不翻译：${cfg.codeVerbatim ? '开' : '关'}`,
    `自定义正文：${cfg.customText ? `${cfg.customText.length} 字` : '未设置'}`,
    `配置来源：${source}`,
    '命令：/think-zh on | off | soft | normal | hard | max | per-turn on|off | text <正文> | reset | help',
  ].join('\n');
}

const HELP = [
  '/think-zh on            开启（下一轮生效）',
  '/think-zh off           关闭，等同于卸载效果',
  '/think-zh soft|normal|hard|max   设置强制程度',
  '/think-zh per-turn on|off        每轮补一条运行时提醒',
  '/think-zh text <正文>    用自己的指令完全替换内置文案',
  '/think-zh reset         清掉运行时覆盖，回到补丁默认值',
  '/think-zh status        查看当前状态',
].join('\n');

export function registerCommand(ctx, options = {}) {
  const home = options.home || dshHome();
  let commands = null;
  try {
    commands = typeof ctx.get === 'function' ? ctx.get('commands') : null;
  } catch {
    commands = null;
  }
  if (!commands || typeof commands.register !== 'function') return null;

  const handler = async (invocation) => {
    const raw = String(invocation?.rawInput ?? '').trim();
    const [headRaw, ...restParts] = raw.split(/\s+/);
    const head = (headRaw || 'status').toLowerCase();
    const rest = restParts.join(' ').trim();
    const patch = options.patchConfig || {};

    const ok = (text) => ({ kind: 'success', text });
    const bad = (text) => ({ kind: 'error', text });

    try {
      if (head === 'help' || head === '-h' || head === '--help') return ok(HELP);
      if (head === 'status' || head === '') return ok(renderStatus(resolveConfig(patch, home), home));

      if (head === 'on' || head === 'off') {
        writeState({ enabled: head === 'on' }, home);
        return ok(`中文思考已${head === 'on' ? '开启' : '关闭'}，下一轮思考生效。\n${renderStatus(resolveConfig(patch, home), home)}`);
      }

      if (STRENGTHS.includes(head)) {
        writeState({ strength: head, enabled: true }, home);
        return ok(`强度已设为 ${head}，并自动开启。下一轮生效。`);
      }

      if (head === 'per-turn') {
        const value = rest.toLowerCase();
        if (!['on', 'off', '1', '0', 'true', 'false'].includes(value)) return bad('用法：/think-zh per-turn on|off');
        const enabled = ['on', '1', 'true'].includes(value);
        writeState({ perTurn: enabled }, home);
        return ok(`每轮提醒已${enabled ? '开启' : '关闭'}。`);
      }

      if (head === 'verbatim') {
        const value = rest.toLowerCase();
        if (!['on', 'off', '1', '0', 'true', 'false'].includes(value)) return bad('用法：/think-zh verbatim on|off（代码/命令原文是否保持不翻译）');
        const enabled = ['on', '1', 'true'].includes(value);
        writeState({ codeVerbatim: enabled }, home);
        return ok(`代码原文保护已${enabled ? '开启' : '关闭'}。`);
      }

      if (head === 'text') {
        if (!rest) return bad('用法：/think-zh text <完整指令正文>');
        writeState({ customText: rest, enabled: true }, home);
        return ok(`已用自定义正文替换内置文案（${rest.length} 字），并自动开启。下一轮生效。`);
      }

      if (head === 'reset') {
        writeState({ enabled: undefined, strength: undefined, perTurn: undefined, codeVerbatim: undefined, customText: undefined }, home);

        return ok(`运行时覆盖已清空，回到补丁默认值。\n${renderStatus(resolveConfig(patch, home), home)}`);
      }

      return bad(`没认出 "${head}"。\n${HELP}`);
    } catch (error) {
      return bad(`操作失败：${error && error.message ? error.message : String(error)}`);
    }
  };

  const spec = {
    name: 'think-zh',
    description: '中文思考：让模型用简体中文进行 thinking / reasoning（on|off|强度|每轮提醒|自定义正文）',
    input: { hint: 'status | on | off | soft|normal|hard|max | per-turn on|off | text <正文> | reset | help' },
    handler,
  };

  for (const name of ['think-zh', 'think-chinese']) {
    try {
      commands.register({ ...spec, name });
      return name;
    } catch (error) {
      const msg = String(error && error.message ? error.message : error);
      if (!/already registered/i.test(msg)) {
        console.warn(`[think-zh] 命令注册失败（${name}）：${msg}`);
      }
    }
  }
  return null;
}
