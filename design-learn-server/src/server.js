const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const DEFAULT_PORT = Number(process.env.PORT || process.env.DESIGN_LEARN_PORT || 3100);
const WS_CLOSE_DELAY_MS = 500;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const { createMcpHandler } = require('./mcp');
const { createStorage } = require('./storage');
const { createExtractionPipeline } = require('./pipeline');

const storage = createStorage({ dataDir: process.env.DESIGN_LEARN_DATA_DIR });
const extractionPipeline = createExtractionPipeline({ storage });
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
  storage.close();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
