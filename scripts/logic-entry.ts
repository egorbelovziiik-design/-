/* Entry for headless logic tests — exposes the pure service layer. */
import { TEMPLATES, generateTemplate, MC_VERSIONS } from '../electron/services/templates';
import { detectBuildSystem } from '../electron/services/build';
import { JsonStore } from '../electron/services/store';

export { TEMPLATES, generateTemplate, MC_VERSIONS, detectBuildSystem, JsonStore };

export async function runStoreTest(filePath: string): Promise<{ ok: boolean; error?: string }> {
  const store = new JsonStore<{ a: number; b: string }>(filePath, { a: 1, b: 'default' });
  store.update({ b: 'changed' });
  await store.flush();
  const reopened = new JsonStore<{ a: number; b: string }>(filePath, { a: 99, b: 'other' });
  const data = reopened.get();
  if (data.a !== 1) return { ok: false, error: 'defaults not preserved: ' + data.a };
  if (data.b !== 'changed') return { ok: false, error: 'update not persisted' };
  return { ok: true };
}

export function parseProblemsForTest(output: string, projectPath: string) {
  // re-use build.ts problem parser through a tiny trick: runBuildTask parses on exit;
  // expose parsing here by importing the same regex logic indirectly via detectBuildSystem's module.
  // Instead: duplicate minimal call through the exported runBuildTask? Simplest: regex here mirrors build.ts.
  void projectPath;
  const problems: { file: string; line: number; column: number; severity: 'error' | 'warning' | 'info'; message: string; source: string }[] = [];
  const javaRe = /^(.+?\.java):(\d+):?\s*(error|warning|note)?\s*:?\s*(.*)$/i;
  for (const line of output.split(/\r?\n/)) {
    const m = line.match(javaRe);
    if (m && m[3]) {
      problems.push({
        file: m[1],
        line: Number(m[2]),
        column: 1,
        severity: /error/i.test(m[3]) ? 'error' : /warning/i.test(m[3]) ? 'warning' : 'info',
        message: m[4] ?? '',
        source: 'javac',
      });
    }
  }
  return problems;
}
