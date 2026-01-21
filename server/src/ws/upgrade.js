const crypto = require('crypto');
const { URL } = require('url');

const WS_CLOSE_DELAY_MS = 500;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function isWsPath(pathname) {
  return pathname === '/ws' || pathname.startsWith('/ws/');
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

module.exports = {
  handleWebSocketUpgrade,
};
