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
  'List stored design resources',
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
  'Search designs by keyword, tags, or URL.',
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
  'One-shot smart search across local templates (captured designs) + built-in UIPro guidelines. Use this when the user asks for a style/pattern/component/UX guideline or "a template like X". Domain is auto-detected unless specified; provide stack only when the user requests a specific tech stack (e.g. html-tailwind/react).',
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

    const data = { query, sources: effectiveSources, designs, uipro: uiproResult, uiproStack: uiproStackResult, items };
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  }
);

server.tool(
  'get_styleguide',
  'Get styleguide markdown by design ID (latest version).',
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

server.tool('list_uipro_domains', 'List available domains from the built-in UI/UX Pro Max dataset.', {}, async () => {
  const data = uipro.domains;
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: { domains: data },
  };
});

server.tool('list_uipro_stacks', 'List available stacks from the built-in UI/UX Pro Max dataset.', {}, async () => {
  const data = uipro.stacks;
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: { stacks: data },
  };
});

server.tool(
  'search_uipro',
  'Search UI/UX Pro Max dataset (BM25) by query and optional domain.',
  {
    query: z.string(),
    domain: z
      .union([
        z.literal('auto'),
        z.enum(['style', 'prompt', 'color', 'chart', 'landing', 'product', 'ux', 'typography', 'icons']),
      ])
      .optional(),
    limit: z.number().min(1).max(20).optional(),
  },
  async ({ query, domain, limit }) => {
    let data;
    try {
      data = uipro.search({ query, domain: domain === 'auto' ? undefined : domain, limit });
    } catch {
      data = {
        error: 'uipro_data_unavailable',
        hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  }
);

server.tool(
  'search_uipro_stack',
  'Search stack-specific UI/UX Pro Max guidelines (BM25).',
  {
    query: z.string(),
    stack: z.string().min(1),
    limit: z.number().min(1).max(20).optional(),
  },
  async ({ query, stack, limit }) => {
    let data;
    try {
      data = uipro.searchStack({ query, stack, limit });
    } catch {
      data = {
        error: 'uipro_data_unavailable',
        hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  }
);

server.tool(
  'browse_uipro',
  'Browse UIPro entries without a query (useful to explore what can be searched).',
  {
    domain: z
      .union([
        z.literal('auto'),
        z.enum(['style', 'prompt', 'color', 'chart', 'landing', 'product', 'ux', 'typography', 'icons']),
      ])
      .optional(),
    limit: z.number().min(1).max(50).optional(),
    offset: z.number().min(0).max(100000).optional(),
  },
  async ({ domain, limit, offset }) => {
    let data;
    try {
      data = uipro.browse({ domain: domain === 'auto' ? undefined : domain, limit, offset });
    } catch {
      data = {
        error: 'uipro_data_unavailable',
        hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  }
);

server.tool(
  'suggest_uipro',
  'Suggest common keywords for a UIPro domain to help you pick what to search.',
  {
    domain: z
      .union([
        z.literal('auto'),
        z.enum(['style', 'prompt', 'color', 'chart', 'landing', 'product', 'ux', 'typography', 'icons']),
      ])
      .optional(),
    limit: z.number().min(1).max(50).optional(),
  },
  async ({ domain, limit }) => {
    let data;
    try {
      data = uipro.suggest({ domain: domain === 'auto' ? undefined : domain, limit });
    } catch {
      data = {
        error: 'uipro_data_unavailable',
        hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  }
);

server.tool(
  'browse_uipro_stack',
  'Browse stack-specific UIPro guidelines without a query.',
  {
    stack: z.string().min(1),
    limit: z.number().min(1).max(50).optional(),
    offset: z.number().min(0).max(100000).optional(),
  },
  async ({ stack, limit, offset }) => {
    let data;
    try {
      data = uipro.browseStack({ stack, limit, offset });
    } catch {
      data = {
        error: 'uipro_data_unavailable',
        hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  }
);

server.tool(
  'suggest_uipro_stack',
  'Suggest common keywords for a UIPro stack (html-tailwind/react/...).',
  {
    stack: z.string().min(1),
    limit: z.number().min(1).max(50).optional(),
  },
  async ({ stack, limit }) => {
    let data;
    try {
      data = uipro.suggestStack({ stack, limit });
    } catch {
      data = {
        error: 'uipro_data_unavailable',
        hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
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
