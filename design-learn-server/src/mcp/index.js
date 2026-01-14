const { randomUUID } = require('crypto');
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { isInitializeRequest } = require('@modelcontextprotocol/sdk/types.js');
const { z } = require('zod');

const { createStorage } = require('../storage');
const { createUipro } = require('../uipro');

const tools = {
  list_designs: {
    title: 'List Designs',
    description: 'List stored design resources.',
    inputSchema: {
      limit: z.number().min(1).max(100).optional(),
    },
  },
  search_designs: {
    title: 'Search Designs',
    description: 'Search designs by keyword, tags, or URL.',
    inputSchema: {
      query: z.string(),
      limit: z.number().min(1).max(100).optional(),
    },
  },
  search_library: {
    title: 'Search Library',
    description:
      'One-shot smart search across local templates (captured designs) + built-in UIPro guidelines. Use this when the user asks for a style/pattern/component/UX guideline or "a template like X". Domain is auto-detected unless specified; provide stack only when the user requests a specific tech stack (e.g. html-tailwind/react).',
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
  get_styleguide: {
    title: 'Get Styleguide',
    description: 'Fetch styleguide markdown by design ID (latest version).',
    inputSchema: {
      designId: z.string(),
    },
  },
  list_uipro_domains: {
    title: 'List UI/UX Pro Domains',
    description: 'List available domains from the built-in UI/UX Pro Max dataset.',
    inputSchema: {},
  },
  list_uipro_stacks: {
    title: 'List UI/UX Pro Stacks',
    description: 'List available stacks from the built-in UI/UX Pro Max dataset.',
    inputSchema: {},
  },
  search_uipro: {
    title: 'Search UI/UX Pro',
    description: 'Search UI/UX Pro Max dataset (BM25) by query and optional domain.',
    inputSchema: {
      query: z.string(),
      domain: z
        .union([
          z.literal('auto'),
          z.enum(['style', 'prompt', 'color', 'chart', 'landing', 'product', 'ux', 'typography', 'icons']),
        ])
        .optional(),
      limit: z.number().min(1).max(20).optional(),
    },
  },
  search_uipro_stack: {
    title: 'Search UI/UX Pro Stack',
    description: 'Search stack-specific UI/UX Pro Max guidelines (BM25).',
    inputSchema: {
      query: z.string(),
      stack: z.string().min(1),
      limit: z.number().min(1).max(20).optional(),
    },
  },
  browse_uipro: {
    title: 'Browse UI/UX Pro',
    description: 'Browse UIPro entries without a query (useful to explore what can be searched).',
    inputSchema: {
      domain: z
        .union([
          z.literal('auto'),
          z.enum(['style', 'prompt', 'color', 'chart', 'landing', 'product', 'ux', 'typography', 'icons']),
        ])
        .optional(),
      limit: z.number().min(1).max(50).optional(),
      offset: z.number().min(0).max(100000).optional(),
    },
  },
  suggest_uipro: {
    title: 'Suggest UI/UX Pro Keywords',
    description: 'Suggest common keywords for a UIPro domain to help you pick what to search.',
    inputSchema: {
      domain: z
        .union([
          z.literal('auto'),
          z.enum(['style', 'prompt', 'color', 'chart', 'landing', 'product', 'ux', 'typography', 'icons']),
        ])
        .optional(),
      limit: z.number().min(1).max(50).optional(),
    },
  },
  browse_uipro_stack: {
    title: 'Browse UI/UX Pro Stack',
    description: 'Browse stack-specific UIPro guidelines without a query.',
    inputSchema: {
      stack: z.string().min(1),
      limit: z.number().min(1).max(50).optional(),
      offset: z.number().min(0).max(100000).optional(),
    },
  },
  suggest_uipro_stack: {
    title: 'Suggest UI/UX Pro Stack Keywords',
    description: 'Suggest common keywords for a UIPro stack (html-tailwind/react/...).',
    inputSchema: {
      stack: z.string().min(1),
      limit: z.number().min(1).max(50).optional(),
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

function createToolHandlers(storage, uipro) {
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
    get_styleguide: async ({ designId }) => {
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
    list_uipro_domains: async () => {
      const data = uipro.domains;
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: { domains: data },
      };
    },
    list_uipro_stacks: async () => {
      const data = uipro.stacks;
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: { stacks: data },
      };
    },
    search_uipro: async ({ query, domain, limit }) => {
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
    },
    search_uipro_stack: async ({ query, stack, limit }) => {
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
    },
    browse_uipro: async ({ domain, limit, offset }) => {
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
    },
    suggest_uipro: async ({ domain, limit }) => {
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
    },
    browse_uipro_stack: async ({ stack, limit, offset }) => {
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
    },
    suggest_uipro_stack: async ({ stack, limit }) => {
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
    },
  };
}

function createMcpServer({ name, version, storage, uipro }) {
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

  const handlers = createToolHandlers(storage, uipro);
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

function createMcpHandler(options = {}) {
  const storage = options.storage || createStorage({ dataDir: options.dataDir });
  const ownsStorage = !options.storage;
  const serverName = options.serverName || 'design-learn';
  const serverVersion = options.serverVersion || '0.1.0';
  const authToken = options.authToken || null;
  const uipro = options.uipro || createUipro({ dataDir: storage.dataDir });
  const server = createMcpServer({ name: serverName, version: serverVersion, storage, uipro });
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
