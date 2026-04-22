const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const electronBinary = require('electron');

const rootDir = path.resolve(__dirname, '..');
const nextCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const isWindows = process.platform === 'win32';

let electronProcess = null;
const childProcesses = [];

function spawnChild(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    stdio: 'inherit',
    shell: isWindows,
  });

  childProcesses.push(child);
  return child;
}

function waitForUrl(url, timeoutMs = 60000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timeout aguardando ${url}`));
          return;
        }

        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

function shutdown(exitCode = 0) {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }

  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(exitCode);
}

async function main() {
  const nextProcess = spawnChild(nextCommand, ['run', 'dev'], {
    cwd: rootDir,
    env: process.env,
  });

  nextProcess.on('exit', (code) => {
    if (!electronProcess) {
      process.exit(code ?? 1);
      return;
    }
    shutdown(code ?? 0);
  });

  await waitForUrl('http://127.0.0.1:3000');

  electronProcess = spawn(String(electronBinary), ['.'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });

  electronProcess.on('exit', (code) => {
    shutdown(code ?? 0);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}

main().catch((error) => {
  console.error(error);
  shutdown(1);
});
