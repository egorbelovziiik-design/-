import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import { assertPathSafe } from './security';
import type { BuildResult, ProblemItem } from '../shared/types';

export interface BuildTaskSpec {
  kind: 'gradle' | 'maven' | 'npm' | 'pnpm' | 'yarn' | 'python' | 'javac' | 'cmake' | 'cargo' | 'dotnet' | 'custom';
  command: string;
  args: string[];
  label: string;
}

let currentProcess: ChildProcess | null = null;
let cancelled = false;

export function detectBuildSystem(projectPath: string): BuildTaskSpec[] {
  const p = (f: string) => path.join(projectPath, f);
  const tasks: BuildTaskSpec[] = [];
  const isWin = process.platform === 'win32';

  if (fs.existsSync(p('gradlew.bat')) || fs.existsSync(p('gradlew')) || fs.existsSync(p('build.gradle')) || fs.existsSync(p('build.gradle.kts'))) {
    const wrapper = isWin && fs.existsSync(p('gradlew.bat')) ? p('gradlew.bat') : fs.existsSync(p('gradlew')) ? './gradlew' : 'gradle';
    tasks.push({ kind: 'gradle', command: wrapper, args: ['build'], label: 'Gradle: build' });
    tasks.push({ kind: 'gradle', command: wrapper, args: ['build', '-x', 'test'], label: 'Gradle: build (skip tests)' });
    tasks.push({ kind: 'gradle', command: wrapper, args: ['test'], label: 'Gradle: test' });
    tasks.push({ kind: 'gradle', command: wrapper, args: ['runClient'], label: 'Gradle: runClient (Minecraft)' });
    tasks.push({ kind: 'gradle', command: wrapper, args: ['remapJar'], label: 'Gradle: remapJar (Fabric)' });
    tasks.push({ kind: 'gradle', command: wrapper, args: ['shadowJar'], label: 'Gradle: shadowJar' });
  }
  if (fs.existsSync(p('pom.xml'))) {
    tasks.push({ kind: 'maven', command: isWin ? 'mvn.cmd' : 'mvn', args: ['package'], label: 'Maven: package' });
    tasks.push({ kind: 'maven', command: isWin ? 'mvn.cmd' : 'mvn', args: ['test'], label: 'Maven: test' });
  }
  if (fs.existsSync(p('package.json'))) {
    const pkg = JSON.parse(fs.readFileSync(p('package.json'), 'utf-8')) as { scripts?: Record<string, string> };
    const runner = fs.existsSync(p('pnpm-lock.yaml')) ? 'pnpm' : fs.existsSync(p('yarn.lock')) ? 'yarn' : 'npm';
    for (const script of Object.keys(pkg.scripts ?? {})) {
      tasks.push({ kind: runner === 'pnpm' ? 'pnpm' : runner === 'yarn' ? 'yarn' : 'npm', command: runner, args: ['run', script], label: `${runner}: ${script}` });
    }
  }
  if (fs.existsSync(p('CMakeLists.txt'))) {
    tasks.push({ kind: 'cmake', command: 'cmake', args: ['--build', 'build'], label: 'CMake: build' });
  }
  if (fs.existsSync(p('Cargo.toml'))) {
    tasks.push({ kind: 'cargo', command: 'cargo', args: ['build'], label: 'Cargo: build' });
    tasks.push({ kind: 'cargo', command: 'cargo', args: ['test'], label: 'Cargo: test' });
  }
  if (fs.existsSync(p('requirements.txt')) || fs.existsSync(p('pyproject.toml'))) {
    tasks.push({ kind: 'python', command: 'python', args: ['-m', 'pytest', '-q'], label: 'Python: pytest' });
  }
  return tasks;
}

