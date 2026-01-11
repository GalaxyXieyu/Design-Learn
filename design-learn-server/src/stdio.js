#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const { createStorage } = require('./storage');

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
const storage = createStorage({ dataDir });

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

// Tools
server.tool(
  'list_designs',
  'List stored design resources',
  { limit: z.number().min(1).max(100).optional() },
  async ({ limit }) => {
    const designs = storage.listDesigns();
    const data = typeof limit === 'number' ? designs.slice(0, limit) : designs;
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  'search_designs',
  'Search designs by keyword, tags, or URL.',
  {
    query: z.string(),
    limit: z.number().min(1).max(100).optional(),
  },
  async ({ query, limit }) => {
    const needle = query.toLowerCase();
    const designs = storage.listDesigns();
    const matches = designs.filter((design) => {
      const tags = Array.isArray(design.metadata?.tags) ? design.metadata.tags.join(' ') : '';
      const haystack = [design.name, design.url, design.description, design.category, tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
    const data = typeof limit === 'number' ? matches.slice(0, limit) : matches;
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  'get_styleguide',
  'Get styleguide markdown by design ID (latest version).',
  { designId: z.string() },
  async ({ designId }) => {
    const versions = storage.listVersions(designId);
    if (!versions || versions.length === 0) {
      return {
        content: [{ type: 'text', text: `No versions found for design: ${designId}` }],
      };
    }
    const latest = versions[0];
    const version = await storage.getVersion(latest.id);
    if (!version) {
      return {
        content: [{ type: 'text', text: `Version not found: ${latest.id}` }],
      };
    }
    const markdown = version.styleguideMarkdown || '';
    if (!markdown) {
      return {
        content: [{ type: 'text', text: `Styleguide is empty for design: ${designId}` }],
      };
    }
    return {
      content: [{ type: 'text', text: markdown }],
    };
  }
);

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
  { designId: z.string() },
  ({ designId }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Analyze design metadata for ID: ${designId}. Summarize key traits and risks.`,
        },
      },
    ],
  })
);

async function main() {
  await ensurePlaywright();
  // 同时启动 HTTP 服务（给 Chrome/VSCode 插件用）
  const httpServer = spawn('node', [path.join(__dirname, 'server.js')], {
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, DESIGN_LEARN_DATA_DIR: dataDir },
  });
  httpServer.unref();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[design-learn-mcp] stdio error:', error);
  process.exit(1);
});
