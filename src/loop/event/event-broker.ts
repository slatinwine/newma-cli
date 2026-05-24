/**
 * Event Broker
 *
 * Manages event source state with pause/resume capability.
 * Based on Codex's EventBroker design.
 */

import { EventEmitter } from 'events';
import {
  IEventSource,
  EventSourceState,
  UIEvent,
  EventBrokerConfig,
  EventStreamState,
  EventSourcePausedError,
  EventStreamError,
  UIEventType,
} from './types';

// ============================================================================
// Event Broker
// ============================================================================

/**
 * Event Broker manages an event source with pause/resume capability.
 *
 * Key features:
 * - Pause: Drops the underlying event source to release stdin
 * - Resume: Recreates the event source
 * - State tracking: Monitors source state and poll statistics
 *
 * This is critical for integrating external programs (vim, etc.) that need
 * full control of stdin.
 */
export class EventBroker extends EventEmitter {
  private state: EventSourceState = EventSourceState.Start;
  private source: IEventSource | null = null;
  private streamState: EventStreamState;

  constructor(
    private readonly config: EventBrokerConfig = {}
  ) {
    super();
    this.streamState = {
      sourceState: EventSourceState.Start,
      pollCount: 0,
      lastPollTime: 0,
    };
  }

  /**
   * Get the current event source
   * Returns null if paused, otherwise starts if needed and returns the source
   */
  getActiveSource(): IEventSource | null {
    switch (this.state) {
      case EventSourceState.Paused:
        return null;

      case EventSourceState.Start:
        if (this.source) {
          this.state = EventSourceState.Running;
          this.updateStreamState(EventSourceState.Running);
          this.emit('source-started');
          return this.source;
        }
        return null;

      case EventSourceState.Running:
        return this.source;
    }
  }

  /**
   * Set the event source
   */
  setSource(source: IEventSource | null): void {
    this.source = source;
    if (source && this.state === EventSourceState.Start) {
      this.state = EventSourceState.Running;
      this.updateStreamState(EventSourceState.Running);
      this.emit('source-started');
    }
  }

  /**
   * Pause the event source
   *
   * This will:
   * 1. Call pause() on the source (releases stdin)
   * 2. Set state to Paused
   * 3. Allow external programs to use stdin
   */
  pause(): void {
    if (this.state === EventSourceState.Paused) {
      return;
    }

    this.debug('Pausing event source');

    if (this.source) {
      const pauseResult = this.source.pause();
      if (pauseResult instanceof Promise) {
        pauseResult.catch((error) => {
          this.emit('error', new EventStreamError(
            `Failed to pause event source: ${error.message}`,
            'PAUSE_FAILED',
            error
          ));
        });
      }
    }

    this.state = EventSourceState.Paused;
    this.updateStreamState(EventSourceState.Paused);
    this.emit('paused');
  }

  /**
   * Resume the event source
   *
   * This will:
   * 1. Call resume() on the source (recreates stdin)
   * 2. Set state to Start (will transition to Running on next poll)
   * 3. Emit 'resume' event to wake up any waiting pollers
   */
  resume(): void {
    if (this.state === EventSourceState.Start || this.state === EventSourceState.Running) {
      return;
    }

    this.debug('Resuming event source');

    if (this.source) {
      const resumeResult = this.source.resume();
      if (resumeResult instanceof Promise) {
        resumeResult.catch((error) => {
          this.emit('error', new EventStreamError(
            `Failed to resume event source: ${error.message}`,
            'RESUME_FAILED',
            error
          ));
        });
      }
    }

    this.state = EventSourceState.Start;
    this.updateStreamState(EventSourceState.Start);
    this.emit('resumed');
  }

  /**
   * Check if the event source is paused
   */
  isPaused(): boolean {
    return this.state === EventSourceState.Paused;
  }

  /**
   * Check if the event source is running
   */
  isRunning(): boolean {
    return this.state === EventSourceState.Running;
  }

  /**
   * Get current stream state
   */
  getStreamState(): Readonly<EventStreamState> {
    return { ...this.streamState };
  }

  /**
   * Poll for next event from the active source
   *
   * Returns null if:
   * - Source is paused
   * - Source is not set
   * - No event is available
   *
   * Throws EventSourcePausedError if source is paused
   */
  async pollNext(): Promise<UIEvent | null> {
    this.streamState.pollCount++;
    this.streamState.lastPollTime = Date.now();

    const source = this.getActiveSource();
    if (!source) {
      throw new EventSourcePausedError();
    }

    return source.pollNext();
  }

  /**
   * Update stream state (internal)
   */
  private updateStreamState(sourceState: EventSourceState): void {
    this.streamState.sourceState = sourceState;
    this.emit('state-changed', this.streamState);
  }

  /**
   * Debug logging
   */
  private debug(message: string): void {
    if (this.config.debug) {
      console.log(`[EventBroker] ${message}`);
    }
  }
}

// ============================================================================
// Event Stream (Combined Draw + Input)
// ============================================================================

/**
 * Event Stream combines draw events and user input into a single stream.
 *
 * Uses round-robin polling to ensure fairness between:
 * - Draw events (for UI updates)
 * - User input events (keyboard, paste, etc.)
 */
export class EventStream {
  private pollDrawFirst = false;
  private drawEventQueue: UIEvent[] = [];

  constructor(
    private readonly broker: EventBroker,
    private readonly drawEventEmitter: EventEmitter
  ) {
    // Listen for draw events
    this.drawEventEmitter.on('draw', () => {
      this.drawEventQueue.push({ type: UIEventType.Draw });
    });
  }

  /**
   * Poll for next event using round-robin strategy
   *
   * This ensures neither draw events nor input events starve
   */
  async pollNext(): Promise<UIEvent | null> {
    // Round-robin: alternate between checking draw and input first
    const drawFirst = this.pollDrawFirst;
    this.pollDrawFirst = !this.pollDrawFirst;

    if (drawFirst) {
      // Check draw first, then input
      const drawEvent = this.pollDrawEvent();
      if (drawEvent) return drawEvent;

      return await this.broker.pollNext();
    } else {
      // Check input first, then draw
      try {
        const inputEvent = await this.broker.pollNext();
        if (inputEvent) return inputEvent;
      } catch (error) {
        if (error instanceof EventSourcePausedError) {
          // Source is paused, still check for draw events
        } else {
          throw error;
        }
      }

      return this.pollDrawEvent();
    }
  }

  /**
   * Poll for a draw event (non-blocking)
   */
  private pollDrawEvent(): UIEvent | null {
    return this.drawEventQueue.shift() || null;
  }

  /**
   * Trigger a draw event (for external callers)
   */
  triggerDraw(): void {
    this.drawEventEmitter.emit('draw');
  }

  /**
   * Pause the underlying event source
   */
  pause(): void {
    this.broker.pause();
  }

  /**
   * Resume the underlying event source
   */
  resume(): void {
    this.broker.resume();
  }

  /**
   * Check if the stream is paused
   */
  isPaused(): boolean {
    return this.broker.isPaused();
  }
}
