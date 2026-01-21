const http = require('http');
const { URL } = require('url');

const { createRouter } = require('./router');
const { registerRoutes } = require('../routes');
const { sendJson, sendMethodNotAllowed } = require('./response');
const { readJsonBody } = require('./request');
const { handleWebSocketUpgrade } = require('../ws/upgrade');

function isMcpPath(pathname) {
  return pathname === '/mcp' || pathname.startsWith('/mcp/');
}

function isWsPath(pathname) {
  return pathname === '/ws' || pathname.startsWith('/ws/');
}

function handleWsHttpFallback(req, res) {
  sendJson(res, 426, { error: 'upgrade_required' });
}

function createServer(deps) {
  const router = createRouter();
  registerRoutes(router, deps);

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
        await deps.mcpHandler.handleRequest(req, res, body);
        return;
      }

      await deps.mcpHandler.handleRequest(req, res);
      return;
    }

    if (isWsPath(pathname)) {
      return handleWsHttpFallback(req, res);
    }

    const result = await router.handle(req, res, url, deps);
    if (result?.methodNotAllowed) {
      return sendMethodNotAllowed(res);
    }
    if (result?.handled) {
      return;
    }

    return sendJson(res, 404, { error: 'not_found', path: pathname });
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

  return server;
}

module.exports = {
  createServer,
};
