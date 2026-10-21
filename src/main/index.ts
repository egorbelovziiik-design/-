import { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } from 'electron'
import { join, basename } from 'path'
import { promises as fsp, existsSync, readFileSync, writeFileSync, statSync, createReadStream } from 'fs'
import { spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { streamChat, completeOnce, listModels } from './ai'
import { offlineUuid, startDeviceCode, pollDeviceToken, minecraftLogin, refreshMicrosoft } from './msauth'
import { templateFiles } from './templates'
import type { AiProviderConfig, ChatMessage, MinecraftProjectOptions } from '../shared/types'

let win: BrowserWindow | null = null
const isWin = process.platform === 'win32'

function createWindow(): void {
  win = new BrowserWindow({
    width: 1520, height: 940, minWidth: 980, minHeight: 620,
    backgroundColor: '#09090F',
    title: 'WinCode AI',
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

// ---------- window controls ----------
ipcMain.on('win:minimize', () => win?.minimize())
ipcMain.on('win:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()))
ipcMain.on('win:close', () => win?.close())
ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, userData: app.getPath('userData'), home: app.getPath('home') }))

// ---------- secure secret store (Windows DPAPI via safeStorage) ----------
function secretsFile(): string { return join(app.getPath('userData'), 'secrets.json') }
function readSecrets(): Record<string, string> {
  try { return JSON.parse(readFileSync(secretsFile(), 'utf8')) } catch { return {} }
}
ipcMain.handle('secret:set', (_e, key: string, value: string) => {
  const all = readSecrets()
  if (!value) delete all[key]
  else all[key] = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(value).toString('base64') : Buffer.from(value).toString('base64')
  writeFileSync(secretsFile(), JSON.stringify(all))
})
ipcMain.handle('secret:get', (_e, key: string) => {
  const v = readSecrets()[key]
  if (!v) return ''
  try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(v, 'base64')) : Buffer.from(v, 'base64').toString() }
  catch { return '' }
})

