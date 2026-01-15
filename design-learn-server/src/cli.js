#!/usr/bin/env node

const http = require('http');

function printHelp() {
  console.log(`Design-Learn MCP Server

Usage:
  design-learn-server [options]

Options:
  --port <number>           服务端口（默认 3100）
  --data-dir <path>         数据目录（默认 ./data）
  --auth-token <token>      MCP 鉴权令牌（可选）
  --server-name <name>      MCP Server Name（可选）
  --server-version <ver>    MCP Server Version（可选）
  --health-check            启动后执行健康检查（默认开启）
  --no-health-check         关闭健康检查
  -h, --help                查看帮助
`);
}

function parseArgs(argv) {
  const args = { healthCheck: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--port') {
      args.port = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--data-dir') {
      args.dataDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--auth-token') {
      args.authToken = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--server-name') {
      args.serverName = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--server-version') {
      args.serverVersion = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--health-check') {
      args.healthCheck = true;
      continue;
    }
    if (arg === '--no-health-check') {
      args.healthCheck = false;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }
  }
  return args;
}

function applyEnv(options) {
  if (options.port) {
    process.env.PORT = String(options.port);
  }
  if (options.dataDir) {
    process.env.DESIGN_LEARN_DATA_DIR = options.dataDir;
    process.env.DATA_DIR = options.dataDir;
  }
  if (options.authToken) {
    process.env.MCP_AUTH_TOKEN = options.authToken;
  }
  if (options.serverName) {
    process.env.MCP_SERVER_NAME = options.serverName;
  }
  if (options.serverVersion) {
    process.env.MCP_SERVER_VERSION = options.serverVersion;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pingHealth(port) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        method: 'GET',
        timeout: 1200,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function waitForHealth(port, attempts = 5, delayMs = 300) {
  for (let i = 0; i < attempts; i += 1) {
    const ok = await pingHealth(port);
    if (ok) return true;
    await sleep(delayMs);
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  applyEnv(args);

  const port = Number(process.env.PORT || 3100);
  require('./server');

  console.log(`[design-learn-mcp] ready: http://localhost:${port}`);
  console.log(`[design-learn-mcp] endpoints: /api/health /mcp /api/import/*`);

  if (args.healthCheck) {
    const ok = await waitForHealth(port);
    if (ok) {
      console.log('[design-learn-mcp] health check ok');
    } else {
      console.warn('[design-learn-mcp] health check failed');
    }
  }
}

main().catch((error) => {
  console.error('[design-learn-mcp] failed to start', error);
  process.exit(1);
});
