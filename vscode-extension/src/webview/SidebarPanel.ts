import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import { FileManager } from '../fileManager';

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'designLearnSidebar';
  private _view?: vscode.WebviewView;
  private _extensionUri: vscode.Uri;
  private _taskPollInterval?: NodeJS.Timeout;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  public refresh() {
    if (this._view) {
      this._loadSnapshots();
      this._loadTasks();
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
          this._extractUrl(message.url, false);
          break;
        case 'extractWithAI':
          this._extractUrl(message.url, true);
          break;
        case 'extractAll':
          this._extractAllRoutes(message.url, message.useAI);
          break;
        case 'scanRoutes':
          this._scanRoutes(message.url);
          break;
        case 'loadData':
          this._loadData();
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
        case 'saveConfig':
          this._saveConfig(message.config);
          break;
        // 任务管理
        case 'loadTasks':
          this._loadTasks();
          break;
        case 'createTask':
          this._createTask(message.url, message.options);
          break;
        case 'retryTask':
          this._retryTask(message.taskId);
          break;
        case 'deleteTask':
          this._deleteTask(message.taskId);
          break;
        case 'clearCompletedTasks':
          this._clearCompletedTasks();
          break;
        case 'startTaskPolling':
          this._startTaskPolling();
          break;
        case 'stopTaskPolling':
          this._stopTaskPolling();
          break;
      }
    });

    webviewView.onDidDispose(() => {
      this._stopTaskPolling();
    });
  }

  private async _extractUrl(url: string, useAI: boolean) {
    if (!url || !url.trim()) {
      vscode.window.showErrorMessage('请输入有效的 URL');
      return;
    }

    try {
      new URL(url);
    } catch {
      vscode.window.showErrorMessage('请输入有效的 URL 格式');
      return;
    }

    this._view?.webview.postMessage({ type: 'extracting', status: true });

    const command = useAI ? 'design-learn.extractWithAI' : 'design-learn.extract';
    const originalShowInputBox = vscode.window.showInputBox;
    vscode.window.showInputBox = async (options) => {
      if (options?.prompt?.includes('URL')) return url;
      return originalShowInputBox(options);
    };
    
    await vscode.commands.executeCommand(command);
    vscode.window.showInputBox = originalShowInputBox;
    
    this._view?.webview.postMessage({ type: 'extracting', status: false });
    setTimeout(() => this._loadSnapshots(), 2000);
  }

  private _loadData() {
    setImmediate(() => {
      this._loadModels();
      this._loadSnapshots();
      this._loadConfig();
      this._loadTasks();
      this._checkServerStatus();
    });
  }

  // ==================== 路由扫描和批量提取 ====================

  private async _scanRoutes(url: string) {
    if (!url?.trim()) return;
    try { new URL(url); } catch { return; }

    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    this._view?.webview.postMessage({ type: 'scanningRoutes', status: true });

    try {
      const result = await this._serverRequest('POST', `${serverUrl}/api/scan-routes`, { url, limit: 10 });
      this._view?.webview.postMessage({ type: 'routesScanned', routes: result.routes || [], baseUrl: url });
    } catch (err: any) {
      vscode.window.showErrorMessage(`扫描路由失败: ${err.message}`);
      this._view?.webview.postMessage({ type: 'routesScanned', routes: [], baseUrl: url, error: err.message });
    } finally {
      this._view?.webview.postMessage({ type: 'scanningRoutes', status: false });
    }
  }

  private async _extractAllRoutes(baseUrl: string, useAI: boolean) {
    if (!baseUrl?.trim()) return;

    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      const result = await this._serverRequest('POST', `${serverUrl}/api/scan-routes`, { url: baseUrl, limit: 10 });
      const routes: string[] = result.routes || [];

      if (!routes.length) {
        vscode.window.showWarningMessage('未找到可提取的路由');
        return;
      }

      const baseUrlObj = new URL(baseUrl);
      for (const route of routes) {
        const fullUrl = `${baseUrlObj.origin}${route}`;
        await this._createTask(fullUrl, { useAI });
      }

      vscode.window.showInformationMessage(`已添加 ${routes.length} 个任务到队列`);
      this._loadTasks();
      this._startTaskPolling();
    } catch (err: any) {
      vscode.window.showErrorMessage(`批量提取失败: ${err.message}`);
    }
  }

  // ==================== 任务管理 ====================

  private async _loadTasks() {
    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      const result = await this._serverRequest('GET', `${serverUrl}/api/tasks`, null);
      this._view?.webview.postMessage({ type: 'updateTasks', ...result });
    } catch {
      this._view?.webview.postMessage({ type: 'updateTasks', tasks: [], groups: {}, stats: { total: 0, pending: 0, running: 0, completed: 0, failed: 0 } });
    }
  }

  private async _createTask(url: string, options: any = {}) {
    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      await this._serverRequest('POST', `${serverUrl}/api/tasks`, { url, options });
      this._loadTasks();
    } catch (err: any) {
      vscode.window.showErrorMessage(`创建任务失败: ${err.message}`);
    }
  }

  private async _retryTask(taskId: string) {
    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      await this._serverRequest('POST', `${serverUrl}/api/tasks/${taskId}/retry`, {});
      this._loadTasks();
    } catch (err: any) {
      vscode.window.showErrorMessage(`重试任务失败: ${err.message}`);
    }
  }

  private async _deleteTask(taskId: string) {
    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      await this._serverRequest('DELETE', `${serverUrl}/api/tasks/${taskId}`, null);
      this._loadTasks();
    } catch (err: any) {
      vscode.window.showErrorMessage(`删除任务失败: ${err.message}`);
    }
  }

  private async _clearCompletedTasks() {
    const config = vscode.workspace.getConfiguration('designLearn');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3100');

    try {
      const result = await this._serverRequest('DELETE', `${serverUrl}/api/tasks/clear-completed`, null);
      vscode.window.showInformationMessage(`已清除 ${result.deleted || 0} 个已完成任务`);
      this._loadTasks();
    } catch (err: any) {
      vscode.window.showErrorMessage(`清除任务失败: ${err.message}`);
    }
  }

  private _startTaskPolling() {
    this._stopTaskPolling();
    this._taskPollInterval = setInterval(() => this._loadTasks(), 2000);
  }

  private _stopTaskPolling() {
    if (this._taskPollInterval) {
      clearInterval(this._taskPollInterval);
      this._taskPollInterval = undefined;
    }
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
    if (models.length === 1) {
      await config.update('selectedModel', model.id, vscode.ConfigurationTarget.Global);
    }
    this._loadModels();
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

  private _getHtmlForWebview(_webview: vscode.Webview): string {
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
    .logo-icon { width: 28px; height: 28px; background: linear-gradient(135deg, var(--accent), #67b8ff); border-radius: 6px; display: flex; align-items: center; justify-content: center; }
    .logo-icon svg { width: 16px; height: 16px; color: white; }
    .logo-text h1 { font-size: 14px; font-weight: 600; }
    .logo-text p { font-size: 10px; color: var(--vscode-descriptionForeground); }

    /* URL 输入 */
    .url-section { margin-bottom: 12px; }
    .url-input { width: 100%; padding: 10px 12px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 8px; color: var(--vscode-input-foreground); font-size: 12px; }
    .url-input:focus { outline: none; border-color: var(--accent); }

    /* 按钮 */
    .btn-group { display: flex; gap: 8px; margin-bottom: 16px; }
    .btn { flex: 1; padding: 10px 12px; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .btn-primary { background: linear-gradient(135deg, var(--accent), #67b8ff); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn svg { width: 14px; height: 14px; }
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
    .snapshot-action { width: 22px; height: 22px; border: none; background: var(--vscode-button-secondaryBackground); border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--vscode-foreground); }
    .snapshot-action:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .snapshot-action.delete:hover { background: #ef4444; color: white; }
    .snapshot-action svg { width: 12px; height: 12px; }

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

    /* 模式切换 */
    .mode-switch { display: flex; background: var(--vscode-input-background); border-radius: 6px; padding: 2px; margin-bottom: 8px; }
    .mode-btn { flex: 1; padding: 6px 8px; border: none; background: transparent; color: var(--vscode-descriptionForeground); font-size: 11px; border-radius: 4px; cursor: pointer; }
    .mode-btn.active { background: var(--accent); color: white; }

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
    .task-actions button { width: 18px; height: 18px; border: none; background: transparent; border-radius: 3px; cursor: pointer; color: var(--vscode-descriptionForeground); display: flex; align-items: center; justify-content: center; }
    .task-actions button:hover { background: var(--vscode-button-secondaryBackground); }
    .task-actions button.delete:hover { background: #ef4444; color: white; }
    .task-actions button svg { width: 10px; height: 10px; }
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
    <!-- 服务器状态 -->
    <div class="server-status" id="serverStatus" onclick="document.getElementById('serverModal').classList.add('show')">
      <div class="status-indicator" id="statusIndicator"></div>
      <div class="status-info">
        <div class="status-title" id="statusTitle">检查中...</div>
        <div class="status-url" id="statusUrl">http://localhost:3100</div>
      </div>
    </div>

    <!-- 头部 -->
    <div class="header">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div class="logo-text">
        <h1>Design-Learn</h1>
        <p>智能学习页面设计</p>
      </div>
    </div>

    <!-- URL 输入 + 操作 -->
    <div class="url-section">
      <input type="url" id="urlInput" class="url-input" placeholder="输入网页 URL，回车提取">
    </div>

    <!-- 模式切换 -->
    <div class="mode-switch">
      <button class="mode-btn active" id="modeCurrent" onclick="setMode('current')">当前页面</button>
      <button class="mode-btn" id="modeAll" onclick="setMode('all')">全部路由 (≤10)</button>
    </div>

    <div class="btn-group">
      <button id="extractBtn" class="btn btn-primary" title="仅提取页面设计资源">
        <svg viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>提取</span>
      </button>
      <button id="extractAIBtn" class="btn btn-primary" title="提取并使用 AI 分析设计风格">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg>
        <span>AI 分析</span>
      </button>
    </div>

    <!-- AI 模型面板 -->
    <div class="panel" id="modelPanel">
      <div class="panel-header" onclick="togglePanel('modelPanel')">
        <span class="panel-title">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg>
          AI 模型
        </span>
        <svg class="panel-arrow" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
      <div class="panel-content">
        <div id="modelList"></div>
        <div id="modelForm" style="display:none;"></div>
        <button class="add-btn" id="addModelBtn" onclick="showModelForm()">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          添加模型
        </button>
      </div>
    </div>

    <!-- 任务队列面板 -->
    <div class="panel" id="taskPanel" style="display:none;">
      <div class="panel-header" onclick="togglePanel('taskPanel')">
        <span class="panel-title">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M9 11l3 3L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          任务队列
          <span class="panel-badge" id="taskCount">0</span>
        </span>
        <svg class="panel-arrow" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
      <div class="panel-content">
        <div id="taskList"></div>
        <div class="batch-actions">
          <button class="batch-btn" onclick="vscode.postMessage({type:'clearCompletedTasks'})">清除已完成</button>
          <button class="batch-btn" onclick="retryAllFailed()">重试失败</button>
        </div>
      </div>
    </div>

    <!-- 快照列表面板 -->
    <div class="panel" id="snapshotPanel">
      <div class="panel-header" onclick="togglePanel('snapshotPanel')">
        <span class="panel-title">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          快照列表
          <span class="panel-badge" id="snapshotCount">0</span>
        </span>
        <svg class="panel-arrow" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
      <div class="panel-content">
        <div id="snapshotList" class="snapshot-list"></div>
        <button class="add-btn" style="margin-top:8px;" id="batchAnalyzeBtn" onclick="vscode.postMessage({type:'batchAnalyze'})">
          <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg>
          批量 AI 分析
        </button>
      </div>
    </div>

    <!-- 设置面板 -->
    <div class="panel collapsed" id="settingsPanel">
      <div class="panel-header" onclick="togglePanel('settingsPanel')">
        <span class="panel-title">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="2"/></svg>
          提取设置
        </span>
        <svg class="panel-arrow" viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </div>
      <div class="panel-content">
        <div class="setting-group-label">资源下载</div>
        <div class="setting-item">
          <span class="setting-label">内联 CSS</span>
          <label class="setting-toggle"><input type="checkbox" id="inlineCSS" checked><span class="slider"></span></label>
        </div>
        <div class="setting-item">
          <span class="setting-label">下载图片</span>
          <label class="setting-toggle"><input type="checkbox" id="includeImages" checked><span class="slider"></span></label>
        </div>
        <div class="setting-item">
          <span class="setting-label">下载字体</span>
          <label class="setting-toggle"><input type="checkbox" id="includeFonts" checked><span class="slider"></span></label>
        </div>
        <div class="setting-group-label" style="margin-top:10px;">AI 分析内容</div>
        <div class="setting-item">
          <span class="setting-label">颜色</span>
          <label class="setting-toggle"><input type="checkbox" id="analyzeColors" checked><span class="slider"></span></label>
        </div>
        <div class="setting-item">
          <span class="setting-label">排版</span>
          <label class="setting-toggle"><input type="checkbox" id="analyzeTypography" checked><span class="slider"></span></label>
        </div>
        <div class="setting-item">
          <span class="setting-label">布局</span>
          <label class="setting-toggle"><input type="checkbox" id="analyzeLayout" checked><span class="slider"></span></label>
        </div>
        <div class="setting-item">
          <span class="setting-label">组件</span>
          <label class="setting-toggle"><input type="checkbox" id="analyzeComponents" checked><span class="slider"></span></label>
        </div>
        <button class="add-btn" style="margin-top:10px;" onclick="saveConfig()">保存设置</button>
      </div>
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

  <script>
    const vscode = acquireVsCodeApi();
    let isExtracting = false;
    let models = [];
    let selectedModelId = '';
    let snapshotPaths = {};
    let editingModelId = null;
    let currentMode = 'current';
    let tasks = [];

    // 折叠面板
    function togglePanel(id) {
      document.getElementById(id).classList.toggle('collapsed');
    }

    // 模式切换
    function setMode(mode) {
      currentMode = mode;
      document.getElementById('modeCurrent').classList.toggle('active', mode === 'current');
      document.getElementById('modeAll').classList.toggle('active', mode === 'all');
      document.getElementById('taskPanel').style.display = mode === 'all' ? 'block' : 'none';
      if (mode === 'all') {
        vscode.postMessage({type:'loadTasks'});
        vscode.postMessage({type:'startTaskPolling'});
      } else {
        vscode.postMessage({type:'stopTaskPolling'});
      }
    }

    // 任务管理
    function renderTasks(taskList) {
      tasks = taskList || [];
      document.getElementById('taskCount').textContent = tasks.length;
      const c = document.getElementById('taskList');
      if (!tasks.length) {
        c.innerHTML = '<div class="empty-state"><p>暂无任务</p></div>';
        return;
      }
      // 按域名分组
      const groups = {};
      tasks.forEach(t => {
        const domain = t.domain || 'unknown';
        if (!groups[domain]) groups[domain] = [];
        groups[domain].push(t);
      });
      c.innerHTML = Object.entries(groups).map(([domain, items]) =>
        '<div class="domain-group"><div class="domain-header">' + domain + ' (' + items.length + ')</div>' +
        items.map(t =>
          '<div class="task-item" data-id="' + t.id + '">' +
          '<div class="task-header">' +
          '<div class="task-status ' + t.status + '"></div>' +
          '<div class="task-url" title="' + t.url + '">' + t.url.replace(/^https?:\\/\\/[^/]+/, '') + '</div>' +
          '<div class="task-actions">' +
          (t.status === 'failed' ? '<button onclick="retryTask(\\'' + t.id + '\\')"><svg viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="2"/></svg></button>' : '') +
          '<button class="delete" onclick="deleteTask(\\'' + t.id + '\\')"><svg viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2"/></svg></button>' +
          '</div></div>' +
          '<div class="task-progress">' + (t.stage || t.status) + (t.progress ? ' ' + t.progress + '%' : '') + (t.error ? ' - ' + t.error : '') + '</div>' +
          '</div>'
        ).join('') + '</div>'
      ).join('');
    }

    function retryTask(id) { vscode.postMessage({type:'retryTask', taskId: id}); }
    function deleteTask(id) { vscode.postMessage({type:'deleteTask', taskId: id}); }
    function retryAllFailed() {
      tasks.filter(t => t.status === 'failed').forEach(t => retryTask(t.id));
    }

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
      document.getElementById('statusIndicator').className = 'status-indicator ' + (connected ? 'connected' : 'disconnected');
      document.getElementById('statusTitle').textContent = connected ? '服务器已连接' : '服务器未连接';
      document.getElementById('statusUrl').textContent = url;
      document.getElementById('serverUrlInput').value = url;
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
          '<button onclick="event.stopPropagation();editModel(\\'' + m.id + '\\')"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2"/></svg></button>' +
          '<button class="delete" onclick="event.stopPropagation();deleteModel(\\'' + m.id + '\\')"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
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

    // 快照列表
    function renderSnapshots(snapshots) {
      document.getElementById('snapshotCount').textContent = snapshots.length;
      const c = document.getElementById('snapshotList');
      if (!snapshots.length) {
        c.innerHTML = '<div class="empty-state"><p>暂无快照</p></div>';
        return;
      }
      snapshotPaths = {};
      snapshots.forEach((s, i) => { snapshotPaths[i] = s.path; });
      c.innerHTML = snapshots.map((s, idx) =>
        '<div class="snapshot-item" data-idx="' + idx + '">' +
        '<div class="snapshot-title">' + s.title + '</div>' +
        (s.url ? '<div class="snapshot-url">' + s.url + '</div>' : '') +
        '<div class="snapshot-meta">' +
        (s.date ? '<span class="snapshot-date">' + s.date + '</span>' : '') +
        (s.hasAnalysis ? '<span class="snapshot-badge">AI</span>' : '') +
        '</div>' +
        '<div class="snapshot-actions">' +
        '<button class="snapshot-action" data-action="analyze" title="AI分析"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/></svg></button>' +
        '<button class="snapshot-action" data-action="view" title="查看"><svg viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg></button>' +
        '<button class="snapshot-action" data-action="open" title="打开"><svg viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke="currentColor" stroke-width="2"/></svg></button>' +
        '<button class="snapshot-action delete" data-action="delete" title="删除"><svg viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
        '</div></div>'
      ).join('');
    }

    document.getElementById('snapshotList').addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();
      const item = btn.closest('.snapshot-item');
      const path = snapshotPaths[item.dataset.idx];
      if (!path) return;
      const action = btn.dataset.action;
      if (action === 'analyze') vscode.postMessage({type:'analyzeSnapshot', path});
      else if (action === 'view') vscode.postMessage({type:'viewSnapshot', path});
      else if (action === 'open') vscode.postMessage({type:'openSnapshot', path});
      else if (action === 'delete') vscode.postMessage({type:'deleteSnapshot', path});
    });

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
      if (msg.type === 'updateSnapshots') renderSnapshots(msg.snapshots || []);
      if (msg.type === 'updateConfig') updateConfig(msg.config);
      if (msg.type === 'extracting') setExtracting(msg.status);
      if (msg.type === 'serverStatus') updateServerStatus(msg.connected, msg.url);
      if (msg.type === 'updateTasks') renderTasks(msg.tasks || []);
    });

    vscode.postMessage({type:'loadData'});
  </script>
</body>
</html>`;
  }
}
