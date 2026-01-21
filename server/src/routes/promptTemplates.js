const { sendJson, sendNoContent } = require('../http/response');
const {
  readJsonBody,
  parseOptionalBoolean,
  parseLimitOffsetStrict,
  paginate,
} = require('../http/request');
const {
  ensurePromptTemplateDefault,
  normalizePromptTemplateInput,
  normalizePromptTemplatePatch,
} = require('../services/promptTemplates');

async function handlePromptTemplatesList(res, url, storage) {
  const type = url.searchParams.get('type') || undefined;
  const activeParam =
    url.searchParams.get('active') ??
    url.searchParams.get('isActive') ??
    url.searchParams.get('is_active');
  const defaultParam =
    url.searchParams.get('default') ??
    url.searchParams.get('isDefault') ??
    url.searchParams.get('is_default');

  const isActive = parseOptionalBoolean(activeParam);
  if (activeParam !== null && isActive === null) {
    return sendJson(res, 400, { error: 'invalid_active' });
  }
  const isDefault = parseOptionalBoolean(defaultParam);
  if (defaultParam !== null && isDefault === null) {
    return sendJson(res, 400, { error: 'invalid_default' });
  }

  const pagination = parseLimitOffsetStrict(url);
  if (pagination.error) {
    return sendJson(res, 400, { error: pagination.error });
  }
  const { limit, offset } = pagination;

  await ensurePromptTemplateDefault(storage, type);
  const templates = storage.listPromptTemplates({ type, isActive, isDefault });
  const { items, total } = paginate(templates, limit, offset);
  return sendJson(res, 200, { items, limit, offset, total });
}

async function handlePromptTemplateCreate(req, res, storage) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { error: 'invalid_payload' });
  }

  try {
    const template = await storage.createPromptTemplate(normalizePromptTemplateInput(body));
    return sendJson(res, 201, template);
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }
}

async function handlePromptTemplateGet(res, storage, templateId) {
  const template = await storage.getPromptTemplate(templateId);
  if (!template) {
    return sendJson(res, 404, { error: 'prompt_template_not_found' });
  }
  return sendJson(res, 200, template);
}

async function handlePromptTemplatePatch(req, res, storage, templateId) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }
  if (typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { error: 'invalid_payload' });
  }
  if (!Object.keys(body).length) {
    return sendJson(res, 400, { error: 'empty_patch' });
  }

  try {
    const template = await storage.updatePromptTemplate(templateId, normalizePromptTemplatePatch(body));
    if (!template) {
      return sendJson(res, 404, { error: 'prompt_template_not_found' });
    }
    return sendJson(res, 200, template);
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }
}

async function handlePromptTemplateDelete(res, storage, templateId) {
  const template = storage.getPromptTemplate(templateId);

  if (template?.metadata?.system === true) {
    return sendJson(res, 403, {
      error: 'cannot_delete_system_template',
      message: '系统模板不能删除',
    });
  }

  const removed = await storage.deletePromptTemplate(templateId);
  if (!removed) {
    return sendJson(res, 404, { error: 'prompt_template_not_found' });
  }
  await ensurePromptTemplateDefault(storage, removed.type);
  return sendNoContent(res);
}

function registerPromptTemplateRoutes(router, deps) {
  const { storage } = deps;

  router.add('GET', '/api/prompt-templates', (req, res, ctx) =>
    handlePromptTemplatesList(res, ctx.url, storage)
  );
  router.add('POST', '/api/prompt-templates', (req, res) => handlePromptTemplateCreate(req, res, storage));
  router.add('GET', '/api/prompt-templates/:templateId', (req, res, ctx) =>
    handlePromptTemplateGet(res, storage, ctx.params.templateId)
  );
  router.add('PATCH', '/api/prompt-templates/:templateId', (req, res, ctx) =>
    handlePromptTemplatePatch(req, res, storage, ctx.params.templateId)
  );
  router.add('DELETE', '/api/prompt-templates/:templateId', (req, res, ctx) =>
    handlePromptTemplateDelete(res, storage, ctx.params.templateId)
  );
}

module.exports = {
  registerPromptTemplateRoutes,
};
