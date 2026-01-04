import * as vscode from 'vscode';
import { PageExtractor } from './extractor';
import { FileManager } from './fileManager';
import { AIAnalyzer } from './aiAnalyzer';
import { SidebarPanel } from './webview/SidebarPanel';
import { SettingsPanel } from './webview/SettingsPanel';
import { ServerManager } from './serverManager';
import * as path from 'path';
import * as fs from 'fs';

let sidebarProvider: SidebarPanel;
let serverManager: ServerManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('=== Design-Learn 插件已激活 ===');

    // 注册侧边栏 WebviewView
    sidebarProvider = new SidebarPanel(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('designLearnSidebar', sidebarProvider)
    );

    // 注册命令：打开设置面板
    const settingsCommand = vscode.commands.registerCommand('design-learn.openSettings', () => {
        SettingsPanel.createOrShow(context.extensionUri);
    });

    // 注册命令：提取网页
    const extractCommand = vscode.commands.registerCommand('design-learn.extract', async () => {
        await extractPage(false);
    });

    // 注册命令：提取并分析（AI）
    const extractWithAICommand = vscode.commands.registerCommand('design-learn.extractWithAI', async () => {
        await extractPage(true);
    });

    // 注册命令：配置 AI 模型
    const configureCommand = vscode.commands.registerCommand('design-learn.configure', async () => {
        SettingsPanel.createOrShow(context.extensionUri);
    });

    // 注册命令：批量分析快照
    const batchAnalyzeCommand = vscode.commands.registerCommand('design-learn.batchAnalyze', async () => {
        await batchAnalyzeSnapshots();
    });

    // 注册命令：分析单个快照
    const analyzeSnapshotCommand = vscode.commands.registerCommand('design-learn.analyzeSnapshot', async (snapshotPath?: string) => {
        await analyzeSingleSnapshot(snapshotPath);
    });

    // 注册命令：刷新快照列表
    const refreshSnapshotsCommand = vscode.commands.registerCommand('design-learn.refreshSnapshots', () => {
        sidebarProvider.refresh();
    });

    // 注册命令：打开快照文件夹
    const openSnapshotsFolderCommand = vscode.commands.registerCommand('design-learn.openSnapshotsFolder', async () => {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            vscode.window.showWarningMessage('请先打开一个工作区以浏览快照。');
            return;
        }
        const fm = new FileManager(workspace.uri.fsPath);
        const dirs = fm.getDirectories();
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(dirs.snapshots));
    });

    const openSnapshotFolderCommand = vscode.commands.registerCommand('design-learn.openSnapshotFolder', async (folderPath: string) => {
        if (!folderPath || !fs.existsSync(folderPath)) {
            vscode.window.showWarningMessage('未找到快照目录。');
            return;
        }
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folderPath));
    });

    serverManager = new ServerManager(context);
    const toggleServerCommand = vscode.commands.registerCommand('design-learn.toggleServer', () => {
        serverManager.toggle();
    });

    const serverConfig = vscode.workspace.getConfiguration('designLearn').get<any>('server');
    if (serverConfig?.autoStart) {
        void serverManager.start();
    }

    context.subscriptions.push(
        settingsCommand,
        extractCommand,
        extractWithAICommand,
        configureCommand,
        batchAnalyzeCommand,
        analyzeSnapshotCommand,
        refreshSnapshotsCommand,
        openSnapshotsFolderCommand,
        openSnapshotFolderCommand,
        toggleServerCommand,
        serverManager
    );
}

async function extractPage(useAI: boolean) {
    try {
        // 检查工作区
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('请先打开一个工作区');
            return;
        }

        // 输入 URL
        const url = await vscode.window.showInputBox({
            prompt: '请输入要提取的网页 URL',
            placeHolder: 'https://example.com',
            validateInput: (value) => {
                try {
                    new URL(value);
                    return null;
                } catch {
                    return '请输入有效的 URL';
                }
            }
        });

        if (!url) {
            return;
        }

        // 显示进度
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在提取网页...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: '初始化提取器...' });

            // 创建提取器
            const extractor = new PageExtractor();
            
            progress.report({ increment: 20, message: '正在加载页面...' });
            
            // 提取页面
            const snapshot = await extractor.extract(url);
            
            progress.report({ increment: 50, message: '正在保存文件...' });

            // 保存文件
            const fileManager = new FileManager(workspaceFolder.uri.fsPath);
            const savedFiles = await fileManager.saveSnapshot(snapshot);

            progress.report({ increment: 80, message: '提取完成' });

            // 如果启用 AI 分析
            if (useAI) {
                progress.report({ increment: 90, message: '正在进行 AI 分析...' });
                
                try {
                    const analyzer = new AIAnalyzer();
                    const analysis = await analyzer.analyze(snapshot);
                    
                    if (analysis && analysis.markdown) {
                        const markdownPath = await fileManager.saveMarkdown(snapshot, analysis.markdown);
                        savedFiles.push(markdownPath);
                        
                        vscode.window.showInformationMessage(
                            `提取和分析完成！已保存 ${savedFiles.length} 个文件`,
                            '打开文件'
                        ).then(selection => {
                            if (selection === '打开文件') {
                                vscode.window.showTextDocument(vscode.Uri.file(markdownPath));
                            }
                        });
                    }
                } catch (aiError: any) {
                    vscode.window.showWarningMessage(`AI 分析失败: ${aiError.message}`);
                }
            } else {
                vscode.window.showInformationMessage(
                    `提取完成！已保存 ${savedFiles.length} 个文件`,
                    '打开文件夹'
                ).then(selection => {
                    if (selection === '打开文件夹') {
                        const folderPath = path.dirname(savedFiles[0]);
                        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(folderPath));
                    }
                });
            }

            progress.report({ increment: 100 });
            sidebarProvider?.refresh();
        });

    } catch (error: any) {
        vscode.window.showErrorMessage(`提取失败: ${error.message}`);
    }
}

