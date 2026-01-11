import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { FileManager } from '../../fileManager';

type PostMessage = (message: any) => void;

export class SnapshotService {
  private readonly _postMessage: PostMessage;

  constructor(postMessage: PostMessage) {
    this._postMessage = postMessage;
  }

  public async loadSnapshots() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this._postMessage({ type: 'updateSnapshots', snapshots: [] });
      return;
    }

    try {
      const fileManager = new FileManager(workspaceFolder.uri.fsPath);
      const snapshotDir = fileManager.getDirectories().snapshots;

      if (!fs.existsSync(snapshotDir)) {
        this._postMessage({ type: 'updateSnapshots', snapshots: [] });
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
          } catch {
            // ignore
          }
        }

        const analysisPath = path.join(folder, 'analysis.md');
        snapshot.hasAnalysis = fs.existsSync(analysisPath);
        snapshots.push(snapshot);
      }

      snapshots.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      this._postMessage({ type: 'updateSnapshots', snapshots });
    } catch {
      this._postMessage({ type: 'updateSnapshots', snapshots: [] });
    }
  }

  public openSnapshot(snapshotPath: string) {
    if (snapshotPath && fs.existsSync(snapshotPath)) {
      vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(snapshotPath));
    }
  }

  public async viewSnapshotHtml(snapshotPath: string) {
    const htmlPath = path.join(snapshotPath, 'index.html');
    if (fs.existsSync(htmlPath)) {
      const doc = await vscode.workspace.openTextDocument(htmlPath);
      await vscode.window.showTextDocument(doc);
    }
  }

  public async deleteSnapshot(snapshotPath: string) {
    if (!snapshotPath || !fs.existsSync(snapshotPath)) return;

    const confirm = await vscode.window.showWarningMessage('确定要删除这个快照吗？', { modal: true }, '删除');
    if (confirm === '删除') {
      try {
        fs.rmSync(snapshotPath, { recursive: true });
        await this.loadSnapshots();
        vscode.window.showInformationMessage('快照已删除');
      } catch (err: any) {
        vscode.window.showErrorMessage(`删除失败: ${err.message}`);
      }
    }
  }

  public async copyMarkdown(snapshot: any) {
    const md = `# ${snapshot.title}\n\n**URL**: ${snapshot.url}\n**提取时间**: ${snapshot.date}\n\n## 设计规范\n@import designlearn://snapshot/${snapshot.id}/style.md`;
    await vscode.env.clipboard.writeText(md);
    vscode.window.showInformationMessage('Markdown 已复制');
  }

  public async copyMcpUri(snapshotId: string) {
    const uri = `designlearn://snapshot/${snapshotId}`;
    await vscode.env.clipboard.writeText(uri);
    vscode.window.showInformationMessage('MCP URI 已复制');
  }
}
