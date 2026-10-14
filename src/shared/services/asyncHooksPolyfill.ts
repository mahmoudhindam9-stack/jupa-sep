export class AsyncLocalStorage {
  private store: any = undefined;
  run(store: any, callback: (...args: any[]) => any, ...args: any[]) {
    const prev = this.store;
    this.store = store;
    try {
      return callback(...args);
    } finally {
      this.store = prev;
    }
  }
  getStore() {
    return this.store;
  }
  enterWith(store: any) {
    this.store = store;
  }
  disable() {
    this.store = undefined;
  }
}

if (typeof globalThis !== "undefined") {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage;
}

export default { AsyncLocalStorage };
