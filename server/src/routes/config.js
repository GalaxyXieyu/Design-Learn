const { getConfigPath } = require('../storage/paths');
const { readJson, writeJson } = require('../storage/fileStore');
const { readJsonBody } = require('../http/request');
const { sendJson } = require('../http/response');

const DEFAULT_CONFIG = {
  model: {
    name: '',
    version: '',
    provider: '',
  },
  aiModels: [],
  selectedModelId: '',
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

async function loadConfig(storage) {
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
  const aiModels = Array.isArray(input?.aiModels) ? input.aiModels : [];
  const selectedModelId = typeof input?.selectedModelId === 'string' ? input.selectedModelId : '';
  return {
    model: {
      ...DEFAULT_CONFIG.model,
      ...model,
    },
    aiModels,
    selectedModelId,
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

async function handleConfigGet(res, storage) {
  const config = await loadConfig(storage);
  sendJson(res, 200, config);
}

async function handleConfigPut(req, res, storage) {
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

function registerConfigRoutes(router, deps) {
  const { storage } = deps;
  router.add('GET', '/api/config', (req, res) => handleConfigGet(res, storage));
  router.add('PUT', '/api/config', (req, res) => handleConfigPut(req, res, storage));
}

module.exports = {
  registerConfigRoutes,
};
