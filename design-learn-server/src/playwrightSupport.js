const { spawn } = require('child_process');
const path = require('path');

const serverRoot = path.resolve(__dirname, '..');
const autoInstallPlaywright = process.env.DESIGN_LEARN_AUTO_INSTALL_PLAYWRIGHT !== '0';
let installPromise = null;

function isPlaywrightInstalled() {
  try {
    require.resolve('playwright', { paths: [serverRoot] });
    return true;
  } catch {
    return false;
  }
}

function installPlaywright(logger) {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, ['install', 'playwright'], {
      cwd: serverRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (chunk) => logger?.(chunk.toString()));
    child.stderr?.on('data', (chunk) => logger?.(chunk.toString()));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm_install_failed:${code ?? 'unknown'}`));
    });
  });
}

async function ensurePlaywrightInstalled(options = {}) {
  if (!autoInstallPlaywright) return;
  if (isPlaywrightInstalled()) return;
  if (typeof options.onProgress === 'function') {
    options.onProgress('installing_playwright');
  }
  if (!installPromise) {
    const logger = options.logger || ((text) => process.stderr.write(text));
    installPromise = installPlaywright(logger).finally(() => {
      installPromise = null;
    });
  }
  await installPromise;
}

async function loadPlaywright(options = {}) {
  try {
    return await import('playwright');
  } catch {
    await ensurePlaywrightInstalled(options);
  }
  try {
    return await import('playwright');
  } catch {
    throw new Error('playwright_not_installed');
  }
}

module.exports = {
  ensurePlaywrightInstalled,
  loadPlaywright,
};
