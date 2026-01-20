import * as fs from 'fs';
import * as vscode from 'vscode';
import { MessageRouter } from './messageRouter';
import { AiAnalysisService } from './services/aiAnalysisService';
import { ConfigService } from './services/configService';
import { DesignService } from './services/designService';
import { ImportService } from './services/importService';
import { ModelService } from './services/modelService';
import { PollingService } from './services/pollingService';
import { ServerClient } from './services/serverClient';
import { SnapshotService } from './services/snapshotService';
import { UIProService } from './services/uiproService';

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'designLearnSidebar';
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private readonly _cacheBuster: string;
  private _services?: {
    serverClient: ServerClient;
    pollingService: PollingService;
    designService: DesignService;
    importService: ImportService;
    snapshotService: SnapshotService;
    modelService: ModelService;
    configService: ConfigService;
    uiproService: UIProService;
  };

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
    this._cacheBuster = Date.now().toString(36);
  }

  public refresh() {
    if (!this._services) return;
    void this._services.designService.loadDesigns();
    void this._services.serverClient.checkServerStatus((connected, url) => {
      this._view?.webview.postMessage({ type: 'serverStatus', connected, url });
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    const postMessage = (message: any) => {
      this._view?.webview.postMessage(message);
    };

    const getServerUrl = () => {
      const config = vscode.workspace.getConfiguration('designLearn');
      return config.get<string>('serverUrl', 'http://localhost:3100');
    };

    const serverClient = new ServerClient(getServerUrl);
    const pollingService = new PollingService(() => {
      void this._services?.designService.loadDesigns();
    });
    const aiService = new AiAnalysisService(serverClient);
    const designService = new DesignService(serverClient, aiService, postMessage);
    const importService = new ImportService(serverClient, aiService, designService, postMessage, pollingService);
    const snapshotService = new SnapshotService(postMessage);
    const modelService = new ModelService(postMessage, serverClient);
    const configService = new ConfigService(postMessage);
    const uiproService = new UIProService(serverClient, postMessage);

    this._services = {
      serverClient,
      pollingService,
      designService,
      importService,
      snapshotService,
      modelService,
      configService,
      uiproService,
    };

    const loadPromptTemplates = async () => {
      const config = vscode.workspace.getConfiguration('designLearn');
      const selectedTemplateId = config.get<string>('selectedPromptTemplateId', '');
      try {
        const result = await serverClient.requestToServer(
          'GET',
          '/api/prompt-templates?type=styleguide&limit=100',
          null
        );
        const items = Array.isArray(result.items) ? result.items : [];
        const templates = items.map((item: any) => ({
          id: item.id,
          name: item.name,
          prompt: item.content,
          isDefault: !!item.isDefault,
          system: !!item?.metadata?.system,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));
        postMessage({ type: 'updatePromptTemplates', templates, selectedTemplateId });
      } catch {
        const localTemplates = config.get<any[]>('promptTemplates', []);
        const templates = localTemplates.map((item: any) => ({
          ...item,
          isDefault: !!item.active,
          system: !!item?.system,
        }));
        postMessage({ type: 'updatePromptTemplates', templates, selectedTemplateId });
      }
    };

    const savePromptTemplate = async (template: any) => {
      if (!template || !template.name || !template.prompt) {
        vscode.window.showWarningMessage('模板名称和提示词内容不能为空');
        return;
      }
      const config = vscode.workspace.getConfiguration('designLearn');
      try {
        const payload = {
          name: template.name,
          type: 'styleguide',
          content: template.prompt,
          description: template.description || '',
          isDefault: template.active === true,
        };
        if (template?.isUpdate && template.id) {
          await serverClient.requestToServer(
            'PATCH',
            `/api/prompt-templates/${encodeURIComponent(template.id)}`,
            payload
          );
        } else {
          await serverClient.requestToServer('POST', '/api/prompt-templates', {
            id: template.id,
            ...payload,
          });
        }
        await loadPromptTemplates();
        vscode.window.showInformationMessage(`模板 "${template.name}" 已保存`);
      } catch {
        const templates = config.get<any[]>('promptTemplates', []);
        const normalizedTemplate = { ...template };
        delete normalizedTemplate.isUpdate;
        if (normalizedTemplate.active) {
          templates.forEach(t => t.active = false);
        }
        const existingIndex = templates.findIndex(t => t.id === normalizedTemplate.id);
        if (existingIndex >= 0) {
          templates[existingIndex] = normalizedTemplate;
        } else {
          templates.push(normalizedTemplate);
        }
        await config.update('promptTemplates', templates, vscode.ConfigurationTarget.Global);
        await loadPromptTemplates();
        vscode.window.showInformationMessage(`模板 "${template.name}" 已保存（本地）`);
      }
    };

    const deletePromptTemplate = async (templateId: string) => {
      const config = vscode.workspace.getConfiguration('designLearn');
      if (!templateId) return;
      try {
        await serverClient.requestToServer(
          'DELETE',
          `/api/prompt-templates/${encodeURIComponent(templateId)}`,
          null
        );
        await loadPromptTemplates();
      } catch {
        const templates = config.get<any[]>('promptTemplates', []);
        const filtered = templates.filter(t => t.id !== templateId);
        await config.update('promptTemplates', filtered, vscode.ConfigurationTarget.Global);
        await loadPromptTemplates();
      }
    };

    const router = new MessageRouter({
      extract: (message) => importService.importUrl(message.url, false, message.templateId),
      extractWithAI: (message) => importService.importUrl(message.url, true, message.templateId),
      extractAll: (message) => importService.importAllRoutes(message.url, message.useAI, message.templateId),
      scanRoutes: (message) => importService.scanRoutes(message.url),
      loadData: () => {
        setImmediate(() => {
          modelService.loadModels();
          void designService.loadDesigns();
          configService.loadConfig();
          void loadPromptTemplates();
          void uiproService.loadMeta();
          void serverClient.checkServerStatus((connected, url) => {
            postMessage({ type: 'serverStatus', connected, url });
          });
        });
      },
      loadDesigns: () => designService.loadDesigns(),
      checkServer: () =>
        serverClient.checkServerStatus((connected, url) => {
          postMessage({ type: 'serverStatus', connected, url });
        }),
      updateServerUrl: async (message) => {
        const config = vscode.workspace.getConfiguration('designLearn');
        await config.update('serverUrl', message.url, vscode.ConfigurationTarget.Global);
        await serverClient.checkServerStatus((connected, url) => {
          postMessage({ type: 'serverStatus', connected, url });
        });
      },
      openSnapshot: (message) => snapshotService.openSnapshot(message.path),
      viewSnapshot: (message) => snapshotService.viewSnapshotHtml(message.path),
      deleteSnapshot: (message) => snapshotService.deleteSnapshot(message.path),
      selectModel: (message) => modelService.selectModel(message.modelId),
      saveModel: (message) => modelService.saveModel(message.model),
      deleteModel: (message) => modelService.deleteModel(message.modelId),
      analyzeSnapshot: (message) => vscode.commands.executeCommand('design-learn.analyzeSnapshot', message.path),
      batchAnalyze: () => vscode.commands.executeCommand('design-learn.batchAnalyze'),
      copyMarkdown: (message) => snapshotService.copyMarkdown(message.snapshot),
      copyMcpUri: (message) => snapshotService.copyMcpUri(message.snapshotId),
      copyDesignMcpUri: (message) => designService.copyDesignMcpUri(message.designId),
      viewDesign: (message) => designService.viewDesign(message.designId),
      viewDesignHtml: (message) => designService.viewDesignHtml(message.designId),
      loadDesignSnapshots: (message) => designService.loadDesignSnapshots(message.designId),
      deleteDesign: (message) => designService.deleteDesign(message.designId),
      loadUiproMeta: () => uiproService.loadMeta(),
      searchUipro: (message) => uiproService.search(message.query || '', { domain: message.domain, limit: message.limit }),
      searchUiproStack: (message) =>
        uiproService.searchStack(message.query || '', message.stack || '', { limit: message.limit }),
      browseUipro: (message) => uiproService.browse({ domain: message.domain, limit: message.limit, offset: message.offset }),
      suggestUipro: (message) => uiproService.suggest({ domain: message.domain, limit: message.limit }),
      browseUiproStack: (message) =>
        uiproService.browseStack(message.stack || '', { limit: message.limit, offset: message.offset }),
      suggestUiproStack: (message) => uiproService.suggestStack(message.stack || '', { limit: message.limit }),
      openExternal: async (message) => {
        const raw = typeof message?.url === 'string' ? message.url : '';
        if (!raw) return;
        try {
          const parsed = vscode.Uri.parse(raw);
          if (parsed.scheme !== 'http' && parsed.scheme !== 'https') return;
          await vscode.env.openExternal(parsed);
        } catch {
          // ignore
        }
      },
      copyText: async (message) => {
        const text = typeof message?.text === 'string' ? message.text : '';
        if (!text) return;
        await vscode.env.clipboard.writeText(text);
      },
      selectPromptTemplate: async (message) => {
        const config = vscode.workspace.getConfiguration('designLearn');
        const templateId = typeof message?.templateId === 'string' ? message.templateId : '';
        await config.update('selectedPromptTemplateId', templateId || '', vscode.ConfigurationTarget.Global);
      },
      savePromptTemplate: async (message) => savePromptTemplate(message.template),
      deletePromptTemplate: async (message) => deletePromptTemplate(message.templateId),
      confirmDeleteTemplate: async (message) => {
        const result = await vscode.window.showWarningMessage(
          '确定要删除这个模板吗？',
          { modal: true },
          '删除',
          '取消'
        );
        if (result === '删除') {
          postMessage({ type: 'executeDeleteTemplate', templateId: message.templateId });
        }
      },
      openSettingsPanel: () => vscode.commands.executeCommand('design-learn.openSettings'),
      saveConfig: (message) => configService.saveConfig(message.config),
      startDesignPolling: () => pollingService.start(),
      stopDesignPolling: () => pollingService.stop(),
    });

    webviewView.webview.onDidReceiveMessage((message) => {
      void router.handle(message);
    });

    webviewView.onDidDispose(() => {
      pollingService.stop();
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const mediaPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar');
    const styleUri = webview
      .asWebviewUri(vscode.Uri.joinPath(mediaPath, 'styles.css'))
      .with({ query: `v=${this._cacheBuster}` });
    const htmlPath = vscode.Uri.joinPath(mediaPath, 'index.html').fsPath;
    const scriptFiles = [
      'utils/url.js',
      'utils/format.js',
      'utils/dom.js',
      'state/store.js',
      'ui/models.js',
      'ui/templates.js',
      'ui/historyList.js',
      'ui/settings.js',
      'ui/serverModal.js',
      'handlers/events.js',
      'handlers/messages.js',
      'main.js',
    ];

    const scripts = scriptFiles
      .map((file) => {
        const scriptUri = webview
          .asWebviewUri(vscode.Uri.joinPath(mediaPath, file))
          .with({ query: `v=${this._cacheBuster}` });
        return `<script src="${scriptUri}"></script>`;
      })
      .join('\n');

    let html = fs.readFileSync(htmlPath, 'utf-8');
    html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);
    html = html.replace(/\{\{styleUri\}\}/g, styleUri.toString());
    html = html.replace(/\{\{scripts\}\}/g, scripts);

    return html;
  }
}
