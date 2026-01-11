import * as vscode from 'vscode';

type PostMessage = (message: any) => void;

export class ConfigService {
  private readonly _postMessage: PostMessage;

  constructor(postMessage: PostMessage) {
    this._postMessage = postMessage;
  }

  public loadConfig() {
    const config = vscode.workspace.getConfiguration('designLearn');
    this._postMessage({
      type: 'updateConfig',
      config: {
        inlineCSS: config.get<boolean>('extraction.inlineCSS', true),
        includeImages: config.get<boolean>('extraction.includeImages', true),
        includeFonts: config.get<boolean>('extraction.includeFonts', true),
        analyzeColors: config.get<boolean>('analysis.colors', true),
        analyzeTypography: config.get<boolean>('analysis.typography', true),
        analyzeLayout: config.get<boolean>('analysis.layout', true),
        analyzeComponents: config.get<boolean>('analysis.components', true),
      },
    });
  }

  public async saveConfig(cfg: any) {
    const config = vscode.workspace.getConfiguration('designLearn');
    await Promise.all([
      config.update('extraction.inlineCSS', cfg.inlineCSS, vscode.ConfigurationTarget.Global),
      config.update('extraction.includeImages', cfg.includeImages, vscode.ConfigurationTarget.Global),
      config.update('extraction.includeFonts', cfg.includeFonts, vscode.ConfigurationTarget.Global),
      config.update('analysis.colors', cfg.analyzeColors, vscode.ConfigurationTarget.Global),
      config.update('analysis.typography', cfg.analyzeTypography, vscode.ConfigurationTarget.Global),
      config.update('analysis.layout', cfg.analyzeLayout, vscode.ConfigurationTarget.Global),
      config.update('analysis.components', cfg.analyzeComponents, vscode.ConfigurationTarget.Global),
    ]);
    vscode.window.showInformationMessage('配置已保存');
  }
}
