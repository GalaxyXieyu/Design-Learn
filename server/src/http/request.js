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

function parseOptionalBoolean(value) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function parseLimitOffset(url) {
  const limitRaw = Number(url.searchParams.get('limit'));
  const offsetRaw = Number(url.searchParams.get('offset'));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { limit, offset };
}

function parseLimitOffsetStrict(url) {
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');

  if (limitRaw !== null && !Number.isFinite(Number(limitRaw))) {
    return { error: 'invalid_limit' };
  }
  if (offsetRaw !== null && !Number.isFinite(Number(offsetRaw))) {
    return { error: 'invalid_offset' };
  }

  return parseLimitOffset(url);
}

function paginate(items, limit, offset) {
  const total = items.length;
  const paged = items.slice(offset, offset + limit);
  return { items: paged, total };
}

module.exports = {
  readJsonBody,
  parseOptionalBoolean,
  parseLimitOffset,
  parseLimitOffsetStrict,
  paginate,
};
