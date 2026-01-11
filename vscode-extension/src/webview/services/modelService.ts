import * as vscode from 'vscode';
import { ServerClient } from './serverClient';

type PostMessage = (message: any) => void;

export class ModelService {
  private readonly _postMessage: PostMessage;
  private readonly _serverClient: ServerClient;

  constructor(postMessage: PostMessage, serverClient: ServerClient) {
    this._postMessage = postMessage;
    this._serverClient = serverClient;
  }

  public async loadModels() {
    const config = vscode.workspace.getConfiguration('designLearn');
    let models = config.get<any[]>('aiModels', []);
    let selectedModelId = config.get<string>('selectedModel', '');

    // 尝试从服务端加载
    try {
      const serverConfig = await this._serverClient.requestToServer('GET', '/api/config', null);
      if (Array.isArray(serverConfig.aiModels) && serverConfig.aiModels.length) {
        models = serverConfig.aiModels;
        selectedModelId = serverConfig.selectedModelId || selectedModelId;
      }
    } catch {
      // 服务端不可用，使用本地配置
    }

    this._postMessage({ type: 'updateModels', models, selectedModelId });
  }

  public async selectModel(modelId: string) {
    const config = vscode.workspace.getConfiguration('designLearn');
    await config.update('selectedModel', modelId, vscode.ConfigurationTarget.Global);
    await this._syncToServer();
    this.loadModels();
  }

  public async saveModel(model: any) {
    const config = vscode.workspace.getConfiguration('designLearn');
    const models = config.get<any[]>('aiModels', []);
    const existingIndex = models.findIndex(m => m.id === model.id);
    if (existingIndex >= 0) {
      models[existingIndex] = model;
    } else {
      models.push(model);
    }
    await config.update('aiModels', models, vscode.ConfigurationTarget.Global);
    let selectedModelId = config.get<string>('selectedModel', '');
    if (models.length === 1) {
      selectedModelId = model.id;
      await config.update('selectedModel', model.id, vscode.ConfigurationTarget.Global);
    }
    await this._syncToServer();
    this._postMessage({ type: 'updateModels', models, selectedModelId });
    vscode.window.showInformationMessage(`模型 "${model.name}" 已保存`);
  }

  public async deleteModel(modelId: string) {
    const config = vscode.workspace.getConfiguration('designLearn');
    const models = config.get<any[]>('aiModels', []);
    const filtered = models.filter(m => m.id !== modelId);
    await config.update('aiModels', filtered, vscode.ConfigurationTarget.Global);
    await this._syncToServer();
    this.loadModels();
  }

  private async _syncToServer() {
    const config = vscode.workspace.getConfiguration('designLearn');
    const aiModels = config.get<any[]>('aiModels', []);
    const selectedModelId = config.get<string>('selectedModel', '');
    try {
      await this._serverClient.requestToServer('PUT', '/api/config', { aiModels, selectedModelId });
    } catch {
      // 服务端不可用，静默失败
    }
  }
}