function parseProblems(output: string, projectPath: string): ProblemItem[] {
  const problems: ProblemItem[] = [];
  const lines = output.split(/\r?\n/);
  // javac / gradle:  /path/File.java:12: error: message
  const javaRe = /^(.+?\.java):(\d+):?\s*(error|warning|note)?\s*:?\s*(.*)$/i;
  // Gradle Kotlin DSL / Kotlin compiler
  const kotlinRe = /^(.+?\.kts?):(\d+):(\d+):\s*(error|warning):\s*(.*)$/i;
  // TypeScript / ESLint
  const tsRe = /^(.+?\.(ts|tsx|js|jsx))\((\d+),(\d+)\):\s*(error|warning)\s*(TS\d+)?\s*(.*)$/i;
  // Python
  const pyRe = /^\s*File "(.+?)", line (\d+)(.*)$/;
  // Generic gcc/clang
  const gccRe = /^(.+?\.(c|cpp|cc|h|hpp)):(\d+):(\d+):\s*(error|warning|note):\s*(.*)$/i;

  for (const line of lines) {
    let m = line.match(javaRe);
    if (m && m[3]) {
      problems.push({
        file: path.isAbsolute(m[1]) ? m[1] : path.resolve(projectPath, m[1]),
        line: Number(m[2]),
        column: 1,
        severity: /error/i.test(m[3]) ? 'error' : /warning/i.test(m[3]) ? 'warning' : 'info',
        message: m[4] ?? '',
        source: 'javac',
      });
      continue;
    }
    m = line.match(kotlinRe);
    if (m) {
      problems.push({
        file: path.isAbsolute(m[1]) ? m[1] : path.resolve(projectPath, m[1]),
        line: Number(m[2]),
        column: Number(m[3]),
        severity: /error/i.test(m[4] ?? '') ? 'error' : 'warning',
        message: m[5] ?? '',
        source: 'kotlinc',
      });
      continue;
    }
    m = line.match(tsRe);
    if (m) {
      problems.push({
        file: path.isAbsolute(m[1]) ? m[1] : path.resolve(projectPath, m[1]),
        line: Number(m[3]),
        column: Number(m[4]),
        severity: /error/i.test(m[5] ?? '') ? 'error' : 'warning',
        message: (m[7] ?? m[6] ?? '').trim(),
        source: 'tsc',
      });
      continue;
    }
    m = line.match(gccRe);
    if (m) {
      problems.push({
        file: path.isAbsolute(m[1]) ? m[1] : path.resolve(projectPath, m[1]),
        line: Number(m[3]),
        column: Number(m[4]),
        severity: /error/i.test(m[5] ?? '') ? 'error' : 'warning',
        message: m[6] ?? '',
        source: 'gcc',
      });
      continue;
    }
    m = line.match(pyRe);
    if (m) {
      problems.push({
        file: path.isAbsolute(m[1]) ? m[1] : path.resolve(projectPath, m[1]),
        line: Number(m[2]),
        column: 1,
        severity: 'error',
        message: line.trim(),
        source: 'python',
      });
    }
  }
  return problems.slice(0, 400);
}

export function runBuildTask(
  projectPath: string,
  spec: BuildTaskSpec | { command: string; args: string[]; label: string },
  callbacks: {
    onOutput: (chunk: string) => void;
    onDone: (result: BuildResult) => void;
  },
): void {
  const resolved = assertPathSafe(projectPath, { mustExist: true });
  if (currentProcess) {
    try {
      currentProcess.kill();
    } catch {
      /* noop */
    }
    currentProcess = null;
  }
  cancelled = false;
  const started = Date.now();
  const fullCommand = `${spec.command} ${spec.args.join(' ')}`;
  callbacks.onOutput(`\x1b[35m[WinCode AI]\x1b[0m $ ${fullCommand}\r\n`);

  const isWinBat = process.platform === 'win32' && /\.(bat|cmd)$/i.test(spec.command);
  const child = spawn(spec.command, spec.args, {
    cwd: resolved,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: '1', CI: '1', GRADLE_OPTS: process.env.GRADLE_OPTS ?? '' },
    shell: isWinBat,
  });
  currentProcess = child;

  let output = '';
  const onData = (buf: Buffer) => {
    const text = buf.toString('utf-8');
    output += text;
    if (output.length > 2_000_000) output = output.slice(-1_500_000);
    callbacks.onOutput(text);
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  child.on('error', (err) => {
    callbacks.onOutput(`\r\n[build error] ${err.message}\r\n`);
    callbacks.onDone({
      ok: false,
      exitCode: -1,
      command: fullCommand,
      durationMs: Date.now() - started,
      problems: [],
      tail: output.slice(-20000),
    });
    currentProcess = null;
  });

  child.on('exit', (code) => {
    const exitCode = code ?? (cancelled ? 130 : 1);
    const problems = parseProblems(output, resolved);
    callbacks.onOutput(`\r\n\x1b[35m[WinCode AI]\x1b[0m process exited with code ${exitCode} (${Date.now() - started} ms)\r\n`);
    callbacks.onDone({
      ok: exitCode === 0,
      exitCode,
      command: fullCommand,
      durationMs: Date.now() - started,
      problems,
      tail: output.slice(-20000),
    });
    currentProcess = null;
  });
}

export function stopBuildTask(): boolean {
  if (currentProcess) {
    cancelled = true;
    try {
      currentProcess.kill();
    } catch {
      /* noop */
    }
    currentProcess = null;
    return true;
  }
  return false;
}

export async function writeProjectFiles(root: string, files: { path: string; content: string }[]): Promise<number> {
  const resolvedRoot = assertPathSafe(root);
  let count = 0;
  for (const f of files) {
    const full = path.join(resolvedRoot, f.path);
    // Prevent path traversal from templates
    const rel = path.relative(resolvedRoot, full);
    if (rel.startsWith('..')) throw new Error('Template attempted path traversal: ' + f.path);
    await fsPromises.mkdir(path.dirname(full), { recursive: true });
    await fsPromises.writeFile(full, f.content, 'utf-8');
    count++;
  }
  return count;
}
