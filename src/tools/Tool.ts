// src/tools/Tool.ts
/**
 * Enhanced Tool System
 * Based on Claude Code v2.1.88 architecture
 * Provides type-safe tool definitions with safe defaults
 */

import { z } from 'zod';
import { ToolCategory, Permission, ToolContext, ToolResult } from './types';

/**
 * Progress data for tool execution
 */
export type ToolProgressData = {
  type: string;
  message: string;
  [key: string]: unknown;
};

/**
 * Tool call progress callback
 */
export type ToolCallProgress<P extends ToolProgressData = ToolProgressData> = (
  progress: P
) => void;

/**
 * Validation result
 */
export type ValidationResult =
  | { result: true }
  | {
      result: false;
      message: string;
      errorCode: number;
    };

/**
 * Permission result
 */
export type PermissionResult =
  | { behavior: 'allow'; updatedInput: Record<string, unknown> }
  | { behavior: 'deny'; message: string }
  | { behavior: 'ask'; message: string };

/**
 * Base tool interface with all methods
 */
export type Tool<
  Input extends z.ZodType = z.ZodType,
  Output = unknown,
  P extends ToolProgressData = ToolProgressData,
> = {
  // Basic metadata
  name: string;
  description: string;
  category: ToolCategory;
  permissions: Permission[];

  // Schema definitions
  readonly inputSchema: Input;
  outputSchema?: z.ZodType<unknown>;

  // Core execution
  call: (
    args: z.infer<Input>,
    context: ToolContext,
    onProgress?: ToolCallProgress<P>
  ) => Promise<ToolResult>;

  // Concurrency and safety
  isConcurrencySafe: (input: z.infer<Input>) => boolean;
  isReadOnly: (input: z.infer<Input>) => boolean;
  isDestructive?: (input: z.infer<Input>) => boolean;

  // Permission and validation
  validateInput?: (
    input: z.infer<Input>,
    context: ToolContext
  ) => Promise<ValidationResult>;
  checkPermissions?: (
    input: z.infer<Input>,
    context: ToolContext
  ) => Promise<PermissionResult>;

  // Tool characteristics
  isSearchOrReadCommand?: (input: z.infer<Input>) => {
    isSearch: boolean;
    isRead: boolean;
    isList?: boolean;
  };
  isOpenWorld?: (input: z.infer<Input>) => boolean;

  // User interface
  userFacingName?: (input: Partial<z.infer<Input>>) => string;
  getActivityDescription?: (
    input: Partial<z.infer<Input>>
  ) => string | null;
  getToolUseSummary?: (input: Partial<z.infer<Input>>) => string | null;

  // Tool search and discovery
  aliases?: string[];
  searchHint?: string;
  shouldDefer?: boolean;
  alwaysLoad?: boolean;

  // Result handling
  isResultTruncated?: (output: Output) => boolean;
};

/**
 * Tool definition interface (all methods optional)
 */
export type ToolDef<
  Input extends z.ZodType = z.ZodType,
  Output = unknown,
  P extends ToolProgressData = ToolProgressData,
> = Omit<Tool<Input, Output, P>, 'isConcurrencySafe' | 'isReadOnly' | 'checkPermissions'> &
  Partial<
    Pick<
      Tool<Input, Output, P>,
      'isConcurrencySafe' | 'isReadOnly' | 'checkPermissions'
    >
  >;

/**
 * Methods that have defaults
 */
type DefaultableToolKeys =
  | 'isConcurrencySafe'
  | 'isReadOnly'
  | 'isDestructive'
  | 'checkPermissions';

/**
 * Built tool type with defaults filled in
 */
type BuiltTool<T> = Omit<T, DefaultableToolKeys> & {
  [K in DefaultableToolKeys]-?: K extends keyof T
    ? undefined extends T[K]
      ? ToolDefaults[K]
      : T[K]
    : ToolDefaults[K]
};

/**
 * Default implementations (fail-closed where it matters)
 */
const TOOL_DEFAULTS = {
  isConcurrencySafe: (_input?: unknown) => false,
  isReadOnly: (_input?: unknown) => false,
  isDestructive: (_input?: unknown) => false,
  checkPermissions: (
    _input: Record<string, unknown>,
    _ctx?: ToolContext
  ): Promise<PermissionResult> =>
    Promise.resolve({ behavior: 'allow', updatedInput: _input }),
};

type ToolDefaults = typeof TOOL_DEFAULTS;

/**
 * Build a complete Tool from a partial definition
 * Fills in safe defaults for commonly-stubbed methods
 *
 * @param def - Partial tool definition
 * @returns Complete tool with defaults
 */
export function buildTool<
  Input extends z.ZodType = z.ZodType,
  Output = unknown,
  P extends ToolProgressData = ToolProgressData,
>(def: ToolDef<Input, Output, P>): BuiltTool<typeof def> {
  return {
    ...TOOL_DEFAULTS,
    userFacingName: (_input?: unknown) => def.name,
    ...def,
  } as BuiltTool<typeof def>;
}

/**
 * Check if a tool matches a name (primary name or alias)
 */
export function toolMatchesName(
  tool: { name: string; aliases?: string[] },
  name: string
): boolean {
  return tool.name === name || (tool.aliases?.includes(name) ?? false);
}

/**
 * Find a tool by name or alias from a list of tools
 */
export function findToolByName(
  tools: Tool[],
  name: string
): Tool | undefined {
  return tools.find((t) => toolMatchesName(t, name));
}
