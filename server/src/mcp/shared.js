const { z } = require('zod');
const { resolveVersionForAnalysis, saveDesignAnalysis } = require('../services/designAnalysis');

const DEFAULT_SNAPSHOT_LIMIT = 3;
const DEFAULT_HTML_LIMIT = 16000;
const DEFAULT_CSS_LIMIT = 12000;
const DEFAULT_IMPORT_TIMEOUT_MS = 120000;
const MAX_SNAPSHOT_LIMIT = 10;
const MAX_CONTENT_LIMIT = 200000;
const MAX_IMPORT_TIMEOUT_MS = 300000;

const tools = {
  list_designs: {
    title: '查看 UI 参考模板',
    description: '列出你收集的所有 UI 参考模板。比如："列出我的 UI 参考"、"显示所有捕获的页面"',
    inputSchema: {
      limit: z.number().min(1).max(100).optional(),
    },
  },
  search_designs: {
    title: '搜索 UI 参考模板',
    description: '在 UI 参考模板中搜索。比如："搜索包含登录按钮的 UI"、"找找那个蓝色的页面 UI"',
    inputSchema: {
      query: z.string(),
      limit: z.number().min(1).max(100).optional(),
    },
  },
  search_library: {
    title: '搜索 UI 规范和代码模板',
    description:
      '搜索 UI 设计规范、组件代码模板、配色方案、字体搭配等。' +
      '比如："React Button 组件代码"、"深色主题配色"、"登录表单最佳实践"、"卡片布局样式"。' +
      '会自动检测搜索类型，也可以指定 stack（如 react、vue、html-tailwind）来获取对应技术栈的实现代码。',
    inputSchema: {
      query: z.string().min(1),
      sources: z.array(z.enum(['designs', 'uipro', 'uipro_stack'])).optional(),
      domain: z
        .union([
          z.literal('auto'),
          z.enum(['style', 'prompt', 'color', 'chart', 'landing', 'product', 'ux', 'typography', 'icons']),
        ])
        .optional(),
      stack: z.string().min(1).optional(),
      limit: z.number().min(1).max(50).optional(),
      designLimit: z.number().min(1).max(100).optional(),
    },
  },
  get_design: {
    title: '查看 UI 参考详情',
    description:
      '查看某个 UI 参考的最新设计规范文档。比如："获取 design_xxx 的代码实现"、"看看这个页面的样式指南"',
    inputSchema: {
      designId: z.string(),
    },
  },
  list_versions: {
    title: '查看设计版本列表',
    description: '列出某个 design 的所有版本，便于后续读取快照或保存分析结果。',
    inputSchema: {
      designId: z.string(),
    },
  },
  get_version: {
    title: '读取设计版本内容',
    description:
      '读取 design 的某个版本内容，可返回 snapshots、HTML/CSS 截断内容、已有 styleguide 和 rules。' +
      '传 versionId 可精确读取；只传 designId 时默认返回最新版本。',
    inputSchema: {
      versionId: z.string().optional(),
      designId: z.string().optional(),
      snapshotLimit: z.number().min(1).max(MAX_SNAPSHOT_LIMIT).optional(),
      htmlLimit: z.number().min(0).max(MAX_CONTENT_LIMIT).optional(),
      cssLimit: z.number().min(0).max(MAX_CONTENT_LIMIT).optional(),
      includeSnapshots: z.boolean().optional(),
    },
  },
  save_design_analysis: {
    title: '保存设计分析结果',
    description:
      '把当前模型生成的设计分析结果写回本地库，保存到 styleguideMarkdown / rules，并更新 design 的分析状态。',
    inputSchema: {
      versionId: z.string().optional(),
      designId: z.string().optional(),
      styleguideMarkdown: z.string().min(1),
      rules: z.record(z.any()).optional(),
      analysisSource: z.string().optional(),
    },
  },
  import_design: {
    title: '从网址导入 UI 参考',
    description:
      '输入一个网址，提取页面 UI 并生成参考代码。支持 waitForCompletion=true 直接等待导入完成并返回 designId/versionId。',
    inputSchema: {
      url: z.string().url(),
      useAI: z.boolean().optional(),
      designId: z.string().optional(),
      waitForCompletion: z.boolean().optional(),
      timeoutMs: z.number().min(1000).max(MAX_IMPORT_TIMEOUT_MS).optional(),
    },
  },
};

const prompts = {
  analyze_design: {
    title: 'Analyze Design',
    description: 'Summarize design metadata for review.',
    argsSchema: {
      designId: z.string(),
    },
  },
};

