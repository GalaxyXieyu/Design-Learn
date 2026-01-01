#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const { McpServer, ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const { createStorage } = require('./storage');

const dataDir = process.env.DESIGN_LEARN_DATA_DIR || process.env.DATA_DIR || './data';
const storage = createStorage({ dataDir });

// 同时启动 HTTP 服务（给 Chrome/VSCode 插件用）
const httpServer = spawn('node', [path.join(__dirname, 'server.js')], {
  stdio: 'ignore',
  detached: true,
  env: { ...process.env, DESIGN_LEARN_DATA_DIR: dataDir },
});
httpServer.unref();

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
server.tool('ping', 'Check MCP server status', {}, async () => ({
  content: [{ type: 'text', text: 'pong' }],
}));

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
  'get_design',
  'Fetch design metadata by ID',
  { designId: z.string() },
  async ({ designId }) => {
    const design = await storage.getDesign(designId);
    if (!design) {
      return {
        content: [{ type: 'text', text: `Design not found: ${designId}` }],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(design, null, 2) }],
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('[design-learn-mcp] stdio error:', error);
  process.exit(1);
});
