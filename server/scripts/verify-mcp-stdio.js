#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { ListToolsResultSchema, CallToolResultSchema } = require('@modelcontextprotocol/sdk/types.js');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--stdio-entry') {
      args.stdioEntry = argv[i + 1];
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
  console.log(`Verify MCP connectivity (stdio transport)

Usage:
  node scripts/verify-mcp-stdio.js [--stdio-entry src/stdio.js]

Options:
  --stdio-entry <path>  Stdio server entry file (default: src/stdio.js)
  -h, --help            Show help
`);
}

function createTempDataDir() {
  const base = path.join(os.tmpdir(), 'design-learn-stdio-');
  return fs.mkdtempSync(base);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const serverRoot = path.resolve(__dirname, '..');
  const entry = args.stdioEntry ? path.resolve(serverRoot, args.stdioEntry) : path.join(serverRoot, 'src', 'stdio.js');
  const dataDir = createTempDataDir();

  const client = new Client({ name: 'design-learn-mcp-stdio-verify', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: 'node',
    args: [entry],
    cwd: serverRoot,
    env: {
      DESIGN_LEARN_DATA_DIR: dataDir,
      DESIGN_LEARN_STDIO_START_HTTP_SERVER: '0',
      DESIGN_LEARN_AUTO_INSTALL_PLAYWRIGHT: '0',
    },
    stderr: 'inherit',
  });

  try {
    await client.connect(transport);

    const tools = await client.request({ method: 'tools/list', params: {} }, ListToolsResultSchema);
    const toolNames = new Set(tools.tools.map((t) => t.name));

    console.log(`[mcp] tools: ${tools.tools.length}`);
    for (const name of [
      'list_uipro_domains',
      'list_uipro_stacks',
      'search_uipro',
      'search_uipro_stack',
      'search_library',
    ]) {
      console.log(`[mcp] has ${name}: ${toolNames.has(name)}`);
    }

    const result = await client.request(
      {
        method: 'tools/call',
        params: { name: 'search_uipro', arguments: { query: 'glassmorphism', domain: 'style', limit: 1 } },
      },
      CallToolResultSchema
    );
    const text = result.content?.[0]?.text || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    console.log('[mcp] search_uipro parse_ok:', Boolean(parsed && typeof parsed === 'object'));
    console.log('[mcp] search_uipro contains Glassmorphism:', /Glassmorphism/i.test(text));

    if (toolNames.has('search_library')) {
      const libraryResult = await client.request(
        {
          method: 'tools/call',
          params: { name: 'search_library', arguments: { query: 'glassmorphism', limit: 3 } },
        },
        CallToolResultSchema
      );
      const libraryText = libraryResult.content?.[0]?.text || '';
      let libraryParsed;
      try {
        libraryParsed = JSON.parse(libraryText);
      } catch {
        libraryParsed = null;
      }

      const designsOk = Boolean(libraryParsed && Array.isArray(libraryParsed.designs));
      const uiproOk = Boolean(libraryParsed && libraryParsed.uipro && typeof libraryParsed.uipro === 'object');
      console.log('[mcp] search_library designs_ok:', designsOk);
      console.log('[mcp] search_library uipro_ok:', uiproOk);
      console.log('[mcp] search_library uipro contains Glassmorphism:', /Glassmorphism/i.test(libraryText));
    }
  } finally {
    try {
      await transport.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((error) => {
  console.error('[mcp] stdio verify failed:', error);
  process.exit(1);
});
