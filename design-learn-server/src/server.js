const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const DEFAULT_PORT = Number(process.env.PORT || process.env.DESIGN_LEARN_PORT || 3100);
const WS_CLOSE_DELAY_MS = 500;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const { createMcpHandler } = require('./mcp');
const { createStorage } = require('./storage');
const { createExtractionPipeline } = require('./pipeline');
const { createPreviewPipeline } = require('./preview');
const { getConfigPath } = require('./storage/paths');
const { readJson, writeJson } = require('./storage/fileStore');

const storage = createStorage({ dataDir: process.env.DESIGN_LEARN_DATA_DIR });
const extractionPipeline = createExtractionPipeline({ storage });
const previewPipeline = createPreviewPipeline({ storage });
const mcpHandler = createMcpHandler({
  storage,
  dataDir: process.env.DESIGN_LEARN_DATA_DIR,
  serverName: process.env.MCP_SERVER_NAME,
  serverVersion: process.env.MCP_SERVER_VERSION,
  authToken: process.env.MCP_AUTH_TOKEN,
});

const routes = [
  {
    method: 'GET',
    path: '/',
    handler: handleRoot,
  },
  {
    method: 'GET',
    path: '/api/health',
    handler: handleHealth,
  },
];

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendNoContent(res) {
  res.writeHead(204);
  res.end();
}

function handleRoot(req, res) {
  sendJson(res, 200, {
    name: 'design-learn-server',
    status: 'ready',
    endpoints: {
      health: '/api/health',
      importBrowser: '/api/import/browser',
      importUrl: '/api/import/url',
      importJobs: '/api/import/jobs',
      importStream: '/api/import/stream',
      designs: '/api/designs',
      snapshots: '/api/snapshots',
      config: '/api/config',
      previews: '/api/previews',
      mcp: '/mcp',
      ws: '/ws',
    },
  });
}

