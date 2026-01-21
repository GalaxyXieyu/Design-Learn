const { URL } = require('url');

const { sendJson } = require('../http/response');
const { readJsonBody } = require('../http/request');

function handleImportStream(req, res, extractionPipeline, url) {
  const jobIdFilter = url.searchParams.get('jobId');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'ok' })}\n\n`);

  const unsubscribe = extractionPipeline.onProgress((event) => {
    if (jobIdFilter && event.job.id !== jobIdFilter) {
      return;
    }
    res.write(`event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
}

function handleImportJobs(res, extractionPipeline) {
  sendJson(res, 200, { jobs: extractionPipeline.listJobs() });
}

function handleImportJob(res, extractionPipeline, jobId) {
  const job = extractionPipeline.getJob(jobId);
  if (!job) {
    return sendJson(res, 404, { error: 'job_not_found' });
  }
  return sendJson(res, 200, { job });
}

async function handleImportBrowser(req, res, extractionPipeline) {
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

async function handleImportUrl(req, res, storage, extractionPipeline, importJobs) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  try {
    const rawUrl = body.url || '';
    if (!rawUrl) {
      return sendJson(res, 400, { error: 'url_required' });
    }

    try {
      new URL(rawUrl);
    } catch {
      return sendJson(res, 400, { error: 'invalid_url' });
    }

    const requestedDesignId = body.designId || null;
    let requestedDesign = null;
    if (requestedDesignId) {
      requestedDesign = await storage.getDesign(requestedDesignId);
      if (!requestedDesign) {
        return sendJson(res, 404, { error: 'design_not_found' });
      }
    }

    const existing = requestedDesign ? null : storage.listDesigns().find((item) => item.url === rawUrl);
    const now = new Date().toISOString();
    const useAI = !!body?.options?.useAI;
    const hasPromptTemplateId = Object.prototype.hasOwnProperty.call(body?.options || {}, 'promptTemplateId');
    const promptTemplateIdRaw = body?.options?.promptTemplateId;
    const promptTemplateId =
      hasPromptTemplateId && typeof promptTemplateIdRaw === 'string'
        ? promptTemplateIdRaw.trim() || null
        : hasPromptTemplateId
          ? null
          : undefined;

    let designId = requestedDesign?.id || existing?.id || null;
    if (!designId) {
      let name = rawUrl;
      try {
        const parsed = new URL(rawUrl);
        name = parsed.hostname || rawUrl;
      } catch {}

      const design = await storage.createDesign({
        name,
        url: rawUrl,
        source: 'script',
        metadata: {
          extractedFrom: 'playwright',
          processingStatus: 'processing',
          processingStartedAt: now,
          processingError: null,
          aiRequested: useAI,
          aiCompleted: false,
          ...(promptTemplateId !== undefined ? { promptTemplateId } : {}),
          tags: [],
        },
      });
      designId = design.id;
    }

    const job = extractionPipeline.enqueueImportFromUrl({ ...body, designId });
    importJobs.trackImportJob(job.id, designId);

    await storage.updateDesign(designId, {
      metadata: {
        processingStatus: 'processing',
        processingStartedAt: now,
        processingJobId: job.id,
        processingError: null,
        aiRequested: useAI,
        ...(useAI ? { aiCompleted: false } : {}),
        ...(promptTemplateId !== undefined ? { promptTemplateId } : {}),
      },
    });

    sendJson(res, 202, { job, designId });
  } catch (error) {
    sendJson(res, 400, { error: error.message });
  }
}

function registerImportRoutes(router, deps) {
  const { storage, extractionPipeline, importJobs } = deps;
  router.add('GET', '/api/import/stream', (req, res, ctx) => handleImportStream(req, res, extractionPipeline, ctx.url));
  router.add('GET', '/api/import/jobs', (req, res) => handleImportJobs(res, extractionPipeline));
  router.add('GET', '/api/import/jobs/:jobId', (req, res, ctx) =>
    handleImportJob(res, extractionPipeline, ctx.params.jobId)
  );
  router.add('POST', '/api/import/browser', (req, res) => handleImportBrowser(req, res, extractionPipeline));
  router.add('POST', '/api/import/url', (req, res) =>
    handleImportUrl(req, res, storage, extractionPipeline, importJobs)
  );
  router.add('POST', '/api/designs/import', (req, res) => handleImportBrowser(req, res, extractionPipeline));
  router.add('POST', '/api/snapshots/import', (req, res) => handleImportBrowser(req, res, extractionPipeline));
}

module.exports = {
  registerImportRoutes,
};
