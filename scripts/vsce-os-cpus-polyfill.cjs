// Codex sandbox: Node.js `os.cpus()` may return empty array, which breaks
// secretlint's p-map concurrency validation (expects >= 1).
//
// This file is intentionally outside `vscode-extension/` so it won't be
// packaged into the VSIX.
const os = require('os');

if (Array.isArray(os.cpus()) && os.cpus().length === 0) {
  const realCpus = os.cpus;
  os.cpus = () => {
    const cpus = realCpus();
    return Array.isArray(cpus) && cpus.length > 0 ? cpus : [{}];
  };
}

