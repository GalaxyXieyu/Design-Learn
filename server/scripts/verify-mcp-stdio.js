#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { ListToolsResultSchema, CallToolResultSchema } = require('@modelcontextprotocol/sdk/types.js');
const { createStorage } = require('../src/storage');

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

async function seedData(dataDir) {
  const storage = await createStorage({ dataDir });
  try {
    const design = await storage.createDesign({
      name: 'Verify Landing',
      url: 'http://127.0.0.1:4010/index.html',
      source: 'verify',
      metadata: { tags: ['verify'] },
    });
    const version = await storage.createVersion({
      designId: design.id,
      styleguideMarkdown: '',
      rules: {},
      snapshots: [
        {
          title: 'Verify Landing',
          url: 'http://127.0.0.1:4010/index.html',
          html: '<main><section class="hero">Hello Verify</section></main>',
          css: '.hero { color: #123456; padding: 24px; }',
          metadata: { viewport: { width: 1440, height: 900 } },
          extractedAt: new Date().toISOString(),
        },
      ],
      createdBy: 'verify',
    });
    return { design, version };
  } finally {
    storage.close();
  }
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
  const seeded = await seedData(dataDir);

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
      'list_versions',
      'get_version',
      'save_design_analysis',
      'search_library',
    ]) {
      console.log(`[mcp] has ${name}: ${toolNames.has(name)}`);
    }

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

    if (toolNames.has('get_version') && toolNames.has('save_design_analysis')) {
      const versionResult = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'get_version',
            arguments: { designId: seeded.design.id, snapshotLimit: 1, htmlLimit: 20, cssLimit: 20 },
          },
        },
        CallToolResultSchema
      );
      const versionText = versionResult.content?.[0]?.text || '';
      const versionPayload = JSON.parse(versionText);
      console.log('[mcp] get_version design_match:', versionPayload.designId === seeded.design.id);
      console.log('[mcp] get_version snapshot_count:', versionPayload.snapshotCount === 1);
      console.log('[mcp] get_version html_truncated:', versionPayload.snapshots?.[0]?.htmlTruncated === true);

      const saveResult = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'save_design_analysis',
            arguments: {
              designId: seeded.design.id,
              styleguideMarkdown: '# Verify Report\n\n- hero uses accent color',
              rules: { colors: ['#123456'] },
              analysisSource: 'verify-script',
            },
          },
        },
        CallToolResultSchema
      );
      const saveText = saveResult.content?.[0]?.text || '';
      const savePayload = JSON.parse(saveText);
      console.log('[mcp] save_design_analysis saved:', savePayload.styleguideSaved === true);
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
