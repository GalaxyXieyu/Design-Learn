const { randomUUID } = require('crypto');
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { isInitializeRequest } = require('@modelcontextprotocol/sdk/types.js');
const { z } = require('zod');

const { createStorage } = require('../storage');
const { createUipro } = require('../uipro');

const tools = {
  list_designs: {
    title: '查看 UI 参考模板',
    description: '列出你收集的所有 UI 参考模板。比如："列出我的 UI 参考"、"显示所有捕获的页面"',
    inputSchema: {
      limit: z.number().min(1).max(100).optional(),
    },
  },
  search_designs: {
    title: '搜索 UI 参考模板',
    description: '在 UI 参考模板中搜索。比如："搜索包含登录按钮的 UI"、"找找那个蓝色的页面 UI"',
    inputSchema: {
      query: z.string(),
      limit: z.number().min(1).max(100).optional(),
    },
  },
  search_library: {
    title: '搜索 UI 规范和代码模板',
    description:
      '搜索 UI 设计规范、组件代码模板、配色方案、字体搭配等。' +
      '比如："React Button 组件代码"、"深色主题配色"、"登录表单最佳实践"、"卡片布局样式"。' +
      '会自动检测搜索类型，也可以指定 stack（如 react、vue、html-tailwind）来获取对应技术栈的实现代码。',
    inputSchema: {
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
  },
  get_design: {
    title: '查看 UI 参考详情',
    description: '查看某个 UI 参考的完整代码实现（包含 AI 生成的组件代码、样式说明等）。比如："获取 design_xxx 的代码实现"、"看看这个页面的样式指南"',
    inputSchema: {
      designId: z.string(),
    },
  },
  import_design: {
    title: '从网址导入 UI 参考',
    description: '输入一个网址，提取页面 UI 并生成参考代码。比如："从这个网址导入：https://example.com"、"提取 https://xxx.com 的按钮样式"',
    inputSchema: {
      url: z.string().url(),
      useAI: z.boolean().optional(),
      designId: z.string().optional(),
    },
  },
};

const prompts = {
  analyze_design: {
    title: 'Analyze Design',
    description: 'Summarize design metadata for review.',
    argsSchema: {
      designId: z.string(),
    },
  },
};

function createToolHandlers(storage, uipro, extractionPipeline) {
  function matchDesigns(query) {
    const needle = query.toLowerCase();
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

  return {
    list_designs: async ({ limit }) => {
      const designs = storage.listDesigns();
      const data = typeof limit === 'number' ? designs.slice(0, limit) : designs;
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: { designs: data },
      };
    },
    search_designs: async ({ query, limit }) => {
      const matches = matchDesigns(query);
      const data = typeof limit === 'number' ? matches.slice(0, limit) : matches;
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: { designs: data },
      };
    },
    search_library: async ({ query, sources, domain, stack, limit, designLimit }) => {
      const effectiveSources = Array.isArray(sources) && sources.length > 0 ? sources : ['designs', 'uipro'];
      const designs =
        effectiveSources.includes('designs')
          ? (() => {
              const matches = matchDesigns(query);
              const max = typeof designLimit === 'number' ? designLimit : typeof limit === 'number' ? limit : undefined;
              return typeof max === 'number' ? matches.slice(0, max) : matches;
            })()
          : [];

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
    },
    get_design: async ({ designId }) => {
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
        structuredContent: { designId, versionId: latest.id, markdown },
      };
    },
    import_design: async ({ url, useAI, designId }) => {
      if (!extractionPipeline) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'extraction_pipeline_unavailable' }) }],
        };
      }
      try {
        const useAiFlag = useAI === true;
        const job = extractionPipeline.enqueueImportFromUrl({ url, designId, options: { useAI: useAiFlag } });
        return {
          content: [{ type: 'text', text: JSON.stringify({ jobId: job.id, designId: job.designId }, null, 2) }],
          structuredContent: { jobId: job.id, designId: job.designId },
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
        };
      }
    },
  };
}

function createMcpServer({ name, version, storage, uipro, extractionPipeline }) {
  const server = new McpServer(
    {
      name,
      version,
    },
    {
      capabilities: {
        tools: Object.keys(tools),
        resources: ['server-info', 'design'],
        prompts: Object.keys(prompts),
      },
    }
  );

  const handlers = createToolHandlers(storage, uipro, extractionPipeline);
  Object.entries(tools).forEach(([toolName, schema]) => {
    server.registerTool(toolName, schema, handlers[toolName]);
  });

  server.registerResource(
    'server-info',
    'design-learn://info',
    {
      title: 'Design-Learn Server Info',
      description: 'Basic server metadata.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify({ name, version, timestamp: new Date().toISOString() }),
        },
      ],
    })
  );

  server.registerResource(
    'design',
    new ResourceTemplate('design://{designId}', { list: undefined }),
    {
      title: 'Design Metadata',
      description: 'Design metadata stored in the local database.',
      mimeType: 'application/json',
    },
    async (uri, { designId }) => {
      const design = await storage.getDesign(designId);
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(design || { error: 'not_found', designId }, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    }
  );

  Object.entries(prompts).forEach(([promptName, schema]) => {
    server.registerPrompt(promptName, schema, ({ designId }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Analyze design metadata for ID: ${designId}. Summarize key traits and risks.`,
          },
        },
      ],
    }));
  });

  return server;
}

async function createMcpHandler(options = {}) {
  const storage = options.storage || (await createStorage({ dataDir: options.dataDir }));
  const ownsStorage = !options.storage;
  const serverName = options.serverName || 'design-learn';
  const serverVersion = options.serverVersion || '0.1.0';
  const authToken = options.authToken || null;
  const uipro = options.uipro || createUipro({ dataDir: storage.dataDir });
  const extractionPipeline = options.extractionPipeline || null;
  const server = createMcpServer({ name: serverName, version: serverVersion, storage, uipro, extractionPipeline });
  const transports = new Map();

  function verifyAuth(req, res) {
    if (!authToken) {
      return true;
    }

    const header = req.headers.authorization || '';
    if (header === `Bearer ${authToken}`) {
      return true;
    }

    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return false;
  }

  async function handleMcpPost(req, res, body) {
    const sessionId = req.headers['mcp-session-id'];
    let transport;

    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId);
    } else if (!sessionId && isInitializeRequest(body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport);
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };
      await server.connect(transport);
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Invalid or missing session ID' },
          id: null,
        })
      );
      return;
    }

    await transport.handleRequest(req, res, body);
  }

  async function handleMcpStream(req, res) {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !transports.has(sessionId)) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Invalid or missing session ID');
      return;
    }

    const transport = transports.get(sessionId);
    await transport.handleRequest(req, res);
  }

  async function handleRequest(req, res, body) {
    if (!verifyAuth(req, res)) {
      return;
    }

    if (req.method === 'POST') {
      await handleMcpPost(req, res, body);
      return;
    }

    if (req.method === 'GET' || req.method === 'DELETE') {
      await handleMcpStream(req, res);
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  async function close() {
    for (const transport of transports.values()) {
      await transport.close();
    }
    transports.clear();
    if (ownsStorage) {
      storage.close();
    }
  }

  return {
    handleRequest,
    close,
  };
}

module.exports = {
  createMcpHandler,
};
