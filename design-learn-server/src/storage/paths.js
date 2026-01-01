const os = require('os');
const path = require('path');

function expandHome(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return inputPath;
  }

  if (inputPath === '~') {
    return os.homedir();
  }

  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

function resolveDataDir(override) {
  const candidate =
    override || process.env.DESIGN_LEARN_DATA_DIR || process.env.DATA_DIR;
  if (candidate) {
    return expandHome(candidate);
  }

  return path.join(process.cwd(), 'data');
}

function getDesignDir(dataDir, designId) {
  return path.join(dataDir, 'designs', designId);
}

function getDesignMetaPath(dataDir, designId) {
  return path.join(getDesignDir(dataDir, designId), 'design.json');
}

function getDesignIndexPath(dataDir) {
  return path.join(dataDir, 'designs', '_index.json');
}

function getVersionDir(dataDir, designId, versionNumber) {
  return path.join(getDesignDir(dataDir, designId), `v${versionNumber}`);
}

function getStyleguidePath(dataDir, designId, versionNumber) {
  return path.join(getVersionDir(dataDir, designId, versionNumber), 'styleguide.md');
}

function getRulesPath(dataDir, designId, versionNumber) {
  return path.join(getVersionDir(dataDir, designId, versionNumber), 'rules.json');
}

function getSnapshotsPath(dataDir, designId, versionNumber) {
  return path.join(getVersionDir(dataDir, designId, versionNumber), 'snapshots.json');
}

function getComponentsDir(dataDir, designId, versionNumber) {
  return path.join(getVersionDir(dataDir, designId, versionNumber), 'components');
}

function getComponentDir(dataDir, designId, versionNumber, componentId) {
  return path.join(getComponentsDir(dataDir, designId, versionNumber), componentId);
}

function getComponentCodePath(dataDir, designId, versionNumber, componentId) {
  return path.join(getComponentDir(dataDir, designId, versionNumber, componentId), 'code.json');
}

function getRulesDir(dataDir, designId, versionNumber) {
  return path.join(getVersionDir(dataDir, designId, versionNumber), 'rules');
}

function getRulePath(dataDir, designId, versionNumber, ruleId) {
  return path.join(getRulesDir(dataDir, designId, versionNumber), `${ruleId}.json`);
}

function getDatabasePath(dataDir) {
  return path.join(dataDir, 'database.sqlite');
}

function getConfigPath(dataDir) {
  return path.join(dataDir, 'config.json');
}

module.exports = {
  expandHome,
  resolveDataDir,
  getDesignDir,
  getDesignMetaPath,
  getDesignIndexPath,
  getVersionDir,
  getStyleguidePath,
  getRulesPath,
  getSnapshotsPath,
  getComponentsDir,
  getComponentDir,
  getComponentCodePath,
  getRulesDir,
  getRulePath,
  getDatabasePath,
  getConfigPath,
};
