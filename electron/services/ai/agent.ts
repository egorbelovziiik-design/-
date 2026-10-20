/**
 * WinCode Intelligence — AI Agent runtime.
 * Executes real model tool calls against the local project:
 * file read/write, search, listing, safe command execution, memory updates.
 * Dangerous operations require explicit user permission (renderer modal).
 */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile, spawn, ChildProcess } from 'node:child_process';
import type { WebContents } from 'electron';
import { streamChat, chatOnce, type ProviderAuth, type AIToolDefinition } from './providers';
import { assertPathSafe, shouldIgnoreDir, isProbablyBinary } from '../security';
import type { AIMessage, AIToolCall, AgentMode, PermissionRequest } from '../../shared/types';
import { appendMemory, loadMemory } from '../memory';

export interface AgentRunContext {
  webContents: WebContents;
  projectRoot: string;
  mode: AgentMode;
  auth: ProviderAuth;
  allowedFiles?: string[]; // EDIT mode restricts writes
}

export interface AgentEvent {
  type:
    | 'text'
    | 'tool-start'
    | 'tool-result'
    | 'plan'
    | 'step'
    | 'permission'
    | 'done'
    | 'error'
    | 'stopped';
  payload: unknown;
  ts: number;
}

const runningProcesses = new Map<string, ChildProcess>();
const cancelTokens = new Map<string, AbortController>();
const pendingPermissions = new Map<string, { resolve: (v: boolean) => void }>();

export function respondPermission(requestId: string, approved: boolean) {
  const p = pendingPermissions.get(requestId);
  if (p) {
    p.resolve(approved);
    pendingPermissions.delete(requestId);
  }
}

export function stopAgent(runId: string) {
  cancelTokens.get(runId)?.abort();
  for (const [, proc] of runningProcesses) {
    try {
      proc.kill();
    } catch {
      /* noop */
    }
  }
  runningProcesses.clear();
}

function emit(ctx: AgentRunContext, type: AgentEvent['type'], payload: unknown) {
  ctx.webContents.send('ai:agent-event', { type, payload, ts: Date.now() } as AgentEvent);
}

async function requestPermission(ctx: AgentRunContext, tool: string, description: string, detail: string, dangerous: boolean): Promise<boolean> {
  if (!dangerous && ctx.auth && dangerous === false) {
    // safe tools auto-approved only in AUTOPILOT/AGENT with settings flag handled by caller
  }
  const id = 'perm_' + Math.random().toString(36).slice(2) + Date.now();
  const req: PermissionRequest = { id, tool, description, detail, dangerous };
  const promise = new Promise<boolean>((resolve) => {
    pendingPermissions.set(id, { resolve });
    emit(ctx, 'permission', req);
    // Dedicated channel so the renderer shows the approval modal immediately.
    ctx.webContents.send('ai:permission-request', req);
  });
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5 * 60 * 1000));
  const approved = await Promise.race([promise, timeout]);
  if (!approved) emit(ctx, 'tool-result', { name: tool, content: 'User denied this operation.', isError: true });
  return approved;
}

/* ------------------------------ Tools ------------------------------ */

interface ToolContext {
  ctx: AgentRunContext;
  runId: string;
}

