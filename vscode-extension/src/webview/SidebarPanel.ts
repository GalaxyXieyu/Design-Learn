import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { FileManager } from '../fileManager';
import { AIAnalyzer } from '../aiAnalyzer';
import { Snapshot } from '../types';

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'designLearnSidebar';
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  private _designPollInterval?: NodeJS.Timeout;
  private _pendingAiJobs = new Map<string, { designId: string }>();
  private _analysisInFlight = new Set<string>();

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  public refresh() {
    if (this._view) {
      this._loadDesigns();
      this._checkServerStatus();
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.type) {
        case 'extract':
          this._importUrl(message.url, false);
          break;
        case 'extractWithAI':
          this._importUrl(message.url, true);
          break;
        case 'extractAll':
          this._importAllRoutes(message.url, message.useAI);
          break;
        case 'scanRoutes':
          this._scanRoutes(message.url);
          break;
        case 'loadData':
          this._loadData();
          break;
        case 'loadDesigns':
          this._loadDesigns();
          break;
        case 'checkServer':
          this._checkServerStatus();
          break;
        case 'updateServerUrl':
          this._updateServerUrl(message.url);
          break;
        case 'openSnapshot':
          if (message.path && fs.existsSync(message.path)) {
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(message.path));
          }
          break;
        case 'viewSnapshot':
          this._viewSnapshotHtml(message.path);
          break;
        case 'deleteSnapshot':
          this._deleteSnapshot(message.path);
          break;
        case 'selectModel':
          this._selectModel(message.modelId);
          break;
        case 'saveModel':
          this._saveModel(message.model);
          break;
        case 'deleteModel':
          this._deleteModel(message.modelId);
          break;
        case 'analyzeSnapshot':
          vscode.commands.executeCommand('design-learn.analyzeSnapshot', message.path);
          break;
        case 'batchAnalyze':
          vscode.commands.executeCommand('design-learn.batchAnalyze');
          break;
        case 'copyMarkdown':
          this._copyMarkdown(message.snapshot);
          break;
        case 'copyMcpUri':
          this._copyMcpUri(message.snapshotId);
          break;
        case 'copyDesignMcpUri':
          this._copyDesignMcpUri(message.designId);
          break;
        case 'viewDesign':
          this._viewDesign(message.designId);
          break;
        case 'deleteDesign':
          this._deleteDesign(message.designId);
          break;
        case 'saveConfig':
          this._saveConfig(message.config);
          break;
        case 'startDesignPolling':
          this._startDesignPolling();
          break;
        case 'stopDesignPolling':
          this._stopDesignPolling();
          break;
      }
    });

    webviewView.onDidDispose(() => {
      this._stopDesignPolling();
    });
  }

  private async _importUrl(url: string, useAI: boolean) {
    const normalizedUrl = this._normalizeUrlInput(url);
    if (!normalizedUrl) {
      vscode.window.showErrorMessage('请输入有效的 URL');
      return;
    }

    try {
      new URL(normalizedUrl);
    } catch {
      vscode.window.showErrorMessage('请输入有效的 URL 格式');
      return;
    }

    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    this._view?.webview.postMessage({ type: 'extracting', status: true });

    try {
      const result = await this._serverRequest('POST', `${serverUrl}/api/import/url`, { url: normalizedUrl, options: { useAI: !!useAI } });
      if (useAI && result?.job?.id && result?.designId) {
        this._pendingAiJobs.set(result.job.id, { designId: result.designId });
      }
      this._loadDesigns();
      this._startDesignPolling();
    } catch (err: any) {
      const msg = err?.message || 'unknown_error';
      if (msg === 'playwright_not_installed') {
        vscode.window.showErrorMessage(
          '服务端未安装 Playwright，无法通过 URL 导入。请在 design-learn-server 目录执行 npm install playwright。'
        );
      } else {
        vscode.window.showErrorMessage(`导入失败: ${msg}`);
      }
    } finally {
      this._view?.webview.postMessage({ type: 'extracting', status: false });
    }
  }

  private _loadData() {
    setImmediate(() => {
      this._loadModels();
      this._loadDesigns();
      this._loadConfig();
      this._checkServerStatus();
    });
  }

  // ==================== 路由扫描和批量提取 ====================

  private async _scanRoutes(url: string) {
    const normalizedUrl = this._normalizeUrlInput(url);
    if (!normalizedUrl) return;
    try { new URL(normalizedUrl); } catch { return; }

    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    this._view?.webview.postMessage({ type: 'scanningRoutes', status: true });

    try {
      const result = await this._serverRequest('POST', `${serverUrl}/api/scan-routes`, { url: normalizedUrl, limit: 10 });
      this._view?.webview.postMessage({ type: 'routesScanned', routes: result.routes || [], baseUrl: normalizedUrl });
    } catch (err: any) {
      vscode.window.showErrorMessage(`扫描路由失败: ${err.message}`);
      this._view?.webview.postMessage({ type: 'routesScanned', routes: [], baseUrl: normalizedUrl, error: err.message });
    } finally {
      this._view?.webview.postMessage({ type: 'scanningRoutes', status: false });
    }
  }

  private async _importAllRoutes(baseUrl: string, useAI: boolean) {
    const normalizedBaseUrl = this._normalizeUrlInput(baseUrl);
    if (!normalizedBaseUrl) return;

    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      const result = await this._serverRequest('POST', `${serverUrl}/api/scan-routes`, { url: normalizedBaseUrl, limit: 10 });
      const routes: string[] = result.routes || [];
      this._view?.webview.postMessage({
        type: 'routesScanned',
        routes,
        baseUrl: normalizedBaseUrl,
        total: routes.length,
      });

      if (!routes.length) {
        vscode.window.showWarningMessage('未找到可提取的路由');
        return;
      }

      const baseUrlObj = new URL(normalizedBaseUrl);
      for (const route of routes) {
        const fullUrl = `${baseUrlObj.origin}${route}`;
        const result = await this._serverRequest('POST', `${serverUrl}/api/import/url`, { url: fullUrl, options: { useAI: !!useAI } });
        if (useAI && result?.job?.id && result?.designId) {
          this._pendingAiJobs.set(result.job.id, { designId: result.designId });
        }
      }

      vscode.window.showInformationMessage(`已开始导入 ${routes.length} 个路由`);
      this._loadDesigns();
      this._startDesignPolling();
    } catch (err: any) {
      vscode.window.showErrorMessage(`批量提取失败: ${err.message}`);
    }
  }

  private _normalizeUrlInput(url: string): string {
    const value = (url || '').trim();
    if (!value) return '';
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;
    return `https://${value}`;
  }

  // ==================== 设计列表（服务端 DB） ====================

  private async _loadDesigns() {
    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      const result = await this._serverRequest('GET', `${serverUrl}/api/designs?limit=200`, null);
      const items = Array.isArray(result.items) ? result.items : [];
      const jobIds = items
        .map((item: any) => item?.metadata?.processingJobId)
        .filter((jobId: string) => !!jobId);

      let jobsById = new Map<string, any>();
      if (jobIds.length) {
        try {
          const jobsResult = await this._serverRequest('GET', `${serverUrl}/api/import/jobs`, null);
          const jobs = Array.isArray(jobsResult.jobs) ? jobsResult.jobs : [];
          jobsById = new Map(jobs.map((job: any) => [job.id, job]));
        } catch {
          jobsById = new Map();
        }
      }

      const merged = items.map((item: any) => {
        const jobId = item?.metadata?.processingJobId;
        const job = jobId ? jobsById.get(jobId) : null;
        if (!job) return item;
        const meta = item?.metadata || {};
        const jobError = job?.error?.message || job?.error || null;
        const existingError = meta.processingError || null;
        const isAiPhase =
          meta.processingStatus === 'analyzing' ||
          (typeof meta.processingMessage === 'string' && meta.processingMessage.startsWith('ai_'));
        const processingMessage = isAiPhase ? meta.processingMessage : job.message;
        const processingProgress =
          isAiPhase && typeof meta.processingProgress === 'number' ? meta.processingProgress : job.progress;
        return {
          ...item,
          metadata: {
            ...(meta || {}),
            processingProgress,
            processingMessage,
            processingJobStatus: job.status,
            processingError: existingError || jobError,
          },
        };
      });

      const decorated = this._applyAiPendingStatus(merged);
      this._view?.webview.postMessage({ type: 'updateDesigns', items: decorated });
      this._maybeRunAiAnalysis(decorated, jobsById);
    } catch {
      this._view?.webview.postMessage({ type: 'updateDesigns', items: [] });
    }
  }

  private _applyAiPendingStatus(items: any[]) {
    if (!Array.isArray(items) || !items.length) return items;
    const pendingDesignIds = new Set(
      Array.from(this._pendingAiJobs.values()).map((entry) => entry.designId)
    );

    return items.map((item: any) => {
      const designId = item?.id;
      if (!designId) return item;
      const meta = item?.metadata || {};
      if (meta.processingStatus === 'failed') return item;
      const aiRequested = !!meta.aiRequested;
      const aiCompleted = meta.processingMessage === 'ai_completed' || meta.aiCompleted;
      const jobStatus = meta.processingJobStatus;
      const jobRunning = jobStatus === 'running' || jobStatus === 'queued';

      if (this._analysisInFlight.has(designId)) {
        return {
          ...item,
          metadata: {
            ...meta,
            processingStatus: 'analyzing',
            processingMessage: 'ai_analyzing',
            processingProgress: 90,
            processingError: null,
          },
        };
      }

      if (pendingDesignIds.has(designId)) {
        return {
          ...item,
          metadata: {
            ...meta,
            processingStatus: 'analyzing',
            processingMessage: 'ai_pending',
            processingProgress: 80,
            processingError: null,
          },
        };
      }

      if (aiRequested && !aiCompleted && !jobRunning) {
        return {
          ...item,
          metadata: {
            ...meta,
            processingStatus: 'analyzing',
            processingMessage: meta.processingMessage?.startsWith('ai_') ? meta.processingMessage : 'ai_pending',
            processingProgress: typeof meta.processingProgress === 'number' ? meta.processingProgress : 80,
            processingError: null,
          },
        };
      }

      return item;
    });
  }

  private _maybeRunAiAnalysis(items: any[], jobsById: Map<string, any>) {
    if (this._pendingAiJobs.size) {
      for (const [jobId, data] of this._pendingAiJobs.entries()) {
        const job = jobsById.get(jobId);
        if (!job) continue;
        if (job.status === 'failed') {
          this._pendingAiJobs.delete(jobId);
          continue;
        }
        if (job.status !== 'completed') continue;
        this._pendingAiJobs.delete(jobId);
        if (this._analysisInFlight.has(data.designId)) continue;
        void this._runAiAnalysisForDesign(data.designId);
      }
    }

    if (!Array.isArray(items) || !items.length) return;
    for (const item of items) {
      const designId = item?.id;
      if (!designId) continue;
      if (this._analysisInFlight.has(designId)) continue;
      const meta = item?.metadata || {};
      const aiRequested = !!meta.aiRequested;
      const aiCompleted = meta.processingMessage === 'ai_completed' || meta.aiCompleted;
      if (!aiRequested || aiCompleted) continue;
      if (meta.processingStatus === 'failed' || meta.processingMessage === 'failed') continue;
      const jobStatus = meta.processingJobStatus;
      if (jobStatus === 'running' || jobStatus === 'queued') continue;
      void this._runAiAnalysisForDesign(designId);
    }
  }

  private async _runAiAnalysisForDesign(designId: string) {
    this._analysisInFlight.add(designId);
    try {
      const config = vscode.workspace.getConfiguration('designLearn');
      const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

      await this._updateDesignProcessing(designId, {
        processingStatus: 'analyzing',
        processingMessage: 'ai_analyzing',
        processingProgress: 90,
        processingError: null,
        aiRequested: true,
        aiCompleted: false,
      });

      const result = await this._serverRequest(
        'GET',
        `${serverUrl}/api/snapshots?designId=${encodeURIComponent(designId)}&limit=1`,
        null
      );
      const snapshot = Array.isArray(result.items) ? result.items[0] : null;
      if (!snapshot || !snapshot.versionId) return;

      const existing = await this._serverRequest(
        'GET',
        `${serverUrl}/api/versions/${encodeURIComponent(snapshot.versionId)}`,
        null
      );
      if (existing?.styleguideMarkdown) {
        await this._updateDesignProcessing(designId, {
          processingStatus: 'completed',
          processingMessage: 'ai_completed',
          processingProgress: 100,
          processingError: null,
          lastImportVersionId: snapshot.versionId,
          lastImportAt: new Date().toISOString(),
          aiRequested: false,
          aiCompleted: true,
        });
        return;
      }

      const analyzer = new AIAnalyzer();
      const analysis = await analyzer.analyze(this._toAnalyzerSnapshot(snapshot));

      if (analysis?.markdown) {
        await this._serverRequest(
          'PATCH',
          `${serverUrl}/api/versions/${encodeURIComponent(snapshot.versionId)}`,
          { styleguideMarkdown: analysis.markdown }
        );
        await this._updateDesignProcessing(designId, {
          processingStatus: 'completed',
          processingMessage: 'ai_completed',
          processingProgress: 100,
          processingError: null,
          lastImportVersionId: snapshot.versionId,
          lastImportAt: new Date().toISOString(),
          aiRequested: false,
          aiCompleted: true,
        });
        vscode.window.showInformationMessage('AI 分析完成');
      }
    } catch (err: any) {
      await this._updateDesignProcessing(designId, {
        processingStatus: 'failed',
        processingMessage: 'failed',
        processingProgress: 100,
        processingError: err?.message || String(err),
        aiRequested: false,
        aiCompleted: false,
      });
      vscode.window.showWarningMessage(`AI 分析失败: ${err?.message || String(err)}`);
    } finally {
      this._analysisInFlight.delete(designId);
    }
  }

  private async _updateDesignProcessing(designId: string, metaPatch: Record<string, any>) {
    if (!designId) return;
    try {
      const config = vscode.workspace.getConfiguration('designLearn');
      const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');
      await this._serverRequest(
        'PATCH',
        `${serverUrl}/api/designs/${encodeURIComponent(designId)}`,
        { metadata: metaPatch }
      );
    } catch {
      // ignore
    }
  }

  private _toAnalyzerSnapshot(snapshot: any): Snapshot {
    const meta = snapshot?.metadata || {};
    const viewport = meta.viewport || { width: 1280, height: 720, devicePixelRatio: 1 };
    const stats = meta.stats || {
      totalElements: 0,
      totalImages: 0,
      totalLinks: 0,
      totalScripts: 0,
      totalStyles: 0,
    };

    return {
      id: String(snapshot.id || ''),
      url: snapshot.url || '',
      title: snapshot.title || snapshot.url || 'Untitled',
      html: snapshot.html || '',
      css: snapshot.css || '',
      assets: { images: [], fonts: [] },
      metadata: {
        viewport,
        userAgent: meta.userAgent || '',
        language: meta.language || '',
        charset: meta.charset || '',
        meta: meta.meta || {},
        performance: meta.performance,
        stats,
      },
      extractedAt: snapshot.createdAt || new Date().toISOString(),
      extractionTime: snapshot.extractionTime || 0,
    };
  }

  private _startDesignPolling() {
    this._stopDesignPolling();
    this._designPollInterval = setInterval(() => this._loadDesigns(), 2000);
  }

  private _stopDesignPolling() {
    if (this._designPollInterval) {
      clearInterval(this._designPollInterval);
      this._designPollInterval = undefined;
    }
  }

  private async _deleteDesign(designId: string) {
    if (!designId) return;
    const confirm = await vscode.window.showWarningMessage('确定要删除这个设计记录吗？', { modal: true }, '删除');
    if (confirm !== '删除') return;

    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      await this._serverRequest('DELETE', `${serverUrl}/api/designs/${encodeURIComponent(designId)}`, null);
      this._loadDesigns();
      vscode.window.showInformationMessage('已删除设计记录');
    } catch (err: any) {
      vscode.window.showErrorMessage(`删除失败: ${err.message}`);
    }
  }

  private async _viewDesign(designId: string) {
    if (!designId) return;

    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      const design = await this._serverRequest('GET', `${serverUrl}/api/designs/${encodeURIComponent(designId)}`, null);
      let versionId = design?.metadata?.lastImportVersionId;
      if (!versionId) {
        try {
          const result = await this._serverRequest(
            'GET',
            `${serverUrl}/api/snapshots?designId=${encodeURIComponent(designId)}&limit=1`,
            null
          );
          const snapshot = Array.isArray(result.items) ? result.items[0] : null;
          versionId = snapshot?.versionId || null;
        } catch {
          versionId = null;
        }
      }
      if (versionId) {
        try {
          const version = await this._serverRequest('GET', `${serverUrl}/api/versions/${encodeURIComponent(versionId)}`, null);
          if (version?.styleguideMarkdown) {
            const doc = await vscode.workspace.openTextDocument({
              language: 'markdown',
              content: version.styleguideMarkdown,
            });
            await vscode.window.showTextDocument(doc, { preview: true });
            return;
          }
        } catch {
          // fallback to design json
        }
      }

      const doc = await vscode.workspace.openTextDocument({
        language: 'json',
        content: JSON.stringify(design, null, 2),
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (err: any) {
      vscode.window.showErrorMessage(`加载设计失败: ${err.message}`);
    }
  }

  private async _copyDesignMcpUri(designId: string) {
    if (!designId) return;
    const uri = `design://${designId}`;
    await vscode.env.clipboard.writeText(uri);
    vscode.window.showInformationMessage('MCP URI 已复制');
  }

  private _serverRequest(method: string, url: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options: http.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(json.error || `HTTP ${res.statusCode}`));
            } else {
              resolve(json);
            }
          } catch { resolve({}); }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });

      if (body && method !== 'GET') {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  private async _checkServerStatus() {
    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      const http = require('http');
      const url = new URL(serverUrl + '/api/health');

      const req = http.get({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        timeout: 2000
      }, (res: any) => {
        const connected = res.statusCode === 200;
        this._view?.webview.postMessage({ type: 'serverStatus', connected, url: serverUrl });
      });

      req.on('error', () => {
        this._view?.webview.postMessage({ type: 'serverStatus', connected: false, url: serverUrl });
      });

      req.on('timeout', () => {
        req.destroy();
        this._view?.webview.postMessage({ type: 'serverStatus', connected: false, url: serverUrl });
      });
    } catch {
      this._view?.webview.postMessage({ type: 'serverStatus', connected: false, url: serverUrl });
    }
  }

  private async _updateServerUrl(url: string) {
    const config = vscode.workspace.getConfiguration('designLearn');
    await config.update('serverUrl', url, vscode.ConfigurationTarget.Global);
    this._checkServerStatus();
  }

  private _loadModels() {
    const config = vscode.workspace.getConfiguration('designLearn');
    const models = config.get<any[]>('aiModels', []);
    const selectedModelId = config.get<string>('selectedModel', '');
    this._view?.webview.postMessage({ type: 'updateModels', models, selectedModelId });
  }

  private _selectModel(modelId: string) {
    const config = vscode.workspace.getConfiguration('designLearn');
    config.update('selectedModel', modelId, vscode.ConfigurationTarget.Global);
    this._loadModels();
  }

  private async _saveModel(model: any) {
    const config = vscode.workspace.getConfiguration('designLearn');
    const models = config.get<any[]>('aiModels', []);
    const existingIndex = models.findIndex(m => m.id === model.id);
    if (existingIndex >= 0) {
      models[existingIndex] = model;
    } else {
      models.push(model);
    }
    await config.update('aiModels', models, vscode.ConfigurationTarget.Global);
    let selectedModelId = config.get<string>('selectedModel', '');
    if (models.length === 1) {
      selectedModelId = model.id;
      await config.update('selectedModel', model.id, vscode.ConfigurationTarget.Global);
    }
    // 直接发送更新后的数据
    this._view?.webview.postMessage({ type: 'updateModels', models, selectedModelId });
    vscode.window.showInformationMessage(`模型 "${model.name}" 已保存`);
  }

  private async _deleteModel(modelId: string) {
    const config = vscode.workspace.getConfiguration('designLearn');
    const models = config.get<any[]>('aiModels', []);
    const filtered = models.filter(m => m.id !== modelId);
    await config.update('aiModels', filtered, vscode.ConfigurationTarget.Global);
    this._loadModels();
  }

  private _loadConfig() {
    const config = vscode.workspace.getConfiguration('designLearn');
    this._view?.webview.postMessage({
      type: 'updateConfig',
      config: {
        inlineCSS: config.get<boolean>('extraction.inlineCSS', true),
        includeImages: config.get<boolean>('extraction.includeImages', true),
        includeFonts: config.get<boolean>('extraction.includeFonts', true),
        analyzeColors: config.get<boolean>('analysis.colors', true),
        analyzeTypography: config.get<boolean>('analysis.typography', true),
        analyzeLayout: config.get<boolean>('analysis.layout', true),
        analyzeComponents: config.get<boolean>('analysis.components', true)
      }
    });
  }

  private async _saveConfig(cfg: any) {
    const config = vscode.workspace.getConfiguration('designLearn');
    await Promise.all([
      config.update('extraction.inlineCSS', cfg.inlineCSS, vscode.ConfigurationTarget.Global),
      config.update('extraction.includeImages', cfg.includeImages, vscode.ConfigurationTarget.Global),
      config.update('extraction.includeFonts', cfg.includeFonts, vscode.ConfigurationTarget.Global),
      config.update('analysis.colors', cfg.analyzeColors, vscode.ConfigurationTarget.Global),
      config.update('analysis.typography', cfg.analyzeTypography, vscode.ConfigurationTarget.Global),
      config.update('analysis.layout', cfg.analyzeLayout, vscode.ConfigurationTarget.Global),
      config.update('analysis.components', cfg.analyzeComponents, vscode.ConfigurationTarget.Global)
    ]);
    vscode.window.showInformationMessage('配置已保存');
  }

  private async _loadSnapshots() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._view?.webview.postMessage({ type: 'updateSnapshots', snapshots: [] });
      return;
    }

    try {
      const fileManager = new FileManager(workspaceFolder.uri.fsPath);
      const snapshotDir = fileManager.getDirectories().snapshots;

      if (!fs.existsSync(snapshotDir)) {
        this._view?.webview.postMessage({ type: 'updateSnapshots', snapshots: [] });
        return;
      }

      const entries = fs.readdirSync(snapshotDir, { withFileTypes: true });
      const snapshots: any[] = [];
      const dirs = entries.filter(e => e.isDirectory()).slice(0, 30);
      
      for (const entry of dirs) {
        const folder = path.join(snapshotDir, entry.name);
        const metadataPath = path.join(folder, 'metadata.json');
        const snapshot: any = { id: entry.name, path: folder, title: entry.name, url: '', date: '', hasAnalysis: false };

        if (fs.existsSync(metadataPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            snapshot.title = meta.title || entry.name;
            snapshot.url = meta.url || '';
            snapshot.date = meta.extractedAt ? new Date(meta.extractedAt).toLocaleString() : '';
          } catch {}
        }

        const analysisPath = path.join(folder, 'analysis.md');
        snapshot.hasAnalysis = fs.existsSync(analysisPath);
        snapshots.push(snapshot);
      }

      snapshots.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this._view?.webview.postMessage({ type: 'updateSnapshots', snapshots });
    } catch {
      this._view?.webview.postMessage({ type: 'updateSnapshots', snapshots: [] });
    }
  }

  private async _viewSnapshotHtml(snapshotPath: string) {
    const htmlPath = path.join(snapshotPath, 'index.html');
    if (fs.existsSync(htmlPath)) {
      const doc = await vscode.workspace.openTextDocument(htmlPath);
      await vscode.window.showTextDocument(doc);
    }
  }

  private async _deleteSnapshot(snapshotPath: string) {
    if (!snapshotPath || !fs.existsSync(snapshotPath)) return;

    const confirm = await vscode.window.showWarningMessage('确定要删除这个快照吗？', { modal: true }, '删除');
    if (confirm === '删除') {
      try {
        fs.rmSync(snapshotPath, { recursive: true });
        this._loadSnapshots();
        vscode.window.showInformationMessage('快照已删除');
      } catch (err: any) {
        vscode.window.showErrorMessage(`删除失败: ${err.message}`);
      }
    }
  }

  private async _copyMarkdown(snapshot: any) {
    const md = `# ${snapshot.title}\n\n**URL**: ${snapshot.url}\n**提取时间**: ${snapshot.date}\n\n## 设计规范\n@import designlearn://snapshot/${snapshot.id}/style.md`;
    await vscode.env.clipboard.writeText(md);
    vscode.window.showInformationMessage('Markdown 已复制');
  }

  private async _copyMcpUri(snapshotId: string) {
    const uri = `designlearn://snapshot/${snapshotId}`;
    await vscode.env.clipboard.writeText(uri);
    vscode.window.showInformationMessage('MCP URI 已复制');
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const mediaPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar');
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, 'styles.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, 'main.js'));
    const htmlPath = vscode.Uri.joinPath(mediaPath, 'index.html').fsPath;

    let html = fs.readFileSync(htmlPath, 'utf-8');
    html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
    html = html.replace(/\{\{styleUri\}\}/g, styleUri.toString());
    html = html.replace(/\{\{scriptUri\}\}/g, scriptUri.toString());

    return html;
  }

  // Legacy method kept for reference - will be removed after verification
  private _getHtmlForWebview_OLD(_webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root { --accent: #4a9eff; --accent-hover: #3d8ce6; --success: #4caf50; --error: #f44336; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
	    body { font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); }
	    .container { padding: 12px; }

    /* 服务器状态 */
    .server-status { background: var(--vscode-editor-background); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .server-status:hover { background: var(--vscode-list-hoverBackground); }
    .status-indicator { width: 8px; height: 8px; border-radius: 50%; }
    .status-indicator.connected { background: var(--success); }
    .status-indicator.disconnected { background: var(--error); }
    .status-info { flex: 1; min-width: 0; }
    .status-title { font-size: 11px; font-weight: 600; }
    .status-url { font-size: 10px; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; }

    /* 头部 */
    .header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, var(--accent), #67b8ff); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .logo-icon svg { width: 20px; height: 20px; color: white; }
	    .logo-text { flex: 1; min-width: 0; }
	    .logo-text h1 { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	    .logo-text p { font-size: 10px; color: var(--vscode-descriptionForeground); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .server-dot { width: 10px; height: 10px; border-radius: 50%; background: #6b7280; cursor: pointer; transition: background 0.2s; }
    .server-dot.connected { background: #22c55e; }
    .server-dot.disconnected { background: #ef4444; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .settings-btn { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; color: var(--vscode-descriptionForeground); }
    .settings-btn:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-foreground); }
    .settings-dropdown { position: absolute; top: 100%; right: 0; width: 220px; background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; display: none; }
    .settings-dropdown.show { display: block; }
    .dropdown-section { padding: 8px 0; border-bottom: 1px solid var(--vscode-panel-border); }
    .dropdown-section:last-child { border-bottom: none; }
    .dropdown-label { padding: 4px 12px; font-size: 10px; color: var(--vscode-descriptionForeground); text-transform: uppercase; }
    .dropdown-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; font-size: 12px; cursor: pointer; }
    .dropdown-item:hover { background: var(--vscode-list-hoverBackground); }
    .dropdown-item svg { width: 16px; height: 16px; margin-right: 8px; }
    .dropdown-link { display: flex; align-items: center; padding: 8px 12px; font-size: 12px; cursor: pointer; color: var(--vscode-foreground); }
    .dropdown-link:hover { background: var(--vscode-list-hoverBackground); }
    .dropdown-link svg { width: 16px; height: 16px; margin-right: 8px; opacity: 0.7; }

	    /* 模版库区域 */
	    .history-section { margin-top: 16px; flex: 1; display: flex; flex-direction: column; min-height: 0; }
	    .history-header { display: flex; align-items: center; margin-bottom: 8px; }
	    .history-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }
		    .history-toolbar { display: grid; grid-template-columns: 1fr 1fr; grid-template-areas: "search search" "filter sort"; gap: 6px; margin-bottom: 8px; align-items: center; }
		    .history-search { grid-area: search; width: 100%; min-width: 0; height: 30px; padding: 0 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 8px; color: var(--vscode-input-foreground); font-size: 11px; }
		    #historyFilter { grid-area: filter; }
		    #historySort { grid-area: sort; }
		    .history-select { width: 100%; min-width: 0; height: 30px; padding: 0 8px; background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border); border-radius: 8px; color: var(--vscode-dropdown-foreground); font-size: 11px; }
		    @media (min-width: 420px) {
		      .history-toolbar { grid-template-columns: 1fr 120px 120px; grid-template-areas: "search filter sort"; }
		    }
	    .history-list { flex: 1; overflow-y: auto; }
	    .history-item { padding: 10px; border-radius: 10px; margin-bottom: 8px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); cursor: pointer; }
	    .history-item:hover { background: var(--vscode-list-hoverBackground); }
	    .history-item-title { font-size: 12px; font-weight: 600; margin-bottom: 2px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.3; }
	    .history-item-url { font-size: 10px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
		    .history-item-meta { display: flex; align-items: center; gap: 8px; justify-content: space-between; font-size: 10px; color: var(--vscode-descriptionForeground); }
		    .history-item-meta-left { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			    .history-item-status { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 3px; font-size: 10px; white-space: nowrap; flex-shrink: 0; }
		    .history-item-status.processing { background: #3b82f620; color: #3b82f6; }
	    .history-item-status.running { background: #f59e0b20; color: #f59e0b; }
	    .history-item-status.completed { background: #22c55e20; color: #22c55e; }
	    .history-item-status.failed { background: #ef444420; color: #ef4444; }
			    .history-item-actions { display: flex; gap: 4px; margin-top: 6px; justify-content: flex-end; flex-wrap: wrap; }
			    .history-item-actions button { padding: 4px 8px; font-size: 10px; background: var(--vscode-button-secondaryBackground); border: 1px solid var(--vscode-button-border, transparent); border-radius: 8px; cursor: pointer; color: var(--vscode-button-secondaryForeground); white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
			    .history-item-actions button:hover { background: var(--vscode-button-secondaryHoverBackground); }
			    .history-item-actions button svg { width: 12px; height: 12px; opacity: 0.9; flex-shrink: 0; }

	    .library-group { margin-bottom: 10px; }
	    .library-group-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); border-radius: 10px; cursor: pointer; user-select: none; }
	    .library-group-header:hover { background: var(--vscode-list-hoverBackground); }
	    .library-group-title { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: var(--vscode-descriptionForeground); }
	    .library-group-body { padding-top: 8px; }
	    .library-group-body.collapsed { display: none; }
	    .library-group-arrow { transition: transform 0.2s; }
	    .library-group-arrow.collapsed { transform: rotate(-90deg); }

	    /* 顶部快捷操作面板 */
	    .quick-panel { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 12px; padding: 10px; margin-bottom: 12px; }
		    .url-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
			    .url-input { flex: 1 1 160px; min-width: 0; height: 34px; padding: 0 12px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 10px; color: var(--vscode-input-foreground); font-size: 12px; }
		    .url-input:focus { outline: none; border-color: var(--accent); }
		    .action-btns { display: flex; gap: 6px; flex-shrink: 0; margin-left: auto; }
	    .action-btn { height: 34px; padding: 0 10px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
	    .action-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
	    .action-btn.primary { border: none; background: linear-gradient(135deg, var(--accent), #67b8ff); color: white; }
	    .action-btn.primary:hover { opacity: 0.92; }
    .action-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .action-btn svg { width: 16px; height: 16px; }

    /* 窄宽度：仅保留图标，隐藏文字，避免溢出 */
		    @media (max-width: 340px) {
		      .action-btn span { display: none; }
		      .action-btn { width: 34px; padding: 0; justify-content: center; }
		      .action-btns { gap: 4px; }
		      .url-row { gap: 6px; }
		      .action-btns { width: 100%; justify-content: flex-end; }
		      .history-item-actions button span { display: none; }
		      .history-item-actions button { width: 30px; padding: 0; justify-content: center; }
		    }

	    /* 模式切换（更轻量） */
	    .mode-switch { display: flex; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 10px; padding: 2px; margin-top: 8px; }
	    .mode-btn { flex: 1; padding: 6px 8px; border: none; background: transparent; color: var(--vscode-descriptionForeground); font-size: 11px; border-radius: 8px; cursor: pointer; }
	    .mode-btn.active { background: var(--accent); color: white; }
    .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* 折叠面板 */
    .panel { background: var(--vscode-editor-background); border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; cursor: pointer; user-select: none; }
    .panel-header:hover { background: var(--vscode-list-hoverBackground); }
    .panel-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--vscode-descriptionForeground); display: flex; align-items: center; gap: 6px; }
    .panel-badge { background: var(--accent); color: white; font-size: 10px; padding: 1px 6px; border-radius: 10px; }
    .panel-arrow { transition: transform 0.2s; }
    .panel.collapsed .panel-arrow { transform: rotate(-90deg); }
    .panel-content { padding: 0 12px 12px; }
    .panel.collapsed .panel-content { display: none; }

    /* 模型列表 */
    .model-item { padding: 10px; background: var(--vscode-input-background); border: 1px solid transparent; border-radius: 8px; margin-bottom: 6px; cursor: pointer; display: flex; align-items: center; gap: 10px; }
    .model-item:hover { background: var(--vscode-list-hoverBackground); }
    .model-item.selected { border-color: var(--accent); background: rgba(74, 158, 255, 0.1); }
    .model-icon { width: 28px; height: 28px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 700; }
    .model-info { flex: 1; min-width: 0; }
    .model-name { font-size: 12px; font-weight: 600; }
    .model-id { font-size: 10px; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; }
    .model-actions { display: flex; gap: 4px; }
    .model-actions button { width: 22px; height: 22px; border: none; background: transparent; border-radius: 4px; cursor: pointer; color: var(--vscode-descriptionForeground); display: flex; align-items: center; justify-content: center; }
    .model-actions button:hover { background: var(--vscode-button-secondaryBackground); color: var(--vscode-foreground); }
    .model-actions button.delete:hover { background: #ef4444; color: white; }

    /* 模型表单 */
    .model-form { background: var(--vscode-input-background); border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .form-row { display: flex; gap: 8px; margin-bottom: 8px; }
    .form-group { flex: 1; }
    .form-group label { display: block; font-size: 10px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; }
    .form-group input, .form-group select { width: 100%; padding: 6px 8px; background: var(--vscode-editor-background); border: 1px solid var(--vscode-input-border); border-radius: 4px; color: var(--vscode-input-foreground); font-size: 11px; }
    .form-group input:focus { outline: none; border-color: var(--accent); }
    .form-actions { display: flex; gap: 8px; margin-top: 10px; }
    .form-actions button { flex: 1; padding: 6px; border: none; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; }
    .form-actions .save { background: var(--accent); color: white; }
    .form-actions .cancel { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }

    /* 添加按钮 */
    .add-btn { width: 100%; padding: 8px; border: 1px dashed var(--vscode-input-border); background: transparent; border-radius: 6px; color: var(--vscode-descriptionForeground); font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; }
    .add-btn:hover { border-color: var(--accent); color: var(--accent); }

    /* 快照列表 */
    .snapshot-list { max-height: 300px; overflow-y: auto; }
    .snapshot-item { padding: 10px; background: var(--vscode-input-background); border-radius: 8px; margin-bottom: 6px; position: relative; }
    .snapshot-item:hover { background: var(--vscode-list-hoverBackground); }
    .snapshot-title { font-size: 12px; font-weight: 600; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .snapshot-url { font-size: 10px; color: var(--vscode-descriptionForeground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
    .snapshot-meta { display: flex; align-items: center; gap: 8px; }
    .snapshot-date { font-size: 10px; color: var(--vscode-descriptionForeground); opacity: 0.7; }
    .snapshot-badge { font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(76, 175, 80, 0.2); color: var(--success); }
    .snapshot-actions { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); display: none; gap: 4px; }
    .snapshot-item:hover .snapshot-actions { display: flex; }
    .snapshot-action { width: 26px; height: 26px; border: none; background: var(--vscode-button-secondaryBackground); border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--vscode-foreground); }
    .snapshot-action:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .snapshot-action.delete:hover { background: #ef4444; color: white; }
    .snapshot-action svg { width: 14px; height: 14px; }

    /* 设置选项 */
    .setting-group-label { font-size: 10px; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .setting-item { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
    .setting-label { font-size: 11px; }
    .setting-toggle { position: relative; width: 32px; height: 18px; }
    .setting-toggle input { opacity: 0; width: 0; height: 0; }
    .setting-toggle .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: var(--vscode-input-background); border-radius: 9px; transition: 0.2s; }
    .setting-toggle .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 2px; bottom: 2px; background: var(--vscode-foreground); border-radius: 50%; transition: 0.2s; }
    .setting-toggle input:checked + .slider { background: var(--accent); }
    .setting-toggle input:checked + .slider:before { transform: translateX(14px); }

    /* 空状态 */
    .empty-state { text-align: center; padding: 16px; color: var(--vscode-descriptionForeground); }
    .empty-state svg { width: 32px; height: 32px; margin-bottom: 8px; opacity: 0.5; }
    .empty-state p { font-size: 11px; }

	    /* 模式切换（旧样式已合并到上方 quick-panel） */

    /* 任务列表 */
    .task-item { padding: 8px 10px; background: var(--vscode-input-background); border-radius: 6px; margin-bottom: 6px; }
    .task-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .task-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .task-status.pending { background: var(--vscode-descriptionForeground); }
    .task-status.running { background: #f59e0b; animation: pulse 1s infinite; }
    .task-status.extracted { background: #3b82f6; }
    .task-status.analyzing { background: #8b5cf6; animation: pulse 1s infinite; }
    .task-status.completed { background: var(--success); }
    .task-status.failed { background: var(--error); }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
    .task-url { flex: 1; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .task-progress { font-size: 10px; color: var(--vscode-descriptionForeground); }
    .task-actions { display: flex; gap: 4px; }
    .task-actions button { width: 20px; height: 20px; border: none; background: transparent; border-radius: 4px; cursor: pointer; color: var(--vscode-descriptionForeground); display: flex; align-items: center; justify-content: center; }
    .task-actions button:hover { background: var(--vscode-button-secondaryBackground); }
    .task-actions button.delete:hover { background: #ef4444; color: white; }
    .task-actions button svg { width: 12px; height: 12px; }
    .domain-group { margin-bottom: 10px; }
    .domain-header { font-size: 10px; color: var(--vscode-descriptionForeground); margin-bottom: 4px; font-weight: 600; }
    .batch-actions { display: flex; gap: 6px; margin-top: 8px; }
    .batch-btn { flex: 1; padding: 5px; border: 1px solid var(--vscode-input-border); background: transparent; border-radius: 4px; font-size: 10px; color: var(--vscode-descriptionForeground); cursor: pointer; }
    .batch-btn:hover { border-color: var(--accent); color: var(--accent); }

    /* 模态框 */
    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
    .modal.show { display: flex; }
    .modal-content { background: var(--vscode-editor-background); border-radius: 8px; padding: 16px; width: 90%; max-width: 300px; }
    .modal-header { font-size: 13px; font-weight: 600; margin-bottom: 12px; }
    .modal-input { width: 100%; padding: 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 4px; color: var(--vscode-input-foreground); font-size: 12px; margin-bottom: 12px; }
    .modal-footer { display: flex; gap: 8px; justify-content: flex-end; }
    .modal-btn { padding: 6px 12px; border: none; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; }
    .modal-btn-primary { background: var(--accent); color: white; }
    .modal-btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  </style>
</head>
<body>
  <div class="container">
    <!-- 头部 -->
    <div class="header">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="logo-text">
        <h1>Design-Learn</h1>
        <p>智能学习页面设计</p>
      </div>
      <div class="header-actions" style="position:relative;">
        <div class="server-dot" id="serverDot" title="服务器状态" onclick="document.getElementById('serverModal').classList.add('show')"></div>
	        <div class="settings-btn" id="settingsBtn" onclick="toggleSettingsMenu()">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2"/></svg>
        </div>
        <!-- 设置下拉菜单 -->
        <div class="settings-dropdown" id="settingsDropdown">
          <div class="dropdown-section">
            <div class="dropdown-label">资源下载</div>
            <div class="dropdown-item"><span>内联 CSS</span><label class="setting-toggle"><input type="checkbox" id="inlineCSS" checked><span class="slider"></span></label></div>
            <div class="dropdown-item"><span>下载图片</span><label class="setting-toggle"><input type="checkbox" id="includeImages" checked><span class="slider"></span></label></div>
            <div class="dropdown-item"><span>下载字体</span><label class="setting-toggle"><input type="checkbox" id="includeFonts" checked><span class="slider"></span></label></div>
          </div>
          <div class="dropdown-section">
            <div class="dropdown-label">AI 分析</div>
            <div class="dropdown-item"><span>颜色</span><label class="setting-toggle"><input type="checkbox" id="analyzeColors" checked><span class="slider"></span></label></div>
            <div class="dropdown-item"><span>排版</span><label class="setting-toggle"><input type="checkbox" id="analyzeTypography" checked><span class="slider"></span></label></div>
            <div class="dropdown-item"><span>布局</span><label class="setting-toggle"><input type="checkbox" id="analyzeLayout" checked><span class="slider"></span></label></div>
            <div class="dropdown-item"><span>组件</span><label class="setting-toggle"><input type="checkbox" id="analyzeComponents" checked><span class="slider"></span></label></div>
          </div>
          <div class="dropdown-section">
            <div class="dropdown-link" onclick="openModelConfig()">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg>
              AI 模型配置
            </div>
            <div class="dropdown-link" onclick="document.getElementById('serverModal').classList.add('show');closeSettingsMenu();">
              <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="2"/></svg>
              服务器配置
            </div>
          </div>
        </div>
      </div>
    </div>

	    <div class="quick-panel">
	      <div class="url-row">
	        <input type="url" id="urlInput" class="url-input" placeholder="输入网页 URL，回车提取">
	        <div class="action-btns">
	          <button id="extractBtn" class="action-btn primary" title="提取（不做 AI 分析）">
	            <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
	            <span>提取</span>
	          </button>
	          <button id="extractAIBtn" class="action-btn" title="提取 + AI 分析">
	            <svg viewBox="0 0 24 24" fill="none"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg>
	            <span>AI</span>
	          </button>
	        </div>
	      </div>
	      <div class="mode-switch">
	        <button class="mode-btn active" id="modeCurrent" onclick="setMode('current')">当前页面</button>
	        <button class="mode-btn" id="modeAll" onclick="setMode('all')">全部路由 ≤10</button>
	      </div>
	    </div>

		    <!-- 模版库区域 -->
    <div class="history-section">
      <div class="history-header">
        <span class="history-title">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
	          模版库
          <span class="panel-badge" id="snapshotCount">0</span>
        </span>
      </div>
	    <div class="history-toolbar">
	        <input type="text" id="historySearch" class="history-search" placeholder="搜索..." oninput="filterHistory()">
	        <select id="historyFilter" class="history-select" onchange="filterHistory()">
	          <option value="all">全部</option>
	          <option value="processing">处理中</option>
	          <option value="completed">已完成</option>
	          <option value="failed">失败</option>
	        </select>
        <select id="historySort" class="history-select" onchange="filterHistory()">
          <option value="newest">最新</option>
          <option value="oldest">最早</option>
          <option value="grouped">按网站</option>
        </select>
      </div>
      <div id="historyList" class="history-list"></div>
    </div>
  </div>

  <!-- 服务器配置模态框 -->
  <div class="modal" id="serverModal">
    <div class="modal-content">
      <div class="modal-header">服务器配置</div>
      <input type="text" id="serverUrlInput" class="modal-input" placeholder="http://localhost:3100">
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" onclick="document.getElementById('serverModal').classList.remove('show')">取消</button>
        <button class="modal-btn modal-btn-primary" onclick="saveServerUrl()">保存</button>
      </div>
    </div>
  </div>

  <!-- 模型配置模态框 -->
  <div class="modal" id="modelModal">
    <div class="modal-content" style="width:320px;">
      <div class="modal-header">AI 模型配置</div>
      <div id="modelModalList"></div>
      <div id="modelModalForm" style="display:none;">
        <input type="text" id="modalModelName" class="modal-input" placeholder="模型名称">
        <select id="modalModelProvider" class="modal-input">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="custom">自定义</option>
        </select>
        <input type="password" id="modalModelApiKey" class="modal-input" placeholder="API Key">
        <input type="text" id="modalModelBaseUrl" class="modal-input" placeholder="Base URL (可选)">
        <input type="text" id="modalModelId" class="modal-input" placeholder="Model ID">
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-secondary" id="modelModalCloseBtn">关闭</button>
        <button class="modal-btn modal-btn-primary" id="modelModalSaveBtn" style="display:none;">保存</button>
        <button class="modal-btn modal-btn-primary" id="modelModalAddBtn">添加模型</button>
      </div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let isExtracting = false;
	    let models = [];
	    let selectedModelId = '';
		    let editingModelId = null;
		    let currentMode = 'current';
		    let allDesigns = [];
		    let libraryItemsByKey = {};
		    const libraryGroupCollapsed = { processing: false, failed: false, completed: false };
	
	    function findButtonFromEventTarget(target, stopAtEl) {
	      let el = target;
	      while (el && el !== stopAtEl) {
	        if (el.tagName === 'BUTTON') return el;
	        el = el.parentNode;
	      }
	      return null;
	    }
	
	    (function initActionDelegates() {
	      // 模型配置模态框：关闭/添加/保存（避免与侧边栏 showModelForm 重名冲突）
	      const modalCloseBtn = document.getElementById('modelModalCloseBtn');
	      if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModelModal);
	      const modalAddBtn = document.getElementById('modelModalAddBtn');
	      if (modalAddBtn) modalAddBtn.addEventListener('click', showModelFormInModal);
	      const modalSaveBtn = document.getElementById('modelModalSaveBtn');
	      if (modalSaveBtn) modalSaveBtn.addEventListener('click', saveModelFromModal);

	      // 模型配置模态框列表：编辑/删除
	      const modalList = document.getElementById('modelModalList');
	      if (modalList) {
	        modalList.addEventListener('click', function(e) {
	          const btn = findButtonFromEventTarget(e && e.target, modalList);
	          if (!btn) return;
	          const action = btn.getAttribute('data-action');
	          const id = btn.getAttribute('data-id');
	          if (!action || !id) return;
	          if (action === 'edit-modal-model') editModelInModal(id);
	          if (action === 'delete-modal-model') deleteModelFromModal(id);
	        });
	      }
	
	      // 侧边栏模型列表：编辑/删除（阻止触发选择模型）
	      const modelList = document.getElementById('modelList');
	      if (modelList) {
	        modelList.addEventListener('click', function(e) {
	          const btn = findButtonFromEventTarget(e && e.target, modelList);
	          if (!btn) return;
	          const action = btn.getAttribute('data-action');
	          const id = btn.getAttribute('data-id');
	          if (!action || !id) return;
	          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
	          if (action === 'edit-model') editModel(id);
	          if (action === 'delete-model') deleteModel(id);
	        });
	      }
	    })();

    // 设置下拉菜单
	    function toggleSettingsMenu() {
	      try {
	        const ev = (typeof window !== 'undefined' && window.event) ? window.event : null;
	        if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
	        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
	      } catch {}
	      const dropdown = document.getElementById('settingsDropdown');
	      if (!dropdown) return;
	      dropdown.classList.toggle('show');
	    }
    function closeSettingsMenu() {
      document.getElementById('settingsDropdown').classList.remove('show');
    }
    function openModelConfig() {
      closeSettingsMenu();
      renderModelListInModal();
      document.getElementById('modelModal').classList.add('show');
    }
    function closeModelModal() {
      document.getElementById('modelModal').classList.remove('show');
      document.getElementById('modelModalForm').style.display = 'none';
      document.getElementById('modelModalList').style.display = 'block';
      document.getElementById('modelModalSaveBtn').style.display = 'none';
      document.getElementById('modelModalAddBtn').style.display = 'inline-block';
    }
	    function renderModelListInModal() {
	      const container = document.getElementById('modelModalList');
	      if (!models.length) {
	        container.innerHTML = '<div style="padding:12px;text-align:center;color:var(--vscode-descriptionForeground);">暂无模型</div>';
	        return;
	      }
	      container.innerHTML = models.map(m =>
	        '<div style="display:flex;align-items:center;padding:8px;border-bottom:1px solid var(--vscode-panel-border);">' +
	        '<div style="flex:1;"><div style="font-weight:600;font-size:12px;">' + m.name + '</div>' +
	        '<div style="font-size:10px;color:var(--vscode-descriptionForeground);">' + m.modelId + '</div></div>' +
	        '<button style="background:none;border:none;cursor:pointer;padding:4px;" data-action="edit-modal-model" data-id="' + m.id + '">✏️</button>' +
	        '<button style="background:none;border:none;cursor:pointer;padding:4px;" data-action="delete-modal-model" data-id="' + m.id + '">🗑️</button>' +
	        '</div>'
	      ).join('');
	    }
    let editingModalModelId = null;
    function showModelFormInModal() {
      editingModalModelId = null;
      document.getElementById('modelModalForm').style.display = 'block';
      document.getElementById('modelModalList').style.display = 'none';
      document.getElementById('modelModalSaveBtn').style.display = 'inline-block';
      document.getElementById('modelModalAddBtn').style.display = 'none';
      document.getElementById('modalModelName').value = '';
      document.getElementById('modalModelApiKey').value = '';
      document.getElementById('modalModelBaseUrl').value = '';
      document.getElementById('modalModelId').value = '';
    }
    function editModelInModal(id) {
      const m = models.find(x => x.id === id);
      if (!m) return;
      editingModalModelId = id;
      document.getElementById('modelModalForm').style.display = 'block';
      document.getElementById('modelModalList').style.display = 'none';
      document.getElementById('modelModalSaveBtn').style.display = 'inline-block';
      document.getElementById('modelModalAddBtn').style.display = 'none';
      document.getElementById('modalModelName').value = m.name || '';
      document.getElementById('modalModelProvider').value = m.provider || 'openai';
      document.getElementById('modalModelApiKey').value = m.apiKey || '';
      document.getElementById('modalModelBaseUrl').value = m.baseUrl || '';
      document.getElementById('modalModelId').value = m.modelId || '';
    }
    function saveModelFromModal() {
      const model = {
        id: editingModalModelId || Date.now().toString(),
        name: document.getElementById('modalModelName').value.trim(),
        provider: document.getElementById('modalModelProvider').value,
        apiKey: document.getElementById('modalModelApiKey').value.trim(),
        baseUrl: document.getElementById('modalModelBaseUrl').value.trim() || null,
        modelId: document.getElementById('modalModelId').value.trim()
      };
      if (!model.name || !model.apiKey || !model.modelId) {
        alert('请填写名称、API Key 和 Model ID');
        return;
      }
      vscode.postMessage({type:'saveModel', model});
      closeModelModal();
    }
    function deleteModelFromModal(id) {
      if (confirm('确定删除这个模型？')) {
        vscode.postMessage({type:'deleteModel', modelId: id});
        renderModelListInModal();
      }
    }
    // 点击外部关闭下拉菜单
	    // 阻止点击下拉内容时触发外部关闭
	    (function() {
	      const dropdown = document.getElementById('settingsDropdown');
	      if (dropdown) {
	        dropdown.addEventListener('click', function(e) {
	          if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
	        });
	      }
	    })();
	
	    document.addEventListener('click', function(e) {
	      const dropdown = document.getElementById('settingsDropdown');
	      const btn = document.getElementById('settingsBtn');
	      try {
	        if (!dropdown || !btn) return;
	        const target = e && e.target ? e.target : null;
	        if (!target) {
	          dropdown.classList.remove('show');
	          return;
	        }
	        if (!dropdown.contains(target) && !btn.contains(target)) {
	          dropdown.classList.remove('show');
	        }
	      } catch {
	        dropdown?.classList?.remove?.('show');
	      }
	    });

    // 折叠面板
    function togglePanel(id) {
      document.getElementById(id).classList.toggle('collapsed');
    }

		    // 模式切换（仅影响“提取”行为）
		    function setMode(mode) {
		      currentMode = mode;
		      document.getElementById('modeCurrent').classList.toggle('active', mode === 'current');
		      document.getElementById('modeAll').classList.toggle('active', mode === 'all');
		    }

			    // 设计列表：用于“模版库”展示（来自服务端 DB）
			    function renderDesigns(designList) {
			      allDesigns = designList || [];
			      const hasActive = (allDesigns || []).some(d => (d && d.metadata && d.metadata.processingStatus) === 'processing');
			      vscode.postMessage({ type: hasActive ? 'startDesignPolling' : 'stopDesignPolling' });
			      filterHistory();
			    }
	
		    function stripOriginFromUrl(url) {
		      if (!url) return '';
		      const idx = url.indexOf('://');
		      if (idx < 0) return url;
		      const rest = url.slice(idx + 3);
		      const slash = rest.indexOf('/');
		      if (slash < 0) return '/';
		      return rest.slice(slash);
		    }

		    function deleteDesign(id) { vscode.postMessage({type:'deleteDesign', designId: id}); }

    // 提取按钮
    document.getElementById('extractBtn').onclick = () => {
      if (isExtracting) return;
      const url = document.getElementById('urlInput').value.trim();
      if (!url) { document.getElementById('urlInput').focus(); return; }
      if (currentMode === 'all') {
        vscode.postMessage({type:'extractAll', url, useAI: false});
      } else {
        vscode.postMessage({type:'extract', url});
      }
    };

    document.getElementById('extractAIBtn').onclick = () => {
      if (isExtracting) return;
      const url = document.getElementById('urlInput').value.trim();
      if (!url) {
        document.getElementById('urlInput').focus();
        document.getElementById('urlInput').placeholder = '请先输入 URL';
        setTimeout(() => { document.getElementById('urlInput').placeholder = '输入网页 URL，回车提取'; }, 2000);
        return;
      }
      if (currentMode === 'all') {
        vscode.postMessage({type:'extractAll', url, useAI: true});
      } else {
        vscode.postMessage({type:'extractWithAI', url});
      }
    };
    
    document.getElementById('urlInput').onkeypress = (e) => {
      if (e.key === 'Enter') document.getElementById('extractBtn').click();
    };

    // 服务器配置
    function saveServerUrl() {
      const url = document.getElementById('serverUrlInput').value.trim();
      if (url) {
        vscode.postMessage({type:'updateServerUrl', url});
        document.getElementById('serverModal').classList.remove('show');
      }
    }

    function updateServerStatus(connected, url) {
      const dot = document.getElementById('serverDot');
      if (dot) {
        dot.className = 'server-dot ' + (connected ? 'connected' : 'disconnected');
        dot.title = connected ? '服务器已连接: ' + url : '服务器未连接';
      }
      const input = document.getElementById('serverUrlInput');
      if (input) input.value = url;
    }

    // 模型管理
	    function renderModels() {
	      const container = document.getElementById('modelList');
	      if (!models.length) {
	        container.innerHTML = '<div class="empty-state"><p>尚未配置 AI 模型</p></div>';
	        return;
	      }
	      container.innerHTML = models.map(m => {
	        const isSelected = m.id === selectedModelId;
	        const initial = (m.name || 'AI')[0].toUpperCase();
	        return '<div class="model-item' + (isSelected ? ' selected' : '') + '" data-id="' + m.id + '">' +
	          '<div class="model-icon">' + initial + '</div>' +
	          '<div class="model-info"><div class="model-name">' + m.name + '</div><div class="model-id">' + m.modelId + '</div></div>' +
	          '<div class="model-actions">' +
	          '<button data-action="edit-model" data-id="' + m.id + '"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg></button>' +
	          '<button class="delete" data-action="delete-model" data-id="' + m.id + '"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
	          '</div></div>';
	      }).join('');

      // 点击选择模型
      container.querySelectorAll('.model-item').forEach(el => {
        el.addEventListener('click', () => {
          vscode.postMessage({type:'selectModel', modelId: el.dataset.id});
        });
      });
    }

    function showModelForm(model) {
      editingModelId = model ? model.id : null;
      document.getElementById('addModelBtn').style.display = 'none';
      document.getElementById('modelForm').style.display = 'block';
      document.getElementById('modelForm').innerHTML = 
        '<div class="model-form">' +
        '<div class="form-row"><div class="form-group"><label>名称</label><input type="text" id="mName" value="' + (model?.name || '') + '" placeholder="如 GPT-4"></div>' +
        '<div class="form-group"><label>类型</label><select id="mProvider"><option value="openai"' + (model?.provider === 'openai' ? ' selected' : '') + '>OpenAI</option><option value="anthropic"' + (model?.provider === 'anthropic' ? ' selected' : '') + '>Anthropic</option><option value="custom"' + (model?.provider === 'custom' ? ' selected' : '') + '>自定义</option></select></div></div>' +
        '<div class="form-group"><label>API Key</label><input type="password" id="mApiKey" value="' + (model?.apiKey || '') + '" placeholder="sk-..."></div>' +
        '<div class="form-row"><div class="form-group"><label>Base URL (可选)</label><input type="text" id="mBaseUrl" value="' + (model?.baseUrl || '') + '" placeholder="自定义 API 地址"></div>' +
        '<div class="form-group"><label>模型 ID</label><input type="text" id="mModelId" value="' + (model?.modelId || '') + '" placeholder="如 gpt-4"></div></div>' +
        '<div class="form-actions"><button class="cancel" onclick="hideModelForm()">取消</button><button class="save" onclick="saveModel()">保存</button></div>' +
        '</div>';
    }

    function hideModelForm() {
      editingModelId = null;
      document.getElementById('addModelBtn').style.display = 'flex';
      document.getElementById('modelForm').style.display = 'none';
    }

    function saveModel() {
      const model = {
        id: editingModelId || Date.now().toString(),
        name: document.getElementById('mName').value.trim(),
        provider: document.getElementById('mProvider').value,
        apiKey: document.getElementById('mApiKey').value.trim(),
        baseUrl: document.getElementById('mBaseUrl').value.trim() || null,
        modelId: document.getElementById('mModelId').value.trim()
      };
      if (!model.name || !model.apiKey || !model.modelId) {
        alert('请填写名称、API Key 和模型 ID');
        return;
      }
      vscode.postMessage({type:'saveModel', model});
      hideModelForm();
    }

    function editModel(id) {
      const model = models.find(m => m.id === id);
      if (model) showModelForm(model);
    }

    function deleteModel(id) {
      if (confirm('确定删除这个模型？')) {
        vscode.postMessage({type:'deleteModel', modelId: id});
      }
    }

		    // 模版库数据（来自服务端 designs）
		    function filterHistory() {
		      const search = (document.getElementById('historySearch').value || '').toLowerCase();
		      const filter = document.getElementById('historyFilter').value;
		      const sort = document.getElementById('historySort').value;

		      const statusGroupOf = (d) => {
		        const s = d && d.metadata ? d.metadata.processingStatus : null;
		        if (s === 'failed') return 'failed';
		        if (s === 'processing') return 'processing';
		        return 'completed';
		      };

		      let items = (allDesigns || [])
		        .filter(d => d && d.id)
		        .map(d => ({
		          key: 'd:' + d.id,
		          type: 'design',
		          id: d.id,
		          title: d.name || (d.url ? (new URL(d.url).hostname || '未命名') : '未命名'),
		          url: d.url || '',
		          date: d.updatedAt || d.createdAt || '',
		          statusGroup: statusGroupOf(d),
		          jobId: d.metadata ? d.metadata.processingJobId : null,
		          error: d.metadata ? d.metadata.processingError : null,
		          versionId: d.metadata ? d.metadata.lastImportVersionId : null
		        }));

		      // 搜索/过滤
		      items = items.filter(it => {
		        if (search) {
		          const title = (it.title || '').toLowerCase();
		          const url = (it.url || '').toLowerCase();
		          const error = (it.error || '').toLowerCase();
		          const versionId = (it.versionId || '').toLowerCase();
		          if (!title.includes(search) && !url.includes(search) && !error.includes(search) && !versionId.includes(search)) return false;
		        }
		        if (filter === 'all') return true;
		        if (filter === 'completed') return it.statusGroup === 'completed';
		        if (filter === 'failed') return it.statusGroup === 'failed';
		        if (filter === 'processing') return it.statusGroup === 'processing';
		        return true;
		      });

		      // 计数
		      document.getElementById('snapshotCount').textContent = String(items.length);

		      const getDateValue = (v) => {
		        const t = Date.parse(v || '');
		        return Number.isFinite(t) ? t : 0;
		      };

		      if (sort === 'oldest') {
		        items = items.slice().sort((a, b) => getDateValue(a.date) - getDateValue(b.date));
		      } else if (sort === 'grouped') {
		        items = items.slice().sort((a, b) => {
		          const hostA = a.url ? new URL(a.url).hostname : '';
		          const hostB = b.url ? new URL(b.url).hostname : '';
		          return hostA.localeCompare(hostB);
		        });
		      } else {
		        items = items.slice().sort((a, b) => getDateValue(b.date) - getDateValue(a.date));
		      }

		      renderHistoryList(items);
		    }

	    function renderHistoryList(items) {
	      const c = document.getElementById('historyList');
	      libraryItemsByKey = {};
	      if (!items.length) {
	        c.innerHTML = '<div style="padding:20px;text-align:center;color:var(--vscode-descriptionForeground);">暂无记录</div>';
	        return;
	      }

	      const groups = { processing: [], failed: [], completed: [] };
	      items.forEach((it) => {
	        if (!groups[it.statusGroup]) groups[it.statusGroup] = [];
	        groups[it.statusGroup].push(it);
	      });

		      const renderItem = (it) => {
		        libraryItemsByKey[it.key] = it;
		        const statusText = it.statusGroup === 'processing' ? '处理中' : (it.statusGroup === 'failed' ? '失败' : '已完成');
		        const statusClass = it.statusGroup === 'processing' ? 'processing' : (it.statusGroup === 'failed' ? 'failed' : 'completed');
		        const metaLeft = it.date ? it.date : '';
		        const subline =
		          (it.url ? '<div class="history-item-url">' + it.url + '</div>' : '') +
		          (it.statusGroup === 'processing' ? '<div class="task-progress" style="margin-top:4px;">处理中...</div>' : '') +
		          (it.statusGroup === 'failed' && it.error ? '<div class="task-progress" style="margin-top:4px;color:#ef4444;">' + it.error + '</div>' : '');

		        const actions =
		          (it.statusGroup === 'failed'
		            ? '<button data-action="retryDesign" title="重试导入"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M21 12a9 9 0 10-3.3 6.9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 3v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>重试</span></button>'
		            : '') +
		          '<button data-action="viewDesign" title="查看详情"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg><span>查看</span></button>' +
		          '<button data-action="copyMcp" title="复制 MCP URI"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>复制</span></button>' +
		          '<button data-action="deleteDesign" title="删除记录"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>删除</span></button>';

		        return (
		          '<div class="history-item" data-key="' + it.key + '">' +
		          '<div class="history-item-title">' + (it.title || '') + '</div>' +
		          subline +
		          '<div class="history-item-meta">' +
		          '<span class="history-item-meta-left">' + metaLeft + '</span>' +
		          '<span class="history-item-status ' + statusClass + '">' + statusText + '</span>' +
		          '</div>' +
		          '<div class="history-item-actions">' + actions + '</div>' +
		          '</div>'
		        );
	      };

	      const renderGroup = (key, title) => {
	        const list = groups[key] || [];
	        if (!list.length) return '';
	        const collapsed = !!libraryGroupCollapsed[key];
	        return (
	          '<div class="library-group" data-group="' + key + '">' +
	          '<div class="library-group-header" data-action="toggleGroup" data-group="' + key + '">' +
	          '<div class="library-group-title">' + title + '<span class="panel-badge">' + list.length + '</span></div>' +
	          '<svg class="library-group-arrow' + (collapsed ? ' collapsed' : '') + '" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
	          '</div>' +
	          '<div class="library-group-body' + (collapsed ? ' collapsed' : '') + '" data-group-body="' + key + '">' +
	          list.map(renderItem).join('') +
	          '</div></div>'
	        );
	      };

	      c.innerHTML =
	        renderGroup('processing', '处理中') +
	        renderGroup('failed', '失败') +
	        renderGroup('completed', '已完成');
	    }

	    const historyListEl = document.getElementById('historyList');
	    if (historyListEl) {
	      historyListEl.addEventListener('click', function(e) {
	        const btn = e.target.closest('[data-action]');
	        if (!btn) return;
	        e.stopPropagation();
	        const action = btn.dataset.action;
	        if (action === 'toggleGroup') {
	          const group = btn.dataset.group;
	          if (!group) return;
	          libraryGroupCollapsed[group] = !libraryGroupCollapsed[group];
	          filterHistory();
	          return;
	        }

	        const itemEl = btn.closest('.history-item');
	        if (!itemEl) return;
	        const key = itemEl.dataset.key;
	        const it = key ? libraryItemsByKey[key] : null;
	        if (!it) return;

		        if (action === 'viewDesign' && it.type === 'design') {
		          vscode.postMessage({type:'viewDesign', designId: it.id});
		        } else if (action === 'copyMcp' && it.type === 'design') {
		          vscode.postMessage({type:'copyDesignMcpUri', designId: it.id});
		          btn.textContent = '已复制';
		          setTimeout(() => btn.textContent = '复制MCP', 1500);
		        } else if (action === 'retryDesign' && it.type === 'design') {
		          vscode.postMessage({type:'extract', url: it.url});
		        } else if (action === 'deleteDesign' && it.type === 'design') {
		          deleteDesign(it.id);
		        }
		      });
		    }

    // 设置
    function saveConfig() {
      vscode.postMessage({
        type: 'saveConfig',
        config: {
          inlineCSS: document.getElementById('inlineCSS').checked,
          includeImages: document.getElementById('includeImages').checked,
          includeFonts: document.getElementById('includeFonts').checked,
          analyzeColors: document.getElementById('analyzeColors').checked,
          analyzeTypography: document.getElementById('analyzeTypography').checked,
          analyzeLayout: document.getElementById('analyzeLayout').checked,
          analyzeComponents: document.getElementById('analyzeComponents').checked
        }
      });
    }

    function updateConfig(cfg) {
      document.getElementById('inlineCSS').checked = cfg.inlineCSS;
      document.getElementById('includeImages').checked = cfg.includeImages;
      document.getElementById('includeFonts').checked = cfg.includeFonts;
      document.getElementById('analyzeColors').checked = cfg.analyzeColors;
      document.getElementById('analyzeTypography').checked = cfg.analyzeTypography;
      document.getElementById('analyzeLayout').checked = cfg.analyzeLayout;
      document.getElementById('analyzeComponents').checked = cfg.analyzeComponents;
    }

    // 提取状态
    function setExtracting(status) {
      isExtracting = status;
      const btn = document.getElementById('extractBtn');
      btn.disabled = status;
      btn.innerHTML = status 
        ? '<div class="spinner"></div><span>提取中...</span>'
        : '<svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>提取设计</span>';
    }

    // 消息处理
	    window.addEventListener('message', e => {
	      const msg = e.data;
	      if (msg.type === 'updateModels') {
	        models = msg.models || [];
	        selectedModelId = msg.selectedModelId || '';
	        renderModels();
	      }
	      if (msg.type === 'updateDesigns') renderDesigns(msg.items || []);
	      if (msg.type === 'updateConfig') updateConfig(msg.config);
	      if (msg.type === 'extracting') setExtracting(msg.status);
	      if (msg.type === 'serverStatus') updateServerStatus(msg.connected, msg.url);
	    });

    // 初始化模态框按钮事件（确保所有函数已定义）
    (function initModalButtons() {
      const modalCloseBtn = document.getElementById('modelModalCloseBtn');
      const modalAddBtn = document.getElementById('modelModalAddBtn');
      const modalSaveBtn = document.getElementById('modelModalSaveBtn');
      if (modalCloseBtn) modalCloseBtn.onclick = closeModelModal;
      if (modalAddBtn) modalAddBtn.onclick = showModelFormInModal;
      if (modalSaveBtn) modalSaveBtn.onclick = saveModelFromModal;
    })();

    vscode.postMessage({type:'loadData'});
  </script>
</body>
</html>`;
  }
}
