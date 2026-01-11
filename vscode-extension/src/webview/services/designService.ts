import * as vscode from 'vscode';
import { AiAnalysisService } from './aiAnalysisService';
import { ServerClient } from './serverClient';

type PostMessage = (message: any) => void;

export class DesignService {
  private readonly _serverClient: ServerClient;
  private readonly _aiService: AiAnalysisService;
  private readonly _postMessage: PostMessage;

  constructor(serverClient: ServerClient, aiService: AiAnalysisService, postMessage: PostMessage) {
    this._serverClient = serverClient;
    this._aiService = aiService;
    this._postMessage = postMessage;
  }

  public async loadDesigns() {
    try {
      const result = await this._serverClient.requestToServer('GET', '/api/designs?limit=200', null);
      const items = Array.isArray(result.items) ? result.items : [];
      const jobIds = items
        .map((item: any) => item?.metadata?.processingJobId)
        .filter((jobId: string) => !!jobId);

      let jobsById = new Map<string, any>();
      if (jobIds.length) {
        try {
          const jobsResult = await this._serverClient.requestToServer('GET', '/api/import/jobs', null);
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

      const decorated = this._aiService.applyPendingStatus(merged);
      this._postMessage({ type: 'updateDesigns', items: decorated });
      this._aiService.maybeRunAiAnalysis(decorated, jobsById);
    } catch {
      this._postMessage({ type: 'updateDesigns', items: [] });
    }
  }

  public async deleteDesign(designId: string) {
    if (!designId) return;
    const confirm = await vscode.window.showWarningMessage('确定要删除这个设计记录吗？', { modal: true }, '删除');
    if (confirm !== '删除') return;

    try {
      await this._serverClient.requestToServer(
        'DELETE',
        `/api/designs/${encodeURIComponent(designId)}`,
        null
      );
      await this.loadDesigns();
      vscode.window.showInformationMessage('已删除设计记录');
    } catch (err: any) {
      vscode.window.showErrorMessage(`删除失败: ${err.message}`);
    }
  }

  public async viewDesign(designId: string) {
    if (!designId) return;

    try {
      const design = await this._serverClient.requestToServer(
        'GET',
        `/api/designs/${encodeURIComponent(designId)}`,
        null
      );
      let versionId = design?.metadata?.lastImportVersionId;
      if (!versionId) {
        try {
          const result = await this._serverClient.requestToServer(
            'GET',
            `/api/snapshots?designId=${encodeURIComponent(designId)}&limit=1`,
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
          const version = await this._serverClient.requestToServer(
            'GET',
            `/api/versions/${encodeURIComponent(versionId)}`,
            null
          );
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

  public async copyDesignMcpUri(designId: string) {
    if (!designId) return;
    const uri = `design://${designId}`;
    await vscode.env.clipboard.writeText(uri);
    vscode.window.showInformationMessage('MCP URI 已复制');
  }

  public async viewDesignHtml(designId: string) {
    if (!designId) return;
    try {
      const result = await this._serverClient.requestToServer(
        'GET',
        `/api/snapshots?designId=${encodeURIComponent(designId)}&limit=1`,
        null
      );
      const snapshot = Array.isArray(result.items) ? result.items[0] : null;
      if (snapshot?.html) {
        const doc = await vscode.workspace.openTextDocument({
          language: 'html',
          content: snapshot.html,
        });
        await vscode.window.showTextDocument(doc, { preview: true });
      } else {
        vscode.window.showWarningMessage('未找到 HTML 内容');
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`加载 HTML 失败: ${err.message}`);
    }
  }

  public async loadDesignSnapshots(designId: string) {
    if (!designId) return;
    try {
      const result = await this._serverClient.requestToServer(
        'GET',
        `/api/snapshots?designId=${encodeURIComponent(designId)}&limit=100`,
        null
      );
      const snapshots = Array.isArray(result.items) ? result.items : [];
      this._postMessage({ type: 'designSnapshots', designId, snapshots });
    } catch {
      this._postMessage({ type: 'designSnapshots', designId, snapshots: [] });
    }
  }
}
