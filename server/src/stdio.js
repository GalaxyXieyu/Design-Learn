#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const { createStorage } = require('./storage');
const { createUipro } = require('./uipro');
const { tools, prompts, createToolHandlers, createAnalyzePrompt } = require('./mcp/shared');

const serverRoot = path.resolve(__dirname, '..');
const autoInstallPlaywright = process.env.DESIGN_LEARN_AUTO_INSTALL_PLAYWRIGHT !== '0';

function isPlaywrightInstalled() {
  try {
    require.resolve('playwright', { paths: [serverRoot] });
    return true;
  } catch {
    return false;
  }
}

function installPlaywright() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, ['install', 'playwright'], {
      cwd: serverRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (chunk) => process.stderr.write(chunk));
    child.stderr?.on('data', (chunk) => process.stderr.write(chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm_install_failed:${code ?? 'unknown'}`));
    });
  });
}

async function ensurePlaywright() {
  if (!autoInstallPlaywright) return;
  if (isPlaywrightInstalled()) return;
  console.error('[design-learn-mcp] Playwright not found, installing...');
  try {
    await installPlaywright();
    console.error('[design-learn-mcp] Playwright installed.');
  } catch (error) {
    console.error('[design-learn-mcp] Playwright install failed:', error?.message || error);
  }
}

// 数据目录优先级：环境变量 > 用户目录下的 .design-learn
// 这样 npx 用户也能正常使用，数据统一存放在 ~/.design-learn/data
const os = require('os');
const defaultDataDir = path.join(os.homedir(), '.design-learn', 'data');
const dataDir = process.env.DESIGN_LEARN_DATA_DIR || process.env.DATA_DIR || defaultDataDir;
const startHttpServer = process.env.DESIGN_LEARN_STDIO_START_HTTP_SERVER !== '0';
const uipro = createUipro({ dataDir });

async function withFreshStorage(run) {
  const storage = await createStorage({ dataDir });
  try {
    return await run(storage);
  } finally {
    storage.close();
  }
}

const storageProxy = {
  dataDir,
  listDesigns: () => withFreshStorage((storage) => storage.listDesigns()),
  getDesign: (designId) => withFreshStorage((storage) => storage.getDesign(designId)),
  updateDesign: (designId, patch) => withFreshStorage((storage) => storage.updateDesign(designId, patch)),
  listVersions: (designId) => withFreshStorage((storage) => storage.listVersions(designId)),
  getVersion: (versionId) => withFreshStorage((storage) => storage.getVersion(versionId)),
  updateVersion: (versionId, patch) => withFreshStorage((storage) => storage.updateVersion(versionId, patch)),
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `http_${response.status}`);
  }
  return data;
}

async function waitForImportJob(port, jobId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const payload = await requestJson(`http://localhost:${port}/api/import/jobs/${jobId}`);
    const job = payload?.job;
    if (!job) {
      throw new Error(`Import job not found: ${jobId}`);
    }
    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }
    await delay(500);
  }
  throw new Error(`Import job timeout after ${timeoutMs}ms`);
}

async function waitForHttpServerReady(port, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // retry until timeout
    }
    await delay(300);
  }
  throw new Error(`design-learn_http_server_not_ready:${port}`);
}

async function importDesignViaHttp({ url, useAI, designId, waitForCompletion, timeoutMs }) {
  const port = process.env.PORT || process.env.DESIGN_LEARN_PORT || 3100;
  await waitForHttpServerReady(port);
  const payload = await requestJson(`http://localhost:${port}/api/import/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, options: { useAI }, designId }),
  });

  const job = payload?.job;
  if (!job) {
    throw new Error('import_job_missing');
  }

  if (!waitForCompletion) {
    return {
      jobId: job.id,
      designId: payload.designId || designId || null,
      status: job.status,
      waited: false,
    };
  }

  const finalJob = await waitForImportJob(port, job.id, timeoutMs);
  return {
    jobId: finalJob.id,
    designId: payload.designId || finalJob.result?.designId || designId || null,
    versionId: finalJob.result?.versionId || null,
    status: finalJob.status,
    message: finalJob.message,
    waited: true,
    error: finalJob.error?.message || null,
  };
}

async function saveDesignAnalysisViaHttp({ versionId, designId, styleguideMarkdown, rules, analysisSource }) {
  const port = process.env.PORT || process.env.DESIGN_LEARN_PORT || 3100;
  await waitForHttpServerReady(port);
  return requestJson(`http://localhost:${port}/api/analysis/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      versionId,
      designId,
      styleguideMarkdown,
      rules,
      analysisSource,
    }),
  });
}

const server = new McpServer(
  {
    name: process.env.MCP_SERVER_NAME || 'design-learn',
    version: process.env.MCP_SERVER_VERSION || '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

async function registerTools() {
  const handlers = createToolHandlers({
    storage: storageProxy,
    uipro,
    importDesign: importDesignViaHttp,
    saveAnalysis: startHttpServer ? saveDesignAnalysisViaHttp : undefined,
  });

  Object.entries(tools).forEach(([toolName, schema]) => {
    server.tool(toolName, schema.description, schema.inputSchema, handlers[toolName]);
  });
}

// Resources
server.resource(
  'server-info',
  'design-learn://info',
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: JSON.stringify({
          name: 'design-learn',
          version: '0.1.0',
          dataDir,
          timestamp: new Date().toISOString(),
        }),
      },
    ],
  })
);

// Prompts
server.prompt(
  'analyze_design',
  'Summarize design metadata for review',
  prompts.analyze_design.argsSchema,
  createAnalyzePrompt
);

async function main() {
  await ensurePlaywright();
  await registerTools();
  if (startHttpServer) {
    // 同时启动 HTTP 服务（给 Chrome/VSCode 插件用）
    const httpServer = spawn('node', [path.join(__dirname, 'server.js')], {
      stdio: 'ignore',
      detached: true,
      env: { ...process.env, DESIGN_LEARN_DATA_DIR: dataDir },
    });
    httpServer.unref();
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[design-learn-mcp] stdio error:', error);
  process.exit(1);
});