function toolDefs(mode: AgentMode): AIToolDefinition[] {
  const base: AIToolDefinition[] = [
    {
      name: 'read_file',
      description: 'Read a text file from the project. Returns the file content with line numbers.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path or project-relative path' },
          start_line: { type: 'number', description: 'Optional first line (1-based)' },
          end_line: { type: 'number', description: 'Optional last line (inclusive)' },
        },
        required: ['path'],
      },
    },
    {
      name: 'list_dir',
      description: 'List files and folders in a directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (project-relative or absolute)' },
          depth: { type: 'number', description: 'Recursion depth 1-3, default 1' },
        },
        required: ['path'],
      },
    },
    {
      name: 'search_files',
      description: 'Search text/regex across project files. Returns matches with file, line, preview.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text or regex to search' },
          regex: { type: 'boolean' },
          file_glob: { type: 'string', description: 'Only search files whose path contains this substring' },
        },
        required: ['query'],
      },
    },
    {
      name: 'write_file',
      description: 'Create or overwrite a file with the given content. Creates parent directories.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
          reason: { type: 'string', description: 'Short explanation shown to the user' },
        },
        required: ['path', 'content'],
      },
    },
  ];

  if (mode === 'ASK') return [];

  if (mode === 'PLAN') {
    return [
      {
        name: 'save_plan',
        description: 'Save the architecture/implementation plan into project memory.',
        parameters: {
          type: 'object',
          properties: { plan_markdown: { type: 'string' } },
          required: ['plan_markdown'],
        },
      },
      ...base.slice(0, 3),
    ];
  }

  return [
    ...base,
    {
      name: 'create_directory',
      description: 'Create a directory (and parents) inside the project.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
    {
      name: 'run_command',
      description:
        'Run a shell command inside the project directory (builds, tests, gradle, npm, git). Requires user permission for dangerous commands.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute, e.g. "gradlew build" or "npm install"' },
          timeout_ms: { type: 'number', description: 'Timeout in milliseconds, default 300000' },
        },
        required: ['command'],
      },
    },
    {
      name: 'delete_path',
      description: 'Delete a file or folder (moves to recycle bin). ALWAYS ask the user for permission first via your reply.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          confirm_phrase: { type: 'string', description: 'Must be exactly "DELETE" to proceed' },
        },
        required: ['path', 'confirm_phrase'],
      },
    },
    {
      name: 'update_memory',
      description: 'Update persistent project memory (architecture, key classes, user preferences, Minecraft version).',
      parameters: {
        type: 'object',
        properties: {
          architecture: { type: 'string' },
          key_classes: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
          minecraft: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              loader: { type: 'string' },
              java: { type: 'string' },
            },
          },
        },
      },
    },
    {
      name: 'finish',
      description: 'Signal that the task is complete, with a summary of what was done.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          build_ok: { type: 'boolean', description: 'Whether the last build/test run succeeded' },
        },
        required: ['summary'],
      },
    },
  ];
}

function resolveInProject(ctx: AgentRunContext, p: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(ctx.projectRoot, p);
  return assertPathSafe(abs);
}

async function readNumbered(abs: string, start?: number, end?: number): Promise<string> {
  const raw = await fs.readFile(abs, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const s = Math.max(1, start ?? 1) - 1;
  const e = Math.min(lines.length, end ?? lines.length);
  return lines
    .slice(s, e)
    .map((l, i) => `${String(s + i + 1).padStart(5)}| ${l}`)
    .join('\n');
}

async function listDirRecursive(abs: string, depth: number, prefix = ''): Promise<string> {
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries.slice(0, 200)) {
    if (shouldIgnoreDir(e.name) && e.isDirectory()) continue;
    out.push(`${prefix}${e.isDirectory() ? '📁' : '📄'} ${e.name}`);
    if (e.isDirectory() && depth > 1) {
      out.push(await listDirRecursive(path.join(abs, e.name), depth - 1, prefix + '  '));
    }
  }
  return out.join('\n');
}

const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+-rf?\b/i,
  /\brmdir\b/i,
  /\bdel\b/i,
  /\bformat\b/i,
  /\bmkfs\b/i,
  /\bshutdown\b/i,
  /\bregedit\b/i,
  /\breg\s+add\b/i,
  /\bRemove-Item\b/i,
  /\bInvoke-Expression\b/i,
  /\bcurl\b.*\|\s*(sh|bash|powershell)/i,
  /\bwget\b.*\|\s*(sh|bash)/i,
  /\bgit\s+push\s+--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bchmod\s+777\b/i,
  /\bsudo\b/i,
];

function isDangerousCommand(cmd: string): boolean {
  return DANGEROUS_COMMAND_PATTERNS.some((re) => re.test(cmd));
}

async function runCommand(tc: ToolContext, command: string, timeoutMs: number): Promise<string> {
  const dangerous = isDangerousCommand(command);
  const approved = await requestPermission(
    tc.ctx,
    'run_command',
    dangerous ? `⚠️ Potentially dangerous command: ${command}` : `Run command: ${command}`,
    `cwd: ${tc.ctx.projectRoot}\ncommand: ${command}`,
    dangerous,
  );
  if (!approved) return 'Command was not executed: user did not approve.';

  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const child = spawn(isWin ? 'cmd.exe' : '/bin/sh', isWin ? ['/d', '/s', '/c', command] : ['-c', command], {
      cwd: tc.ctx.projectRoot,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    runningProcesses.set(tc.runId, child);
    let out = '';
    const collect = (b: Buffer) => {
      out += b.toString('utf-8');
      if (out.length > 200000) out = out.slice(-200000);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* noop */
      }
    }, timeoutMs || 300000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      runningProcesses.delete(tc.runId);
      resolve(`Exit code: ${code}\n--- output (tail) ---\n${out.slice(-12000)}`);
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve('Failed to start command: ' + err.message);
    });
  });
}

