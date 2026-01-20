const PROMPT_TEMPLATE_FIELDS = [
  'id',
  'name',
  'type',
  'content',
  'description',
  'isActive',
  'isDefault',
  'metadata',
  'createdAt',
  'updatedAt',
];

const PROMPT_TEMPLATE_LIMITS = {
  name: 100,
  description: 500,
  content: 50000,
};

const PROMPT_TEMPLATE_DEFAULT_TYPE = 'styleguide';

const PROMPT_TEMPLATE_RESOLUTION_ORDER = ['templateId', 'default', 'built-in'];

module.exports = {
  PROMPT_TEMPLATE_FIELDS,
  PROMPT_TEMPLATE_LIMITS,
  PROMPT_TEMPLATE_DEFAULT_TYPE,
  PROMPT_TEMPLATE_RESOLUTION_ORDER,
};