// ---------- file system ----------
const SKIP = new Set(['node_modules', '.git', 'build', '.gradle', 'out', 'dist', 'target', '__pycache__', '.idea', 'run'])
async function tree(dir: string, depth = 0): Promise<any[]> {
  if (depth > 14) return []
  const entries = await fsp.readdir(dir, { withFileTypes: true })
  const nodes: any[] = []
  for (const e of entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
    if (e.isDirectory() && SKIP.has(e.name)) continue
    const p = join(dir, e.name)
    nodes.push({ name: e.name, path: p, isDir: e.isDirectory(), children: e.isDirectory() ? await tree(p, depth + 1) : undefined })
    if (nodes.length > 4000) break
  }
  return nodes
}
ipcMain.handle('fs:tree', (_e, dir: string) => tree(dir))
ipcMain.handle('fs:read', async (_e, p: string) => {
  const st = statSync(p)
  if (st.size > 4_000_000) throw new Error('Файл слишком большой (>4 МБ) для редактора')
  const buf = await fsp.readFile(p)
  if (buf.includes(0)) throw new Error('Бинарный файл нельзя открыть в редакторе')
  return buf.toString('utf8')
})
ipcMain.handle('fs:write', async (_e, p: string, content: string) => { await fsp.mkdir(join(p, '..'), { recursive: true }); await fsp.writeFile(p, content, 'utf8') })
ipcMain.handle('fs:mkdir', (_e, p: string) => fsp.mkdir(p, { recursive: true }))
ipcMain.handle('fs:delete', (_e, p: string) => fsp.rm(p, { recursive: true, force: true }))
ipcMain.handle('fs:rename', (_e, from: string, to: string) => fsp.rename(from, to))
ipcMain.handle('fs:exists', (_e, p: string) => existsSync(p))
ipcMain.handle('dialog:openFolder', async () => {
  const r = await dialog.showOpenDialog(win!, { properties: ['openDirectory', 'createDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})
ipcMain.handle('dialog:openFile', async () => {
  const r = await dialog.showOpenDialog(win!, { properties: ['openFile'] })
  return r.canceled ? null : r.filePaths[0]
})

// ---------- project index (persistent AI memory / light RAG) ----------
const TEXT_EXT = new Set(['java', 'kt', 'kts', 'py', 'js', 'ts', 'tsx', 'jsx', 'json', 'gradle', 'xml', 'yml', 'yaml', 'properties', 'md', 'html', 'css', 'cpp', 'c', 'cs', 'rs', 'go', 'sql'])
async function walkText(dir: string, out: string[] = [], depth = 0): Promise<string[]> {
  if (depth > 16 || out.length > 3000) return out
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!SKIP.has(e.name)) await walkText(p, out, depth + 1) }
    else if (TEXT_EXT.has((e.name.split('.').pop() || '').toLowerCase())) out.push(p)
  }
  return out
}
ipcMain.handle('project:index', async (_e, root: string) => {
  const files = await walkText(root)
  const entries: any[] = []
  for (const f of files.slice(0, 800)) {
    try {
      const rel = f.slice(root.length + 1).replace(/\\/g, '/')
      const head = (await fsp.readFile(f, 'utf8')).slice(0, 12000)
      const symbols = [...head.matchAll(/(?:class|interface|object|fun|def|function|public\s+\w+\s+\w+\s*\()\s*([A-Za-z_]\w*)/g)].slice(0, 24).map(m => m[1])
      entries.push({ path: rel, size: head.length, symbols, preview: head.split('\n').slice(0, 8).join('\n') })
    } catch { /* skip */ }
  }
  const indexDir = join(root, '.wincode')
  await fsp.mkdir(indexDir, { recursive: true })
  const data = { rootName: basename(root), updatedAt: new Date().toISOString(), files: entries }
  await fsp.writeFile(join(indexDir, 'index.json'), JSON.stringify(data, null, 1))
  return data
})
ipcMain.handle('project:search', async (_e, root: string, query: string) => {
  const files = await walkText(root)
  const q = query.toLowerCase()
  const hits: any[] = []
  for (const f of files) {
    if (hits.length >= 200) break
    const rl = createInterface({ input: createReadStream(f, 'utf8'), crlfDelay: Infinity })
    let lineNo = 0
    for await (const line of rl) {
      lineNo++
      if (line.toLowerCase().includes(q)) hits.push({ file: f, rel: f.slice(root.length + 1).replace(/\\/g, '/'), line: lineNo, text: line.trim().slice(0, 240) })
    }
  }
  return hits
})
ipcMain.handle('project:relevant', async (_e, root: string, prompt: string, maxChars = 30000) => {
  // Lightweight retrieval: score indexed files by keyword overlap with the prompt, return full content of top files.
  try {
    const idx = JSON.parse(await fsp.readFile(join(root, '.wincode', 'index.json'), 'utf8'))
    const words = new Set((prompt.toLowerCase().match(/[a-zа-я0-9_]{3,}/gi) || []))
    const scored = idx.files.map((f: any) => {
      let s = 0
      const hay = (f.path + ' ' + f.symbols.join(' ') + ' ' + f.preview).toLowerCase()
      words.forEach(w => { if (hay.includes(w)) s += f.symbols.some((x: string) => x.toLowerCase() === w) ? 5 : 1 })
      return { f, s }
    }).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s).slice(0, 8)
    let budget = maxChars
    const out: { path: string; content: string }[] = []
    for (const { f } of scored) {
      if (budget <= 0) break
      const content = (await fsp.readFile(join(root, f.path), 'utf8')).slice(0, budget)
      budget -= content.length
      out.push({ path: f.path, content })
    }
    return out
  } catch { return [] }
})

// ---------- processes: run commands & terminal sessions ----------
const procs = new Map<string, ChildProcess>()
function spawnTracked(id: string, cmd: string, cwd: string, shellMode: boolean): ChildProcess {
  const child = spawn(cmd, [], {
    cwd: cwd || undefined,
    shell: shellMode ? (isWin ? 'powershell.exe' : '/bin/bash') : (isWin ? 'powershell.exe' : '/bin/bash'),
    env: { ...process.env, FORCE_COLOR: '1' }
  })
  procs.set(id, child)
  const send = (ch: string, data: any) => win?.webContents.send(ch, data)
  child.stdout?.on('data', d => send('proc:data', { id, data: d.toString() }))
  child.stderr?.on('data', d => send('proc:data', { id, data: d.toString() }))
  child.on('error', err => send('proc:data', { id, data: `\r\n[ошибка запуска: ${err.message}]\r\n` }))
  child.on('close', code => { procs.delete(id); send('proc:exit', { id, code }) })
  return child
}
ipcMain.handle('proc:run', (_e, id: string, cmd: string, cwd: string) => { spawnTracked(id, cmd, cwd, true); return true })
ipcMain.handle('term:create', (_e, id: string, cwd: string, shellName: string) => {
  const shellExe = isWin ? (shellName === 'cmd' ? 'cmd.exe' : 'powershell.exe') : '/bin/bash'
  const child = spawn(shellExe, isWin && shellExe.includes('powershell') ? ['-NoLogo'] : [], {
    cwd: cwd || app.getPath('home'), env: { ...process.env, TERM: 'xterm-256color' }
  })
  procs.set(id, child)
  child.stdout?.on('data', d => win?.webContents.send('proc:data', { id, data: d.toString() }))
  child.stderr?.on('data', d => win?.webContents.send('proc:data', { id, data: d.toString() }))
  child.on('close', code => { procs.delete(id); win?.webContents.send('proc:exit', { id, code }) })
  return true
})
ipcMain.on('proc:write', (_e, id: string, data: string) => { try { procs.get(id)?.stdin?.write(data) } catch { /* closed */ } })
ipcMain.handle('proc:kill', (_e, id: string) => {
  const p = procs.get(id); if (!p) return
  if (isWin) spawn('taskkill', ['/pid', String(p.pid), '/T', '/F'])
  else p.kill('SIGTERM')
})
ipcMain.handle('proc:exec', async (_e, cmd: string, cwd: string) => {
  return new Promise<{ code: number; output: string }>(resolve => {
    const child = spawn(cmd, [], { cwd: cwd || undefined, shell: isWin ? 'powershell.exe' : '/bin/bash', env: process.env })
    let out = ''
    child.stdout?.on('data', d => (out += d.toString()))
    child.stderr?.on('data', d => (out += d.toString()))
    child.on('error', e => resolve({ code: -1, output: String(e) }))
    child.on('close', code => resolve({ code: code ?? -1, output: out }))
  })
})

// ---------- git ----------
function git(cwd: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise(resolve => {
    const child = spawn('git', args, { cwd, env: process.env })
    let out = ''
    child.stdout?.on('data', d => (out += d.toString()))
    child.stderr?.on('data', d => (out += d.toString()))
    child.on('error', e => resolve({ code: -1, output: `git недоступен: ${e.message}` }))
    child.on('close', code => resolve({ code: code ?? -1, output: out }))
  })
}
ipcMain.handle('git', (_e, cwd: string, args: string[]) => git(cwd, args))

// ---------- AI ----------
const aiAborts = new Map<string, AbortController>()
ipcMain.handle('ai:chat', async (_e, reqId: string, cfg: AiProviderConfig, messages: ChatMessage[]) => {
  const ctl = new AbortController()
  aiAborts.set(reqId, ctl)
  let full = ''
  try {
    for await (const chunk of streamChat(cfg, messages, ctl.signal)) {
      full += chunk
      win?.webContents.send('ai:chunk', { reqId, chunk })
    }
    win?.webContents.send('ai:done', { reqId, full })
    return full
  } catch (err: any) {
    const msg = ctl.signal.aborted ? 'Генерация остановлена пользователем.' : `Ошибка AI API: ${err?.message || err}`
    win?.webContents.send('ai:error', { reqId, error: msg })
    throw new Error(msg)
  } finally { aiAborts.delete(reqId) }
})
ipcMain.handle('ai:stop', (_e, reqId: string) => aiAborts.get(reqId)?.abort())
ipcMain.handle('ai:complete', async (_e, cfg: AiProviderConfig, prompt: string) => {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 12000)
  try { return await completeOnce(cfg, [{ role: 'user', content: prompt }], ctl.signal) }
  finally { clearTimeout(t) }
})
ipcMain.handle('ai:models', (_e, cfg: AiProviderConfig) => listModels(cfg))

// ---------- Minecraft accounts ----------
ipcMain.handle('mc:offlineUuid', (_e, name: string) => offlineUuid(name))
ipcMain.handle('mc:msLogin', async (_e, clientId: string) => {
  if (!clientId) throw new Error('Укажите Azure client_id в настройках (раздел Accounts). Инструкция — в документации WinCode AI.')
  const dc = await startDeviceCode(clientId)
  win?.webContents.send('mc:deviceCode', dc)
  shell.openExternal(dc.verificationUri)
  const tokens = await pollDeviceToken(clientId, dc.deviceCode, dc.interval)
  const profile = await minecraftLogin(tokens.accessToken)
  return { profile, refreshToken: tokens.refreshToken }
})
ipcMain.handle('mc:msRefresh', async (_e, clientId: string, refreshToken: string) => {
  const tokens = await refreshMicrosoft(clientId, refreshToken)
  const profile = await minecraftLogin(tokens.accessToken)
  return { profile, refreshToken: tokens.refreshToken }
})

// ---------- Minecraft project scaffolding ----------
const WRAPPER_FILES = [
  { url: 'https://raw.githubusercontent.com/gradle/gradle/v8.10.2/gradle/wrapper/gradle-wrapper.jar', dest: 'gradle/wrapper/gradle-wrapper.jar', bin: true },
  { url: 'https://raw.githubusercontent.com/gradle/gradle/v8.10.2/gradlew', dest: 'gradlew', bin: false },
  { url: 'https://raw.githubusercontent.com/gradle/gradle/v8.10.2/gradlew.bat', dest: 'gradlew.bat', bin: false }
]
ipcMain.handle('mc:createProject', async (_e, o: MinecraftProjectOptions) => {
  const root = join(o.parentDir, o.name.replace(/\s+/g, '-'))
  if (existsSync(join(root, 'build.gradle'))) throw new Error(`В папке ${root} проект уже существует`)
  const files = templateFiles(o)
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(root, rel)
    await fsp.mkdir(join(dest, '..'), { recursive: true })
    await fsp.writeFile(dest, content, 'utf8')
  }
  // Gradle Wrapper: скачиваем официальные файлы gradle/gradle, чтобы gradlew сразу работал
  let wrapperOk = true
  for (const w of WRAPPER_FILES) {
    try {
      const res = await fetch(w.url)
      if (!res.ok) throw new Error(String(res.status))
      const dest = join(root, w.dest)
      await fsp.mkdir(join(dest, '..'), { recursive: true })
      await fsp.writeFile(dest, Buffer.from(await res.arrayBuffer()))
    } catch { wrapperOk = false }
  }
  if (!isWin) { try { await fsp.chmod(join(root, 'gradlew'), 0o755) } catch { /* noop */ } }
  return { root, wrapperOk, fileCount: Object.keys(files).length }
})

