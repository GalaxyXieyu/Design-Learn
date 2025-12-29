const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const KEEP_ALIVE_INTERVAL_MS = 15000;
const WS_CLOSE_DELAY_MS = 500;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

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

function handleMcpSse(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  const readyPayload = JSON.stringify({
    status: 'ready',
    transport: 'sse',
    timestamp: new Date().toISOString(),
  });

  res.write(': ok\n\n');
  res.write(`event: ready\ndata: ${readyPayload}\n\n`);

  const interval = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, KEEP_ALIVE_INTERVAL_MS);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
}

function handleWsHttpFallback(req, res) {
  sendJson(res, 426, { error: 'upgrade_required' });
}

function findRoute(method, pathname) {
  return routes.find((route) => route.method === method && route.path === pathname);
}

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  console.log(`[http] ${req.method} ${pathname}`);

  if (isMcpPath(pathname)) {
    return handleMcpSse(req, res);
  }

  if (isWsPath(pathname)) {
    return handleWsHttpFallback(req, res);
  }

  const route = findRoute(req.method, pathname);
  if (route) {
    return route.handler(req, res);
  }

  return sendJson(res, 404, { error: 'not_found', path: pathname });
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
  try {
    handleRequest(req, res);
  } catch (error) {
    console.error('[http] handler error', error);
    sendJson(res, 500, { error: 'internal_error' });
  }
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
});

function shutdown(signal) {
  console.log(`[design-learn-server] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
