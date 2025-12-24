type EventHandler = (data: any) => Promise<void> | void;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler) {
    const handlers = this.handlers.get(event) || [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  async emit(event: string, data: any) {
    const handlers = this.handlers.get(event) || [];
    for (const handler of handlers) {
      try {
        await handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    }
  }
}

export const eventBus = new EventBus();

export const EVENTS = {
  RAW_CREATED: "raw:created",
  RAW_PROCESSED: "raw:processed",
  RAW_FAILED: "raw:failed",
} as const;
