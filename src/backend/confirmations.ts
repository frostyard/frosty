export class ConfirmationManager {
  private pending = new Map<string, (approved: boolean) => void>();

  waitForConfirmation(toolCallId: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.pending.set(toolCallId, resolve);
    });
  }

  resolve(toolCallId: string, approved: boolean): void {
    const resolver = this.pending.get(toolCallId);
    if (resolver) {
      resolver(approved);
      this.pending.delete(toolCallId);
    }
  }

  clearAll(): void {
    for (const [id, resolver] of this.pending) {
      resolver(false);
    }
    this.pending.clear();
  }
}
