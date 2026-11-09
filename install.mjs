#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = 'dsh-think-zh';
const SELF = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const BEGIN = '# >>> dsh-think-zh begin';
const END = '# <<< dsh-think-zh end';

const PREFERRED = ['desktop', 'web'];

const BLOCK = `${BEGIN}
- insert:
    - id: think-zh
      name: dsh-think-zh
      inject: [systemPrompt]
      config:
        enabled: true
        strength: hard
        perTurn: true
        codeVerbatim: true
${END}`;

function parseArgs(argv) {
  const out = { profile: null, mode: 'auto', all: false, list: false, remove: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--profile' || arg === '-p') out.profile = argv[++i] || null;
    else if (arg === '--mode' || arg === '-m') out.mode = argv[++i] || 'auto';
    else if (arg === '--all') out.all = true;
    else if (arg === '--list' || arg === '-l') out.list = true;
    else if (arg === '--remove' || arg === '--uninstall') out.remove = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
  }
  if (!['auto', 'patch', 'bundle'].includes(out.mode)) out.mode = 'auto';
  return out;
}

function dshHome() {
  const env = process.env.DSH_HOME;
  if (typeof env === 'string' && env.trim()) return env.trim();
  return path.join(os.homedir(), '.dsh');
}

const profilesRoot = () => path.join(dshHome(), 'profiles');
const profileDir = (name) => path.join(profilesRoot(), name);
const patchPath = (name) => path.join(profileDir(name), 'cordis.patch.yml');
const manifestPath = (name) => path.join(profileDir(name), 'package.json');
const linkPath = (name) => path.join(profileDir(name), 'node_modules', PKG);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function allProfiles() {
  try {
    return fs
      .readdirSync(profilesRoot(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => fs.existsSync(manifestPath(name)))
      .sort();
  } catch {
    return [];
  }
}

function stateOf(name) {
  const manifest = readJson(manifestPath(name));
  const patchText = fs.existsSync(patchPath(name)) ? fs.readFileSync(patchPath(name), 'utf8') : '';
  const bundles = manifest?.dsh?.profile?.bundles ?? [];
  return {
    name,
    dir: profileDir(name),
    manifest,
    hasPatch: patchText.includes(BEGIN),
    hasBundle: bundles.includes(PKG),
    hasDependency: Boolean(manifest?.dependencies?.[PKG]),
    linked: fs.existsSync(linkPath(name)),
    bundles,
  };
}

function pickProfile(args) {
  const known = allProfiles();
  if (args.profile) {
    if (!known.includes(args.profile)) {
      console.error(`没有这个 profile：${args.profile}${known.length ? `（现有：${known.join(', ')}）` : '（还没初始化过任何 profile）'}`);
      process.exit(1);
    }
    return [args.profile];
  }
  if (args.all) return known;
  for (const name of PREFERRED) if (known.includes(name)) return [name];
  if (known.length === 1) return known;
  if (known.length === 0) {
    console.error(`找不到 profile：${profilesRoot()} 下没有任何 profile。先启动一次 dsh（桌面端 / dsh web）。`);
    process.exit(1);
  }
  console.error(`有多个 profile，说不清要装哪个：${known.join(', ')}\n用 --profile <名字> 或 --all。`);
  process.exit(1);
}

function stripBlock(text) {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < 0 || end < start) return text;
  return `${text.slice(0, start)}${text.slice(end + END.length)}`.replace(/\n{3,}/g, '\n\n');
}

async function validateYaml(text, name) {
  const candidates = [
    path.join(profileDir(name), 'node_modules', 'yaml', 'dist', 'index.js'),
    path.join(profileDir(name), 'node_modules', 'js-yaml', 'index.js'),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const mod = await import(new URL(`file://${candidate.replace(/\\/g, '/')}`).href);
      const parse = mod.parse || mod.default?.parse || mod.load;
      if (typeof parse === 'function') {
        parse(text);
        return true;
      }
    } catch (error) {
      console.error(`补丁层 YAML 解析失败：${error && error.message ? error.message : error}`);
      return false;
    }
  }
  return null;
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function applyPatch(name) {
  const file = patchPath(name);
  const exists = fs.existsSync(file);
  const current = exists ? fs.readFileSync(file, 'utf8') : '';
  if (current.includes(BEGIN)) return 'patch 已存在，跳过';
  const base = exists
    ? current
    : '# Your patch layer for this dsh profile, applied after every bundle layer:\n# a top-level YAML array of loader patch entries.\n\n';
  const next = `${base.replace(/\s*$/, '')}\n\n${BLOCK}\n`;
  if ((await validateYaml(next, name)) === false) throw new Error('补丁层 YAML 校验失败，已放弃写入');
  if (exists) fs.writeFileSync(`${file}.bak`, current, 'utf8');
  else fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next, 'utf8');
  return `已写入补丁层 ${file}`;
}

