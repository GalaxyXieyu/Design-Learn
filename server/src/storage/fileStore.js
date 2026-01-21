const fs = require('fs/promises');
const path = require('path');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  const payload = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, payload, 'utf-8');
}

async function readJson(filePath) {
  const payload = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(payload);
}

async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf-8');
}

async function removePath(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  ensureDir,
  writeJson,
  readJson,
  writeText,
  readText,
  removePath,
};
