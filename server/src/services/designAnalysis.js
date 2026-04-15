async function resolveVersionForAnalysis(storage, { designId, versionId }) {
  if (versionId) {
    const version = await storage.getVersion(versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }
    return version;
  }

  if (!designId) {
    throw new Error('designId or versionId is required');
  }

  const versions = await storage.listVersions(designId);
  if (!versions || versions.length === 0) {
    throw new Error(`No versions found for design: ${designId}`);
  }

  const latest = versions[0];
  const version = await storage.getVersion(latest.id);
  if (!version) {
    throw new Error(`Version not found: ${latest.id}`);
  }
  return version;
}

async function markAnalysisSaved(storage, version, analysisSource) {
  const now = new Date().toISOString();
  await storage.updateDesign(version.designId, {
    stats: {
      lastAnalyzedAt: now,
    },
    metadata: {
      aiRequested: true,
      aiCompleted: true,
      processingStatus: 'completed',
      processingMessage: 'ai_completed',
      processingProgress: 100,
      processingError: null,
      processingUpdatedAt: now,
      lastImportVersionId: version.id,
      ...(analysisSource ? { lastAnalysisSource: analysisSource } : {}),
    },
  });
}

async function saveDesignAnalysis(storage, { versionId, designId, styleguideMarkdown, rules, analysisSource }) {
  const version = await resolveVersionForAnalysis(storage, { designId, versionId });
  const updatedVersion = await storage.updateVersion(version.id, {
    styleguideMarkdown,
    ...(rules !== undefined ? { rules } : {}),
  });
  await markAnalysisSaved(storage, version, analysisSource || 'mcp');

  return {
    designId: version.designId,
    versionId: version.id,
    styleguideSaved: Boolean(updatedVersion?.styleguideMarkdown),
    rulesSaved: rules !== undefined,
    analysisSource: analysisSource || 'mcp',
  };
}

module.exports = {
  resolveVersionForAnalysis,
  saveDesignAnalysis,
};
