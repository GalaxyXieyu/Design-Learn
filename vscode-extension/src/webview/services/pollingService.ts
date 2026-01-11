export class PollingService {
  private _interval?: NodeJS.Timeout;
  private readonly _callback: () => void;

  constructor(callback: () => void) {
    this._callback = callback;
  }

  public start(intervalMs = 2000) {
    this.stop();
    this._interval = setInterval(this._callback, intervalMs);
  }

  public stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = undefined;
    }
  }
}
