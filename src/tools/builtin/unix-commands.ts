// src/tools/builtin/unix-commands.ts
/**
 * Common Unix command-line tools
 * Provides specific tools for frequently used commands
 */

import {
  Tool,
  ToolCategory,
  Permission,
  ToolParameter,
  ValidationResult,
} from '../types';
import { execFileSync } from 'child_process';
import path from 'path';

/**
 * Execute a command helper
 */
async function execCommand(
  command: string,
  args: string[],
  cwd: string,
  captureOutput = true
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const output = execFileSync(command, args, {
      cwd,
      stdio: captureOutput ? 'pipe' : 'inherit',
      encoding: 'utf-8',
    });

    return {
      success: true,
      output: output.trim(),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      output: error.stdout || error.stderr,
    };
  }
}

/**
 * List directory contents (ls)
 */
export const listFilesTool: Tool = {
  name: 'list_files',
  description: 'List files and directories in a given path',
  category: ToolCategory.COMMAND,
  permissions: [Permission.READ_FILES],
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Directory path to list (relative to project root)',
      required: false,
      default: '.',
    },
    {
      name: 'showHidden',
      type: 'boolean',
      description: 'Include hidden files (dotfiles)',
      required: false,
      default: false,
    },
    {
      name: 'longFormat',
      type: 'boolean',
      description: 'Use long listing format (shows permissions, size, etc.)',
      required: false,
      default: false,
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: 'List subdirectories recursively',
      required: false,
      default: false,
    },
  ],
  async handler(params, context) {
    const {
      path: targetPath = '.',
      showHidden = false,
      longFormat = false,
      recursive = false,
    } = params as {
      path?: string;
      showHidden?: boolean;
      longFormat?: boolean;
      recursive?: boolean;
    };

    const workingDir = path.resolve(context.root, targetPath);

    const args = [];
    if (showHidden) args.push('-a');
    if (longFormat) args.push('-l');
    if (recursive) args.push('-R');

    args.push(workingDir);

    return await execCommand('ls', args, context.root);
  },
};

/**
 * Read file contents (cat)
 */
