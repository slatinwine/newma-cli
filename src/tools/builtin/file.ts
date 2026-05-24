// src/tools/builtin/file.ts
/**
 * File operations tool
 * Enhanced version based on Claude Code architecture
 * Handles create, modify, delete operations
 */

import { z } from 'zod';
import { promises as fs } from 'fs';
import path from 'path';
import { RollbackManager } from '../../rollback';
import { retryFileOperation } from '../../retry';
import { reviewFileChange, FileChange } from '../../review-mode';
import { Config } from '../../config';
import { buildTool, type ToolDef } from '../Tool';
import { adaptToLegacyTool } from '../adapter';
import { ToolCategory, Permission } from '../types';
import type { ToolContext, ToolResult, Tool as LegacyTool } from '../types';

/**
 * File operation types
 */
const fileOperationSchema = z.enum(['create', 'modify', 'delete']);

/**
 * Input schema for file tool
 */
const fileInputSchema = z.strictObject({
  operation: fileOperationSchema.describe('The operation to perform'),
  path: z.string().describe('File path relative to project root'),
  content: z.string().optional().describe('File content (for create/modify operations)'),
});

/**
 * Output schema for file tool
 */
const fileOutputSchema = z.object({
  operation: fileOperationSchema,
  path: z.string(),
  success: z.boolean(),
  oldContent: z.string().optional(),
  newContent: z.string().optional(),
  rollbackPoint: z.string().optional(),
});

/**
 * Internal file tool using new buildTool pattern
 */
const internalFileTool = buildTool({
  name: 'file',
  description: 'Create, modify, or delete files',
  category: ToolCategory.FILE,
  permissions: [Permission.READ_FILES, Permission.WRITE_FILES],

  // Schema definitions
  inputSchema: fileInputSchema,
  outputSchema: fileOutputSchema,

  // Tool characteristics
  searchHint: 'create or overwrite files',
  isReadOnly: (input) => false,
  isConcurrencySafe: (input) => false,
  isDestructive: (input) => input.operation === 'delete',

  // Search/read detection
  isSearchOrReadCommand: (input) => ({
    isSearch: false,
    isRead: input.operation === 'modify' && !input.content, // Read-only modify
  }),

  // User interface
  userFacingName: (input) => {
    if (!input?.operation) return 'File';
    const op = input.operation;
    const p = input.path || '';
    return `${op.charAt(0).toUpperCase() + op.slice(1)} ${path.basename(p)}`;
  },

  getActivityDescription: (input) => {
    if (!input?.operation) return null;
    const op = input.operation;
    const p = input.path || '';
    return `${op === 'create' ? 'Creating' : op === 'delete' ? 'Deleting' : 'Modifying'} ${path.basename(p)}`;
  },

  /**
   * Validate input
   */
  async validateInput(input: z.infer<typeof fileInputSchema>, context: ToolContext) {
    const errors: string[] = [];

    // Check if content is provided for create/modify
    if ((input.operation === 'create' || input.operation === 'modify') && !input.content) {
      errors.push(`Content is required for ${input.operation} operation`);
    }

    // Check for dangerous paths
    if (input.path.includes('.env') || input.path.includes('credentials')) {
      errors.push('Cannot modify sensitive files directly');
    }

    if (errors.length > 0) {
      return { result: false, message: errors.join(', '), errorCode: 400 };
    }
    return { result: true };
  },

  /**
   * Execute file operation
   */
  async call(input: z.infer<typeof fileInputSchema>, context: ToolContext): Promise<ToolResult> {
    const { operation, path: filePath, content } = input;

    const fullPath = path.resolve(context.root, filePath);
    const config = context.config as Config;

    try {
      // Read old content for modify/delete operations
      let oldContent: string | undefined;
      if (operation === 'modify' || operation === 'delete') {
        try {
          oldContent = await fs.readFile(fullPath, 'utf-8');
        } catch {
          // File doesn't exist, oldContent remains undefined
        }
      }

      // Build FileChange object for review
      const fileChange: FileChange = {
        type: operation,
        path: filePath,
        oldContent,
        newContent: operation === 'delete' ? undefined : content,
      };

      // Review the change if Review Mode is enabled
      if (config.reviewMode?.enabled) {
        const reviewResult = await reviewFileChange(
          fileChange,
          config.reviewMode,
          context.root
        );

        if (!reviewResult.approved) {
          return {
            success: false,
            error: reviewResult.reason || 'Change rejected by user',
          };
        }
      }

      // Execute the file operation
      switch (operation) {
        case 'create': {
          await retryFileOperation('create file', async () => {
            // Create directory if needed
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            // Write file
            await fs.writeFile(fullPath, content!, 'utf-8');
          });

          return {
            success: true,
            output: `Created file: ${filePath}`,
            metadata: { path: filePath, size: content!.length },
          };
        }

        case 'modify': {
          await retryFileOperation('modify file', async () => {
            // Check if file exists
            if (!require('fs').existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            // Write file
            await fs.writeFile(fullPath, content!, 'utf-8');
          });

          return {
            success: true,
            output: `Modified file: ${filePath}`,
            metadata: { path: filePath, size: content!.length },
          };
        }

        case 'delete': {
          await retryFileOperation('delete file', async () => {
            // Check if file exists
            if (!require('fs').existsSync(fullPath)) {
              throw new Error(`File not found: ${filePath}`);
            }
            // Delete file
            await fs.unlink(fullPath);
          });

          return {
            success: true,
            output: `Deleted file: ${filePath}`,
            metadata: { path: filePath },
          };
        }

        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Export legacy-compatible tool
 */
export const fileTool: LegacyTool = adaptToLegacyTool(internalFileTool);
