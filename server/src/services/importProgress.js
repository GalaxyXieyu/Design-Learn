function createImportProgress({ storage, extractionPipeline }) {
  const importJobDesignMap = new Map();

  function registerPipelineHandlers() {
    extractionPipeline.onProgress((event) => {
      const designId = importJobDesignMap.get(event.job.id);
      if (!designId) {
        return;
      }

      const now = new Date().toISOString();
      void (async () => {
        const design = await storage.getDesign(designId);
        const meta = design?.metadata || {};
        const aiRequested = !!meta.aiRequested;
        const aiCompleted = meta.processingMessage === 'ai_completed' || meta.aiCompleted;

        const metaPatch = {
          processingStatus: event.event === 'failed' ? 'failed' : event.event === 'completed' ? 'completed' : 'processing',
          processingJobId: event.job.id,
          processingUpdatedAt: now,
        };

        if (event.event === 'failed') {
          metaPatch.processingError = event.job.error?.message || 'unknown_error';
          metaPatch.processingMessage = 'failed';
          metaPatch.processingProgress = 100;
        } else if (event.event === 'completed') {
          metaPatch.processingError = null;
          metaPatch.lastImportAt = now;
          metaPatch.lastImportVersionId = event.job.result?.versionId || null;
          if (aiRequested && !aiCompleted) {
            metaPatch.processingStatus = 'analyzing';
            metaPatch.processingMessage = 'ai_pending';
            metaPatch.processingProgress = 80;
          } else {
            metaPatch.processingMessage = 'completed';
            metaPatch.processingProgress = 100;
          }
        } else {
          metaPatch.processingMessage = event.job.message || 'processing';
          metaPatch.processingProgress = event.job.progress || 0;
        }

        await storage.updateDesign(designId, { metadata: metaPatch });
      })().catch(() => undefined);

      if (event.event === 'failed' || event.event === 'completed') {
        importJobDesignMap.delete(event.job.id);
      }
    });
  }

  function trackImportJob(jobId, designId) {
    importJobDesignMap.set(jobId, designId);
  }

  return {
    registerPipelineHandlers,
    trackImportJob,
  };
}

module.exports = {
  createImportProgress,
};