async function executeTool(call: AIToolCall, tc: ToolContext): Promise<{ content: string; isError?: boolean }> {
  let args: any = {};
  try {
    args = JSON.parse(call.arguments || '{}');
  } catch {
    return { content: 'Invalid JSON arguments: ' + call.arguments, isError: true };
  }

  switch (call.name) {
    case 'read_file': {
      try {
        const abs = resolveInProject(tc.ctx, args.path);
        const content = await readNumbered(abs, args.start_line, args.end_line);
        return { content: content.slice(0, 60000) };
      } catch (e) {
        return { content: (e as Error).message, isError: true };
      }
    }
    case 'list_dir': {
      try {
        const abs = resolveInProject(tc.ctx, args.path || '.');
        return { content: (await listDirRecursive(abs, Math.min(3, args.depth ?? 1))).slice(0, 30000) };
      } catch (e) {
        return { content: (e as Error).message, isError: true };
      }
    }
    case 'search_files': {
      try {
        const { searchInFiles } = require('../files');
        const hits = await searchInFiles(tc.ctx.projectRoot, String(args.query ?? ''), { regex: !!args.regex, maxResults: 120 });
        const filtered = args.file_glob ? hits.filter((h: { file: string }) => h.file.includes(args.file_glob)) : hits;
        if (!filtered.length) return { content: 'No matches.' };
        return {
          content: filtered
            .slice(0, 120)
            .map((h: { file: string; line: number; preview: string }) => `${path.relative(tc.ctx.projectRoot, h.file)}:${h.line}: ${h.preview}`)
            .join('\n'),
        };
      } catch (e) {
        return { content: (e as Error).message, isError: true };
      }
    }
    case 'write_file': {
      try {
        const abs = resolveInProject(tc.ctx, args.path);
        if (tc.ctx.mode === 'EDIT' && tc.ctx.allowedFiles?.length) {
          const rel = path.relative(tc.ctx.projectRoot, abs);
          const allowed = tc.ctx.allowedFiles.some((f) => path.resolve(tc.ctx.projectRoot, f) === abs || f === rel);
          if (!allowed) {
            return { content: `EDIT mode: writing outside selected files is not allowed (${rel}).`, isError: true };
          }
        }
        const exists = fsSync.existsSync(abs);
        if (!exists) {
          const ok = await requestPermission(tc.ctx, 'write_file', `Create new file: ${path.relative(tc.ctx.projectRoot, abs)}`, abs, false);
          if (!ok) return { content: 'User did not approve creating this file.', isError: true };
        }
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, String(args.content ?? ''), 'utf-8');
        return { content: `Written ${Buffer.byteLength(String(args.content ?? ''))} bytes to ${args.path}` };
      } catch (e) {
        return { content: (e as Error).message, isError: true };
      }
    }
    case 'create_directory': {
      try {
        const abs = resolveInProject(tc.ctx, args.path);
        await fs.mkdir(abs, { recursive: true });
        return { content: `Directory created: ${args.path}` };
      } catch (e) {
        return { content: (e as Error).message, isError: true };
      }
    }
    case 'run_command':
      return { content: await runCommand(tc, String(args.command ?? ''), Number(args.timeout_ms ?? 300000)) };
    case 'delete_path': {
      if (args.confirm_phrase !== 'DELETE') {
        return { content: 'delete_path requires confirm_phrase="DELETE". Ask the user in chat first and get approval.', isError: true };
      }
      const ok = await requestPermission(tc.ctx, 'delete_path', `⚠️ DELETE ${args.path}`, String(args.path), true);
      if (!ok) return { content: 'User denied deletion.', isError: true };
      try {
        const abs = resolveInProject(tc.ctx, args.path);
        const { shell } = require('electron');
        await shell.trashItem(abs);
        return { content: `Moved to recycle bin: ${args.path}` };
      } catch (e) {
        return { content: (e as Error).message, isError: true };
      }
    }
    case 'update_memory': {
      const mem = await loadMemory(tc.ctx.projectRoot);
      if (args.architecture) mem.architecture = String(args.architecture);
      if (Array.isArray(args.key_classes)) mem.keyClasses = args.key_classes.map(String);
      if (args.notes) mem.notes = String(args.notes);
      if (args.minecraft) {
        mem.minecraft = {
          version: String(args.minecraft.version ?? mem.minecraft?.version ?? ''),
          loader: String(args.minecraft.loader ?? mem.minecraft?.loader ?? ''),
          java: String(args.minecraft.java ?? mem.minecraft?.java ?? ''),
        };
      }
      mem.changeHistory.push(`[agent ${new Date().toISOString()}] memory updated`);
      await appendMemory(tc.ctx.projectRoot, mem);
      return { content: 'Project memory updated.' };
    }
    case 'save_plan': {
      const mem = await loadMemory(tc.ctx.projectRoot);
      mem.notes = String(args.plan_markdown ?? '');
      mem.architecture = String(args.plan_markdown ?? '').slice(0, 4000);
      await appendMemory(tc.ctx.projectRoot, mem);
      return { content: 'Plan saved to project memory.' };
    }
    case 'finish':
      return { content: `Task finished. Summary: ${args.summary}\nBuild ok: ${args.build_ok}` };
    default:
      return { content: `Unknown tool: ${call.name}`, isError: true };
  }
}

