import * as vscode from 'vscode';
import { normalizeUrlInput } from '../utils/url';
import { AiAnalysisService } from './aiAnalysisService';
import { DesignService } from './designService';
import { PollingService } from './pollingService';
import { ServerClient } from './serverClient';

type PostMessage = (message: any) => void;

export class ImportService {
  private readonly _serverClient: ServerClient;
  private readonly _aiService: AiAnalysisService;
  private readonly _designService: DesignService;
  private readonly _postMessage: PostMessage;
  private readonly _pollingService: PollingService;

  constructor(
    serverClient: ServerClient,
    aiService: AiAnalysisService,
    designService: DesignService,
    postMessage: PostMessage,
    pollingService: PollingService
  ) {
    this._serverClient = serverClient;
    this._aiService = aiService;
    this._designService = designService;
    this._postMessage = postMessage;
    this._pollingService = pollingService;
  }

  public async importUrl(url: string, useAI: boolean) {
    const normalizedUrl = normalizeUrlInput(url);
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

    this._postMessage({ type: 'extracting', status: true });

    try {
      const result = await this._serverClient.requestToServer(
        'POST',
        '/api/import/url',
        { url: normalizedUrl, options: { useAI: !!useAI } }
      );
      if (useAI && result?.job?.id && result?.designId) {
        this._aiService.trackJob(result.job.id, result.designId);
      }
      await this._designService.loadDesigns();
      this._pollingService.start();
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
      this._postMessage({ type: 'extracting', status: false });
    }
  }

  public async scanRoutes(url: string) {
    const normalizedUrl = normalizeUrlInput(url);
    if (!normalizedUrl) return;
    try {
      new URL(normalizedUrl);
    } catch {
      return;
    }

    this._postMessage({ type: 'scanningRoutes', status: true });

    try {
      const result = await this._serverClient.requestToServer(
        'POST',
        '/api/scan-routes',
        { url: normalizedUrl, limit: 10 }
      );
      this._postMessage({ type: 'routesScanned', routes: result.routes || [], baseUrl: normalizedUrl });
    } catch (err: any) {
      vscode.window.showErrorMessage(`扫描路由失败: ${err.message}`);
      this._postMessage({
        type: 'routesScanned',
        routes: [],
        baseUrl: normalizedUrl,
        error: err.message,
      });
    } finally {
      this._postMessage({ type: 'scanningRoutes', status: false });
    }
  }

  public async importAllRoutes(baseUrl: string, useAI: boolean) {
    const normalizedBaseUrl = normalizeUrlInput(baseUrl);
    if (!normalizedBaseUrl) return;

    try {
      const result = await this._serverClient.requestToServer(
        'POST',
        '/api/scan-routes',
        { url: normalizedBaseUrl, limit: 10 }
      );
      const routes: string[] = result.routes || [];
      this._postMessage({
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
      const orderedRoutes = routes.slice();
      const basePath = baseUrlObj.pathname || '/';
      const basePathTrimmed = basePath !== '/' ? basePath.replace(/\/$/, '') : basePath;
      let baseIndex = orderedRoutes.indexOf(basePath);
      if (baseIndex === -1 && basePathTrimmed !== basePath) {
        baseIndex = orderedRoutes.indexOf(basePathTrimmed);
      }
      if (baseIndex > 0) {
        const [baseRoute] = orderedRoutes.splice(baseIndex, 1);
        orderedRoutes.unshift(baseRoute);
      }

      // 发送批量任务开始消息
      this._postMessage({
        type: 'batchImportStarted',
        baseUrl: normalizedBaseUrl,
        routes: orderedRoutes,
        total: orderedRoutes.length
      });

      let designId: string | null = null;
      for (let i = 0; i < orderedRoutes.length; i++) {
        const route = orderedRoutes[i];
        const fullUrl = `${baseUrlObj.origin}${route}`;

        // 发送进度更新
        this._postMessage({
          type: 'batchImportProgress',
          current: i + 1,
          total: orderedRoutes.length,
          route: route
        });

        // 所有路由都不触发 AI，最后统一触发
        const payload: Record<string, any> = { url: fullUrl, options: { useAI: false } };
        if (designId) {
          payload.designId = designId;
        }
        const importResult = await this._serverClient.requestToServer('POST', '/api/import/url', payload);
        if (!designId && importResult?.designId) {
          designId = importResult.designId;
        }
      }

      // 批量导入完成后，手动触发 AI 分析
      if (useAI && designId) {
        this._postMessage({
          type: 'batchImportProgress',
          current: orderedRoutes.length,
          total: orderedRoutes.length,
          route: 'AI 分析中...'
        });
        this._aiService.trackJob('batch-' + Date.now(), designId);
      }

      this._postMessage({ type: 'batchImportCompleted', designId });
      vscode.window.showInformationMessage(`已开始导入 ${routes.length} 个路由`);
      await this._designService.loadDesigns();
      this._pollingService.start();
    } catch (err: any) {
      this._postMessage({ type: 'batchImportCompleted', designId: null, error: err.message });
      vscode.window.showErrorMessage(`批量提取失败: ${err.message}`);
    }
  }
}