// ---------- generic project scaffolding (non-Minecraft) ----------
ipcMain.handle('project:createFiles', async (_e, root: string, files: Record<string, string>) => {
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(root, rel)
    await fsp.mkdir(join(dest, '..'), { recursive: true })
    await fsp.writeFile(dest, content, 'utf8')
  }
  return root
})

// ---------- Java/Kotlin Language Server process manager ----------
const lsProcs = new Map<string, ChildProcess>()
ipcMain.handle('ls:startJava', async (_e, jarPath: string, workspace: string) => {
  if (!jarPath || !existsSync(jarPath)) throw new Error('Не найден Eclipse JDT LS. Укажите путь к org.eclipse.equinox.launcher_*.jar в настройках Java.')
  const dataDir = join(app.getPath('userData'), 'jdt-data')
  const child = spawn('java', [
    '-Declipse.application=org.eclipse.jdt.ls.core.id1', '-Dosgi.bundles.defaultStartLevel=4',
    '-Declipse.product=org.eclipse.jdt.ls.core.product', '-Xms1G', '--add-modules=ALL-SYSTEM',
    '--add-opens', 'java.base/java.util=ALL-UNNAMED', '--add-opens', 'java.base/java.lang=ALL-UNNAMED',
    '-jar', jarPath, '-configuration', join(dataDir, 'config'), '-data', join(dataDir, 'data', basename(workspace))
  ], { cwd: workspace })
  lsProcs.set('java', child)
  child.stderr?.on('data', d => win?.webContents.send('ls:log', { lang: 'java', data: d.toString() }))
  child.on('close', code => win?.webContents.send('ls:log', { lang: 'java', data: `JDT LS завершён (код ${code})` }))
  return true
})
ipcMain.handle('ls:stop', (_e, lang: string) => { lsProcs.get(lang)?.kill(); lsProcs.delete(lang) })

app.whenReady().then(createWindow)
app.on('window-all-closed', () => {
  procs.forEach(p => { try { p.kill() } catch { /* noop */ } })
  lsProcs.forEach(p => { try { p.kill() } catch { /* noop */ } })
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
