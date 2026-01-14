import { ServerClient } from './serverClient';

type PostMessage = (message: any) => void;

export class UIProService {
  private readonly _serverClient: ServerClient;
  private readonly _postMessage: PostMessage;

  constructor(serverClient: ServerClient, postMessage: PostMessage) {
    this._serverClient = serverClient;
    this._postMessage = postMessage;
  }

  public async loadMeta() {
    const meta = { domains: [], stacks: [] };

    try {
      const result = await this._serverClient.requestToServer('GET', '/api/uipro/domains', null);
      meta.domains = Array.isArray(result?.domains) ? result.domains : [];
    } catch {
      meta.domains = [];
    }

    try {
      const result = await this._serverClient.requestToServer('GET', '/api/uipro/stacks', null);
      meta.stacks = Array.isArray(result?.stacks) ? result.stacks : [];
    } catch {
      meta.stacks = [];
    }

    this._postMessage({ type: 'uiproMeta', ...meta });
  }

  public async search(query: string, options: { domain?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    params.set('query', query || '');
    if (options.domain) params.set('domain', options.domain);
    if (typeof options.limit === 'number') params.set('limit', String(options.limit));

    try {
      const result = await this._serverClient.requestToServer('GET', `/api/uipro/search?${params.toString()}`, null);
      this._postMessage({ type: 'uiproSearchResult', result });
    } catch (err: any) {
      this._postMessage({
        type: 'uiproSearchResult',
        result: { error: 'server_unavailable', message: err?.message || 'unknown_error' },
      });
    }
  }

  public async searchStack(query: string, stack: string, options: { limit?: number } = {}) {
    const params = new URLSearchParams();
    params.set('query', query || '');
    params.set('stack', stack || '');
    if (typeof options.limit === 'number') params.set('limit', String(options.limit));

    try {
      const result = await this._serverClient.requestToServer(
        'GET',
        `/api/uipro/search-stack?${params.toString()}`,
        null
      );
      this._postMessage({ type: 'uiproSearchStackResult', result });
    } catch (err: any) {
      this._postMessage({
        type: 'uiproSearchStackResult',
        result: { error: 'server_unavailable', message: err?.message || 'unknown_error' },
      });
    }
  }

  public async browse(options: { domain?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.domain) params.set('domain', options.domain);
    if (typeof options.limit === 'number') params.set('limit', String(options.limit));
    if (typeof options.offset === 'number') params.set('offset', String(options.offset));

    try {
      const result = await this._serverClient.requestToServer('GET', `/api/uipro/browse?${params.toString()}`, null);
      this._postMessage({ type: 'uiproBrowseResult', result });
    } catch (err: any) {
      this._postMessage({
        type: 'uiproBrowseResult',
        result: { error: 'server_unavailable', message: err?.message || 'unknown_error' },
      });
    }
  }

  public async suggest(options: { domain?: string; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (options.domain) params.set('domain', options.domain);
    if (typeof options.limit === 'number') params.set('limit', String(options.limit));

    try {
      const result = await this._serverClient.requestToServer('GET', `/api/uipro/suggest?${params.toString()}`, null);
      this._postMessage({ type: 'uiproSuggestResult', result });
    } catch (err: any) {
      this._postMessage({
        type: 'uiproSuggestResult',
        result: { error: 'server_unavailable', message: err?.message || 'unknown_error' },
      });
    }
  }

  public async browseStack(stack: string, options: { limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    params.set('stack', stack || '');
    if (typeof options.limit === 'number') params.set('limit', String(options.limit));
    if (typeof options.offset === 'number') params.set('offset', String(options.offset));

    try {
      const result = await this._serverClient.requestToServer(
        'GET',
        `/api/uipro/browse-stack?${params.toString()}`,
        null
      );
      this._postMessage({ type: 'uiproBrowseStackResult', result });
    } catch (err: any) {
      this._postMessage({
        type: 'uiproBrowseStackResult',
        result: { error: 'server_unavailable', message: err?.message || 'unknown_error' },
      });
    }
  }

  public async suggestStack(stack: string, options: { limit?: number } = {}) {
    const params = new URLSearchParams();
    params.set('stack', stack || '');
    if (typeof options.limit === 'number') params.set('limit', String(options.limit));

    try {
      const result = await this._serverClient.requestToServer(
        'GET',
        `/api/uipro/suggest-stack?${params.toString()}`,
        null
      );
      this._postMessage({ type: 'uiproSuggestStackResult', result });
    } catch (err: any) {
      this._postMessage({
        type: 'uiproSuggestStackResult',
        result: { error: 'server_unavailable', message: err?.message || 'unknown_error' },
      });
    }
  }
}