function createJsonResult(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function createTextResult(text, structuredContent) {
  const result = {
    content: [{ type: 'text', text }],
  };
  if (structuredContent !== undefined) {
    result.structuredContent = structuredContent;
  }
  return result;
}

async function matchDesigns(storage, query) {
  const needle = query.toLowerCase();
  const designs = await storage.listDesigns();
  return designs.filter((design) => {
    const tags = Array.isArray(design.metadata?.tags) ? design.metadata.tags.join(' ') : '';
    const haystack = [design.name, design.url, design.description, design.category, tags]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

function trimContent(text, limit) {
  const source = typeof text === 'string' ? text : '';
  if (limit === 0 || source.length <= limit) {
    return {
      text: source,
      originalLength: source.length,
      truncated: false,
    };
  }

  return {
    text: source.slice(0, limit),
    originalLength: source.length,
    truncated: true,
  };
}

function normalizeSnapshotForAnalysis(snapshot, { htmlLimit, cssLimit }) {
  const html = trimContent(snapshot?.html, htmlLimit);
  const css = trimContent(snapshot?.css, cssLimit);
  return {
    title: snapshot?.title || '',
    url: snapshot?.url || '',
    html: html.text,
    css: css.text,
    htmlOriginalLength: html.originalLength,
    cssOriginalLength: css.originalLength,
    htmlTruncated: html.truncated,
    cssTruncated: css.truncated,
    metadata: snapshot?.metadata || {},
    extractedAt: snapshot?.extractedAt || null,
  };
}

function buildVersionPayload(version, options = {}) {
  const includeSnapshots = options.includeSnapshots !== false;
  const snapshotLimit = options.snapshotLimit || DEFAULT_SNAPSHOT_LIMIT;
  const htmlLimit = options.htmlLimit ?? DEFAULT_HTML_LIMIT;
  const cssLimit = options.cssLimit ?? DEFAULT_CSS_LIMIT;
  const rawSnapshots = Array.isArray(version.snapshots) ? version.snapshots : [];

  return {
    id: version.id,
    designId: version.designId,
    versionNumber: version.versionNumber,
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    styleguideMarkdown: version.styleguideMarkdown || '',
    rules: version.rules || {},
    snapshotCount: rawSnapshots.length,
    snapshotLimit,
    htmlLimit,
    cssLimit,
    snapshots: includeSnapshots
      ? rawSnapshots.slice(0, snapshotLimit).map((snapshot) => normalizeSnapshotForAnalysis(snapshot, { htmlLimit, cssLimit }))
      : [],
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPipelineJob(extractionPipeline, jobId, timeoutMs = DEFAULT_IMPORT_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = extractionPipeline.getJob(jobId);
    if (!job) {
      throw new Error(`Import job not found: ${jobId}`);
    }
    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }
    await delay(500);
  }
  throw new Error(`Import job timeout after ${timeoutMs}ms`);
}

async function defaultImportDesign({ url, useAI, designId, waitForCompletion, timeoutMs }, { extractionPipeline }) {
  if (!extractionPipeline) {
    throw new Error('extraction_pipeline_unavailable');
  }

  const job = extractionPipeline.enqueueImportFromUrl({
    url,
    designId,
    options: { useAI: useAI === true },
  });

  if (!waitForCompletion) {
    return {
      jobId: job.id,
      designId: designId || null,
      status: job.status,
      waited: false,
    };
  }

  const finalJob = await waitForPipelineJob(extractionPipeline, job.id, timeoutMs);
  return {
    jobId: finalJob.id,
    designId: finalJob.result?.designId || designId || null,
    versionId: finalJob.result?.versionId || null,
    status: finalJob.status,
    message: finalJob.message,
    waited: true,
    error: finalJob.error?.message || null,
  };
}

function createToolHandlers({ storage, uipro, extractionPipeline, importDesign, saveAnalysis }) {
  const importRunner =
    typeof importDesign === 'function'
      ? (args) => importDesign(args, { storage, uipro, extractionPipeline })
      : (args) => defaultImportDesign(args, { storage, extractionPipeline });
  const saveAnalysisRunner =
    typeof saveAnalysis === 'function'
      ? (args) => saveAnalysis(args, { storage, uipro, extractionPipeline })
      : (args) => saveDesignAnalysis(storage, args);

  return {
    list_designs: async ({ limit }) => {
      const designs = await storage.listDesigns();
      const data = typeof limit === 'number' ? designs.slice(0, limit) : designs;
      return createJsonResult({ designs: data });
    },
    search_designs: async ({ query, limit }) => {
      const matches = await matchDesigns(storage, query);
      const data = typeof limit === 'number' ? matches.slice(0, limit) : matches;
      return createJsonResult({ designs: data });
    },
    search_library: async ({ query, sources, domain, stack, limit, designLimit }) => {
      const effectiveSources = Array.isArray(sources) && sources.length > 0 ? sources : ['designs', 'uipro'];
      let designs = [];
      if (effectiveSources.includes('designs')) {
        const matches = await matchDesigns(storage, query);
        const max = typeof designLimit === 'number' ? designLimit : typeof limit === 'number' ? limit : undefined;
        designs = typeof max === 'number' ? matches.slice(0, max) : matches;
      }

      const resolvedDomain = domain === 'auto' ? undefined : domain;
      const maxUipro = typeof limit === 'number' ? limit : 10;

      let uiproResult = null;
      if (effectiveSources.includes('uipro')) {
        try {
          uiproResult = uipro.search({ query, domain: resolvedDomain, limit: maxUipro });
        } catch {
          uiproResult = {
            error: 'uipro_data_unavailable',
            hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
          };
        }
      }

      let uiproStackResult = null;
      if (effectiveSources.includes('uipro_stack') && typeof stack === 'string' && stack.trim()) {
        try {
          uiproStackResult = uipro.searchStack({ query, stack: stack.trim(), limit: maxUipro });
        } catch {
          uiproStackResult = {
            error: 'uipro_data_unavailable',
            hint: 'Check DESIGN_LEARN_UIPRO_DATA_DIR or built-in dataset integrity.',
          };
        }
      }

      const items = [];
      for (const design of designs) {
        items.push({
          source: 'design',
          id: design.id,
          name: design.name,
          url: design.url,
          updatedAt: design.updatedAt || design.createdAt || null,
        });
      }
      if (uiproResult && !uiproResult.error && Array.isArray(uiproResult.results)) {
        uiproResult.results.forEach((row) => items.push({ source: 'uipro', domain: uiproResult.domain, row }));
      }
      if (uiproStackResult && !uiproStackResult.error && Array.isArray(uiproStackResult.results)) {
        uiproStackResult.results.forEach((row) =>
          items.push({ source: 'uipro_stack', stack: uiproStackResult.stack, row })
        );
      }

      return createJsonResult({
        query,
        sources: effectiveSources,
        domains: uipro.domains,
        stacks: uipro.stacks,
        designs,
        uipro: uiproResult,
        uiproStack: uiproStackResult,
        items,
      });
    },
    get_design: async ({ designId }) => {
      const versions = await storage.listVersions(designId);
      if (!versions || versions.length === 0) {
        return createTextResult(`No versions found for design: ${designId}`);
      }
      const latest = versions[0];
      const version = await storage.getVersion(latest.id);
      if (!version) {
        return createTextResult(`Version not found: ${latest.id}`);
      }
      const markdown = version.styleguideMarkdown || '';
      if (!markdown) {
        return createTextResult(
          `Styleguide is empty for design: ${designId}`,
          { designId, versionId: latest.id, markdown: '', hasStyleguide: false }
        );
      }
      return createTextResult(markdown, { designId, versionId: latest.id, markdown, hasStyleguide: true });
    },
    list_versions: async ({ designId }) => {
      const versions = await storage.listVersions(designId);
      return createJsonResult({ designId, versions });
    },
    get_version: async ({ versionId, designId, snapshotLimit, htmlLimit, cssLimit, includeSnapshots }) => {
      try {
        const version = await resolveVersionForAnalysis(storage, { designId, versionId });
        const payload = buildVersionPayload(version, {
          snapshotLimit,
          htmlLimit,
          cssLimit,
          includeSnapshots,
        });
        return createJsonResult(payload);
      } catch (error) {
        return createTextResult(error.message);
      }
    },
    save_design_analysis: async ({ versionId, designId, styleguideMarkdown, rules, analysisSource }) => {
      try {
        const result = await saveAnalysisRunner({
          versionId,
          designId,
          styleguideMarkdown,
          rules,
          analysisSource,
        });
        return createJsonResult(result);
      } catch (error) {
        return createTextResult(error.message);
      }
    },
    import_design: async ({ url, useAI, designId, waitForCompletion, timeoutMs }) => {
      try {
        const result = await importRunner({
          url,
          useAI,
          designId,
          waitForCompletion: waitForCompletion === true,
          timeoutMs: timeoutMs || DEFAULT_IMPORT_TIMEOUT_MS,
        });
        return createJsonResult(result);
      } catch (error) {
        return createJsonResult({ error: error.message });
      }
    },
  };
}

function createAnalyzePrompt({ designId }) {
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Analyze design metadata for ID: ${designId}. Summarize key traits and risks.`,
        },
      },
    ],
  };
}

module.exports = {
  tools,
  prompts,
  createToolHandlers,
  createAnalyzePrompt,
  waitForPipelineJob,
};
