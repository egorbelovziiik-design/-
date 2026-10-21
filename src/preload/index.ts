import { contextBridge, ipcRenderer } from 'electron'

const on = (channel: string) => (cb: (data: any) => void) => {
  const listener = (_e: any, data: any) => cb(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  info: () => ipcRenderer.invoke('app:info'),
  window: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close')
  },
  secret: {
    set: (k: string, v: string) => ipcRenderer.invoke('secret:set', k, v),
    get: (k: string) => ipcRenderer.invoke('secret:get', k)
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    openFile: () => ipcRenderer.invoke('dialog:openFile')
  },
  fs: {
    tree: (dir: string) => ipcRenderer.invoke('fs:tree', dir),
    read: (p: string) => ipcRenderer.invoke('fs:read', p),
    write: (p: string, content: string) => ipcRenderer.invoke('fs:write', p, content),
    mkdir: (p: string) => ipcRenderer.invoke('fs:mkdir', p),
    delete: (p: string) => ipcRenderer.invoke('fs:delete', p),
    rename: (from: string, to: string) => ipcRenderer.invoke('fs:rename', from, to),
    exists: (p: string) => ipcRenderer.invoke('fs:exists', p)
  },
  project: {
    index: (root: string) => ipcRenderer.invoke('project:index', root),
    search: (root: string, q: string) => ipcRenderer.invoke('project:search', root, q),
    relevant: (root: string, prompt: string) => ipcRenderer.invoke('project:relevant', root, prompt),
    createFiles: (root: string, files: Record<string, string>) => ipcRenderer.invoke('project:createFiles', root, files)
  },
  proc: {
    run: (id: string, cmd: string, cwd: string) => ipcRenderer.invoke('proc:run', id, cmd, cwd),
    exec: (cmd: string, cwd: string) => ipcRenderer.invoke('proc:exec', cmd, cwd),
    kill: (id: string) => ipcRenderer.invoke('proc:kill', id),
    write: (id: string, data: string) => ipcRenderer.send('proc:write', id, data),
    onData: on('proc:data'),
    onExit: on('proc:exit')
  },
  term: { create: (id: string, cwd: string, shellName: string) => ipcRenderer.invoke('term:create', id, cwd, shellName) },
  git: (cwd: string, args: string[]) => ipcRenderer.invoke('git', cwd, args),
  ai: {
    chat: (reqId: string, cfg: any, messages: any[]) => ipcRenderer.invoke('ai:chat', reqId, cfg, messages),
    stop: (reqId: string) => ipcRenderer.invoke('ai:stop', reqId),
    complete: (cfg: any, prompt: string) => ipcRenderer.invoke('ai:complete', cfg, prompt),
    models: (cfg: any) => ipcRenderer.invoke('ai:models', cfg),
    onChunk: on('ai:chunk'),
    onDone: on('ai:done'),
    onError: on('ai:error')
  },
  mc: {
    offlineUuid: (name: string) => ipcRenderer.invoke('mc:offlineUuid', name),
    msLogin: (clientId: string) => ipcRenderer.invoke('mc:msLogin', clientId),
    msRefresh: (clientId: string, refreshToken: string) => ipcRenderer.invoke('mc:msRefresh', clientId, refreshToken),
    onDeviceCode: on('mc:deviceCode'),
    createProject: (o: any) => ipcRenderer.invoke('mc:createProject', o)
  },
  ls: {
    startJava: (jar: string, workspace: string) => ipcRenderer.invoke('ls:startJava', jar, workspace),
    stop: (lang: string) => ipcRenderer.invoke('ls:stop', lang),
    onLog: on('ls:log')
  }
}

contextBridge.exposeInMainWorld('api', api)
export type WinCodeApi = typeof api
