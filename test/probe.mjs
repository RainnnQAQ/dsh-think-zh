import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'think-zh-probe-'));
const previousHome = process.env.DSH_HOME;
process.env.DSH_HOME = home;

const sections = [];
const contexts = [];
const listeners = new Map();
const commands = [];

const fakeCtx = {
  systemPrompt: {
    section(section) {
      sections.push(section);
      return () => {};
    },
    context(context) {
      contexts.push(context);
      return () => {};
    },
  },
  on(name, handler, options) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push({ handler, options });
    return () => {};
  },
  get(service) {
    if (service !== 'commands') return null;
    return {
      register(spec) {
        commands.push(spec);
        return spec;
      },
    };
  },
};

const failures = [];
const check = (name, pass, detail = '') => {
  if (pass) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name}  ← ${detail}`);
    failures.push(name);
  }
};

try {
  const plugin = await import('../index.js');
  check('导出 name', plugin.name === 'think-zh');
  check('导出 inject', Array.isArray(plugin.inject) && plugin.inject.includes('systemPrompt'));
  check('导出 apply', typeof plugin.apply === 'function');

  plugin.apply(fakeCtx, {});

  check('注册了 section', sections.length === 1);
  check('section 名字', sections[0]?.name === 'think-zh:thinking-language');
  check('section order 有限', Number.isFinite(sections[0]?.order));
  check('section 不插值', sections[0]?.interpolate === false);
  const sectionText = typeof sections[0]?.text === 'function' ? sections[0].text({}) : sections[0]?.text;
  check('section 文本含简体中文', String(sectionText).includes('简体中文'));

  check('注册了每轮提醒', contexts.length === 1);
  check('context 名字', contexts[0]?.name === 'think-zh:reminder');
  const contextText = typeof contexts[0]?.text === 'function' ? contexts[0].text({}) : contexts[0]?.text;
  check('每轮提醒非空', String(contextText).length > 0);

  check('注册了命令', commands.length === 1 && commands[0]?.name === 'think-zh');

  check('挂了 assemble 监听', listeners.has('system-prompt/assemble'));
  const guarded = listeners.get('system-prompt/assemble')?.[0];
  check('assemble 监听带 prepend', guarded?.options?.prepend === true);

  const downstream = async () => ({ sections: [{ name: 'dsh-purge', text: 'x' }], contexts: [], tools: [], variables: {} });
  const result = await guarded.handler({ sections: [], contexts: [] }, {}, downstream);
  check('兜底补回 section', result.sections.some((s) => s.name === 'think-zh:thinking-language'));
  check('兜底补回 context', result.contexts.some((c) => c.name === 'think-zh:reminder'));
  check('不动别人的段', result.sections.some((s) => s.name === 'dsh-purge'));

  const status = await commands[0].handler({ rawInput: 'status' });
  check('status 命令可用', status.kind === 'success' && status.text.includes('强度'));
  const off = await commands[0].handler({ rawInput: 'off' });
  check('off 命令可用', off.kind === 'success');
  const offResult = await guarded.handler({ sections: [], contexts: [] }, {}, downstream);
  check('关闭后兜底移除 section', !offResult.sections.some((s) => s.name === 'think-zh:thinking-language'));
  await commands[0].handler({ rawInput: 'on' });

  check('暴露隔离上下文注册入口', typeof globalThis.__dshThinkZhRegister === 'function');
} catch (error) {
  check('探针未崩溃', false, error && error.stack ? error.stack : String(error));
} finally {
  if (previousHome === undefined) delete process.env.DSH_HOME;
  else process.env.DSH_HOME = previousHome;
  try {
    fs.rmSync(home, { recursive: true, force: true });
  } catch {

  }
}

console.log(failures.length === 0 ? '\n探针全部通过' : `\n${failures.length} 项失败`);
process.exit(failures.length === 0 ? 0 : 1);
