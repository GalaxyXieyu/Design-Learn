const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');

const DEFAULT_TIMEOUT_MS = 30000;

function createExtractionPipeline({ storage }) {
  const emitter = new EventEmitter();
  const jobs = new Map();
  const queue = [];
  let running = false;
  let closed = false;

  function toPublicJob(job) {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: job.result || null,
      error: job.error || null,
    };
  }

  function emitProgress(job, extra = {}) {
    job.updatedAt = new Date().toISOString();
    emitter.emit('progress', {
      job: toPublicJob(job),
      event: extra.event || 'progress',
      detail: extra.detail || null,
    });
  }

  function enqueue(type, payload) {
    if (closed) {
      throw new Error('pipeline_closed');
    }

    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      type,
      status: 'queued',
      progress: 0,
      message: 'queued',
      createdAt: now,
      updatedAt: now,
      payload,
      result: null,
      error: null,
    };
    jobs.set(job.id, job);
    queue.push(job.id);
    emitProgress(job, { event: 'queued' });
    processQueue();
    return toPublicJob(job);
  }

  function onProgress(listener) {
    emitter.on('progress', listener);
    return () => emitter.off('progress', listener);
  }

  function listJobs() {
    return Array.from(jobs.values()).map((job) => toPublicJob(job));
  }

  function getJob(jobId) {
    const job = jobs.get(jobId);
    return job ? toPublicJob(job) : null;
  }

  function updateJob(job, progress, message, detail) {
    if (typeof progress === 'number') {
      job.progress = Math.max(0, Math.min(100, progress));
    }
    if (message) {
      job.message = message;
    }
    emitProgress(job, { event: 'progress', detail });
  }

  async function processQueue() {
    if (running || closed) {
      return;
    }
    running = true;
    while (queue.length > 0 && !closed) {
      const jobId = queue.shift();
      const job = jobs.get(jobId);
      if (!job || job.status !== 'queued') {
        continue;
      }

      job.status = 'running';
      job.progress = 5;
      job.message = 'started';
      emitProgress(job, { event: 'started' });

      try {
        const result = await runJob(job, updateJob);
        job.status = 'completed';
        job.progress = 100;
        job.message = 'completed';
        job.result = result;
        emitProgress(job, { event: 'completed' });
      } catch (error) {
        job.status = 'failed';
        job.message = 'failed';
        job.error = { message: error.message };
        emitProgress(job, { event: 'failed' });
      }
    }
    running = false;
  }

  async function runJob(job, report) {
    if (job.type === 'import_browser') {
      return importFromBrowser(storage, job.payload, (progress, message, detail) =>
        report(job, progress, message, detail)
      );
    }
    if (job.type === 'import_url') {
      return importFromUrl(storage, job.payload, (progress, message, detail) =>
        report(job, progress, message, detail)
      );
    }
    throw new Error(`unknown_job_type:${job.type}`);
  }

  function close() {
    closed = true;
    emitter.removeAllListeners();
    queue.length = 0;
  }

  return {
    enqueueImportFromBrowser: (payload) => enqueue('import_browser', payload),
    enqueueImportFromUrl: (payload) => enqueue('import_url', payload),
    onProgress,
    listJobs,
    getJob,
    close,
  };
}

function normalizeBrowserPayload(payload = {}) {
  const website = payload.website || {};
  let snapshot = payload.snapshot || null;

  if (!snapshot && Array.isArray(payload.snapshots) && payload.snapshots.length > 0) {
    snapshot = payload.snapshots[0];
  }

  if (!snapshot && (payload.html || payload.css)) {
    snapshot = payload;
  }

  const url = website.url || payload.url || (snapshot ? snapshot.url : '') || '';
  if (!snapshot) {
    throw new Error('snapshot_required');
  }
  if (!url) {
    throw new Error('url_required');
  }

  return {
    website: {
      url,
      title: website.title || payload.title || snapshot.title || '',
      favicon: website.favicon || payload.favicon || '',
    },
    snapshot,
    analysis: payload.analysis || null,
    source: payload.source || payload.extractedFrom || 'browser-extension',
    version: payload.version || payload.extractorVersion || '',
    designId: payload.designId || null,
  };
}

async function importFromBrowser(storage, payload, report) {
  report(15, 'normalizing');
  const normalized = normalizeBrowserPayload(payload);
  report(30, 'storing_design');
  const result = await storeImport(storage, normalized, report);
  report(90, 'stored');
  return result;
}

async function importFromUrl(storage, payload = {}, report) {
  const url = payload.url || '';
  if (!url) {
    throw new Error('url_required');
  }

  report(10, 'launching_browser');
  const snapshot = await extractWithPlaywright(url, payload.options || {}, report);
  report(65, 'extracted');

  const normalized = {
    website: {
      url,
      title: snapshot.title || '',
      favicon: '',
    },
    snapshot,
    analysis: payload.analysis || null,
    source: 'playwright',
    version: payload.extractorVersion || snapshot.metadata?.extractorVersion || '',
    designId: payload.designId || null,
  };

  report(75, 'storing_design');
  const result = await storeImport(storage, normalized, report);
  report(95, 'stored');
  return result;
}

async function storeImport(storage, normalized, report) {
  const { website, snapshot, analysis, source, version, designId } = normalized;
  const url = website.url || snapshot.url || '';
  const title = website.title || snapshot.title || url || 'Untitled';

  let design = null;
  if (designId) {
    design = await storage.getDesign(designId);
  }

  if (!design && url) {
    const existing = storage.listDesigns().find((item) => item.url === url);
    if (existing) {
      design = existing;
    }
  }

  if (!design) {
    design = await storage.createDesign({
      name: title,
      url,
      source: source === 'playwright' ? 'script' : 'browser',
      metadata: {
        extractedFrom: source,
        extractorVersion: version || '',
        tags: [],
      },
    });
  }

  report(55, 'storing_version');
  const versionRecord = await storage.createVersion({
    designId: design.id,
    styleguideMarkdown: analysis?.styleguide || '',
    rules: analysis?.rules || {},
    snapshots: snapshot ? [snapshot] : [],
    createdBy: 'import',
  });

  return {
    designId: design.id,
    versionId: versionRecord.id,
  };
}

async function extractWithPlaywright(url, options = {}, report) {
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (error) {
    throw new Error('playwright_not_installed');
  }

  const extractorPath = path.resolve(__dirname, '../../../scripts/lib/extractor.js');
  let extractPage;
  try {
    const extractorModule = await import(pathToFileURL(extractorPath).href);
    extractPage = extractorModule.extractPage;
  } catch (error) {
    throw new Error('extractor_script_missing');
  }

  if (typeof extractPage !== 'function') {
    throw new Error('extractor_script_invalid');
  }

  const { chromium } = playwright;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const headless = options.headless !== false;

  const browser = await chromium.launch({ headless });
  report(20, 'browser_launched');
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    report(40, 'page_loaded');
    const snapshot = await extractPage(page, options.extractOptions || {});
    report(55, 'snapshot_ready');
    return snapshot;
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

module.exports = {
  createExtractionPipeline,
};
