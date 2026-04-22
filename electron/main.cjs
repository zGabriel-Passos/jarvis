const { app, BrowserWindow } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

const isDev = !app.isPackaged;
const frontendUrl = process.env.JARVIS_FRONTEND_URL || 'http://127.0.0.1:3000';
const backendDir = path.join(app.getAppPath(), 'backend-python');
const pythonCandidates = process.platform === 'win32'
  ? [
      { command: process.env.JARVIS_PYTHON_BIN || 'py', args: process.env.JARVIS_PYTHON_BIN ? ['main.py'] : ['-3', 'main.py'] },
      { command: 'python', args: ['main.py'] },
    ]
  : [
      { command: process.env.JARVIS_PYTHON_BIN || 'python3', args: ['main.py'] },
      { command: 'python', args: ['main.py'] },
    ];

let mainWindow = null;
let backendProcess = null;
let backendStopped = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 920,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#1a1614',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'electron', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(frontendUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function stopBackend() {
  backendStopped = true;
  if (!backendProcess || backendProcess.killed) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(backendProcess.pid), '/t', '/f']);
    return;
  }

  backendProcess.kill('SIGTERM');
}

function startBackend(candidateIndex = 0) {
  const candidate = pythonCandidates[candidateIndex];
  if (!candidate) {
    console.error('Jarvis backend: nenhum executavel Python encontrado.');
    return;
  }

  backendStopped = false;
  backendProcess = spawn(candidate.command, candidate.args, {
    cwd: backendDir,
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      FLASK_ENV: 'production',
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  backendProcess.on('error', (error) => {
    if (candidateIndex < pythonCandidates.length - 1) {
      startBackend(candidateIndex + 1);
      return;
    }
    console.error('Jarvis backend: falha ao iniciar.', error);
  });

  backendProcess.on('exit', (code) => {
    const shouldRetry = !backendStopped && code !== 0 && candidateIndex < pythonCandidates.length - 1;
    if (shouldRetry) {
      startBackend(candidateIndex + 1);
    }
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
