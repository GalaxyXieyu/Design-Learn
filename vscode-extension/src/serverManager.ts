import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class ServerManager implements vscode.Disposable {
  private process: ChildProcess | null = null;
  private statusItem: vscode.StatusBarItem;
  private output: vscode.OutputChannel;

  constructor(private context: vscode.ExtensionContext) {
    this.output = vscode.window.createOutputChannel('Design-Learn Server');
    this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
    this.statusItem.command = 'design-learn.toggleServer';
    this.statusItem.show();
    this.updateStatus();
    this.context.subscriptions.push(this.output, this.statusItem);
  }

  async start(): Promise<void> {
    if (this.process) {
      vscode.window.showInformationMessage('Design-Learn 服务已在运行。');
      return;
    }

    const serverConfig = this.getServerConfig();
    if (!serverConfig) {
      return;
    }

    const { entry, cwd, port, nodePath } = serverConfig;
    const env = { ...process.env };
    if (port) {
      env.PORT = String(port);
    }

    const preferredNode =
      typeof nodePath === 'string' && nodePath.trim()
        ? nodePath.trim()
        : (process.env.DESIGN_LEARN_NODE_PATH?.trim() || 'node');

    let hasRetried = false;
    const spawnServer = (exec: string) => {
      this.output.appendLine(`[server] starting: ${exec} ${entry}`);
      const child = spawn(exec, [entry], { cwd, env });
      this.process = child;

      let stderrText = '';
      child.stdout?.on('data', (chunk) => this.output.append(chunk.toString()));
      child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        stderrText += text;
        if (stderrText.length > 10_000) {
          stderrText = stderrText.slice(-10_000);
        }
        this.output.append(text);
      });

      child.on('error', (err: any) => {
        this.output.appendLine(`[server] failed to start: ${err?.message || String(err)}`);
        if (!hasRetried && exec !== process.execPath) {
          hasRetried = true;
          this.output.appendLine(`[server] retry with: ${process.execPath}`);
          this.process = null;
          this.updateStatus();
          spawnServer(process.execPath);
        }
      });

      child.on('exit', (code) => {
        this.output.appendLine(`[server] exited with code ${code ?? 'unknown'}`);
        if (code && /NODE_MODULE_VERSION|compiled against a different Node\\.js version/i.test(stderrText)) {
          vscode.window
            .showErrorMessage(
              'Design-Learn 服务启动失败：Node 原生依赖版本不匹配（常见于 better-sqlite3）。',
              '修复（npm rebuild）',
              '打开设置'
            )
            .then(async (selection) => {
              if (selection === '打开设置') {
                void vscode.commands.executeCommand('workbench.action.openSettings', 'designLearn.server');
                return;
              }
              if (selection !== '修复（npm rebuild）') return;

              try {
                this.output.appendLine('[server] running: npm rebuild (design-learn-server)');
                await new Promise<void>((resolve, reject) => {
                  const rebuild = spawn('npm', ['rebuild'], { cwd, env, shell: true });
                  rebuild.stdout?.on('data', (chunk) => this.output.append(chunk.toString()));
                  rebuild.stderr?.on('data', (chunk) => this.output.append(chunk.toString()));
                  rebuild.on('error', reject);
                  rebuild.on('exit', (rebuildCode) => {
                    if (rebuildCode === 0) resolve();
                    else reject(new Error(`npm rebuild exit code ${rebuildCode ?? 'unknown'}`));
                  });
                });
                vscode.window.showInformationMessage('依赖重建完成，正在重试启动服务…');
                spawnServer(exec);
              } catch (err: any) {
                vscode.window.showErrorMessage(`依赖重建失败：${err?.message || String(err)}`);
              }
            });
        }
        this.process = null;
        this.updateStatus();
      });

      this.updateStatus();
      this.output.show(true);
    };

    spawnServer(preferredNode);
  }

  stop(): void {
    if (!this.process) {
      vscode.window.showInformationMessage('Design-Learn 服务未运行。');
      return;
    }

    this.output.appendLine('[server] stopping');
    this.process.kill();
    this.process = null;
    this.updateStatus();
  }

  toggle(): void {
    if (this.process) {
      this.stop();
    } else {
      this.start();
    }
  }

  dispose(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.statusItem.dispose();
    this.output.dispose();
  }

  private updateStatus(): void {
    this.statusItem.text = this.process
      ? '$(debug-start) Design-Learn Server: Running'
      : '$(debug-stop) Design-Learn Server: Stopped';
  }

  private getServerConfig(): { entry: string; cwd: string; port?: number; nodePath?: string } | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('请先打开一个工作区以启动 Design-Learn 服务。');
      return null;
    }

    const config = vscode.workspace.getConfiguration('designLearn');
    const serverConfig = config.get<any>('server') || {};
    const workspaceRoot = workspaceFolder.uri.fsPath;
    const entryTemplate = serverConfig.entry || '${workspaceFolder}/design-learn-server/src/server.js';
    const cwdTemplate = serverConfig.cwd || '${workspaceFolder}/design-learn-server';

    const entry = entryTemplate.replace('${workspaceFolder}', workspaceRoot);
    const cwd = cwdTemplate.replace('${workspaceFolder}', workspaceRoot);

    if (!fs.existsSync(entry)) {
      vscode.window.showErrorMessage(`未找到服务入口文件: ${entry}`);
      return null;
    }

    return {
      entry,
      cwd: fs.existsSync(cwd) ? cwd : path.dirname(entry),
      port: serverConfig.port,
      nodePath: serverConfig.nodePath
    };
  }
}
