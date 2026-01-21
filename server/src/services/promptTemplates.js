const { PROMPT_TEMPLATE_DEFAULT_TYPE, getPromptTemplateDefault } = require('../promptTemplates');

function normalizePromptTemplateInput(body) {
  return {
    name: body.name,
    type: body.type,
    content: body.content,
    description: body.description,
    isActive: body.isActive ?? body.active ?? body.is_active,
    isDefault: body.isDefault ?? body.default ?? body.is_default,
    metadata: body.metadata,
  };
}

function normalizePromptTemplatePatch(body) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    patch.name = body.name;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'type')) {
    patch.type = body.type;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'content')) {
    patch.content = body.content;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    patch.description = body.description;
  }
  if (
    Object.prototype.hasOwnProperty.call(body, 'isActive') ||
    Object.prototype.hasOwnProperty.call(body, 'active') ||
    Object.prototype.hasOwnProperty.call(body, 'is_active')
  ) {
    patch.isActive = body.isActive ?? body.active ?? body.is_active;
  }
  if (
    Object.prototype.hasOwnProperty.call(body, 'isDefault') ||
    Object.prototype.hasOwnProperty.call(body, 'default') ||
    Object.prototype.hasOwnProperty.call(body, 'is_default')
  ) {
    patch.isDefault = body.isDefault ?? body.default ?? body.is_default;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'metadata')) {
    patch.metadata = body.metadata;
  }
  return patch;
}

async function ensurePromptTemplateDefault(storage, type) {
  const resolvedType = type || PROMPT_TEMPLATE_DEFAULT_TYPE;
  if (!resolvedType) {
    return;
  }

  let templates = storage.listPromptTemplates({ type: resolvedType });
  const builtIn = getPromptTemplateDefault(resolvedType);
  if (builtIn) {
    const builtInTemplate = templates.find((template) =>
      template?.metadata?.system === true || template?.name === builtIn.name
    );
    if (!builtInTemplate) {
      await storage.createPromptTemplate({ ...builtIn, isDefault: templates.length === 0 });
      templates = storage.listPromptTemplates({ type: resolvedType });
    } else if (!builtInTemplate?.metadata?.system) {
      await storage.updatePromptTemplate(builtInTemplate.id, {
        metadata: { ...(builtInTemplate.metadata || {}), system: true },
      });
      templates = storage.listPromptTemplates({ type: resolvedType });
    }
  }

  if (!templates.length) {
    return;
  }

  const hasDefault = templates.some((template) => template.isDefault);
  if (!hasDefault) {
    await storage.setPromptTemplateDefault(templates[0].id);
  }
}

module.exports = {
  ensurePromptTemplateDefault,
  normalizePromptTemplateInput,
  normalizePromptTemplatePatch,
};
