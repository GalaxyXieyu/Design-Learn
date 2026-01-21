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

function sendMethodNotAllowed(res) {
  sendJson(res, 405, { error: 'method_not_allowed' });
}

module.exports = {
  sendJson,
  sendNoContent,
  sendMethodNotAllowed,
};
