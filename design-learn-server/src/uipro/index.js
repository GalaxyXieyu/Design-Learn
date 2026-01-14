const fs = require('fs');
const path = require('path');

const { BM25 } = require('./bm25');
const { parseCsvFile } = require('./csv');
const {
  DOMAIN_CONFIG,
  STACK_CONFIG,
  STACK_SEARCH_COLUMNS,
  STACK_OUTPUT_COLUMNS,
  detectDomain,
  AVAILABLE_DOMAINS,
  AVAILABLE_STACKS,
} = require('./config');

function expandQuery(query) {
  const raw = String(query ?? '').trim();
  if (!raw) return '';

  const expansions = [];
  const lower = raw.toLowerCase();

  const synonymPairs = [
    ['仪表盘', 'dashboard analytics admin panel'],
    ['看板', 'dashboard kanban board'],
    ['按钮', 'button cta'],
    ['表单', 'form input validation'],
    ['弹窗', 'modal dialog'],
    ['对话框', 'dialog modal'],
    ['导航', 'navigation navbar sidebar'],
    ['侧边栏', 'sidebar navigation'],
    ['卡片', 'card'],
    ['列表', 'list table'],
    ['表格', 'table grid'],
    ['搜索', 'search autocomplete'],
    ['登录', 'login auth'],
    ['注册', 'signup registration'],
    ['定价', 'pricing'],
    ['落地页', 'landing hero cta'],
    ['排版', 'typography font'],
    ['配色', 'color palette'],
    ['图表', 'chart graph visualization'],
    ['无障碍', 'accessibility wcag'],
  ];

  for (const [needle, expansion] of synonymPairs) {
    if (raw.includes(needle) || lower.includes(needle.toLowerCase())) {
      expansions.push(expansion);
    }
  }

  // 少量“伪语义”扩展：常用英文词补齐同类词
  const englishPairs = [
    ['dashboard', 'analytics admin panel'],
    ['button', 'cta primary secondary'],
    ['modal', 'dialog overlay'],
    ['form', 'input validation error'],
    ['landing', 'hero cta section'],
    ['typography', 'font heading body'],
    ['color', 'palette hex rgb'],
    ['chart', 'graph visualization'],
  ];
  for (const [needle, expansion] of englishPairs) {
    if (lower.includes(needle)) expansions.push(expansion);
  }

  const extra = expansions.join(' ').trim();
  return extra ? `${raw} ${extra}` : raw;
}

function resolveDataDir(options = {}) {
  const override = process.env.DESIGN_LEARN_UIPRO_DATA_DIR;
  if (override) {
    return override;
  }

  const baseDataDir = options.dataDir;
  if (baseDataDir) {
    const candidate = path.join(baseDataDir, 'uipro');
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  return path.join(__dirname, 'data');
}

function normalizeLimit(limit, fallback = 5) {
  if (!Number.isFinite(limit)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), 20);
}

