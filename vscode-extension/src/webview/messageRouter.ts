type HandlerResult = void | Promise<void> | PromiseLike<void>;

export class MessageRouter {
  private readonly _handlers: Record<string, (message: any) => HandlerResult>;

  constructor(handlers: Record<string, (message: any) => HandlerResult>) {
    this._handlers = handlers;
  }

  public async handle(message: any) {
    if (!message || !message.type) return;
    const handler = this._handlers[message.type];
    if (!handler) return;
    await handler(message);
  }
}
