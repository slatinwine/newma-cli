/**
 * Readline Event Source
 *
 * Adapts Node.js readline to the IEventSource interface.
 * Provides non-blocking polling and proper pause/resume.
 */

import readline from 'readline';
import { EventEmitter } from 'events';
import {
  IEventSource,
  RawReadlineEvent,
  RawReadlineEventType,
  EventSourceState,
  UIEvent,
  UIEventType,
} from './types';

// ============================================================================
// Readline Event Source
// ============================================================================

/**
 * Readline-based event source
 *
 * Wraps readline to provide:
 * - Non-blocking event polling
 * - Proper pause/resume (releases stdin)
 * - Event queue for async processing
 */
export class ReadlineEventSource extends EventEmitter implements IEventSource {
  private state: EventSourceState = EventSourceState.Start;
  private rl: readline.Interface | null = null;
  private eventQueue: RawReadlineEventType[] = [];
  private isPrompting = false;

  constructor(
    private readonly options: {
      prompt?: string;
      input?: NodeJS.ReadableStream;
      output?: NodeJS.WritableStream;
      historySize?: number;
    } = {}
  ) {
    super();
    this.state = EventSourceState.Start;
  }

  /**
   * Start the readline interface (called on first poll)
   */
  start(): void {
    if (this.rl) {
      return;
    }

    this.rl = readline.createInterface({
      input: this.options.input || process.stdin,
      output: this.options.output || process.stdout,
      prompt: this.options.prompt || '> ',
      historySize: this.options.historySize || 100,
    });

    // Listen for line events
    this.rl.on('line', (line: string) => {
      this.eventQueue.push({ type: 'line', line });
    });

    // Listen for SIGINT (Ctrl+C)
    this.rl.on('SIGINT', () => {
      this.eventQueue.push({ type: 'SIGINT' });
    });

    // Listen for close
    this.rl.on('close', () => {
      this.eventQueue.push({ type: 'close' });
    });

    // Listen for keypress (for raw key events)
    this.rl.on('keypress', (str: string | undefined, key: readline.Key | undefined) => {
      if (key) {
        this.eventQueue.push({
          type: 'keypress',
          key: {
            name: key.name,
            sequence: key.sequence || '',
            ctrl: key.ctrl,
            meta: key.meta,
            shift: key.shift,
            alt: false, // readline.Key doesn't have alt
          }
        });
      }
    });

    this.state = EventSourceState.Running;
    this.emit('started');
  }

  /**
   * Stop the readline interface
   */
  private stop(): void {
    if (!this.rl) {
      return;
    }

    this.rl.close();
    this.rl = null;
    this.state = EventSourceState.Paused;
    this.emit('stopped');
  }

  /**
   * Poll for next event (non-blocking)
   *
   * Returns null if no event is available
   */
  async pollNext(): Promise<UIEvent | null> {
    // Auto-start on first poll
    if (!this.rl) {
      this.start();
    }

    // Check if there's an event in the queue
    if (this.eventQueue.length > 0) {
      const rawEvent = this.eventQueue.shift()!;
      return this.mapRawEvent(rawEvent);
    }

    // No event available
    return null;
  }

  /**
   * Pause the event source (releases stdin)
   */
  pause(): void {
    this.stop();
  }

  /**
   * Resume the event source (recreates stdin)
   */
  resume(): void {
    this.eventQueue = [];
    this.state = EventSourceState.Start;
  }

  /**
   * Check if source is paused
   */
  isPaused(): boolean {
    return this.state === EventSourceState.Paused;
  }

  /**
   * Get the readline interface (for direct use)
   */
  getInterface(): readline.Interface | null {
    if (!this.rl) {
      this.start();
    }
    return this.rl;
  }

  /**
   * Set the prompt
   */
  setPrompt(prompt: string): void {
    if (this.rl) {
      this.rl.setPrompt(prompt);
    }
  }

  /**
   * Write a prompt to the terminal
   */
  prompt(preserveCursor = true): void {
    if (this.rl && !this.isPrompting) {
      this.isPrompting = true;
      this.rl.prompt(preserveCursor);
      // Note: isPrompting is reset when user presses Enter
    }
  }

  /**
   * Write to the output
   */
  write(data: string): void {
    if (this.rl) {
      this.rl.write(data);
    }
  }

  /**
   * Clear the current line
   */
  clearLine(): void {
    if (this.rl) {
      // Move to beginning of line and clear
      process.stdout.write('\r\x1b[K');
    }
  }

  /**
   * Pause the prompt (keep readline alive but don't show prompt)
   */
  pausePrompt(): void {
    if (this.rl) {
      this.rl.pause();
    }
  }

  /**
   * Resume the prompt
   */
  resumePrompt(): void {
    if (this.rl) {
      this.rl.resume();
      this.prompt();
    }
  }

  /**
   * Map raw readline event to UIEvent
   */
  private mapRawEvent(rawEvent: RawReadlineEventType): UIEvent | null {
    switch (rawEvent.type) {
      case 'line':
        // Line event is not directly exposed as UIEvent
        // It's handled by the REPL layer
        // Return a key event for Enter key instead
        return {
          type: UIEventType.Key,
          name: 'return',
          sequence: '\n',
          ctrl: false,
          meta: false,
          shift: false,
          alt: false,
        };

      case 'SIGINT':
        return {
          type: UIEventType.Signal,
          signal: 'SIGINT',
        };

      case 'close':
        return {
          type: UIEventType.Signal,
          signal: 'close',
        };

      case 'keypress':
        if (rawEvent.key) {
          const key = rawEvent.key;
          return {
            type: UIEventType.Key,
            name: key.name || 'unknown',
            sequence: key.sequence || '',
            ctrl: key.ctrl || false,
            meta: key.meta || false,
            shift: key.shift || false,
            alt: key.alt || false,
          };
        }
        return null;

      default:
        return null;
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a default readline event source
 */
export function createReadlineSource(
  prompt?: string
): ReadlineEventSource {
  return new ReadlineEventSource({ prompt });
}

/**
 * Check if a key event is a special key (Ctrl+C, Ctrl+D, etc.)
 */
export function isSpecialKey(event: UIEvent): boolean {
  if (event.type !== UIEventType.Key) {
    return false;
  }

  const { name, ctrl, meta } = event;

  // Ctrl+C (SIGINT)
  if (name === 'c' && ctrl && !meta) {
    return true;
  }

  // Ctrl+D (EOF)
  if (name === 'd' && ctrl && !meta) {
    return true;
  }

  // Ctrl+Z (suspend on Unix)
  if (name === 'z' && ctrl && !meta) {
    return true;
  }

  return false;
}
