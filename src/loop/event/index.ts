/**
 * Event Stream System
 *
 * Unified event system for Kode REPL.
 * Exports all event-related components.
 */

export * from './types';
export * from './event-broker';
export * from './readline-source';
export * from './event-mapper';
export * from './file-watcher-source';
export * from './websocket-source';
export * from './http-source';
export * from './event-source-manager';

// ============================================================================
// Unified Event System Factory
// ============================================================================

import { EventEmitter } from 'events';
import { EventBroker, EventStream } from './event-broker';
import { ReadlineEventSource, createReadlineSource } from './readline-source';
import { EventMapper, createDefaultMapper } from './event-mapper';
import { UIEvent, EventBrokerConfig } from './types';

/**
 * Complete event system setup
 */
export interface EventSystemSetup {
  broker: EventBroker;
  stream: EventStream;
  source: ReadlineEventSource;
  mapper: EventMapper;
  drawEmitter: EventEmitter;
}

/**
 * Create a complete event system for REPL
 *
 * This sets up:
 * - EventBroker: Manages pause/resume
 * - ReadlineEventSource: Wraps readline
 * - EventMapper: Maps and filters events
 * - EventStream: Combines draw and input events
 */
export function createEventSystem(
  config: {
    prompt?: string;
    broker?: EventBrokerConfig;
    debug?: boolean;
  } = {}
): EventSystemSetup {
  // Create draw event emitter
  const drawEmitter = new EventEmitter();

  // Create event broker
  const broker = new EventBroker({
    debug: config.debug,
    ...config.broker,
  });

  // Create readline source
  const source = new ReadlineEventSource({
    prompt: config.prompt || '[newma] ❯ ',
  });

  // Create mapper
  const mapper = createDefaultMapper();

  // Set the source in broker
  broker.setSource(source);

  // Create event stream
  const stream = new EventStream(broker, drawEmitter);

  return {
    broker,
    stream,
    source,
    mapper,
    drawEmitter,
  };
}

/**
 * Wait for next event with timeout
 */
export async function waitForEvent(
  stream: EventStream,
  timeoutMs: number = 1000
): Promise<UIEvent | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const event = await stream.pollNext();
    if (event) {
      return event;
    }

    // Sleep a bit before next poll
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return null; // Timeout
}

/**
 * Check if an event is a quit signal
 */
export function isQuitEvent(event: UIEvent): boolean {
  if (event.type === 'signal') {
    return ['SIGINT', 'EOF', 'close'].includes(event.signal);
  }
  return false;
}

/**
 * Check if an event is Enter key
 */
export function isEnterKey(event: UIEvent): boolean {
  return event.type === 'key' && event.name === 'return';
}

/**
 * Format key event for display
 */
export function formatKeyEvent(event: UIEvent): string {
  if (event.type !== 'key') {
    return '';
  }

  const parts: string[] = [];

  if (event.ctrl) parts.push('Ctrl');
  if (event.meta) parts.push('Meta');
  if (event.shift) parts.push('Shift');
  if (event.alt) parts.push('Alt');

  parts.push(event.name);

  return parts.join('+');
}

// ============================================================================
// Additional Event Source Factories
// ============================================================================

import { FileWatcherEventSource, FileWatcherConfig } from './file-watcher-source';
import { WebSocketEventSource, WebSocketSourceConfig } from './websocket-source';
import { HTTPEventSource, HTTPSourceConfig } from './http-source';

/**
 * Create a file watcher event source
 */
export function createFileWatcherSource(config: FileWatcherConfig): FileWatcherEventSource {
  return new FileWatcherEventSource(config);
}

/**
 * Create a WebSocket event source
 */
export function createWebSocketSource(config: WebSocketSourceConfig): WebSocketEventSource {
  return new WebSocketEventSource(config);
}

/**
 * Create an HTTP event source
 */
export function createHTTPSource(config: HTTPSourceConfig): HTTPEventSource {
  return new HTTPEventSource(config);
}
