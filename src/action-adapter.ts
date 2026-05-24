// src/action-adapter.ts
/**
 * Adapter to convert legacy Actions to Tool Calls
 * Bridges the gap between old action format and new tool system
 */

import { Action } from './types';
import { ToolCall } from './tools/types';
import { ToolRegistry } from './tools/registry';

/**
 * Convert legacy Action to ToolCall
 * Maps old action types to new tool names
 */
export function actionToToolCall(action: Action, registry: ToolRegistry): ToolCall | null {
  switch (action.type) {
    case 'create':
    case 'modify':
    case 'delete':
      // File operations - use file tool
      return {
        tool: 'file',
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parameters: {
          operation: action.type,
          path: action.path || '',
          content: action.content || '',
        },
      };

    case 'run':
      // Command execution - check if it matches a Unix tool
      const matchedTool = matchCommandToTool(action.command || '');
      if (matchedTool) {
        return matchedTool;
      }

      // Fall back to generic command tool
      return {
        tool: 'command',
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parameters: {
          command: action.command || '',
        },
      };

    case 'verify':
      // Verification command
      return {
        tool: 'command',
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parameters: {
          command: action.command || '',
        },
      };

    default:
      return null;
  }
}

/**
 * Match a shell command to a Unix tool
 * Parses common command patterns and converts to tool calls
 */
function matchCommandToTool(command: string): ToolCall | null {
  const trimmed = command.trim();

  // list_files: ls, ls -la, ls -R, etc.
  if (trimmed.startsWith('ls ')) {
    const params = parseLsCommand(trimmed);
    return {
      tool: 'list_files',
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parameters: params,
    };
  }

  // read_file: cat file.txt
  if (trimmed.startsWith('cat ')) {
    const parts = trimmed.split(/\s+/);
    const path = parts[1];
    return {
      tool: 'read_file',
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parameters: { path },
    };
  }

  // head for line limiting: head -n 50 file.txt
  if (trimmed.startsWith('head -n')) {
    const match = trimmed.match(/head\s+-n(\d+)\s+(\S+)/);
    if (match) {
      return {
        tool: 'read_file',
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        parameters: {
          path: match[2],
          lineCount: parseInt(match[1], 10),
        },
      };
    }
  }

  // search_files: grep -r "pattern" path/
  if (trimmed.startsWith('grep ')) {
    const params = parseGrepCommand(trimmed);
    return {
      tool: 'search_files',
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parameters: params,
    };
  }

  // find_files: find path -name "*.ts"
  if (trimmed.startsWith('find ')) {
    const params = parseFindCommand(trimmed);
    return {
      tool: 'find_files',
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parameters: params,
    };
  }

  // count_lines: wc -l files...
  if (trimmed.startsWith('wc -l')) {
    const paths = trimmed.split(/\s+/).slice(2);
    return {
      tool: 'count_lines',
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parameters: { paths },
    };
  }

  // disk_usage: du -h path
  if (trimmed.startsWith('du ')) {
    const params = parseDuCommand(trimmed);
    return {
      tool: 'disk_usage',
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      parameters: params,
    };
  }

  // No match - return null to use generic command tool
  return null;
}

/**
 * Parse ls command
 */
function parseLsCommand(command: string): Record<string, any> {
  const params: Record<string, any> = {
    path: '.',
    showHidden: false,
    longFormat: false,
    recursive: false,
  };

  const parts = command.split(/\s+/);

  // Parse flags
  for (const part of parts) {
    if (part.startsWith('-')) {
      if (part.includes('a')) params.showHidden = true;
      if (part.includes('l')) params.longFormat = true;
      if (part.includes('R')) params.recursive = true;
    }
  }

  // Last argument is path
  const lastArg = parts[parts.length - 1];
  if (!lastArg.startsWith('-')) {
    params.path = lastArg;
  }

  return params;
}

/**
 * Parse grep command
 */
function parseGrepCommand(command: string): Record<string, any> {
  const params: Record<string, any> = {
    path: '.',
    ignoreCase: false,
    recursive: true,
    contextLines: 2,
  };

  // Simple parser for common patterns
  if (command.includes('-i')) params.ignoreCase = true;

  const match = command.match(/-C(\d+)/);
  if (match) params.contextLines = parseInt(match[1], 10);

  // Extract pattern and path
  const parts = command.split(/\s+/);
  const patternIndex = parts.findIndex(p => !p.startsWith('-'));
  if (patternIndex !== -1) {
    params.pattern = parts[patternIndex];

    // Path might be after pattern
    if (patternIndex + 1 < parts.length) {
      params.path = parts[patternIndex + 1];
    }
  }

  return params;
}

/**
 * Parse find command
 */
function parseFindCommand(command: string): Record<string, any> {
  const params: Record<string, any> = {
    path: '.',
    type: 'f',
  };

  const parts = command.split(/\s+/);
  let currentIdx = 1; // Skip "find"

  // Path
  if (currentIdx < parts.length && !parts[currentIdx].startsWith('-')) {
    params.path = parts[currentIdx];
    currentIdx++;
  }

  // Parse options
  while (currentIdx < parts.length) {
    const part = parts[currentIdx];

    if (part === '-name' && currentIdx + 1 < parts.length) {
      params.name = parts[currentIdx + 1];
      currentIdx += 2;
    } else if (part === '-type' && currentIdx + 1 < parts.length) {
      params.type = parts[currentIdx + 1];
      currentIdx += 2;
    } else if (part === '-maxdepth' && currentIdx + 1 < parts.length) {
      params.maxDepth = parseInt(parts[currentIdx + 1], 10);
      currentIdx += 2;
    } else {
      currentIdx++;
    }
  }

  return params;
}

/**
 * Parse du command
 */
function parseDuCommand(command: string): Record<string, any> {
  const params: Record<string, any> = {
    path: '.',
    maxDepth: 1,
    humanReadable: false,
  };

  if (command.includes('-h')) params.humanReadable = true;

  const match = command.match(/-d(\d+)/);
  if (match) params.maxDepth = parseInt(match[1], 10);

  const parts = command.split(/\s+/);
  const lastArg = parts[parts.length - 1];
  if (!lastArg.startsWith('-')) {
    params.path = lastArg;
  }

  return params;
}

/**
 * Batch convert actions to tool calls
 */
export function convertActionsToToolCalls(
  actions: Action[],
  registry: ToolRegistry
): { toolCalls: ToolCall[]; skipped: Action[] } {
  const toolCalls: ToolCall[] = [];
  const skipped: Action[] = [];

  for (const action of actions) {
    const toolCall = actionToToolCall(action, registry);
    if (toolCall) {
      toolCalls.push(toolCall);
    } else {
      skipped.push(action);
    }
  }

  return { toolCalls, skipped };
}