function handleHealth(req, res) {
  sendJson(res, 200, {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

const DEFAULT_CONFIG = {
  model: {
    name: '',
    version: '',
    provider: '',
  },
  templates: {
    styleguide: '',
    components: '',
  },
  extractOptions: {
    includeRules: true,
    includeComponents: true,
  },
  updatedAt: null,
};

function parseLimitOffset(url) {
  const limitRaw = Number(url.searchParams.get('limit'));
  const offsetRaw = Number(url.searchParams.get('offset'));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { limit, offset };
}

function paginate(items, limit, offset) {
  const total = items.length;
  const paged = items.slice(offset, offset + limit);
  return { items: paged, total };
}

async function loadConfig() {
  const configPath = getConfigPath(storage.dataDir);
  try {
    return await readJson(configPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }
}

function normalizeConfig(input) {
  const now = new Date().toISOString();
  const model = input?.model || {};
  const templates = input?.templates || {};
  const extractOptions = input?.extractOptions || {};
  return {
    model: {
      ...DEFAULT_CONFIG.model,
      ...model,
    },
    templates: {
      ...DEFAULT_CONFIG.templates,
      ...templates,
    },
    extractOptions: {
      ...DEFAULT_CONFIG.extractOptions,
      ...extractOptions,
    },
    updatedAt: now,
  };
}

async function handleConfigGet(res) {
  const config = await loadConfig();
  sendJson(res, 200, config);
}

async function handleConfigPut(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { error: 'invalid_config' });
  }
  const config = normalizeConfig(body);
  await writeJson(getConfigPath(storage.dataDir), config);
  return sendJson(res, 200, config);
}

function isMcpPath(pathname) {
  return pathname === '/mcp' || pathname.startsWith('/mcp/');
}

function isWsPath(pathname) {
  return pathname === '/ws' || pathname.startsWith('/ws/');
}

function handleWsHttpFallback(req, res) {
  sendJson(res, 426, { error: 'upgrade_required' });
}

function findRoute(method, pathname) {
  return routes.find((route) => route.method === method && route.path === pathname);
}

function sendMethodNotAllowed(res) {
  sendJson(res, 405, { error: 'method_not_allowed' });
}

function handleImportStream(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const jobIdFilter = url.searchParams.get('jobId');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`event: connected\\ndata: ${JSON.stringify({ status: 'ok' })}\\n\\n`);

  const unsubscribe = extractionPipeline.onProgress((event) => {
    if (jobIdFilter && event.job.id !== jobIdFilter) {
      return;
    }
    res.write(`event: ${event.event}\\ndata: ${JSON.stringify(event)}\\n\\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
}

function handleImportJobs(res) {
  sendJson(res, 200, { jobs: extractionPipeline.listJobs() });
}

function handleImportJob(res, jobId) {
  const job = extractionPipeline.getJob(jobId);
  if (!job) {
    return sendJson(res, 404, { error: 'job_not_found' });
  }
  return sendJson(res, 200, { job });
}

async function handleImportBrowser(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  try {
    const job = extractionPipeline.enqueueImportFromBrowser(body);
    sendJson(res, 202, { job });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

async function handleImportUrl(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  try {
    const job = extractionPipeline.enqueueImportFromUrl(body);
    sendJson(res, 202, { job });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

function handleDesignList(res, url) {
  const { limit, offset } = parseLimitOffset(url);
  const designs = storage.listDesigns();
  const { items, total } = paginate(designs, limit, offset);
  sendJson(res, 200, { items, limit, offset, total });
}

async function handleDesignCreate(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const design = await storage.createDesign(body);
  sendJson(res, 201, design);
}

async function handleDesignGet(res, designId) {
  const design = await storage.getDesign(designId);
  if (!design) {
    return sendJson(res, 404, { error: 'design_not_found' });
  }
  return sendJson(res, 200, design);
}

async function handleDesignPatch(req, res, designId) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  const design = await storage.updateDesign(designId, body);
  if (!design) {
    return sendJson(res, 404, { error: 'design_not_found' });
  }
  return sendJson(res, 200, design);
}

async function handleDesignDelete(res, designId) {
  const design = await storage.getDesign(designId);
  if (!design) {
    return sendJson(res, 404, { error: 'design_not_found' });
  }
  await storage.deleteDesign(designId);
  return sendNoContent(res);
}

async function handleSnapshotsList(res, url) {
  const { limit, offset } = parseLimitOffset(url);
  const filters = {};
  const designId = url.searchParams.get('designId');
  const versionId = url.searchParams.get('versionId');
  if (designId) {
    filters.designId = designId;
  }
  if (versionId) {
    filters.versionId = versionId;
  }
  const snapshots = await storage.listSnapshots(filters);
  const { items, total } = paginate(snapshots, limit, offset);
  return sendJson(res, 200, { items, limit, offset, total });
}

async function handleSnapshotGet(res, snapshotId) {
  const snapshot = await storage.getSnapshot(snapshotId);
  if (!snapshot) {
    return sendJson(res, 404, { error: 'snapshot_not_found' });
  }
  return sendJson(res, 200, snapshot);
}

async function handleSnapshotDelete(res, snapshotId) {
  const snapshot = await storage.deleteSnapshot(snapshotId);
  if (!snapshot) {
    return sendJson(res, 404, { error: 'snapshot_not_found' });
  }
  return sendNoContent(res);
}

function handlePreviewJobs(res) {
  sendJson(res, 200, { jobs: previewPipeline.listJobs() });
}

function handlePreviewJob(res, jobId) {
  const job = previewPipeline.getJob(jobId);
  if (!job) {
    return sendJson(res, 404, { error: 'preview_job_not_found' });
  }
  return sendJson(res, 200, { job });
}

async function handlePreviewEnqueue(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  try {
    const job = previewPipeline.enqueuePreview(body);
    return sendJson(res, 202, { job });
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  console.log(`[http] ${req.method} ${pathname}`);

  if (isMcpPath(pathname)) {
    if (req.method === 'POST') {
      const body = await readJsonBody(req, res);
      if (!body) {
        return;
      }
      await mcpHandler.handleRequest(req, res, body);
      return;
    }

    await mcpHandler.handleRequest(req, res);
    return;
  }

  if (isWsPath(pathname)) {
    return handleWsHttpFallback(req, res);
  }

  if (pathname === '/api/designs/import') {
    if (req.method === 'POST') {
      return handleImportBrowser(req, res);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname.startsWith('/api/import')) {
    if (pathname === '/api/import/stream') {
      if (req.method === 'GET') {
        return handleImportStream(req, res);
      }
      return sendMethodNotAllowed(res);
    }

    if (pathname === '/api/import/jobs') {
      if (req.method === 'GET') {
        return handleImportJobs(res);
      }
      return sendMethodNotAllowed(res);
    }

    if (pathname.startsWith('/api/import/jobs/')) {
      if (req.method === 'GET') {
        const jobId = pathname.split('/').pop();
        return handleImportJob(res, jobId);
      }
      return sendMethodNotAllowed(res);
    }

    if (pathname === '/api/import/browser') {
      if (req.method === 'POST') {
        return handleImportBrowser(req, res);
      }
      return sendMethodNotAllowed(res);
    }

    if (pathname === '/api/import/url') {
      if (req.method === 'POST') {
        return handleImportUrl(req, res);
      }
      return sendMethodNotAllowed(res);
    }
  }

  if (pathname === '/api/config') {
    if (req.method === 'GET') {
      return handleConfigGet(res);
    }
    if (req.method === 'PUT') {
      return handleConfigPut(req, res);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname === '/api/designs') {
    if (req.method === 'GET') {
      return handleDesignList(res, url);
    }
    if (req.method === 'POST') {
      return handleDesignCreate(req, res);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname.startsWith('/api/designs/')) {
    const designId = pathname.split('/').pop();
    if (!designId) {
      return sendJson(res, 400, { error: 'design_id_required' });
    }
    if (req.method === 'GET') {
      return handleDesignGet(res, designId);
    }
    if (req.method === 'PATCH') {
      return handleDesignPatch(req, res, designId);
    }
    if (req.method === 'DELETE') {
      return handleDesignDelete(res, designId);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname === '/api/snapshots/import') {
    if (req.method === 'POST') {
      return handleImportBrowser(req, res);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname === '/api/snapshots') {
    if (req.method === 'GET') {
      return handleSnapshotsList(res, url);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname.startsWith('/api/snapshots/')) {
    const snapshotId = pathname.split('/').pop();
    if (!snapshotId) {
      return sendJson(res, 400, { error: 'snapshot_id_required' });
    }
    if (req.method === 'GET') {
      return handleSnapshotGet(res, snapshotId);
    }
    if (req.method === 'DELETE') {
      return handleSnapshotDelete(res, snapshotId);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname === '/api/previews') {
    if (req.method === 'POST') {
      return handlePreviewEnqueue(req, res);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname === '/api/previews/jobs') {
    if (req.method === 'GET') {
      return handlePreviewJobs(res);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname.startsWith('/api/previews/jobs/')) {
    const jobId = pathname.split('/').pop();
    if (!jobId) {
      return sendJson(res, 400, { error: 'preview_job_id_required' });
    }
    if (req.method === 'GET') {
      return handlePreviewJob(res, jobId);
    }
    return sendMethodNotAllowed(res);
  }

  const route = findRoute(req.method, pathname);
  if (route) {
    return route.handler(req, res);
  }

  return sendJson(res, 404, { error: 'not_found', path: pathname });
}

function readJsonBody(req, res) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'empty_body' }));
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
        resolve(null);
      }
    });
  });
}

function handleWebSocketUpgrade(req, socket) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (!isWsPath(url.pathname)) {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n',
  ];

  socket.write(headers.join('\r\n'));

  const closeTimer = setTimeout(() => {
    socket.end();
  }, WS_CLOSE_DELAY_MS);

  socket.on('close', () => clearTimeout(closeTimer));
  socket.on('error', (err) => console.error(`[ws] ${err.message}`));
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error('[http] handler error', error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'internal_error' });
    }
  });
});

server.on('upgrade', (req, socket) => {
  try {
    handleWebSocketUpgrade(req, socket);
  } catch (error) {
    console.error('[ws] upgrade error', error);
    socket.destroy();
  }
});

server.on('clientError', (err, socket) => {
  console.error('[http] client error', err.message);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(DEFAULT_PORT, () => {
  console.log(`[design-learn-server] listening on http://localhost:${DEFAULT_PORT}`);
  console.log(`[design-learn-server] data dir: ${storage.dataDir}`);
});

function shutdown(signal) {
  console.log(`[design-learn-server] received ${signal}, shutting down`);
  mcpHandler.close().catch((error) => console.error('[mcp] close error', error));
  extractionPipeline.close();
  previewPipeline.close();
  storage.close();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