function removePatch(name) {
  const file = patchPath(name);
  if (!fs.existsSync(file)) return null;
  const current = fs.readFileSync(file, 'utf8');
  if (!current.includes(BEGIN)) return null;
  fs.writeFileSync(`${file}.bak`, current, 'utf8');
  fs.writeFileSync(file, stripBlock(current), 'utf8');
  return `已撤掉补丁层 ${file}`;
}

function applyBundle(name) {
  const file = manifestPath(name);
  const manifest = readJson(file);
  if (!manifest) throw new Error(`读不到 ${file}`);
  manifest.dependencies = manifest.dependencies && typeof manifest.dependencies === 'object' ? manifest.dependencies : {};
  manifest.dsh = manifest.dsh && typeof manifest.dsh === 'object' ? manifest.dsh : {};
  manifest.dsh.profile = manifest.dsh.profile && typeof manifest.dsh.profile === 'object' ? manifest.dsh.profile : {};
  const bundles = Array.isArray(manifest.dsh.profile.bundles) ? manifest.dsh.profile.bundles : [];
  const spec = `link:${SELF}`;
  let touched = false;
  if (manifest.dependencies[PKG] !== spec) {
    manifest.dependencies[PKG] = spec;
    touched = true;
  }
  if (!bundles.includes(PKG)) {
    bundles.push(PKG);
    touched = true;
  }
  manifest.dsh.profile.bundles = bundles;
  if (touched) {
    fs.writeFileSync(`${file}.bak`, fs.readFileSync(file, 'utf8'), 'utf8');
    writeJson(file, manifest);
    return `已写入 bundle 登记 ${file}（dependencies + dsh.profile.bundles）`;
  }
  return 'bundle 登记已存在，跳过';
}

function removeBundle(name) {
  const file = manifestPath(name);
  const manifest = readJson(file);
  if (!manifest) return null;
  let touched = false;
  if (manifest.dependencies && Object.hasOwn(manifest.dependencies, PKG)) {
    delete manifest.dependencies[PKG];
    touched = true;
  }
  const bundles = manifest?.dsh?.profile?.bundles;
  if (Array.isArray(bundles) && bundles.includes(PKG)) {
    manifest.dsh.profile.bundles = bundles.filter((item) => item !== PKG);
    touched = true;
  }
  if (!touched) return null;
  fs.writeFileSync(`${file}.bak`, fs.readFileSync(file, 'utf8'), 'utf8');
  writeJson(file, manifest);
  return `已撤掉 bundle 登记 ${file}`;
}

function decideMode(args, state) {
  if (args.mode !== 'auto') return args.mode;
  if (!state.manifest) return 'patch';
  if (state.linked) return 'bundle';
  return 'patch';
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`用法：
  node install.mjs [--profile <名字>|--all] [--mode auto|patch|bundle] [--remove] [--list]

  --list            列出本机 profile 与安装状态
  --profile <名字>  指定 profile（手机端 DSHA 一般是 web）
  --all             所有 profile
  --mode bundle     写 package.json（dependencies + dsh.profile.bundles）
  --mode patch      写 cordis.patch.yml（- insert:）
  --remove          撤掉两种痕迹

不用 --profile 时按 desktop → web → 唯一 profile 的顺序自动挑。`);
  process.exit(0);
}

if (args.list) {
  const names = allProfiles();
  if (names.length === 0) {
    console.log(`没有 profile（${profilesRoot()}）`);
    process.exit(0);
  }
  console.log(`DSH_HOME = ${dshHome()}\n`);
  for (const name of names) {
    const state = stateOf(name);
    const marks = [
      state.hasBundle ? 'bundle' : '',
      state.hasPatch ? 'patch' : '',
      state.hasDependency ? 'dep' : '',
      state.linked ? 'linked' : 'no-link',
    ].filter(Boolean);
    console.log(`  ${name.padEnd(12)} ${marks.join(' / ') || '未安装'}`);
  }
  process.exit(0);
}

const targets = pickProfile(args);
let failed = 0;

for (const name of targets) {
  const state = stateOf(name);
  try {
    if (args.remove) {
      const done = [removeBundle(name), removePatch(name)].filter(Boolean);
      console.log(`[${name}] ${done.length ? done.join('；') : '本来就没装'}`);
      continue;
    }
    const mode = decideMode(args, state);
    if (mode === 'bundle') {
      console.log(`[${name}] ${applyBundle(name)}`);
      const left = removePatch(name);
      if (left) console.log(`[${name}] 顺手撤掉旧的手工补丁，免得同一 id 插两次`);
    } else {
      console.log(`[${name}] ${await applyPatch(name)}`);
      if (!state.linked) {
        console.log(`[${name}] 提示：node_modules 里还没有 ${PKG}。装上它（或建个软链）之后才真正加载：`);
        console.log(`         dsh plugin --profile ${name} add link:${SELF}`);
      }
    }
  } catch (error) {
    failed += 1;
    console.error(`[${name}] 失败：${error && error.message ? error.message : error}`);
  }
}

if (!args.remove && failed === 0) {
  console.log('\n重启对应的端才生效：桌面端退出重开 / dsh web 重启 / 手机端在 DSHA 里重启 DSH。');
}

process.exit(failed === 0 ? 0 : 1);