async function analyzeSingleSnapshot(snapshotPath?: string) {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('请先打开一个工作区');
            return;
        }

        const fileManager = new FileManager(workspaceFolder.uri.fsPath);
        const snapshotsDir = fileManager.getDirectories().snapshots;

        if (!snapshotPath) {
            if (!fs.existsSync(snapshotsDir)) {
                vscode.window.showWarningMessage('未找到快照目录');
                return;
            }

            const snapshots = fs.readdirSync(snapshotsDir, { withFileTypes: true })
                .filter(e => e.isDirectory())
                .map(e => ({
                    label: e.name,
                    path: path.join(snapshotsDir, e.name)
                }));

            if (snapshots.length === 0) {
                vscode.window.showWarningMessage('没有可分析的快照');
                return;
            }

            const selected = await vscode.window.showQuickPick(snapshots, {
                placeHolder: '选择要分析的快照'
            });

            if (!selected) return;
            snapshotPath = selected.path;
        }

        const metadataPath = path.join(snapshotPath, 'metadata.json');
        if (!fs.existsSync(metadataPath)) {
            vscode.window.showErrorMessage('快照元数据不存在');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在分析快照...',
            cancellable: false
        }, async (progress) => {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
            const analyzer = new AIAnalyzer();
            const analysis = await analyzer.analyze(metadata);

            if (analysis && analysis.markdown) {
                const markdownPath = await fileManager.saveMarkdown(metadata, analysis.markdown);
                vscode.window.showInformationMessage('分析完成！', '打开报告').then(selection => {
                    if (selection === '打开报告') {
                        vscode.window.showTextDocument(vscode.Uri.file(markdownPath));
                    }
                });
            }
        });

        sidebarProvider?.refresh();
    } catch (error: any) {
        vscode.window.showErrorMessage(`分析失败: ${error.message}`);
    }
}

async function batchAnalyzeSnapshots() {
    try {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('请先打开一个工作区');
            return;
        }

        const fileManager = new FileManager(workspaceFolder.uri.fsPath);
        const snapshotsDir = fileManager.getDirectories().snapshots;

        if (!fs.existsSync(snapshotsDir)) {
            vscode.window.showWarningMessage('未找到快照目录');
            return;
        }

        const snapshots = fs.readdirSync(snapshotsDir, { withFileTypes: true })
            .filter(e => e.isDirectory())
            .map(e => path.join(snapshotsDir, e.name))
            .filter(p => !fs.existsSync(path.join(p, 'analysis.md')));

        if (snapshots.length === 0) {
            vscode.window.showInformationMessage('所有快照都已分析');
            return;
        }

        const confirm = await vscode.window.showInformationMessage(
            `发现 ${snapshots.length} 个未分析的快照，是否批量分析？`,
            '开始分析',
            '取消'
        );

        if (confirm !== '开始分析') return;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '批量分析中...',
            cancellable: false
        }, async (progress) => {
            const analyzer = new AIAnalyzer();
            let completed = 0;

            for (const snapshotPath of snapshots) {
                const metadataPath = path.join(snapshotPath, 'metadata.json');
                if (!fs.existsSync(metadataPath)) continue;

                try {
                    progress.report({
                        increment: (100 / snapshots.length),
                        message: `${completed + 1}/${snapshots.length}`
                    });

                    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
                    const analysis = await analyzer.analyze(metadata);

                    if (analysis && analysis.markdown) {
                        await fileManager.saveMarkdown(metadata, analysis.markdown);
                    }

                    completed++;
                } catch (error: any) {
                    console.error(`分析失败 ${snapshotPath}:`, error);
                }
            }

            vscode.window.showInformationMessage(`批量分析完成！成功分析 ${completed}/${snapshots.length} 个快照`);
        });

        sidebarProvider?.refresh();
    } catch (error: any) {
        vscode.window.showErrorMessage(`批量分析失败: ${error.message}`);
    }
}

export function deactivate() {
    SettingsPanel.kill();
    if (serverManager) {
        serverManager.dispose();
    }
}
