import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { DEFAULTS, normalizeConfig, readState, resolveConfig, statePath, writeState } from './config.js';
import { buildContextText, buildSectionText } from './prompt.js';
import { registerCommand } from './command.js';
import { CONTEXT_NAME, SECTION_NAME, enforceAssembly } from './assemble.js';

export async function runSelftest({ patchConfig = {} } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'think-zh-test-'));
  const previousHome = process.env.DSH_HOME;
  process.env.DSH_HOME = home;

  const results = [];
  const check = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });
  const expect = (name, fn) => {
    try {
      const value = fn();
      check(name, value === true, value === true ? '' : String(value));
    } catch (error) {
      check(name, false, error && error.message ? error.message : String(error));
    }
  };

  try {
    const base = normalizeConfig({});
    check('默认开启', base.enabled === true);
    check('默认强度 hard', base.strength === 'hard');
    check('默认每轮提醒', base.perTurn === true);

    const text = buildSectionText(base);
    check('section 含中文思考要求', text.includes('思考'));
    check('section 明确简体中文', text.includes('简体中文'));
    check('section 禁止英文思考开头', text.includes('Let me'));
    check('section 保护代码原文', text.includes('代码') && text.includes('不翻译'));
    check('section 不含未替换变量', !text.includes('{{'));

    const hardCtx = buildContextText(base);
    check('每轮提醒非空', hardCtx.length > 0);
    check('每轮提醒带标记', hardCtx.includes('[思考语言'));

    check('关闭后 section 为空', buildSectionText({ ...base, enabled: false }) === '');
    check('关闭后提醒为空', buildContextText({ ...base, enabled: false }) === '');
    check('perTurn 关闭后提醒为空', buildContextText({ ...base, perTurn: false }) === '');

    const custom = { ...base, customText: '只用中文思考，别的不管。' };
    check('自定义正文覆盖内置', buildSectionText(custom) === '只用中文思考，别的不管。');

    const soft = buildSectionText({ ...base, strength: 'soft' });
    const max = buildSectionText({ ...base, strength: 'max' });
    check('soft 与 max 文案不同', soft !== max);
    check('非法强度回落 hard', normalizeConfig({ strength: '???' }).strength === 'hard');
    check('字符串布尔可解析', normalizeConfig({ enabled: 'false' }).enabled === false);

    writeState({ enabled: false, strength: 'normal' }, home);
    const merged = resolveConfig(patchConfig, home);
    check('文件覆盖补丁', merged.enabled === false && merged.strength === 'normal');
    check('状态文件存在', fs.existsSync(statePath(home)));
    check('状态可解析', readState(home).strength === 'normal');

    writeState({ enabled: undefined, strength: undefined }, home);
    const reset = resolveConfig(patchConfig, home);
    check('reset 回默认', reset.enabled === DEFAULTS.enabled && reset.strength === DEFAULTS.strength);

    const registered = [];
    const fakeCtx = {
      get: (service) =>
        service === 'commands'
          ? {
              register: (spec) => {
                registered.push(spec);
                return spec;
              },
            }
          : null,
    };
    const cmdName = registerCommand(fakeCtx, { patchConfig, home });
    check('命令已注册', cmdName === 'think-zh');
    const spec = registered[0];
    check('命令有 handler', typeof spec?.handler === 'function');

    if (spec) {
      const off = await spec.handler({ rawInput: 'off' });
      check('off 返回 success', off.kind === 'success');
      check('off 落盘', readState(home).enabled === false);

      const on = await spec.handler({ rawInput: 'on' });
      check('on 返回 success', on.kind === 'success' && readState(home).enabled === true);

      const weak = await spec.handler({ rawInput: 'normal' });
      check('强度命令生效', weak.kind === 'success' && readState(home).strength === 'normal');

      const status = await spec.handler({ rawInput: 'status' });
      check('status 有输出', typeof status.text === 'string' && status.text.includes('强度'));

      const perTurn = await spec.handler({ rawInput: 'per-turn off' });
      check('per-turn 生效', perTurn.kind === 'success' && readState(home).perTurn === false);

      const help = await spec.handler({ rawInput: 'help' });
      check('help 有输出', help.text.includes('/think-zh'));

      const bad = await spec.handler({ rawInput: 'wat' });
      check('未知子命令报错', bad.kind === 'error');
    }

    try {
      fs.rmSync(statePath(home), { force: true });
    } catch {

    }

    const assembly = { sections: [{ name: 'other', text: 'x' }], contexts: [] };
    const out = enforceAssembly(assembly, {}, home);
    check('兜底补 section', out.sections.some((s) => s.name === SECTION_NAME));
    check('兜底补 context', out.contexts.some((c) => c.name === CONTEXT_NAME));
    const offAssembly = enforceAssembly(out, { enabled: false }, home);
    check('关闭后兜底移除', !offAssembly.sections.some((s) => s.name === SECTION_NAME));
    check('关闭后保留别人的段', offAssembly.sections.some((s) => s.name === 'other'));
    const again = enforceAssembly(out, {}, home);
    check('重复兜底不重复插入', again.sections.filter((s) => s.name === SECTION_NAME).length === 1);

    try {
      fs.rmSync(statePath(home), { force: true });
    } catch {

    }
    const { createRoutes } = await import('./router.js');
    const routes = createRoutes({}, home);
    const find = (name) => routes.find((r) => r.path === `/api/think-zh/${name}`);
    check('注册了 status/set/reset 三条路由', ['status', 'set', 'reset'].every((n) => find(n)));

    const statusRes = await find('status').fetch(new Request('http://local/api/think-zh/status'));
    const statusBody = await statusRes.json();
    check('status 返回配置', statusRes.ok && statusBody.ok === true && statusBody.config?.enabled === true);
    check('status 带强度表', Array.isArray(statusBody.strengths) && statusBody.strengths.includes('hard'));
    check('status 带注入预览', typeof statusBody.sectionText === 'string' && statusBody.sectionText.includes('简体中文'));

    const setRes = await find('set').fetch(
      new Request('http://local/api/think-zh/set', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strength: 'max', perTurn: false }),
      }),
    );
    const setBody = await setRes.json();
    check('set 落盘并回显', setBody.ok === true && setBody.config?.strength === 'max' && setBody.config?.perTurn === false);

    const badRes = await find('set').fetch(
      new Request('http://local/api/think-zh/set', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strength: '疯狂' }),
      }),
    );
    check('非法强度被拒', badRes.status === 400);

    const resetRes = await find('reset').fetch(new Request('http://local/api/think-zh/reset', { method: 'POST' }));
    const resetBody = await resetRes.json();
    check('reset 回补丁默认', resetBody.ok === true && resetBody.config?.strength === 'hard' && resetBody.overridden === false);

    const clientSrc = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
    check('client 注册内置插件 tab', clientSrc.includes("'settings.plugins.tab'"));
    check('client 调 host 路由', clientSrc.includes('/api/think-zh'));

    check('client 触摸目标 40px', /const TAP = 40/.test(clientSrc));
    check('client 不用 color-mix', !clientSrc.includes('color-mix(in'));
    check('client 输入框 16px 防缩放', /fontSize:\s*16/.test(clientSrc));
    check('client 不锁死宽度', /maxWidth:\s*720/.test(clientSrc) && /width:\s*'100%'/.test(clientSrc));
  } catch (error) {
    check('自检未崩溃', false, error && error.message ? error.message : String(error));
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    try {
      fs.rmSync(home, { recursive: true, force: true });
    } catch {

    }
  }

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  ← ${r.detail}` : ''}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  return { ok: failed.length === 0, results };
}
