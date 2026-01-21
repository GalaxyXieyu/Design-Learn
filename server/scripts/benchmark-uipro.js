#!/usr/bin/env node

const { createUipro } = require('../src/uipro');

function parseArgs(argv) {
  const args = {
    iterations: 30,
    limit: 5,
    dataDir: process.env.DESIGN_LEARN_DATA_DIR || '',
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--iterations') {
      args.iterations = Number(argv[i + 1] || 0);
      i += 1;
      continue;
    }
    if (arg === '--limit') {
      args.limit = Number(argv[i + 1] || 0);
      i += 1;
      continue;
    }
    if (arg === '--data-dir') {
      args.dataDir = String(argv[i + 1] || '');
      i += 1;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      args.help = true;
      continue;
    }
  }

  if (!Number.isFinite(args.iterations) || args.iterations < 1) args.iterations = 30;
  if (!Number.isFinite(args.limit) || args.limit < 1) args.limit = 5;

  return args;
}

function printHelp() {
  console.log(`Benchmark UIPro BM25 baseline

Usage:
  node scripts/benchmark-uipro.js [--iterations N] [--limit N] [--data-dir PATH]

Options:
  --iterations <n>  Iterations per case (default: 30)
  --limit <n>       Result limit per query (default: 5)
  --data-dir <p>    DESIGN_LEARN_DATA_DIR override (default: env or ~/.design-learn/data)
  -h, --help        Show help
`);
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function stats(values) {
  if (!values.length) {
    return { min: 0, avg: 0, p95: 0 };
  }
  const min = Math.min(...values);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const p95 = percentile(values, 0.95);
  return { min, avg, p95 };
}

function nowIso() {
  return new Date().toISOString();
}

function msFromHr(startNs, endNs) {
  return Number(endNs - startNs) / 1e6;
}

function runCase({ name, run, warmup, iterations }) {
  if (typeof warmup === 'function') warmup();
  const times = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = process.hrtime.bigint();
    const result = run();
    const end = process.hrtime.bigint();

    if (result && typeof result === 'object' && result.error) {
      const error = result.error;
      const reason = result.reason ? ` (${result.reason})` : '';
      throw new Error(`case_failed:${name}:${error}${reason}`);
    }

    times.push(msFromHr(start, end));
  }

  return { name, iterations, ...stats(times) };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const uipro = createUipro({ dataDir: args.dataDir || undefined });

  const cases = [
    {
      name: 'style/glassmorphism',
      warmup: () => uipro.search({ query: 'glassmorphism', domain: 'style', limit: args.limit }),
      run: () => uipro.search({ query: 'glassmorphism', domain: 'style', limit: args.limit }),
    },
    {
      name: 'prompt/tailwind',
      warmup: () => uipro.search({ query: 'tailwind', domain: 'prompt', limit: args.limit }),
      run: () => uipro.search({ query: 'tailwind', domain: 'prompt', limit: args.limit }),
    },
    {
      name: 'ux/accessibility',
      warmup: () => uipro.search({ query: 'accessibility', domain: 'ux', limit: args.limit }),
      run: () => uipro.search({ query: 'accessibility', domain: 'ux', limit: args.limit }),
    },
    {
      name: 'stack/nextjs-routing',
      warmup: () => uipro.searchStack({ query: 'routing', stack: 'nextjs', limit: args.limit }),
      run: () => uipro.searchStack({ query: 'routing', stack: 'nextjs', limit: args.limit }),
    },
  ];

  const results = cases.map((c) => runCase({ ...c, iterations: args.iterations }));

  const overall = stats(results.flatMap((r) => [r.min, r.avg, r.p95]));

  console.log(
    JSON.stringify(
      {
        ok: true,
        timestamp: nowIso(),
        dataDir: uipro.dataDir,
        iterations: args.iterations,
        limit: args.limit,
        cases: results,
        overall,
      },
      null,
      2
    )
  );
}

main();