function createUipro(options = {}) {
  const dataDir = resolveDataDir(options);
  const domainCache = new Map();
  const stackCache = new Map();
  const domainSuggestCache = new Map();
  const stackSuggestCache = new Map();

  function loadCsvIndex({ file, searchColumns }) {
    const filePath = path.join(dataDir, file);
    let parsed;
    try {
      parsed = parseCsvFile(filePath);
    } catch {
      return {
        error: 'uipro_data_unavailable',
        reason: 'csv_read_failed',
        file,
      };
    }

    const { headers, records } = parsed || {};
    if (!Array.isArray(headers) || headers.length === 0) {
      return {
        error: 'invalid_csv',
        reason: 'missing_headers',
        file,
      };
    }
    if (!Array.isArray(records) || records.length === 0) {
      return {
        error: 'invalid_csv',
        reason: 'empty_records',
        file,
      };
    }

    const missingColumns = (searchColumns || []).filter((column) => !headers.includes(column));
    if (missingColumns.length > 0) {
      return {
        error: 'invalid_csv',
        reason: 'missing_required_columns',
        file,
        missingColumns,
      };
    }

    const documents = records.map((row) =>
      searchColumns.map((column) => row[column] || '').join(' ')
    );
    const bm25 = new BM25();
    bm25.fit(documents);
    return { file, filePath, records, documents, bm25 };
  }

  function pickKeywordColumnsForDomain(domain) {
    const config = DOMAIN_CONFIG[domain];
    if (!config) return [];
    // 这些列通常包含可用于“推荐/浏览”的关键词
    const candidates = [
      'Keywords',
      'Mood/Style Keywords',
      'Best For',
      'Type',
      'Style Category',
      'Product Type',
      'Pattern Name',
      'Category',
      'Issue',
      'Icon Name',
      'Data Type',
      'AI Prompt Keywords (Copy-Paste Ready)',
      'CSS/Technical Keywords',
    ];
    return candidates.filter((col) => config.searchColumns.includes(col) || config.outputColumns.includes(col));
  }

  function extractTopKeywords(records, columns, limit) {
    const counts = new Map();
    const max = normalizeLimit(limit, 20);

    const normalizePiece = (value) =>
      String(value ?? '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s,/-]+/gu, ' ')
        .trim();

    const bump = (token) => {
      const t = String(token ?? '').trim();
      if (!t) return;
      // 太短的词大多没信息量，但保留 ui/ux/cta
      if (t.length < 2) return;
      if (t.length === 2 && !['ui', 'ux'].includes(t)) return;
      counts.set(t, (counts.get(t) || 0) + 1);
    };

    for (const row of records) {
      for (const col of columns) {
        const raw = normalizePiece(row?.[col]);
        if (!raw) continue;
        // 兼容 “a, b, c” 或 “a / b” 这种分隔
        const parts = raw
          .split(/[,\n/]+/g)
          .map((p) => p.trim())
          .filter(Boolean);
        for (const part of parts) {
          // 再按空格拆，得到更细的 token（BM25 里也会拆）
          const words = part.split(/\s+/).filter(Boolean);
          if (words.length <= 1) {
            bump(part);
          } else {
            for (const w of words) bump(w);
          }
        }
      }
    }

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, max).map(([token]) => token);
  }

  function getDomainIndex(domain) {
    const cached = domainCache.get(domain);
    if (cached) {
      return cached;
    }
    const config = DOMAIN_CONFIG[domain];
    if (!config) {
      return null;
    }
    const index = loadCsvIndex({ file: config.file, searchColumns: config.searchColumns });
    const entry = { ...index, config };
    domainCache.set(domain, entry);
    return entry;
  }

  function getStackIndex(stack) {
    const cached = stackCache.get(stack);
    if (cached) {
      return cached;
    }
    const config = STACK_CONFIG[stack];
    if (!config) {
      return null;
    }
    const index = loadCsvIndex({ file: config.file, searchColumns: STACK_SEARCH_COLUMNS });
    const entry = { ...index, stack };
    stackCache.set(stack, entry);
    return entry;
  }

  function search({ query, domain, limit } = {}) {
    if (typeof query !== 'string' || query.trim() === '') {
      return { error: 'missing_query' };
    }

    const resolvedDomain = domain || detectDomain(query);
    const entry = getDomainIndex(resolvedDomain);
    if (!entry) {
      return {
        error: `unknown_domain:${resolvedDomain}`,
        availableDomains: AVAILABLE_DOMAINS,
      };
    }
    if (entry.error) {
      const errorResult = {
        error: entry.error,
        reason: entry.reason,
        domain: resolvedDomain,
        file: entry.file,
      };
      if (Array.isArray(entry.missingColumns) && entry.missingColumns.length > 0) {
        errorResult.missingColumns = entry.missingColumns;
      }
      return errorResult;
    }

    const maxResults = normalizeLimit(limit, 5);
    const effectiveQuery = expandQuery(query);
    const scored = entry.bm25.score(effectiveQuery);
    const results = [];
    for (const [rowIndex, score] of scored) {
      if (score <= 0) {
        continue;
      }
      const row = entry.records[rowIndex];
      const output = {};
      for (const col of entry.config.outputColumns) {
        if (col in row) {
          output[col] = row[col];
        }
      }
      output._score = Number(score.toFixed(4));
      results.push(output);
      if (results.length >= maxResults) {
        break;
      }
    }

    // 兜底：BM25 没命中时做轻量 contains 匹配（提升可用性，不追求严格语义）
    if (results.length === 0) {
      const normalize = (value) =>
        String(value ?? '')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
          .trim();
      const q = normalize(effectiveQuery);
      const qTokens = q.split(/\s+/).filter((t) => t.length >= 2).slice(0, 6);

      if (qTokens.length > 0 && Array.isArray(entry.documents)) {
        for (let rowIndex = 0; rowIndex < entry.documents.length; rowIndex += 1) {
          const doc = normalize(entry.documents[rowIndex]);
          if (!doc) continue;
          const hit = qTokens.some((t) => doc.includes(t));
          if (!hit) continue;

          const row = entry.records[rowIndex];
          const output = {};
          for (const col of entry.config.outputColumns) {
            if (col in row) output[col] = row[col];
          }
          output._score = 0.0001;
          results.push(output);
          if (results.length >= maxResults) break;
        }
      }
    }

    return {
      source: 'ui-ux-pro-max',
      domain: resolvedDomain,
      query,
      file: entry.file,
      count: results.length,
      results,
      ...(results.length === 0 && domain
        ? (() => {
            const detected = detectDomain(query);
            if (detected && detected !== resolvedDomain) {
              return { hint: `当前 domain=${resolvedDomain} 无结果，试试 domain=${detected} 或切回 auto` };
            }
            return {};
          })()
        : {}),
    };
  }

  function browse({ domain, limit, offset } = {}) {
    const resolvedDomain = domain || 'style';
    const entry = getDomainIndex(resolvedDomain);
    if (!entry) {
      return { error: `unknown_domain:${resolvedDomain}`, availableDomains: AVAILABLE_DOMAINS };
    }
    if (entry.error) {
      return {
        error: entry.error,
        reason: entry.reason,
        domain: resolvedDomain,
        file: entry.file,
      };
    }

    const maxResults = normalizeLimit(limit, 20);
    const start = Math.max(Number.isFinite(offset) ? Math.trunc(offset) : 0, 0);
    const end = Math.min(start + maxResults, entry.records.length);
    const rows = entry.records.slice(start, end);
    const items = rows.map((row) => {
      const output = {};
      for (const col of entry.config.outputColumns) {
        if (col in row) output[col] = row[col];
      }
      return output;
    });

    return {
      source: 'ui-ux-pro-max',
      domain: resolvedDomain,
      file: entry.file,
      total: entry.records.length,
      offset: start,
      count: items.length,
      results: items,
    };
  }

  function suggest({ domain, limit } = {}) {
    const resolvedDomain = domain || 'style';
    const cached = domainSuggestCache.get(resolvedDomain);
    if (cached && typeof cached === 'object') return cached;

    const entry = getDomainIndex(resolvedDomain);
    if (!entry) {
      return { error: `unknown_domain:${resolvedDomain}`, availableDomains: AVAILABLE_DOMAINS };
    }
    if (entry.error) {
      return {
        error: entry.error,
        reason: entry.reason,
        domain: resolvedDomain,
        file: entry.file,
      };
    }

    const columns = pickKeywordColumnsForDomain(resolvedDomain);
    const keywords = extractTopKeywords(entry.records, columns, limit);
    const result = {
      source: 'ui-ux-pro-max',
      domain: resolvedDomain,
      file: entry.file,
      keywords,
      count: keywords.length,
    };
    domainSuggestCache.set(resolvedDomain, result);
    return result;
  }

  function searchStack({ query, stack, limit } = {}) {
    if (typeof query !== 'string' || query.trim() === '') {
      return { error: 'missing_query' };
    }
    if (typeof stack !== 'string' || stack.trim() === '') {
      return { error: 'missing_stack', availableStacks: AVAILABLE_STACKS };
    }

    const entry = getStackIndex(stack);
    if (!entry) {
      return { error: `unknown_stack:${stack}`, availableStacks: AVAILABLE_STACKS };
    }
    if (entry.error) {
      const errorResult = {
        error: entry.error,
        reason: entry.reason,
        stack,
        file: entry.file,
      };
      if (Array.isArray(entry.missingColumns) && entry.missingColumns.length > 0) {
        errorResult.missingColumns = entry.missingColumns;
      }
      return errorResult;
    }

    const maxResults = normalizeLimit(limit, 5);
    const effectiveQuery = expandQuery(query);
    const scored = entry.bm25.score(effectiveQuery);
    const results = [];
    for (const [rowIndex, score] of scored) {
      if (score <= 0) {
        continue;
      }
      const row = entry.records[rowIndex];
      const output = {};
      for (const col of STACK_OUTPUT_COLUMNS) {
        if (col in row) {
          output[col] = row[col];
        }
      }
      output._score = Number(score.toFixed(4));
      results.push(output);
      if (results.length >= maxResults) {
        break;
      }
    }

    if (results.length === 0) {
      const normalize = (value) =>
        String(value ?? '')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
          .trim();
      const q = normalize(effectiveQuery);
      const qTokens = q.split(/\s+/).filter((t) => t.length >= 2).slice(0, 6);

      if (qTokens.length > 0 && Array.isArray(entry.documents)) {
        for (let rowIndex = 0; rowIndex < entry.documents.length; rowIndex += 1) {
          const doc = normalize(entry.documents[rowIndex]);
          if (!doc) continue;
          const hit = qTokens.some((t) => doc.includes(t));
          if (!hit) continue;

          const row = entry.records[rowIndex];
          const output = {};
          for (const col of STACK_OUTPUT_COLUMNS) {
            if (col in row) output[col] = row[col];
          }
          output._score = 0.0001;
          results.push(output);
          if (results.length >= maxResults) break;
        }
      }
    }

    return {
      source: 'ui-ux-pro-max',
      domain: 'stack',
      stack,
      query,
      file: entry.file,
      count: results.length,
      results,
    };
  }

  function browseStack({ stack, limit, offset } = {}) {
    if (typeof stack !== 'string' || stack.trim() === '') {
      return { error: 'missing_stack', availableStacks: AVAILABLE_STACKS };
    }
    const entry = getStackIndex(stack);
    if (!entry) {
      return { error: `unknown_stack:${stack}`, availableStacks: AVAILABLE_STACKS };
    }
    if (entry.error) {
      return { error: entry.error, reason: entry.reason, stack, file: entry.file };
    }

    const maxResults = normalizeLimit(limit, 20);
    const start = Math.max(Number.isFinite(offset) ? Math.trunc(offset) : 0, 0);
    const end = Math.min(start + maxResults, entry.records.length);
    const rows = entry.records.slice(start, end);
    const items = rows.map((row) => {
      const output = {};
      for (const col of STACK_OUTPUT_COLUMNS) {
        if (col in row) output[col] = row[col];
      }
      return output;
    });

    return {
      source: 'ui-ux-pro-max',
      domain: 'stack',
      stack,
      file: entry.file,
      total: entry.records.length,
      offset: start,
      count: items.length,
      results: items,
    };
  }

  function suggestStack({ stack, limit } = {}) {
    if (typeof stack !== 'string' || stack.trim() === '') {
      return { error: 'missing_stack', availableStacks: AVAILABLE_STACKS };
    }

    const cacheKey = `${stack}::${limit ?? ''}`;
    const cached = stackSuggestCache.get(cacheKey);
    if (cached && typeof cached === 'object') return cached;

    const entry = getStackIndex(stack);
    if (!entry) {
      return { error: `unknown_stack:${stack}`, availableStacks: AVAILABLE_STACKS };
    }
    if (entry.error) {
      return { error: entry.error, reason: entry.reason, stack, file: entry.file };
    }

    const keywords = extractTopKeywords(entry.records, STACK_SEARCH_COLUMNS, limit);
    const result = {
      source: 'ui-ux-pro-max',
      domain: 'stack',
      stack,
      file: entry.file,
      keywords,
      count: keywords.length,
    };
    stackSuggestCache.set(cacheKey, result);
    return result;
  }

  return {
    dataDir,
    domains: AVAILABLE_DOMAINS,
    stacks: AVAILABLE_STACKS,
    search,
    browse,
    suggest,
    searchStack,
    browseStack,
    suggestStack,
  };
}

module.exports = {
  createUipro,
};
