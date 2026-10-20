/**
 * CI diagnostics reporter.
 * Posts the tail of electron-builder.log to GitHub issue #1 via the REST API
 * (readable back through api.github.com), with Contents-API and git fallbacks.
 * Runs on the CI runner (full network + GITHUB_TOKEN).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const REPO = process.env.REPO || process.env.GITHUB_REPOSITORY || '';
const RUN_ID = process.env.RUN_ID || process.env.GITHUB_RUN_ID || 'unknown';
const RUN_URL = `https://github.com/${REPO}/actions/runs/${RUN_ID}`;

function logTail(file, max = 48000) {
  if (!fs.existsSync(file)) return `(${file} not produced)`;
  const content = fs.readFileSync(file, 'utf-8');
  return content.length > max ? content.slice(-max) : content;
}

async function api(method, url, body, headers = {}) {
  const res = await fetch(`https://api.github.com${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  const status = fs.existsSync('ci-status.txt') ? fs.readFileSync('ci-status.txt', 'utf-8') : '(no ci-status)';
  const listing = logTail('release-listing.txt', 4000);
  const builder = logTail('electron-builder.log');

  const body = [
    `### CI diagnostics — run [${RUN_ID}](${RUN_URL})`,
    '',
    'ci-status.txt:',
    '```',
    status.trim().slice(0, 500),
    '```',
    '',
    'release-listing.txt:',
    '```',
    listing.trim().slice(0, 2000),
    '```',
    '',
    'electron-builder.log (tail):',
    '```',
    builder,
    '```',
  ].join('\n');

  // Channel 1: issue comment
  try {
    const res = await api('POST', `/repos/${REPO}/issues/1/comments`, { body });
    console.log(`[diag] issue comment -> ${res.status}`);
    if (res.status >= 200 && res.status < 300) return;
  } catch (err) {
    console.log('[diag] issue comment failed:', err.message);
  }

  // Channel 2: Contents API (writes a file into the repo)
  try {
    const content = Buffer.from(body).toString('base64');
    const res = await api('PUT', `/repos/${REPO}/contents/ci-diag-${RUN_ID}.md`, {
      message: `CI diagnostics for run ${RUN_ID} [skip ci]`,
      content,
    });
    console.log(`[diag] contents api -> ${res.status}`);
    if (res.status >= 200 && res.status < 300) return;
  } catch (err) {
    console.log('[diag] contents api failed:', err.message);
  }

  // Channel 3: git commit + push
  try {
    fs.writeFileSync('CI-DIAGNOSTICS.md', body);
    execFileSync('git', ['config', 'user.name', 'wincode-ci'], { stdio: 'inherit' });
    execFileSync('git', ['config', 'user.email', 'ci@wincode.ai'], { stdio: 'inherit' });
    execFileSync('git', ['add', '-f', 'CI-DIAGNOSTICS.md', 'electron-builder.log', 'ci-status.txt', 'release-listing.txt'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    execFileSync('git', ['commit', '-m', `CI diagnostics for run ${RUN_ID} [skip ci]`, '--allow-empty'], { stdio: 'inherit' });
    const branch = process.env.CI_BRANCH || process.env.GITHUB_REF_NAME || 'main';
    execFileSync('git', ['push', 'origin', `HEAD:${branch}`], { stdio: 'inherit' });
    console.log('[diag] git push ok');
  } catch (err) {
    console.log('[diag] git fallback failed:', err.message);
  }
}

main().catch((err) => {
  console.error('[diag] fatal:', err);
  process.exit(0); // never fail the job because of diagnostics
});
