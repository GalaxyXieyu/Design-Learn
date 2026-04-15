import * as vscode from 'vscode';
import { spawn, ChildProcess, execSync } from 'child_process';
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

    const { entry, cwd, port, nodePath, dataDir } = serverConfig;
    const env = { ...process.env };
    if (port) {
      env.PORT = String(port);
    }
    // 默认优先使用工作区 data/（若存在），避免“模板库为空”（数据落在 ~/.design-learn/data）
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder?.uri.fsPath;
    const defaultWorkspaceDataDir = workspaceRoot ? path.join(workspaceRoot, 'data') : '';
    const resolvedDataDir =
      typeof dataDir === 'string' && dataDir.trim()
        ? dataDir.replace('${workspaceFolder}', workspaceRoot || '').trim()
        : (defaultWorkspaceDataDir && fs.existsSync(defaultWorkspaceDataDir) ? defaultWorkspaceDataDir : '');
    if (resolvedDataDir) {
      env.DESIGN_LEARN_DATA_DIR = resolvedDataDir;
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
                this.output.appendLine('[server] running: npm rebuild (server)');
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

  private getServerConfig(): { entry: string; cwd: string; port?: number; nodePath?: string; dataDir?: string } | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('请先打开一个工作区以启动 Design-Learn 服务。');
      return null;
    }

    const config = vscode.workspace.getConfiguration('designLearn');
    const serverConfig = config.get<any>('server') || {};
    const workspaceRoot = workspaceFolder.uri.fsPath;
    const entryTemplate = serverConfig.entry || '${workspaceFolder}/server/src/server.js';
    const cwdTemplate = serverConfig.cwd || '${workspaceFolder}/server';

    let entry = entryTemplate.replace('${workspaceFolder}', workspaceRoot);
    let cwd = cwdTemplate.replace('${workspaceFolder}', workspaceRoot);

    // 如果工作区内没有服务器文件，尝试查找全局安装的 design-learn-server
    if (!fs.existsSync(entry)) {
      const globalEntry = this.findGlobalServerEntry();
      if (globalEntry) {
        this.output.appendLine(`[server] 使用全局安装的 design-learn-server: ${globalEntry}`);
        entry = globalEntry;
        cwd = path.dirname(entry);
      } else {
        vscode.window.showErrorMessage(
          `未找到服务入口文件: ${entry}\n\n提示: 可以通过 npm install -g design-learn-server 全局安装，或在设置中配置 designLearn.server.entry`
        );
        return null;
      }
    }

    return {
      entry,
      cwd: fs.existsSync(cwd) ? cwd : path.dirname(entry),
      port: serverConfig.port,
      nodePath: serverConfig.nodePath,
      dataDir: serverConfig.dataDir
    };
  }

  /**
   * 查找全局安装的 design-learn-server 入口文件
   */
  private findGlobalServerEntry(): string | null {
    // 方法1: 尝试通过 npm root -g 获取全局 node_modules 路径
    try {
      const globalRoot = execSync('npm root -g', { encoding: 'utf-8', timeout: 5000 }).trim();
      const globalEntry = path.join(globalRoot, 'design-learn-server', 'src', 'server.js');
      if (fs.existsSync(globalEntry)) {
        return globalEntry;
      }
    } catch {
      // ignore
    }

    // 方法2: 检查常见的全局安装路径
    const possiblePaths = this.getCommonGlobalPaths();
    for (const basePath of possiblePaths) {
      const entry = path.join(basePath, 'design-learn-server', 'src', 'server.js');
      if (fs.existsSync(entry)) {
        return entry;
      }
    }

    // 方法3: 尝试通过 npx 解析包路径
    try {
      const result = execSync('npm list -g design-learn-server --parseable 2>/dev/null || true', {
        encoding: 'utf-8',
        timeout: 5000
      }).trim();
      if (result) {
        const entry = path.join(result, 'src', 'server.js');
        if (fs.existsSync(entry)) {
          return entry;
        }
      }
    } catch {
      // ignore
    }

    return null;
  }

  /**
   * 获取常见的全局 node_modules 路径
   */
  private getCommonGlobalPaths(): string[] {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      return [
        path.join(appData, 'npm', 'node_modules'),
        path.join(home, 'AppData', 'Local', 'npm', 'node_modules'),
        'C:\\Program Files\\nodejs\\node_modules',
        'C:\\Program Files (x86)\\nodejs\\node_modules',
      ];
    } else {
      return [
        '/usr/local/lib/node_modules',
        '/usr/lib/node_modules',
        path.join(home, '.npm-global', 'lib', 'node_modules'),
        path.join(home, '.nvm', 'versions', 'node', process.version, 'lib', 'node_modules'),
      ];
    }
  }
}
