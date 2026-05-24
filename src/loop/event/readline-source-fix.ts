// Temporary workaround for IEventSource interface compatibility
import { IEventSource } from './types';
import { ReadlineEventSource } from './readline-source';

// Extend ReadlineEventSource to satisfy IEventSource
export class ReadlineEventSourceCompat extends ReadlineEventSource implements IEventSource {
  dispose(): void {
    // @ts-ignore - accessing private method
    if (this.rl) {
      // @ts-ignore
      this.stop();
    }
  }
}
