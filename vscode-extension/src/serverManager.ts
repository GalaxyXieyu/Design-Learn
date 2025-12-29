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

    const { entry, cwd, port } = serverConfig;
    const nodePath = process.execPath;
    const env = { ...process.env };
    if (port) {
      env.PORT = String(port);
    }

    this.output.appendLine(`[server] starting: ${nodePath} ${entry}`);
    this.process = spawn(nodePath, [entry], { cwd, env });

    this.process.stdout?.on('data', (chunk) => this.output.append(chunk.toString()));
    this.process.stderr?.on('data', (chunk) => this.output.append(chunk.toString()));

    this.process.on('exit', (code) => {
      this.output.appendLine(`[server] exited with code ${code ?? 'unknown'}`);
      this.process = null;
      this.updateStatus();
    });

    this.updateStatus();
    this.output.show(true);
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

  private getServerConfig(): { entry: string; cwd: string; port?: number } | null {
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
      port: serverConfig.port
    };
  }
}
