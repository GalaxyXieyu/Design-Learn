const { sendJson } = require('../http/response');
const { readJsonBody } = require('../http/request');

function handlePreviewJobs(res, previewPipeline) {
  sendJson(res, 200, { jobs: previewPipeline.listJobs() });
}

function handlePreviewJob(res, previewPipeline, jobId) {
  const job = previewPipeline.getJob(jobId);
  if (!job) {
    return sendJson(res, 404, { error: 'preview_job_not_found' });
  }
  return sendJson(res, 200, { job });
}

async function handlePreviewEnqueue(req, res, previewPipeline) {
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

async function handlePreviewGet(res, storage, componentId) {
  const component = await storage.getComponent(componentId);
  if (!component) {
    return sendJson(res, 404, { error: 'component_not_found' });
  }
  return sendJson(res, 200, {
    componentId: component.id,
    preview: component.preview || null,
  });
}

function registerPreviewRoutes(router, deps) {
  const { storage, previewPipeline } = deps;
  router.add('POST', '/api/previews', (req, res) => handlePreviewEnqueue(req, res, previewPipeline));
  router.add('GET', '/api/previews/jobs', (req, res) => handlePreviewJobs(res, previewPipeline));
  router.add('GET', '/api/previews/jobs/:jobId', (req, res, ctx) =>
    handlePreviewJob(res, previewPipeline, ctx.params.jobId)
  );
  router.add('GET', '/api/previews/:componentId', (req, res, ctx) =>
    handlePreviewGet(res, storage, ctx.params.componentId)
  );
}

module.exports = {
  registerPreviewRoutes,
};
