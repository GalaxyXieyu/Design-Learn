#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const { resolveDataDir } = require('../src/storage/paths');
const { DOMAIN_CONFIG, STACK_CONFIG } = require('../src/uipro/config');

function parseArgs(argv) {
  const args = {
    repo: process.env.DESIGN_LEARN_UIPRO_RELEASE_REPO || '',
    tag: '',
    asset: '',
    source: '',
    dataDir: '',
    destDir: '',
    dryRun: false,
    noBackup: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') {
      args.repo = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--tag') {
      args.tag = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--asset') {
      args.asset = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--source') {
      args.source = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--data-dir') {
      args.dataDir = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--dest-dir') {
      args.destDir = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--no-backup') {
      args.noBackup = true;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }
  }

  return args;
}

function printHelp() {
  console.log(`Sync UIPro dataset into \${DESIGN_LEARN_DATA_DIR}/uipro

Usage:
  node scripts/sync-uipro-release.js --repo <owner/name> [--tag <tag>|latest] [--asset <asset.zip>]
  node scripts/sync-uipro-release.js --source <zip_url_or_local_path>

Options:
  --repo <owner/name>   GitHub repo for UIPro release assets (or env DESIGN_LEARN_UIPRO_RELEASE_REPO)
  --tag <tag>           Release tag (default: latest)
  --asset <name>        Asset name to download (default: first .zip asset)
  --source <path|url>   Local zip path or https URL (bypass GitHub API)
  --data-dir <path>     Override DESIGN_LEARN_DATA_DIR (default: ~/.design-learn/data or env)
  --dest-dir <path>     Override destination directory (default: <data-dir>/uipro)
  --dry-run             Print resolved plan and exit
  --no-backup           Replace existing dest without backup (dangerous)
  -h, --help            Show help

Notes:
  - If GITHUB_TOKEN is set, it will be used for GitHub API requests (never printed).
  - Extraction requires 'unzip' to be available on PATH.
`);
}

function die(message) {
  console.error(`[uipro-sync] ${message}`);
  process.exit(1);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isHttpUrl(input) {
  return /^https?:\/\//i.test(String(input || ''));
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`http_${response.status}:${body.slice(0, 200)}`);
  }
  return response.json();
}

async function downloadToFile(url, filePath, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`http_${response.status}:${body.slice(0, 200)}`);
  }
  if (!response.body) {
    throw new Error('empty_response_body');
  }

  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(filePath));
}

function listRequiredFiles() {
  const files = new Set();
  for (const domain of Object.values(DOMAIN_CONFIG)) {
    if (domain?.file) files.add(domain.file);
  }
  for (const stack of Object.values(STACK_CONFIG)) {
    if (stack?.file) files.add(stack.file);
  }
  return Array.from(files).sort();
}

function pathExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function validateDataRoot(rootDir, requiredFiles) {
  const missing = requiredFiles.filter((rel) => !pathExists(path.join(rootDir, rel)));
  return { ok: missing.length === 0, missing };
}

function findStylesCsvCandidates(rootDir, maxResults = 20) {
  const candidates = [];
  const queue = [rootDir];
  while (queue.length > 0 && candidates.length < maxResults) {
    const current = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(full);
        continue;
      }
      if (entry.isFile() && entry.name === 'styles.csv') {
        candidates.push(path.dirname(full));
      }
    }
  }
  return candidates;
}

function resolveDataRoot(extractDir, requiredFiles) {
  const candidates = findStylesCsvCandidates(extractDir);
  for (const candidate of candidates) {
    const result = validateDataRoot(candidate, requiredFiles);
    if (result.ok) {
      return candidate;
    }
  }
  return null;
}

function copyDirSync(srcDir, destDir) {
  ensureDir(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(src, dest);
      continue;
    }
    if (entry.isFile()) {
      fs.copyFileSync(src, dest);
    }
  }
}

function extractZip(zipPath, outDir) {
  const result = spawnSync('unzip', ['-q', zipPath, '-d', outDir], { stdio: 'inherit' });
  if (result.error && result.error.code === 'ENOENT') {
    throw new Error('missing_unzip');
  }
  if (result.status !== 0) {
    throw new Error(`unzip_failed:${result.status}`);
  }
}

