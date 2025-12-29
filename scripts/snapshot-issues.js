const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { source: '', outDir: 'issues' };
  for (let i = 2; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--source' && argv[i + 1]) {
      args.source = argv[i + 1];
      i += 1;
      continue;
    }
    if (value === '--out-dir' && argv[i + 1]) {
      args.outDir = argv[i + 1];
      i += 1;
      continue;
    }
  }
  return args;
}

function buildTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${date}_${time}`;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.source) {
    console.error('Usage: node scripts/snapshot-issues.js --source <issues.csv> [--out-dir issues]');
    process.exit(1);
  }

  const sourcePath = path.resolve(args.source);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const fileName = `${buildTimestamp()}-${baseName}.csv`;
  const targetPath = path.join(outDir, fileName);

  const data = fs.readFileSync(sourcePath);
  fs.writeFileSync(targetPath, data);

  console.log(`Snapshot created: ${targetPath}`);
}

main();