export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read and display the contents of a file',
  category: ToolCategory.FILE,
  permissions: [Permission.READ_FILES],
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'File path to read (relative to project root)',
      required: true,
    },
    {
      name: 'lineCount',
      type: 'number',
      description: 'Number of lines to read from the beginning (optional)',
      required: false,
    },
  ],
  validate(params) {
    const errors: string[] = [];
    const filePath = params.path as string;

    if (!filePath || typeof filePath !== 'string') {
      errors.push('File path must be a non-empty string');
      return { valid: false, errors };
    }

    // Check for path traversal attempts
    if (filePath.includes('..')) {
      errors.push('Path traversal (..) is not allowed for security reasons');
    }

    return { valid: errors.length === 0, errors };
  },
  async handler(params, context) {
    const { path: filePath, lineCount } = params as {
      path: string;
      lineCount?: number;
    };

    const fullPath = path.resolve(context.root, filePath);

    try {
      let command = 'cat';
      let args = [fullPath];

      // Use head for line limiting
      if (lineCount && lineCount > 0) {
        return await execCommand('head', [`-n${lineCount}`, fullPath], context.root);
      }

      return await execCommand(command, args, context.root);
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to read file: ${error.message}`,
      };
    }
  },
};

/**
 * Search in files (grep)
 */
export const searchFilesTool: Tool = {
  name: 'search_files',
  description: 'Search for text patterns in files using grep',
  category: ToolCategory.COMMAND,
  permissions: [Permission.READ_FILES],
  parameters: [
    {
      name: 'pattern',
      type: 'string',
      description: 'Search pattern (supports regex)',
      required: true,
    },
    {
      name: 'path',
      type: 'string',
      description: 'Directory or file to search in (default: current directory)',
      required: false,
      default: '.',
    },
    {
      name: 'ignoreCase',
      type: 'boolean',
      description: 'Case-insensitive search',
      required: false,
      default: false,
    },
    {
      name: 'recursive',
      type: 'boolean',
      description: 'Search recursively in subdirectories',
      required: false,
      default: true,
    },
    {
      name: 'filePattern',
      type: 'string',
      description: 'Filter files by pattern (e.g., "*.ts" for TypeScript files)',
      required: false,
    },
    {
      name: 'contextLines',
      type: 'number',
      description: 'Number of context lines to show around matches',
      required: false,
      default: 2,
    },
  ],
  async handler(params, context) {
    const {
      pattern,
      path: searchPath = '.',
      ignoreCase = false,
      recursive = true,
      filePattern,
      contextLines = 2,
    } = params as {
      pattern: string;
      path?: string;
      ignoreCase?: boolean;
      recursive?: boolean;
      filePattern?: string;
      contextLines?: number;
    };

    const args = [];

    if (ignoreCase) args.push('-i');
    if (recursive) args.push('-r');
    args.push(`-C${contextLines}`);

    // Add file pattern if specified
    if (filePattern) {
      args.push(`--include=${filePattern}`);
    }

    args.push(pattern);
    args.push(path.resolve(context.root, searchPath));

    return await execCommand('grep', args, context.root);
  },
};

/**
 * Find files (find)
 */
export const findFilesTool: Tool = {
  name: 'find_files',
  description: 'Search for files by name, type, or other properties',
  category: ToolCategory.COMMAND,
  permissions: [Permission.READ_FILES],
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Directory to search in (default: current directory)',
      required: false,
      default: '.',
    },
    {
      name: 'name',
      type: 'string',
      description: 'File name pattern (e.g., "*.ts", "test-*")',
      required: false,
    },
    {
      name: 'type',
      type: 'enum',
      description: 'File type to search for',
      required: false,
      values: ['f', 'd', 'l'],
      default: 'f',
    },
    {
      name: 'maxDepth',
      type: 'number',
      description: 'Maximum directory depth to search',
      required: false,
    },
  ],
  async handler(params, context) {
    const {
      path: searchPath = '.',
      name,
      type = 'f',
      maxDepth,
    } = params as {
      path?: string;
      name?: string;
      type?: 'f' | 'd' | 'l';
      maxDepth?: number;
    };

    const args = [path.resolve(context.root, searchPath)];

    if (maxDepth !== undefined) {
      args.push(`-maxdepth${maxDepth}`);
    }

    if (type) {
      args.push(`-type${type}`);
    }

    if (name) {
      args.push(`-name${name}`);
    }

    return await execCommand('find', args, context.root);
  },
};

/**
 * Count lines in file (wc -l)
 */
export const countLinesTool: Tool = {
  name: 'count_lines',
  description: 'Count lines in one or more files',
  category: ToolCategory.ANALYSIS,
  permissions: [Permission.READ_FILES],
  parameters: [
    {
      name: 'paths',
      type: 'array',
      description: 'File paths to count (relative to project root)',
      required: true,
    },
  ],
  async handler(params, context) {
    const { paths } = params as { paths: string[] };

    const fullPaths = paths.map(p => path.resolve(context.root, p));

    return await execCommand('wc', ['-l', ...fullPaths], context.root);
  },
};

/**
 * Get file/disk usage (du)
 */
export const diskUsageTool: Tool = {
  name: 'disk_usage',
  description: 'Estimate file and directory space usage',
  category: ToolCategory.ANALYSIS,
  permissions: [Permission.READ_FILES],
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Path to analyze (relative to project root)',
      required: false,
      default: '.',
    },
    {
      name: 'maxDepth',
      type: 'number',
      description: 'Directory depth to display',
      required: false,
      default: 1,
    },
    {
      name: 'humanReadable',
      type: 'boolean',
      description: 'Show sizes in human-readable format (KB, MB, GB)',
      required: false,
      default: true,
    },
  ],
  async handler(params, context) {
    const {
      path: targetPath = '.',
      maxDepth = 1,
      humanReadable = true,
    } = params as {
      path?: string;
      maxDepth?: number;
      humanReadable?: boolean;
    };

    const args = [];
    if (humanReadable) args.push('-h');
    args.push(`-d${maxDepth}`);
    args.push(path.resolve(context.root, targetPath));

    return await execCommand('du', args, context.root);
  },
};

/**
 * Export all Unix command tools
 */
export const unixCommandTools = [
  listFilesTool,
  readFileTool,
  searchFilesTool,
  findFilesTool,
  countLinesTool,
  diskUsageTool,
];
