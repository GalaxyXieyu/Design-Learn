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
    description: 'Search both local designs and the built-in UI/UX Pro dataset by query.',
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().min(1).max(100).optional(),
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
        .enum([
          'style',
          'prompt',
          'color',
          'chart',
          'landing',
          'product',
          'ux',
          'typography',
          'icons',
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
      stack: z.enum([
        'html-tailwind',
        'react',
        'nextjs',
        'vue',
        'nuxtjs',
        'nuxt-ui',
        'svelte',
        'swiftui',
        'react-native',
        'flutter',
        'shadcn',
      ]),
      limit: z.number().min(1).max(20).optional(),
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
    search_library: async ({ query, limit }) => {
      const matches = matchDesigns(query);
      const designs = typeof limit === 'number' ? matches.slice(0, limit) : matches;
      let uiproResult;
      try {
        uiproResult = uipro.search({ query, limit });
      } catch {
        uiproResult = {
          error: 'uipro_data_unavailable',
          hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
        };
      }
      const data = { designs, uipro: uiproResult };
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
        data = uipro.search({ query, domain, limit });
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
