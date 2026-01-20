import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ServerClient } from './services/serverClient';

export class SettingsPanel {
  public static currentPanel: SettingsPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _serverClient: ServerClient;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (SettingsPanel.currentPanel) {
      SettingsPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      'designLearnSettings',
      'Design-Learn 设置',
      column || vscode.ViewColumn.Two,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    SettingsPanel.currentPanel = new SettingsPanel(panel, extensionUri);
  }

  public static kill() {
    SettingsPanel.currentPanel?.dispose();
    SettingsPanel.currentPanel = undefined;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._serverClient = new ServerClient(() => {
      const config = vscode.workspace.getConfiguration('designLearn');
      return config.get<string>('serverUrl', 'http://localhost:3100');
    });

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        this._handleWebviewMessage(message);
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    SettingsPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
  }

  private _handleWebviewMessage(message: any) {
    switch (message.type) {
      case 'closeWebview':
        this.dispose();
        break;

      case 'loadData':
        void this._loadAndSendData();
        this._loadHistoryStats();
        break;

      case 'saveModel':
        this._saveModel(message.model);
        break;

      case 'deleteModel':
        this._deleteModel(message.modelId);
        break;

      case 'saveModels':
        this._saveAllModels(message.models);
        break;

      case 'testConnection':
        this._testConnection(message.model);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private async _loadAndSendData() {
    const config = vscode.workspace.getConfiguration('designLearn');
    const models = config.get<any[]>('aiModels', []);

    this._panel.webview.postMessage({
      type: 'updateData',
      models: models
    });
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
    this._loadAndSendData();
    vscode.window.showInformationMessage(`模型 "${model.name}" 已保存`);
  }

  private async _deleteModel(modelId: string) {
    const config = vscode.workspace.getConfiguration('designLearn');
    const models = config.get<any[]>('aiModels', []);

    const filtered = models.filter(m => m.id !== modelId);
    await config.update('aiModels', filtered, vscode.ConfigurationTarget.Global);
    this._loadAndSendData();
  }

  private async _saveAllModels(models: any[]) {
    const config = vscode.workspace.getConfiguration('designLearn');
    await config.update('aiModels', models, vscode.ConfigurationTarget.Global);
    this._loadAndSendData();
  }

  private async _loadHistoryStats() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._panel.webview.postMessage({
        type: 'updateHistoryStats',
        totalExtracts: 0,
        totalAnalysis: 0,
        storageSize: '0 KB'
      });
      return;
    }

    try {
      const snapshotsDir = path.join(workspaceFolder.uri.fsPath, '.designlearn', 'snapshots');
      if (!fs.existsSync(snapshotsDir)) {
        this._panel.webview.postMessage({
          type: 'updateHistoryStats',
          totalExtracts: 0,
          totalAnalysis: 0,
          storageSize: '0 KB'
        });
        return;
      }

      const entries = fs.readdirSync(snapshotsDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory());
      
      let totalExtracts = dirs.length;
      let totalAnalysis = 0;
      let totalSize = 0;

      for (const dir of dirs) {
        const dirPath = path.join(snapshotsDir, dir.name);
        const analysisPath = path.join(dirPath, 'analysis.md');
        if (fs.existsSync(analysisPath)) {
          totalAnalysis++;
        }
        // 计算目录大小
        totalSize += this._getDirSize(dirPath);
      }

      const sizeStr = totalSize > 1024 * 1024 
        ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(totalSize / 1024)} KB`;

      this._panel.webview.postMessage({
        type: 'updateHistoryStats',
        totalExtracts,
        totalAnalysis,
        storageSize: sizeStr
      });
    } catch (err) {
      console.error('Failed to load history stats:', err);
    }
  }

  private _getDirSize(dirPath: string): number {
    let size = 0;
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isFile()) {
          size += fs.statSync(fullPath).size;
        } else if (entry.isDirectory()) {
          size += this._getDirSize(fullPath);
        }
      }
    } catch {}
    return size;
  }

  private async _testConnection(model: any) {
    try {
      const baseUrl = model.baseUrl || (model.provider === 'anthropic' 
        ? 'https://api.anthropic.com/v1' 
        : 'https://api.openai.com/v1');
      
      const url = `${baseUrl}/chat/completions`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (model.provider === 'anthropic') {
        headers['x-api-key'] = model.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${model.apiKey}`;
      }
      
      const body = JSON.stringify({
        model: model.modelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      });
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body
      });
      
      if (response.ok) {
        this._panel.webview.postMessage({
          type: 'testResult',
          success: true,
          message: `模型 "${model.name}" 连接正常`
        });
      } else {
        const errorData = await response.text();
        this._panel.webview.postMessage({
          type: 'testResult',
          success: false,
          error: `HTTP ${response.status}: ${errorData.substring(0, 200)}`
        });
      }
    } catch (error: any) {
      this._panel.webview.postMessage({
        type: 'testResult',
        success: false,
        error: error.message
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview', 'main.js')
    );
    
    // 加载拆分后的 CSS 文件
    const variablesCss = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview', 'styles', 'variables.css')
    );
    const layoutCss = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview', 'styles', 'layout.css')
    );
    const componentsCss = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview', 'styles', 'components.css')
    );
    const modalCss = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview', 'styles', 'modal.css')
    );
    const responsiveCss = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview', 'styles', 'responsive.css')
    );

    // Read the HTML file
    const htmlPath = path.join(
      this._extensionUri.fsPath,
      'media',
      'webview',
      'settings.html'
    );
    let html = fs.readFileSync(htmlPath, 'utf-8');

    // Replace placeholders
    html = html.replace('${variablesCss}', variablesCss.toString());
    html = html.replace('${layoutCss}', layoutCss.toString());
    html = html.replace('${componentsCss}', componentsCss.toString());
    html = html.replace('${modalCss}', modalCss.toString());
    html = html.replace('${responsiveCss}', responsiveCss.toString());
    html = html.replace('${scriptUri}', scriptUri.toString());

    return html;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
