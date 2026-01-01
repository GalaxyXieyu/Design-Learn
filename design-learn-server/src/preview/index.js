const { EventEmitter } = require('events');
const { randomUUID } = require('crypto');

const DEFAULT_DAILY_LIMIT = Number(process.env.PREVIEW_DAILY_LIMIT || 100);
const DEFAULT_MAX_ATTEMPTS = Number(process.env.PREVIEW_MAX_ATTEMPTS || 3);
const DEFAULT_RETRY_DELAY_MS = Number(process.env.PREVIEW_RETRY_DELAY_MS || 500);

function getDayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function escapeXml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createPreviewPipeline({ storage }) {
  const emitter = new EventEmitter();
  const jobs = new Map();
  const queue = [];
  let running = false;
  let closed = false;
  let quota = { day: getDayStamp(), count: 0 };

  function toPublicJob(job) {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: job.result || null,
      error: job.error || null,
      payload: {
        componentId: job.payload.componentId,
      },
    };
  }

  function emitProgress(job, event, detail) {
    job.updatedAt = new Date().toISOString();
    emitter.emit('progress', {
      job: toPublicJob(job),
      event,
      detail: detail || null,
    });
  }

  function enqueuePreview(payload) {
    if (closed) {
      throw new Error('preview_pipeline_closed');
    }
    if (!payload || !payload.componentId) {
      throw new Error('component_id_required');
    }

    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      type: 'preview_generate',
      status: 'queued',
      attempts: 0,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      createdAt: now,
      updatedAt: now,
      payload,
      result: null,
      error: null,
    };
    jobs.set(job.id, job);
    queue.push(job.id);
    emitProgress(job, 'queued');
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

  function updateQuota() {
    const today = getDayStamp();
    if (quota.day !== today) {
      quota = { day: today, count: 0 };
    }
    return quota;
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

      const currentQuota = updateQuota();
      if (currentQuota.count >= DEFAULT_DAILY_LIMIT) {
        job.status = 'failed';
        job.error = { message: 'quota_exceeded' };
        emitProgress(job, 'failed', { reason: 'quota_exceeded' });
        continue;
      }

      job.status = 'running';
      job.attempts += 1;
      currentQuota.count += 1;
      emitProgress(job, 'started');

      try {
        const result = await runJob(job);
        job.status = 'completed';
        job.result = result;
        emitProgress(job, 'completed');
      } catch (error) {
        if (job.attempts < job.maxAttempts) {
          job.status = 'queued';
          emitProgress(job, 'retrying', { attempt: job.attempts });
          setTimeout(() => {
            if (!closed) {
              queue.push(job.id);
              processQueue();
            }
          }, DEFAULT_RETRY_DELAY_MS);
        } else {
          job.status = 'failed';
          job.error = { message: error.message };
          emitProgress(job, 'failed');
        }
      }
    }
    running = false;
  }

  async function runJob(job) {
    if (job.type !== 'preview_generate') {
      throw new Error(`unknown_job_type:${job.type}`);
    }
    const component = await storage.getComponent(job.payload.componentId);
    if (!component) {
      throw new Error('component_not_found');
    }
    const preview = buildPreview(component);
    await storage.updateComponentPreview(component.id, preview);
    return { componentId: component.id, preview };
  }

  function buildPreview(component) {
    const label = escapeXml(component.name || component.id || 'component');
    const svg = [
      '<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"180\">',
      '<rect width=\"100%\" height=\"100%\" fill=\"#111827\"/>',
      `<text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"#F9FAFB\" font-size=\"14\">${label}</text>`,
      '</svg>',
    ].join('');
    const imageUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    return {
      provider: 'nanobanana_stub',
      imageUrl,
      generatedAt: new Date().toISOString(),
    };
  }

  function close() {
    closed = true;
    emitter.removeAllListeners();
    queue.length = 0;
  }

  return {
    enqueuePreview,
    listJobs,
    getJob,
    onProgress,
    close,
  };
}

module.exports = {
  createPreviewPipeline,
};
