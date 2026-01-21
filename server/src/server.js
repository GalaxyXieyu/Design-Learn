const os = require('os');
const path = require('path');

const { createMcpHandler } = require('./mcp');
const { createStorage } = require('./storage');
const { createExtractionPipeline } = require('./pipeline');
const { createPreviewPipeline } = require('./preview');
const { createUipro } = require('./uipro');
const { createServer } = require('./http/createServer');
const { createImportProgress } = require('./services/importProgress');
const { ensurePromptTemplateDefault } = require('./services/promptTemplates');
const { PROMPT_TEMPLATE_DEFAULT_TYPE } = require('./promptTemplates');

const DEFAULT_PORT = Number(process.env.PORT || process.env.DESIGN_LEARN_PORT || 3100);

const defaultDataDir = path.join(os.homedir(), '.design-learn', 'data');
const dataDir = process.env.DESIGN_LEARN_DATA_DIR || process.env.DATA_DIR || defaultDataDir;

let storage;
let uipro;
let extractionPipeline;
let previewPipeline;
let mcpHandler;
let httpServer;

async function start() {
  storage = await createStorage({ dataDir });

  await ensurePromptTemplateDefault(storage, PROMPT_TEMPLATE_DEFAULT_TYPE);

  uipro = createUipro({ dataDir });
  extractionPipeline = createExtractionPipeline({ storage });
  previewPipeline = createPreviewPipeline({ storage });

  const importJobs = createImportProgress({ storage, extractionPipeline });
  importJobs.registerPipelineHandlers();

  mcpHandler = await createMcpHandler({
    storage,
    dataDir: process.env.DESIGN_LEARN_DATA_DIR,
    serverName: process.env.MCP_SERVER_NAME,
    serverVersion: process.env.MCP_SERVER_VERSION,
    authToken: process.env.MCP_AUTH_TOKEN,
    uipro,
    extractionPipeline,
  });

  httpServer = createServer({
    storage,
    uipro,
    extractionPipeline,
    previewPipeline,
    mcpHandler,
    importJobs,
  });

  httpServer.listen(DEFAULT_PORT, () => {
    console.log(`[design-learn-server] listening on http://localhost:${DEFAULT_PORT}`);
    console.log(`[design-learn-server] data dir: ${storage.dataDir}`);
  });
}

start().catch((error) => {
  console.error('[design-learn-server] startup failed', error);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`[design-learn-server] received ${signal}, shutting down`);
  if (mcpHandler) {
    mcpHandler.close().catch((error) => console.error('[mcp] close error', error));
  }
  extractionPipeline?.close();
  previewPipeline?.close();
  storage?.close();
  httpServer?.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