/* ------------------------------ Main loop ------------------------------ */

const SYSTEM_PROMPTS: Record<AgentMode, string> = {
  ASK: `You are WinCode Intelligence, the AI engine of WinCode AI IDE. Answer programming questions precisely.
You have deep expertise in Java, Kotlin, Minecraft mod development (Fabric, Forge, NeoForge, Quilt, Mixin, Fabric API, LWJGL), Gradle, Maven, Spring, Python, TypeScript, React, C++, Rust, Go, build systems, debugging and architecture.
Be concrete: give real code, not placeholders. You have NO tool access in ASK mode.`,
  EDIT: `You are WinCode Intelligence operating in EDIT mode. You may only modify the files selected by the user.
Use read_file to inspect them, then write_file with complete new file contents. Keep unrelated code intact. Always finish with a summary of changes.`,
  AGENT: `You are WinCode Intelligence operating in AGENT mode. You autonomously develop real software in the user's project.
Workflow: explore the project (list_dir, search_files, read_file) → plan → create files and folders → write real, complete code (never stubs/placeholders) → configure build (Gradle/Maven/npm) → run builds/tests with run_command → read errors → fix them → repeat until the build succeeds.
Rules:
- ALWAYS write complete, compilable code. No TODO stubs for core functionality.
- Use run_command to actually build (e.g. "./gradlew build", "gradlew.bat build", "npm run build") and fix every error.
- Minecraft projects must use version-correct dependencies (Fabric Loom / ForgeGradle / NeoForge ModDevGradle).
- Use update_memory to record architecture decisions.
- Use finish only when the task is truly complete and (if applicable) the build passes.
- Deleting files or dangerous commands requires explicit user approval.`,
  PLAN: `You are WinCode Intelligence in PLAN mode. Produce a detailed architecture and implementation plan.
Analyze the project with read_file/list_dir/search_files, then save the plan with save_plan. Do not write code files.`,
  DEBUG: `You are WinCode Intelligence in DEBUG mode. Your job is to find and fix bugs.
Steps: reproduce context (read logs/output provided by user) → locate faulty code (search_files, read_file) → explain root cause → patch with write_file → run the build/tests with run_command → verify the fix. Report the root cause clearly.`,
  AUTOPILOT: `You are WinCode Intelligence in AUTOPILOT mode. You execute an agreed plan fully automatically.
Follow the plan stored in project memory. Write complete code, run builds, fix compile errors iteratively.
Only pause for permission on dangerous/destructive operations. When done, call finish with a summary and build status.`,
};

