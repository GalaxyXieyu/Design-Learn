#!/usr/bin/env node

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const {
  ListToolsResultSchema,
  ListResourcesResultSchema,
  ListPromptsResultSchema,
} = require('@modelcontextprotocol/sdk/types.js');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') {
      args.url = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--auth-token') {
      args.authToken = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Verify MCP connectivity

Usage:
  node scripts/verify-mcp.js --url http://localhost:3000/mcp [--auth-token TOKEN]

Options:
  --url <url>          MCP endpoint (default: http://localhost:3000/mcp)
  --auth-token <token> MCP auth token
  -h, --help           Show help
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const serverUrl = args.url || process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
  const authToken = args.authToken || process.env.MCP_AUTH_TOKEN;
  const requestInit = authToken
    ? { headers: { Authorization: `Bearer ${authToken}` } }
    : undefined;

  const client = new Client({ name: 'design-learn-mcp-verify', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), requestInit ? { requestInit } : undefined);

  try {
    await client.connect(transport);
    const tools = await client.request({ method: 'tools/list', params: {} }, ListToolsResultSchema);
    const resources = await client.request({ method: 'resources/list', params: {} }, ListResourcesResultSchema);
    const prompts = await client.request({ method: 'prompts/list', params: {} }, ListPromptsResultSchema);

    console.log(`[mcp] tools: ${tools.tools.length}`);
    console.log(`[mcp] resources: ${resources.resources.length}`);
    console.log(`[mcp] prompts: ${prompts.prompts.length}`);
  } finally {
    await transport.close();
  }
}

main().catch((error) => {
  console.error('[mcp] verify failed:', error);
  process.exit(1);
});
