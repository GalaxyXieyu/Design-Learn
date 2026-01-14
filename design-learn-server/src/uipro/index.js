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
    return { file, filePath, records, bm25 };
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
    const scored = entry.bm25.score(query);
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

    return {
      source: 'ui-ux-pro-max',
      domain: resolvedDomain,
      query,
      file: entry.file,
      count: results.length,
      results,
    };
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
    const scored = entry.bm25.score(query);
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

  return {
    dataDir,
    domains: AVAILABLE_DOMAINS,
    stacks: AVAILABLE_STACKS,
    search,
    searchStack,
  };
}

module.exports = {
  createUipro,
};
