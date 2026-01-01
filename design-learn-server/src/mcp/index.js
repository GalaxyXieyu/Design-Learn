const { randomUUID } = require('crypto');
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { isInitializeRequest } = require('@modelcontextprotocol/sdk/types.js');
const { z } = require('zod');

const { createStorage } = require('../storage');

const tools = {
  ping: {
    title: 'Ping',
    description: 'Check MCP server status.',
    inputSchema: {},
  },
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
  get_design: {
    title: 'Get Design',
    description: 'Fetch design metadata by ID.',
    inputSchema: {
      designId: z.string(),
    },
  },
  get_rules: {
    title: 'Get Rules',
    description: 'Fetch rules for a version (colors/typography/spacing/components).',
    inputSchema: {
      versionId: z.string(),
    },
  },
  list_versions: {
    title: 'List Versions',
    description: 'List versions for a design.',
    inputSchema: {
      designId: z.string(),
      limit: z.number().min(1).max(100).optional(),
    },
  },
  get_version: {
    title: 'Get Version',
    description: 'Fetch a version by ID.',
    inputSchema: {
      versionId: z.string(),
    },
  },
  list_components: {
    title: 'List Components',
    description: 'List components with optional filters.',
    inputSchema: {
      designId: z.string().optional(),
      versionId: z.string().optional(),
      type: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
    },
  },
  get_component: {
    title: 'Get Component',
    description: 'Fetch component detail by ID.',
    inputSchema: {
      componentId: z.string(),
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

function createToolHandlers(storage) {
  return {
    ping: async () => ({
      content: [{ type: 'text', text: 'pong' }],
      structuredContent: { status: 'ok', timestamp: new Date().toISOString() },
    }),
    list_designs: async ({ limit }) => {
      const designs = storage.listDesigns();
      const data = typeof limit === 'number' ? designs.slice(0, limit) : designs;
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    },
    search_designs: async ({ query, limit }) => {
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
        structuredContent: data,
      };
    },
    get_design: async ({ designId }) => {
      const design = await storage.getDesign(designId);
      if (!design) {
        return {
          content: [{ type: 'text', text: `Design not found: ${designId}` }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(design, null, 2) }],
        structuredContent: design,
      };
    },
    get_rules: async ({ versionId }) => {
      const version = await storage.getVersion(versionId);
      if (!version) {
        return {
          content: [{ type: 'text', text: `Version not found: ${versionId}` }],
        };
      }
      const rules = version.rules || {};
      return {
        content: [{ type: 'text', text: JSON.stringify(rules, null, 2) }],
        structuredContent: rules,
      };
    },
    list_versions: async ({ designId, limit }) => {
      const versions = storage.listVersions(designId);
      const data = typeof limit === 'number' ? versions.slice(0, limit) : versions;
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    },
    get_version: async ({ versionId }) => {
      const version = await storage.getVersion(versionId);
      if (!version) {
        return {
          content: [{ type: 'text', text: `Version not found: ${versionId}` }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(version, null, 2) }],
        structuredContent: version,
      };
    },
    list_components: async ({ designId, versionId, type, limit }) => {
      const components = storage.listComponents({ designId, versionId, type });
      const data = typeof limit === 'number' ? components.slice(0, limit) : components;
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
      };
    },
    get_component: async ({ componentId }) => {
      const component = await storage.getComponent(componentId);
      if (!component) {
        return {
          content: [{ type: 'text', text: `Component not found: ${componentId}` }],
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(component, null, 2) }],
        structuredContent: component,
      };
    },
  };
}

function createMcpServer({ name, version, storage }) {
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

  const handlers = createToolHandlers(storage);
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
  const server = createMcpServer({ name: serverName, version: serverVersion, storage });
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
