const { randomUUID } = require('crypto');
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { isInitializeRequest } = require('@modelcontextprotocol/sdk/types.js');

const { createStorage } = require('../storage');
const { createUipro } = require('../uipro');
const { tools, prompts, createToolHandlers, createAnalyzePrompt } = require('./shared');

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

  const handlers = createToolHandlers({ storage, uipro, extractionPipeline });
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
    server.registerPrompt(promptName, schema, createAnalyzePrompt);
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