export async function runAgent(runId: string, userMessage: string, history: AIMessage[], ctx: AgentRunContext): Promise<void> {
  const controller = new AbortController();
  cancelTokens.set(runId, controller);

  const memory = await loadMemory(ctx.projectRoot).catch(() => null);
  let system = SYSTEM_PROMPTS[ctx.mode] + `\n\nProject root: ${ctx.projectRoot}\nCurrent date: ${new Date().toISOString()}`;
  if (memory) {
    system += `\n\n<ProjectMemory>\narchitecture: ${memory.architecture}\nkeyClasses: ${memory.keyClasses.join(', ')}\nminecraft: ${JSON.stringify(memory.minecraft ?? {})}\nnotes: ${memory.notes.slice(0, 2000)}\n</ProjectMemory>`;
  }

  const messages: AIMessage[] = [
    { role: 'system', content: system },
    ...history.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-20),
    { role: 'user', content: userMessage },
  ];

  const tools = toolDefs(ctx.mode);
  const tc: ToolContext = { ctx, runId };
  let iteration = 0;
  const MAX_ITERATIONS = ctx.mode === 'ASK' ? 1 : 24;

  try {
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      if (controller.signal.aborted) {
        emit(ctx, 'stopped', { reason: 'cancelled' });
        return;
      }

      let assistantText = '';
      let toolCalls: AIToolCall[] = [];
      let finished = false;

      await new Promise<void>((resolve, reject) => {
        streamChat(
          ctx.auth,
          messages,
          {
            onTextDelta: (delta) => {
              assistantText += delta;
              emit(ctx, 'text', delta);
            },
            onToolCalls: (calls) => {
              toolCalls = calls;
            },
            onDone: () => resolve(),
            onError: (err) => reject(err),
          },
          { tools: tools.length ? tools : undefined, signal: controller.signal, temperature: ctx.auth.provider.temperature },
        );
      });

      if (toolCalls.length === 0) {
        messages.push({ role: 'assistant', content: assistantText, ts: Date.now() });
        emit(ctx, 'done', { text: assistantText });
        return;
      }

      messages.push({ role: 'assistant', content: assistantText, toolCalls, ts: Date.now() });

      for (const call of toolCalls) {
        if (controller.signal.aborted) {
          emit(ctx, 'stopped', { reason: 'cancelled' });
          return;
        }
        emit(ctx, 'tool-start', { id: call.id, name: call.name, arguments: call.arguments });
        const result = await executeTool(call, tc);
        emit(ctx, 'tool-result', { id: call.id, name: call.name, ...result });
        messages.push({ role: 'tool', content: result.content, toolCallId: call.id, name: call.name });
        if (call.name === 'finish') {
          finished = true;
        }
      }

      if (finished) {
        emit(ctx, 'done', { text: assistantText, viaFinish: true });
        return;
      }
    }
    emit(ctx, 'done', { text: 'Agent reached the maximum number of iterations for one task.', truncated: true });
  } catch (err) {
    emit(ctx, 'error', { message: (err as Error).message });
  } finally {
    cancelTokens.delete(runId);
  }
}

/** Quick one-shot completion used for inline ghost-text suggestions. */
export async function inlineComplete(auth: ProviderAuth, prefix: string, suffix: string, language: string, projectContext: string): Promise<string> {
  const messages: AIMessage[] = [
    {
      role: 'system',
      content:
        `You are an inline code completion engine (like GitHub Copilot). Continue the code at the cursor.
Return ONLY the code that should be inserted at the cursor — no markdown fences, no explanations.
Language: ${language}. Match the existing style and indentation exactly.`,
    },
    {
      role: 'user',
      content: `Project context:\n${projectContext.slice(0, 1500)}\n\n<code_before_cursor>\n${prefix.slice(-3000)}\n</code_before_cursor>\n<code_after_cursor>\n${suffix.slice(0, 800)}\n</code_after_cursor>`,
    },
  ];
  const text = await chatOnce(auth, messages, { maxTokens: 300, temperature: 0.2 });
  return text.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').slice(0, 1200);
}

/** Analyze build/log output and propose fixes (used by "Fix with AI"). */
export async function analyzeError(auth: ProviderAuth, logTail: string, projectFiles: string): Promise<string> {
  return chatOnce(auth, [
    {
      role: 'system',
      content: 'You are WinCode Intelligence DEBUG assistant. Given a build/compiler error log, explain the root cause and give the exact fix with code. Be concise and precise.',
    },
    { role: 'user', content: `Project files overview:\n${projectFiles.slice(0, 3000)}\n\nBuild log tail:\n${logTail.slice(-8000)}` },
  ], { temperature: 0.2, maxTokens: 2000 });
}
