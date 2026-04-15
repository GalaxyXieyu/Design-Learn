const { registerRootRoutes } = require('./root');
const { registerAnalysisRoutes } = require('./analysis');
const { registerImportRoutes } = require('./import');
const { registerDesignRoutes } = require('./designs');
const { registerVersionRoutes } = require('./versions');
const { registerSnapshotRoutes } = require('./snapshots');
const { registerPreviewRoutes } = require('./previews');
const { registerTaskRoutes } = require('./tasks');
const { registerConfigRoutes } = require('./config');
const { registerPromptTemplateRoutes } = require('./promptTemplates');
const { registerUiproRoutes } = require('./uipro');
const { registerScanRoutes } = require('./scanRoutes');

function registerRoutes(router, deps) {
  registerRootRoutes(router, deps);
  registerAnalysisRoutes(router, deps);
  registerImportRoutes(router, deps);
  registerConfigRoutes(router, deps);
  registerPromptTemplateRoutes(router, deps);
  registerDesignRoutes(router, deps);
  registerVersionRoutes(router, deps);
  registerSnapshotRoutes(router, deps);
  registerPreviewRoutes(router, deps);
  registerTaskRoutes(router, deps);
  registerScanRoutes(router, deps);
  registerUiproRoutes(router, deps);
}

module.exports = {
  registerRoutes,
};
