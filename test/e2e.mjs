import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function resolveRuntime() {
  const fromEnv = process.env.DSH_RUNTIME;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const candidates = [
    path.join(process.cwd(), 'node_modules'),
    'F:/软件/DeepSeek Harness/resources/app/dsh/node_modules',
    path.join(os.homedir(), '.dsh', 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'node_modules'),
    '/usr/lib/deepseek-harness/resources/app/dsh/node_modules',
  ];
  return candidates.find((dir) => fs.existsSync(path.join(dir, '@deepseek-ai', 'dsh-system-prompt', 'package.json'))) || null;
}

const RUNTIME = resolveRuntime();

if (!RUNTIME) {
  console.log('SKIP  找不到 DSH 安装目录，设置 DSH_RUNTIME 指向 <dsh>/node_modules 后再跑');
  process.exit(0);
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'think-zh-e2e-'));
const previousHome = process.env.DSH_HOME;
process.env.DSH_HOME = home;

const failures = [];
const check = (name, pass, detail = '') => {
  if (pass) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name}  ← ${detail}`);
    failures.push(name);
  }
};

const load = (specifier) => import(pathToFileURL(path.join(RUNTIME, specifier)).href);

try {
  const cordis = await load('@deepseek-ai/cordis/lib/index.js');
  const systemPromptMod = await load('@deepseek-ai/dsh-system-prompt/lib/index.js');
  const Context = cordis.Context || cordis.default?.Context;
  const SystemPrompt = systemPromptMod.SystemPrompt || systemPromptMod.default;

  check('加载 cordis', typeof Context === 'function');
  check('加载 system-prompt 服务', typeof SystemPrompt === 'function');

  const ctx = new Context();
  ctx.plugin(SystemPrompt, { includeHarnessIdentity: false, includeRuntimeContext: true });
  await new Promise((resolve) => setTimeout(resolve, 50));

  check('服务已注册', !!ctx.systemPrompt);

  const plugin = await import('../index.js');
  ctx.plugin(plugin, {});
  await new Promise((resolve) => setTimeout(resolve, 50));

  const assembly = await ctx.systemPrompt.assemble({});
  const sectionNames = assembly.sections.map((s) => s.name);
  const contextNames = assembly.contexts.map((c) => c.name);
  const joined = assembly.sections.map((s) => s.text).join('\n');

  check('section 在装配结果里', sectionNames.includes('think-zh:thinking-language'));
  check('context 在装配结果里', contextNames.includes('think-zh:reminder'));
  check('系统提示含中文思考要求', joined.includes('简体中文'));
  check('系统提示含英文开头禁令', joined.includes('Let me'));
  check('section 排在最末', sectionNames[sectionNames.length - 1] === 'think-zh:thinking-language');

  const ctxText = assembly.contexts.find((c) => c.name === 'think-zh:reminder')?.text || '';
  check('运行时提醒有内容', ctxText.includes('[思考语言'));

  const fsMod = await import('node:fs');
  fsMod.writeFileSync(path.join(home, 'think-zh.json'), JSON.stringify({ enabled: false }), 'utf8');
  const offAssembly = await ctx.systemPrompt.assemble({});
  check('关闭后 section 消失', !offAssembly.sections.some((s) => s.name === 'think-zh:thinking-language'));
  check('关闭后 context 消失', !offAssembly.contexts.some((c) => c.name === 'think-zh:reminder'));

  fsMod.writeFileSync(
    path.join(home, 'think-zh.json'),
    JSON.stringify({ enabled: true, customText: '只用中文推理。' }),
    'utf8',
  );
  const customAssembly = await ctx.systemPrompt.assemble({});
  check(
    '自定义正文生效',
    customAssembly.sections.some((s) => s.name === 'think-zh:thinking-language' && s.text === '只用中文推理。'),
  );
} catch (error) {
  check('端到端未崩溃', false, error && error.stack ? error.stack : String(error));
} finally {
  if (previousHome === undefined) delete process.env.DSH_HOME;
  else process.env.DSH_HOME = previousHome;
  try {
    fs.rmSync(home, { recursive: true, force: true });
  } catch {

  }
}

console.log(failures.length === 0 ? '\n端到端全部通过' : `\n${failures.length} 项失败`);
process.exit(failures.length === 0 ? 0 : 1);
