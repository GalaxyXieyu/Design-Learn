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

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'designLearnSidebar';
  private _view?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;
  private _services?: {
    serverClient: ServerClient;
    pollingService: PollingService;
    designService: DesignService;
    importService: ImportService;
    snapshotService: SnapshotService;
    modelService: ModelService;
    configService: ConfigService;
  };

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
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

    this._services = {
      serverClient,
      pollingService,
      designService,
      importService,
      snapshotService,
      modelService,
      configService,
    };

    const router = new MessageRouter({
      extract: (message) => importService.importUrl(message.url, false),
      extractWithAI: (message) => importService.importUrl(message.url, true),
      extractAll: (message) => importService.importAllRoutes(message.url, message.useAI),
      scanRoutes: (message) => importService.scanRoutes(message.url),
      loadData: () => {
        setImmediate(() => {
          modelService.loadModels();
          void designService.loadDesigns();
          configService.loadConfig();
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
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, 'styles.css'));
    const htmlPath = vscode.Uri.joinPath(mediaPath, 'index.html').fsPath;
    const scriptFiles = [
      'utils/url.js',
      'utils/format.js',
      'utils/dom.js',
      'state/store.js',
      'ui/models.js',
      'ui/historyList.js',
      'ui/settings.js',
      'ui/serverModal.js',
      'handlers/events.js',
      'handlers/messages.js',
      'main.js',
    ];

    const scripts = scriptFiles
      .map((file) => {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, file));
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
