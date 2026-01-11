import * as vscode from 'vscode';
import { AIAnalyzer } from '../../aiAnalyzer';
import { toAnalyzerSnapshot } from '../utils/snapshotMapper';
import { ServerClient } from './serverClient';

export class AiAnalysisService {
  private readonly _pendingAiJobs = new Map<string, { designId: string }>();
  private readonly _analysisInFlight = new Set<string>();
  private readonly _serverClient: ServerClient;

  constructor(serverClient: ServerClient) {
    this._serverClient = serverClient;
  }

  public trackJob(jobId: string, designId: string) {
    if (jobId && designId) {
      this._pendingAiJobs.set(jobId, { designId });
    }
  }

  public applyPendingStatus(items: any[]) {
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

  public maybeRunAiAnalysis(items: any[], jobsById: Map<string, any>) {
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
      await this._updateDesignProcessing(designId, {
        processingStatus: 'analyzing',
        processingMessage: 'ai_analyzing',
        processingProgress: 90,
        processingError: null,
        aiRequested: true,
        aiCompleted: false,
      });

      const result = await this._serverClient.requestToServer(
        'GET',
        `/api/snapshots?designId=${encodeURIComponent(designId)}&limit=20`,
        null
      );
      const snapshots = Array.isArray(result.items) ? result.items : [];
      const snapshot = snapshots[0] || null;
      if (!snapshot || !snapshot.versionId) return;

      const existing = await this._serverClient.requestToServer(
        'GET',
        `/api/versions/${encodeURIComponent(snapshot.versionId)}`,
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
      const analyzerSnapshots = snapshots.map((item: any) => toAnalyzerSnapshot(item));
      const analysis = analyzerSnapshots.length > 1
        ? await analyzer.analyzeBatch(analyzerSnapshots)
        : await analyzer.analyze(analyzerSnapshots[0]);

      if (analysis?.markdown) {
        await this._serverClient.requestToServer(
          'PATCH',
          `/api/versions/${encodeURIComponent(snapshot.versionId)}`,
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
      await this._serverClient.requestToServer(
        'PATCH',
        `/api/designs/${encodeURIComponent(designId)}`,
        { metadata: metaPatch }
      );
    } catch {
      // ignore
    }
  }
}
