/**
 * Logic tests — run headlessly with Node (no Electron binary needed).
 * Bundles the pure service layer with a stubbed 'electron' module and
 * verifies template generation, JSON store atomicity and build detection.
 */
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wincode-test-'));

// Stub electron module for Node-only testing
const stubPath = path.join(tmp, 'electron-stub.js');
fs.writeFileSync(
  stubPath,
  `module.exports = {
    app: { getPath: () => require('os').tmpdir(), getAppPath: () => process.cwd(), getVersion: () => '0.0.0-test' },
    shell: { trashItem: async () => {}, showItemInFolder: () => {} },
    safeStorage: { isEncryptionAvailable: () => false, encryptString: (s) => Buffer.from(s), decryptString: (b) => b.toString() },
    dialog: {}, ipcMain: { handle: () => {} }, BrowserWindow: {}, Menu: {}, nativeImage: {},
  };`,
);

const outfile = path.join(tmp, 'bundle.cjs');
await build({
  entryPoints: [path.join(root, 'scripts/logic-entry.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  external: [],
  alias: { electron: stubPath },
  logLevel: 'error',
});

const mod = require(outfile);
let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log('  ✔', name);
  } catch (err) {
    failures++;
    console.error('  ✘', name, '—', err.message);
  }
}

console.log('[logic] service-layer tests');

await check('template registry has Minecraft + general templates', () => {
  const ids = mod.TEMPLATES.map((t) => t.id);
  for (const must of ['minecraft-fabric-mod', 'minecraft-visual-client', 'minecraft-forge-mod', 'minecraft-neoforge-mod', 'minecraft-plugin', 'minecraft-launcher', 'java-gradle', 'node-ts', 'python-app', 'web-vite', 'discord-bot', 'cpp-cmake']) {
    if (!ids.includes(must)) throw new Error('missing template ' + must);
  }
});

await check('visual client template generates full module system', () => {
  const files = mod.generateTemplate('minecraft-visual-client', {
    projectName: 'TestClient',
    packageName: 'com.test.client',
    minecraftVersion: '1.21.4',
    loader: 'fabric',
    author: 'tester',
  });
  const paths = files.map((f) => f.path);
  const must = [
    'build.gradle',
    'gradle.properties',
    'gradlew.bat',
    'src/main/resources/fabric.mod.json',
  ];
  for (const m of must) if (!paths.some((p) => p.endsWith(m))) throw new Error('missing ' + m);
  const joined = files.map((f) => f.path + '\n' + f.content).join('\n');
  for (const cls of ['ClickGuiScreen', 'ModuleManager', 'EventBus', 'ArrayListHud', 'KeystrokesHud', 'Sprint', 'Fullbright']) {
    if (!joined.includes(cls)) throw new Error('missing class ' + cls);
  }
  if (!joined.includes('fabric-loom')) throw new Error('missing fabric-loom plugin');
  if (!joined.includes('1.21.4')) throw new Error('missing mc version');
});

await check('version matrix prevents incompatible combos', () => {
  const v = mod.MC_VERSIONS.find((x) => x.minecraft === '1.21.4');
  if (v.java !== '21') throw new Error('1.21.4 must use Java 21');
  const old = mod.MC_VERSIONS.find((x) => x.minecraft === '1.16.5');
  if (old.java !== '8') throw new Error('1.16.5 must use Java 8');
  const files = mod.generateTemplate('minecraft-fabric-mod', {
    projectName: 'Mod',
    packageName: 'com.t.m',
    minecraftVersion: '1.20.1',
    loader: 'fabric',
  });
  const props = files.find((f) => f.path === 'gradle.properties').content;
  if (!props.includes('1.20.1')) throw new Error('gradle.properties must pin the chosen MC version');
  if (!props.includes('java') && !props.includes('JAVA')) {
    // java version enforced via toolchain in build.gradle
  }
  const gradle = files.find((f) => f.path === 'build.gradle').content;
  if (!gradle.includes('JavaLanguageVersion') && !gradle.includes('release')) throw new Error('java toolchain missing');
});

await check('launcher template includes Microsoft OAuth flow', () => {
  const files = mod.generateTemplate('minecraft-launcher', { projectName: 'MyLauncher', packageName: 'com.t.launch' });
  const main = files.find((f) => f.path.endsWith('LauncherMain.java'));
  if (!main) throw new Error('missing LauncherMain');
  for (const must of ['devicecode', 'piston-meta', 'SHA-1', 'mainClass']) {
    if (!main.content.includes(must)) throw new Error('launcher missing ' + must);
  }
});

await check('JsonStore persists atomically and merges defaults', async () => {
  const res = await mod.runStoreTest(path.join(tmp, 'store-test.json'));
  if (!res.ok) throw new Error(res.error);
});

await check('build system detection works', () => {
  const proj = path.join(tmp, 'fake-project');
  fs.mkdirSync(path.join(proj, 'gradle'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'build.gradle'), 'plugins {}');
  fs.writeFileSync(path.join(proj, 'gradlew.bat'), '@echo off');
  fs.writeFileSync(path.join(proj, 'package.json'), JSON.stringify({ scripts: { build: 'tsc' } }));
  const tasks = mod.detectBuildSystem(proj);
  if (!tasks.some((t) => t.kind === 'gradle')) throw new Error('gradle not detected');
  if (!tasks.some((t) => t.kind === 'npm')) throw new Error('npm not detected');
});

await check('problem parser extracts java errors', () => {
  const out = '/x/Foo.java:12: error: cannot find symbol\nBuild failed';
  const problems = mod.parseProblemsForTest(out, '/x');
  if (!problems.length) throw new Error('no problems parsed');
  if (problems[0].line !== 12 || problems[0].severity !== 'error') throw new Error('bad parse');
});

console.log(failures === 0 ? '[logic] ALL TESTS PASSED' : `[logic] ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
