export class ServerClient {
  private readonly _getServerUrl: () => string;

  constructor(getServerUrl: () => string) {
    this._getServerUrl = getServerUrl;
  }

  public getServerUrl(): string {
    return this._getServerUrl();
  }

  public request(method: string, url: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const http = require('http');
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      };

      const req = http.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(json.error || `HTTP ${res.statusCode}`));
            } else {
              resolve(json);
            }
          } catch {
            resolve({});
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('timeout'));
      });

      if (body && method !== 'GET') {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  public requestToServer(method: string, path: string, body: any): Promise<any> {
    return this.request(method, `${this.getServerUrl()}${path}`, body);
  }

  public async checkServerStatus(post: (connected: boolean, url: string) => void): Promise<void> {
    const serverUrl = this.getServerUrl();

    try {
      const http = require('http');
      const url = new URL(serverUrl + '/api/health');

      const req = http.get(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          timeout: 2000,
        },
        (res: any) => {
          const connected = res.statusCode === 200;
          post(connected, serverUrl);
        }
      );

      req.on('error', () => post(false, serverUrl));

      req.on('timeout', () => {
        req.destroy();
        post(false, serverUrl);
      });
    } catch {
      post(false, serverUrl);
    }
  }
}
