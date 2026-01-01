#!/usr/bin/env node

const { createStorage } = require('../design-learn-server/src/storage');

async function main() {
  const storage = createStorage({
    dataDir: process.env.DESIGN_LEARN_DATA_DIR || process.env.DATA_DIR,
  });

  try {
    await storage.rebuildIndexes();
    console.log('[rebuild-index] indexes rebuilt');
  } finally {
    storage.close();
  }
}

main().catch((error) => {
  console.error('[rebuild-index] failed:', error);
  process.exit(1);
});
