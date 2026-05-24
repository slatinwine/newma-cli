/**
 * Event Stream Architecture
 *
 * Based on Codex's event_stream.rs design.
 * Provides a flexible, pause/resume-capable event system for Kode's REPL.
 */

// ============================================================================
// Core Event Types
// ============================================================================

/**
 * UI Event types
 */
export enum UIEventType {
  Key = 'key',
  Paste = 'paste',
  Resize = 'resize',
  Draw = 'draw',
  Focus = 'focus',
  Signal = 'signal',
}

/**
 * Key event
 */
export interface KeyEvent {
  type: UIEventType.Key;
  name: string;
  sequence: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/**
 * Paste event
 */
export interface PasteEvent {
  type: UIEventType.Paste;
  content: string;
}

/**
 * Resize event
 */
export interface ResizeEvent {
  type: UIEventType.Resize;
  columns: number;
  rows: number;
}

/**
 * Draw event (triggers UI redraw)
 */
export interface DrawEvent {
  type: UIEventType.Draw;
}

/**
 * Focus event
 */
export interface FocusEvent {
  type: UIEventType.Focus;
  focused: boolean;
  timestamp?: number;
  source?: string;
  data?: any;
}

/**
 * Signal event (SIGINT, SIGTSTP, etc.)
 */
export interface SignalEvent {
  type: UIEventType.Signal;
  signal: string;
}

/**
 * Union type of all UI events
 */
export type UIEvent =
  | KeyEvent
  | PasteEvent
  | ResizeEvent
  | DrawEvent
  | FocusEvent
  | SignalEvent;

/**
 * Base UI event with optional data
 */
export interface BaseUIEvent {
  type: UIEventType;
  data?: any;
}

// ============================================================================
// Event Source Types
// ============================================================================

/**
 * Event source state (mirrors Codex's EventBrokerState)
 */
export enum EventSourceState {
  Paused = 'paused',     // Underlying event source is dropped
  Start = 'start',       // Create new event source on next poll
  Running = 'running',   // Event source is active
}

/**
 * Result of polling an event source
 */
export type EventPollResult = UIEvent | null;

/**
 * Abstract event source interface
 */
export interface IEventSource {
  /**
   * Poll for next event (non-blocking)
   * Returns null if no event is available (Pending)
   */
  pollNext(): Promise<EventPollResult>;

  /**
   * Pause the event source (release resources)
   */
  pause(): void | Promise<void>;

  /**
   * Resume the event source (recreate resources)
   */
  resume(): void | Promise<void>;

  /**
   * Check if source is currently paused
   */
  isPaused(): boolean;

  /**
   * Start the event source (optional)
   */
  start?(): void | Promise<void>;

  /**
   * Dispose the event source (optional)
   */
  dispose?(): void | Promise<void>;

  /**
   * Register event listener (optional)
   */
  on?(event: string, handler: (...args: any[]) => void): void;
}

// ============================================================================
// Event Broker Types
// ============================================================================

/**
 * Event broker configuration
 */
export interface EventBrokerConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Timeout for poll operations (ms) */
  pollTimeout?: number;
}

/**
 * Event stream state
 */
export interface EventStreamState {
  sourceState: EventSourceState;
  pollCount: number;
  lastPollTime: number;
}

// ============================================================================
// Readline Event Types (Raw readline events)
// ============================================================================

/**
 * Raw readline event before mapping
 */
export interface RawReadlineEvent {
  type: 'line' | 'close' | 'SIGINT' | 'keypress' | 'pause' | 'resume';
  data?: any;
}

/**
 * Readline line event
 */
export interface LineEvent {
  type: 'line';
  line: string;
}

/**
 * Readline close event
 */
export interface CloseEvent {
  type: 'close';
}

/**
 * Readline SIGINT event
 */
export interface SIGINTEvent {
  type: 'SIGINT';
}

/**
 * Readline keypress event
 */
export interface KeypressEvent {
  type: 'keypress';
  key: {
    name?: string;
    sequence: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
  };
}

/**
 * Union type of raw readline events
 */
export type RawReadlineEventType =
  | LineEvent
  | CloseEvent
  | SIGINTEvent
  | KeypressEvent;

// ============================================================================
// Event Mapper Types
// ============================================================================

/**
 * Event mapper configuration
 */
export interface EventMapperConfig {
  /** Ignore mouse events */
  ignoreMouse?: boolean;
  /** Convert focus events to draw events */
  focusTriggersDraw?: boolean;
  /** Custom key mappings */
  keyMappings?: Map<string, UIEvent>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Event stream error
 */
export class EventStreamError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'EventStreamError';
  }
}

/**
 * Event source paused error
 */
export class EventSourcePausedError extends EventStreamError {
  constructor() {
    super('Event source is paused', 'SOURCE_PAUSED');
    this.name = 'EventSourcePausedError';
  }
}

// ============================================================================
// Additional Event Source Types
// ============================================================================

/**
 * File watcher event
 */
export interface FileWatcherEvent {
  type: 'change' | 'rename';
  path: string;
  timestamp: number;
}

/**
 * WebSocket event
 */
export interface WebSocketEvent {
  type: 'message' | 'error' | 'close';
  data: string;
  timestamp: number;
  origin: string;
}

/**
 * HTTP event
 */
export interface HTTPEvent {
  type: 'request';
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  query: Record<string, string>;
  timestamp: number;
  remoteAddress?: string;
}