async function resolveZipSource(args, headers) {
  if (args.source) {
    return { url: args.source, via: 'source' };
  }

  if (!args.repo) {
    throw new Error('missing_repo');
  }

  const tag = args.tag || 'latest';
  const base = `https://api.github.com/repos/${args.repo}/releases`;
  const apiUrl = tag === 'latest' ? `${base}/latest` : `${base}/tags/${encodeURIComponent(tag)}`;
  const release = await fetchJson(apiUrl, headers);

  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (assets.length === 0) {
    throw new Error('release_has_no_assets');
  }

  let asset;
  if (args.asset) {
    asset = assets.find((a) => a && a.name === args.asset);
    if (!asset) {
      throw new Error(`asset_not_found:${args.asset}`);
    }
  } else {
    asset = assets.find((a) => a && typeof a.name === 'string' && a.name.toLowerCase().endsWith('.zip'));
    if (!asset) {
      throw new Error('no_zip_asset_found');
    }
  }

  if (!asset.browser_download_url) {
    throw new Error('asset_missing_download_url');
  }

  return { url: asset.browser_download_url, via: 'github_release' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const resolvedDataDir = resolveDataDir(args.dataDir || undefined);
  const destDir = args.destDir ? path.resolve(args.destDir) : path.join(resolvedDataDir, 'uipro');
  const requiredFiles = listRequiredFiles();

  const token = process.env.GITHUB_TOKEN || '';
  const headers = {
    'User-Agent': 'design-learn-uipro-sync',
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : null),
  };

  let source;
  try {
    source = await resolveZipSource(args, headers);
  } catch (error) {
    const message = error?.message || String(error);
    if (message === 'missing_repo') {
      die('Missing --repo (or env DESIGN_LEARN_UIPRO_RELEASE_REPO), or use --source <zip_url_or_path>.');
    }
    throw error;
  }

  if (args.dryRun) {
    console.log(JSON.stringify({ dataDir: resolvedDataDir, destDir, source, requiredFiles }, null, 2));
    return;
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'design-learn-uipro-sync-'));
  const zipPath = path.join(tempRoot, 'uipro.zip');
  const extractDir = path.join(tempRoot, 'extract');

  let stagedDir = '';
  let backupDir = '';

  try {
    ensureDir(extractDir);

    if (isHttpUrl(source.url)) {
      await downloadToFile(source.url, zipPath, headers);
    } else {
      const localPath = path.resolve(source.url);
      if (!pathExists(localPath)) {
        throw new Error(`source_not_found:${localPath}`);
      }
      fs.copyFileSync(localPath, zipPath);
    }

    extractZip(zipPath, extractDir);

    const dataRoot = resolveDataRoot(extractDir, requiredFiles);
    if (!dataRoot) {
      throw new Error('cannot_locate_uipro_data_root');
    }

    const validation = validateDataRoot(dataRoot, requiredFiles);
    if (!validation.ok) {
      throw new Error(`missing_required_files:${validation.missing.slice(0, 5).join(',')}`);
    }

    const destParent = path.dirname(destDir);
    ensureDir(destParent);

    stagedDir = path.join(destParent, `.uipro-tmp-${Date.now()}`);
    copyDirSync(dataRoot, stagedDir);

    const stagedValidation = validateDataRoot(stagedDir, requiredFiles);
    if (!stagedValidation.ok) {
      throw new Error(`staged_missing_files:${stagedValidation.missing.slice(0, 5).join(',')}`);
    }

    if (pathExists(destDir)) {
      if (args.noBackup) {
        fs.rmSync(destDir, { recursive: true, force: true });
      } else {
        backupDir = path.join(destParent, `uipro.bak-${Date.now()}`);
        fs.renameSync(destDir, backupDir);
      }
    }

    fs.renameSync(stagedDir, destDir);
    stagedDir = '';

    console.log(
      JSON.stringify(
        {
          ok: true,
          destDir,
          backupDir: backupDir || null,
          source,
        },
        null,
        2
      )
    );
  } finally {
    try {
      if (stagedDir) {
        fs.rmSync(stagedDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((error) => {
  const message = error?.message || String(error);
  if (message === 'missing_unzip') {
    die('Missing unzip on PATH. Install unzip or run on a system that provides it.');
  }
  if (message === 'cannot_locate_uipro_data_root') {
    die('Cannot locate UIPro data root inside the zip. Expected styles.csv + stacks/*.csv layout.');
  }
  die(message);
});
