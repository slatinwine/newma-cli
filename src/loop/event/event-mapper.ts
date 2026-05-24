/**
 * Event Mapper
 *
 * Maps and filters raw events to UI events.
 * Based on Codex's map_crossterm_event design.
 */

import {
  UIEvent,
  UIEventType,
  EventMapperConfig,
} from './types';

// ============================================================================
// Event Mapper
// ============================================================================

/**
 * Event Mapper maps and filters events
 *
 * Responsibilities:
 * - Filter out unwanted events (mouse, etc.)
 * - Transform events to UIEvent format
 * - Apply custom key mappings
 * - Track terminal focus state
 */
export class EventMapper {
  private terminalFocused = true;

  constructor(
    private readonly config: EventMapperConfig = {}
  ) {
    // Default config
    this.config = {
      ignoreMouse: true,
      focusTriggersDraw: true,
      keyMappings: new Map(),
      ...config,
    };
  }

  /**
   * Map a raw event to a UI event
   * Returns null if the event should be filtered out
   */
  mapEvent(rawEvent: any): UIEvent | null {
    // Skip null/undefined
    if (!rawEvent) {
      return null;
    }

    // Already a UI event?
    if (rawEvent.type && Object.values(UIEventType).includes(rawEvent.type)) {
      return rawEvent as UIEvent;
    }

    // Map based on type
    switch (rawEvent.type) {
      case 'key':
      case 'keypress':
        return this.mapKeyEvent(rawEvent);

      case 'resize':
        return this.mapResizeEvent(rawEvent);

      case 'paste':
        return this.mapPasteEvent(rawEvent);

      case 'focus':
        return this.mapFocusEvent(rawEvent);

      default:
        // Unknown event type, filter out
        return null;
    }
  }

  /**
   * Map key event
   */
  private mapKeyEvent(rawEvent: any): UIEvent | null {
    // Check custom mappings first
    const key = this.buildKeyString(rawEvent);
    if (this.config.keyMappings?.has(key)) {
      return this.config.keyMappings.get(key)!;
    }

    // Default mapping
    return {
      type: UIEventType.Key,
      name: rawEvent.name || 'unknown',
      sequence: rawEvent.sequence || '',
      ctrl: rawEvent.ctrl || false,
      meta: rawEvent.meta || false,
      shift: rawEvent.shift || false,
      alt: rawEvent.alt || false,
    };
  }

  /**
   * Map resize event
   */
  private mapResizeEvent(rawEvent: any): UIEvent | null {
    return {
      type: UIEventType.Resize,
      columns: rawEvent.columns || process.stdout.columns,
      rows: rawEvent.rows || process.stdout.rows,
    };
  }

  /**
   * Map paste event
   */
  private mapPasteEvent(rawEvent: any): UIEvent | null {
    return {
      type: UIEventType.Paste,
      content: rawEvent.content || '',
    };
  }

  /**
   * Map focus event
   */
  private mapFocusEvent(rawEvent: any): UIEvent | null {
    const focused = rawEvent.focused !== undefined ? rawEvent.focused : true;

    // Update focus state
    const focusChanged = this.terminalFocused !== focused;
    this.terminalFocused = focused;

    // If focus triggers draw, return draw event
    if (focusChanged && this.config.focusTriggersDraw) {
      return {
        type: UIEventType.Draw,
      };
    }

    // Otherwise return focus event
    return {
      type: UIEventType.Focus,
      focused,
    };
  }

  /**
   * Build key string for custom mappings
   * Format: "ctrl+shift+alt+meta+keyname"
   */
  private buildKeyString(event: any): string {
    const parts: string[] = [];

    if (event.ctrl) parts.push('ctrl');
    if (event.shift) parts.push('shift');
    if (event.alt) parts.push('alt');
    if (event.meta) parts.push('meta');

    parts.push(event.name || 'unknown');

    return parts.join('+').toLowerCase();
  }

  /**
   * Check if terminal is focused
   */
  isTerminalFocused(): boolean {
    return this.terminalFocused;
  }

  /**
   * Add a custom key mapping
   */
  addKeyMapping(keyString: string, event: UIEvent): void {
    if (!this.config.keyMappings) {
      this.config.keyMappings = new Map();
    }
    this.config.keyMappings.set(keyString.toLowerCase(), event);
  }

  /**
   * Remove a custom key mapping
   */
  removeKeyMapping(keyString: string): void {
    this.config.keyMappings?.delete(keyString.toLowerCase());
  }

  /**
   * Clear all custom key mappings
   */
  clearKeyMappings(): void {
    this.config.keyMappings?.clear();
  }
}

// ============================================================================
// Preset Mappers
// ============================================================================

/**
 * Create default event mapper for Kode REPL
 */
export function createDefaultMapper(): EventMapper {
  const mapper = new EventMapper({
    ignoreMouse: true,
    focusTriggersDraw: true,
  });

  // Add common key mappings for REPL
  mapper.addKeyMapping('ctrl+c', {
    type: UIEventType.Signal,
    signal: 'SIGINT',
  });

  mapper.addKeyMapping('ctrl+d', {
    type: UIEventType.Signal,
    signal: 'EOF',
  });

  return mapper;
}

/**
 * Create event mapper for external editor mode
 * (pauses most events, only captures critical signals)
 */
export function createExternalEditorMapper(): EventMapper {
  const mapper = new EventMapper({
    ignoreMouse: true,
    focusTriggersDraw: false,
  });

  // Only capture SIGINT and SIGTSTP
  mapper.addKeyMapping('ctrl+c', {
    type: UIEventType.Signal,
    signal: 'SIGINT',
  });

  mapper.addKeyMapping('ctrl+z', {
    type: UIEventType.Signal,
    signal: 'SIGTSTP',
  });

  return mapper;
}
