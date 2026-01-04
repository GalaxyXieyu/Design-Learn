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
      tasks: '/api/tasks',
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

async function handlePreviewGet(res, componentId) {
  const component = await storage.getComponent(componentId);
  if (!component) {
    return sendJson(res, 404, { error: 'component_not_found' });
  }
  return sendJson(res, 200, {
    componentId: component.id,
    preview: component.preview || null,
  });
}

// ==================== 任务管理 API ====================

async function handleTasksList(res, url) {
  const filters = {};
  const status = url.searchParams.get('status');
  const domain = url.searchParams.get('domain');
  const excludeCompleted = url.searchParams.get('excludeCompleted') === 'true';

  if (status) {
    filters.status = status.split(',');
  }
  if (domain) {
    filters.domain = domain;
  }
  if (excludeCompleted) {
    filters.excludeCompleted = true;
  }

  const tasks = storage.listTasks(filters);

  // 按域名分组
  const groups = {};
  tasks.forEach(task => {
    if (!groups[task.domain]) {
      groups[task.domain] = [];
    }
    groups[task.domain].push(task);
  });

  // 统计信息
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  sendJson(res, 200, { tasks, groups, stats });
}

async function handleTaskCreate(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  if (!body.url) {
    return sendJson(res, 400, { error: 'url_required' });
  }

  try {
    const task = await storage.createTask({
      url: body.url,
      options: body.options || {},
    });
    sendJson(res, 201, { task });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

async function handleTaskGet(res, taskId) {
  const task = await storage.getTask(taskId);
  if (!task) {
    return sendJson(res, 404, { error: 'task_not_found' });
  }
  return sendJson(res, 200, { task });
}

async function handleTaskUpdate(req, res, taskId) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  const task = await storage.updateTask(taskId, body);
  if (!task) {
    return sendJson(res, 404, { error: 'task_not_found' });
  }
  return sendJson(res, 200, { task });
}

async function handleTaskDelete(res, taskId) {
  const success = await storage.deleteTask(taskId);
  if (!success) {
    return sendJson(res, 404, { error: 'task_not_found' });
  }
  return sendNoContent(res);
}

async function handleTasksClearCompleted(res) {
  const count = await storage.clearCompletedTasks();
  return sendJson(res, 200, { deleted: count });
}

async function handleTaskRetry(req, res, taskId) {
  const task = await storage.getTask(taskId);
  if (!task) {
    return sendJson(res, 404, { error: 'task_not_found' });
  }

  // 重置任务状态
  const resetTask = await storage.updateTask(taskId, {
    status: 'pending',
    progress: 0,
    stage: null,
    error: null,
    completedAt: null,
  });

  return sendJson(res, 200, { task: resetTask });
}

// ==================== 路由扫描 API ====================

async function handleScanRoutes(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  const url = body.url;
  if (!url) {
    return sendJson(res, 400, { error: 'url_required' });
  }

  try {
    new URL(url);
  } catch {
    return sendJson(res, 400, { error: 'invalid_url' });
  }

  try {
    const routes = await scanWebsiteRoutes(url, body.limit || 10);
    sendJson(res, 200, {
      routes,
      total: routes.length,
      baseUrl: url,
    });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

async function scanWebsiteRoutes(baseUrl, maxRoutes = 10) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (error) {
    throw new Error('playwright_not_installed');
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 收集所有链接
    const routes = new Set();
    routes.add(new URL(baseUrl).pathname);

    // 获取所有链接
    const links = await page.$$eval('a[href]', (anchors) => {
      return anchors.map((a) => a.href);
    });

    const baseUrlObj = new URL(baseUrl);
    links.forEach((href) => {
      try {
        const linkUrl = new URL(href, baseUrl);
        if (linkUrl.origin === baseUrlObj.origin) {
          const pathname = linkUrl.pathname;
          if (pathname && !routes.has(pathname)) {
            routes.add(pathname);
          }
        }
      } catch {
        // 忽略无效链接
      }
    });

    // 排序并限制数量
    const sortedRoutes = Array.from(routes)
      .sort((a, b) => {
        const depthA = a.split('/').filter(Boolean).length;
        const depthB = b.split('/').filter(Boolean).length;
        if (depthA !== depthB) return depthA - depthB;
        return a.localeCompare(b);
      })
      .slice(0, maxRoutes);

    return sortedRoutes;
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
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

  if (pathname.startsWith('/api/previews/')) {
    const componentId = pathname.split('/').pop();
    if (!componentId) {
      return sendJson(res, 400, { error: 'component_id_required' });
    }
    if (req.method === 'GET') {
      return handlePreviewGet(res, componentId);
    }
    return sendMethodNotAllowed(res);
  }

  // 任务管理路由
  if (pathname === '/api/tasks') {
    if (req.method === 'GET') {
      return handleTasksList(res, url);
    }
    if (req.method === 'POST') {
      return handleTaskCreate(req, res);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname === '/api/tasks/clear-completed') {
    if (req.method === 'DELETE') {
      return handleTasksClearCompleted(res);
    }
    return sendMethodNotAllowed(res);
  }

  if (pathname.startsWith('/api/tasks/')) {
    const taskId = pathname.split('/').pop();
    if (!taskId) {
      return sendJson(res, 400, { error: 'task_id_required' });
    }

    if (taskId === 'clear-completed') {
      return sendMethodNotAllowed(res);
    }

    if (taskId === 'retry' && req.method === 'POST') {
      const actualTaskId = pathname.split('/').slice(-2, -1)[0];
      if (!actualTaskId) {
        return sendJson(res, 400, { error: 'task_id_required' });
      }
      return handleTaskRetry(req, res, actualTaskId);
    }

    if (req.method === 'GET') {
      return handleTaskGet(res, taskId);
    }
    if (req.method === 'PATCH') {
      return handleTaskUpdate(req, res, taskId);
    }
    if (req.method === 'DELETE') {
      return handleTaskDelete(res, taskId);
    }
    return sendMethodNotAllowed(res);
  }

  // 路由扫描路由
  if (pathname === '/api/scan-routes') {
    if (req.method === 'POST') {
      return handleScanRoutes(req, res);
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
