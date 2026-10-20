import { app, BrowserWindow, Menu, shell, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { registerIpc } from './ipc';
import { killAllTerminals } from './services/terminal';

const isDev = !!process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

function iconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../dist/icon.png'),
    path.join(process.resourcesPath ?? '', 'build/icon.png'),
    path.join(app.getAppPath(), 'build/icon.png'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 940,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#09090F',
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false));
  mainWindow.on('closed', () => {
    mainWindow = null;
    killAllTerminals();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:action', 'file.new'),
        },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:action', 'file.open'),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:action', 'file.save'),
        },
        {
          label: 'Save All',
          accelerator: 'CmdOrCtrl+K S',
          click: () => mainWindow?.webContents.send('menu:action', 'file.saveAll'),
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('menu:action', 'settings.open'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Run',
      submenu: [
        {
          label: 'Run Project',
          accelerator: 'F5',
          click: () => mainWindow?.webContents.send('menu:action', 'build.run'),
        },
        {
          label: 'Debug',
          accelerator: 'F6',
          click: () => mainWindow?.webContents.send('menu:action', 'build.debug'),
        },
        {
          label: 'Build',
          accelerator: 'CmdOrCtrl+Shift+B',
          click: () => mainWindow?.webContents.send('menu:action', 'build.build'),
        },
        {
          label: 'Stop',
          accelerator: 'Shift+F5',
          click: () => mainWindow?.webContents.send('menu:action', 'build.stop'),
        },
      ],
    },
    {
      label: 'AI',
      submenu: [
        {
          label: 'Toggle AI Panel',
          accelerator: 'CmdOrCtrl+Shift+A',
          click: () => mainWindow?.webContents.send('menu:action', 'ai.toggle'),
        },
        {
          label: 'Inline Completion',
          accelerator: 'Ctrl+Space',
          click: () => mainWindow?.webContents.send('menu:action', 'ai.inline'),
        },
        {
          label: 'Agent Mode',
          click: () => mainWindow?.webContents.send('menu:action', 'ai.agent'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About WinCode AI',
          click: () =>
            mainWindow?.webContents.send('menu:action', 'help.about'),
        },
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/egorbelovziiik-design/-'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerIpc();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    killAllTerminals();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => killAllTerminals());
}
