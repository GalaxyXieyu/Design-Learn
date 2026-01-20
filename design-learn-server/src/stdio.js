#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const { createStorage } = require('./storage');
const { createUipro } = require('./uipro');

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
const storagePromise = createStorage({ dataDir });
const uipro = createUipro({ dataDir });

async function matchDesigns(query) {
  const needle = query.toLowerCase();
  const storage = await storagePromise;
  const designs = storage.listDesigns();
  return designs.filter((design) => {
    const tags = Array.isArray(design.metadata?.tags) ? design.metadata.tags.join(' ') : '';
    const haystack = [design.name, design.url, design.description, design.category, tags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
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

// Tools
server.tool(
  'list_designs',
  '列出你收集的所有 UI 参考模板。比如："列出我的 UI 参考"、"显示所有捕获的页面"',
  { limit: z.number().min(1).max(100).optional() },
  async ({ limit }) => {
    const storage = await storagePromise;
    const designs = storage.listDesigns();
    const data = typeof limit === 'number' ? designs.slice(0, limit) : designs;
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: { designs: data },
    };
  }
);

server.tool(
  'search_designs',
  '在 UI 参考模板中搜索。比如："搜索包含登录按钮的 UI"、"找找那个蓝色的页面 UI"',
  {
    query: z.string(),
    limit: z.number().min(1).max(100).optional(),
  },
  async ({ query, limit }) => {
    const matches = await matchDesigns(query);
    const data = typeof limit === 'number' ? matches.slice(0, limit) : matches;
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: { designs: data },
    };
  }
);

server.tool(
  'search_library',
  '搜索 UI 设计规范、组件代码模板、配色方案、字体搭配等。比如："React Button 组件代码"、"深色主题配色"、"登录表单最佳实践"、"卡片布局样式"。会自动检测搜索类型，也可以指定 stack（如 react、vue、html-tailwind）来获取对应技术栈的实现代码。',
  {
    query: z.string().min(1),
    sources: z.array(z.enum(['designs', 'uipro', 'uipro_stack'])).optional(),
    domain: z
      .union([
        z.literal('auto'),
        z.enum(['style', 'prompt', 'color', 'chart', 'landing', 'product', 'ux', 'typography', 'icons']),
      ])
      .optional(),
    stack: z.string().min(1).optional(),
    limit: z.number().min(1).max(50).optional(),
    designLimit: z.number().min(1).max(100).optional(),
  },
  async ({ query, sources, domain, stack, limit, designLimit }) => {
    const effectiveSources = Array.isArray(sources) && sources.length > 0 ? sources : ['designs', 'uipro'];
    let designs = [];
    if (effectiveSources.includes('designs')) {
      const matches = await matchDesigns(query);
      const max = typeof designLimit === 'number' ? designLimit : typeof limit === 'number' ? limit : undefined;
      designs = typeof max === 'number' ? matches.slice(0, max) : matches;
    }

    const resolvedDomain = domain === 'auto' ? undefined : domain;
    const maxUipro = typeof limit === 'number' ? limit : 10;

    let uiproResult = null;
    if (effectiveSources.includes('uipro')) {
      try {
        uiproResult = uipro.search({ query, domain: resolvedDomain, limit: maxUipro });
      } catch {
        uiproResult = {
          error: 'uipro_data_unavailable',
          hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
        };
      }
    }

    let uiproStackResult = null;
    if (effectiveSources.includes('uipro_stack') && typeof stack === 'string' && stack.trim()) {
      try {
        uiproStackResult = uipro.searchStack({ query, stack: stack.trim(), limit: maxUipro });
      } catch {
        uiproStackResult = {
          error: 'uipro_data_unavailable',
          hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
        };
      }
    }

    const items = [];
    for (const d of designs) {
      items.push({
        source: 'design',
        id: d.id,
        name: d.name,
        url: d.url,
        updatedAt: d.updatedAt || d.createdAt || null,
      });
    }
    if (uiproResult && !uiproResult.error && Array.isArray(uiproResult.results)) {
      uiproResult.results.forEach((row) => items.push({ source: 'uipro', domain: uiproResult.domain, row }));
    }
    if (uiproStackResult && !uiproStackResult.error && Array.isArray(uiproStackResult.results)) {
      uiproStackResult.results.forEach((row) => items.push({ source: 'uipro_stack', stack: uiproStackResult.stack, row }));
    }

    const data = {
      query,
      sources: effectiveSources,
      domains: uipro.domains,
      stacks: uipro.stacks,
      designs,
      uipro: uiproResult,
      uiproStack: uiproStackResult,
      items,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  }
);

server.tool(
  'get_design',
  '查看某个 UI 参考的完整代码实现（包含 AI 生成的组件代码、样式说明等）。比如："获取 design_xxx 的代码实现"、"看看这个页面的样式指南"',
  { designId: z.string() },
  async ({ designId }) => {
    const storage = await storagePromise;
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

// New tool: import_design
// Note: This requires extractionPipeline which is only available in HTTP mode (server.js)
// In stdio mode, the HTTP server is spawned as a child process

server.tool(
  'import_design',
  '输入一个网址，提取页面 UI 并生成参考代码。比如："从这个网址导入：https://example.com"、"提取 https://xxx.com 的按钮样式"',
  {
    url: z.string().url(),
    useAI: z.boolean().optional(),
    designId: z.string().optional(),
  },
  async ({ url, useAI, designId }) => {
    // In stdio mode, we need to call the HTTP API
    // The HTTP server is started as a child process
    const port = process.env.PORT || process.env.DESIGN_LEARN_PORT || 3100;
    try {
      const response = await fetch(`http://localhost:${port}/api/import/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options: { useAI }, designId }),
      });
      const data = await response.json();
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
      };
    }
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
  const startHttpServer = process.env.DESIGN_LEARN_STDIO_START_HTTP_SERVER !== '0';
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
