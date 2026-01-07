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
  'get_rules',
  'Fetch rules for a version (colors/typography/spacing/components).',
  { versionId: z.string() },
  async ({ versionId }) => {
    const version = await storage.getVersion(versionId);
    if (!version) {
      return {
        content: [{ type: 'text', text: `Version not found: ${versionId}` }],
      };
    }
    const rules = version.rules || {};
    return {
      content: [{ type: 'text', text: JSON.stringify(rules, null, 2) }],
    };
  }
);

server.tool(
  'list_versions',
  'List versions for a design.',
  {
    designId: z.string(),
    limit: z.number().min(1).max(100).optional(),
  },
  async ({ designId, limit }) => {
    const versions = storage.listVersions(designId);
    const data = typeof limit === 'number' ? versions.slice(0, limit) : versions;
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  'get_version',
  'Fetch a version by ID.',
  { versionId: z.string() },
  async ({ versionId }) => {
    const version = await storage.getVersion(versionId);
    if (!version) {
      return {
        content: [{ type: 'text', text: `Version not found: ${versionId}` }],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(version, null, 2) }],
    };
  }
);

server.tool(
  'list_components',
  'List components with optional filters.',
  {
    designId: z.string().optional(),
    versionId: z.string().optional(),
    type: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
  },
  async ({ designId, versionId, type, limit }) => {
    const components = await storage.listComponents({ designId, versionId, type });
    const data = typeof limit === 'number' ? components.slice(0, limit) : components;
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  'get_component',
  'Fetch component detail by ID.',
  { componentId: z.string() },
  async ({ componentId }) => {
    const component = await storage.getComponent(componentId);
    if (!component) {
      return {
        content: [{ type: 'text', text: `Component not found: ${componentId}` }],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(component, null, 2) }],
    };
  }
);

server.tool(
  'get_component_preview',
  'Fetch preview data for a component.',
  { componentId: z.string() },
  async ({ componentId }) => {
    const component = await storage.getComponent(componentId);
    if (!component) {
      return {
        content: [{ type: 'text', text: `Component not found: ${componentId}` }],
      };
    }
    const payload = { componentId: component.id, preview: component.preview || null };
    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
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
