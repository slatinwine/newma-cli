/**
 * Skill Compiler
 * Compiles TypeScript skills to JavaScript using TypeScript compiler API
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { execFileNoThrow } from '../../utils/execFileNoThrow';
import type {
  CompilationOptions,
  CompilationResult,
  CompilationError
} from './types';

/**
 * Default compilation options
 */
const DEFAULT_OPTIONS: CompilationOptions = {
  outDir: './dist',
  sourceMap: true,
  declaration: false,
  minify: false,
  target: 'ES2020',
  module: 'CommonJS',
  removeComments: false,
  verbose: false,
};

/**
 * Compile TypeScript skill to JavaScript
 */
export async function compileSkill(
  skillPath: string,
  options: CompilationOptions = {}
): Promise<CompilationResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Validate skill path
    const stat = await fs.stat(skillPath);
    if (!stat.isDirectory()) {
      throw new Error(`Skill path must be a directory: ${skillPath}`);
    }

    // Find TypeScript files
    const tsFiles = await findTypeScriptFiles(skillPath);

    if (tsFiles.length === 0) {
      return {
        success: false,
        files: [],
        compilationTime: Date.now() - startTime,
      };
    }

    // Prepare output directory
    const outDir = path.resolve(skillPath, opts.outDir!);
    await fs.mkdir(outDir, { recursive: true });

    // Compile using tsc
    const result = await runTypeScriptCompiler(skillPath, outDir, tsFiles, opts);

    return {
      success: result.errors.length === 0,
      files: result.files,
      sourceMaps: opts.sourceMap ? result.sourceMaps : undefined,
      declarations: opts.declaration ? result.declarations : undefined,
      errors: result.errors.length > 0 ? result.errors : undefined,
      compilationTime: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      files: [],
      errors: [{
        file: skillPath,
        line: 0,
        column: 0,
        code: 0,
        message: error.message,
      }],
      compilationTime: Date.now() - startTime,
    };
  }
}

/**
 * Find all TypeScript files in a directory
 */
async function findTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and dist
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        const subFiles = await findTypeScriptFiles(fullPath);
        files.push(...subFiles);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Run TypeScript compiler using execFileNoThrow
 */
async function runTypeScriptCompiler(
  skillPath: string,
  outDir: string,
  tsFiles: string[],
  options: CompilationOptions
): Promise<{
  files: string[];
  sourceMaps: string[];
  declarations: string[];
  errors: CompilationError[];
}> {
  // Create temporary tsconfig.json
  const tsconfigPath = path.join(os.tmpdir(), `tsconfig-${Date.now()}.json`);
  const tsconfig = {
    compilerOptions: {
      outDir,
      target: options.target,
      module: options.module,
      sourceMap: options.sourceMap,
      declaration: options.declaration,
      removeComments: options.removeComments,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
    },
    include: tsFiles.map(f => path.relative(skillPath, f)),
  };

  await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2));

  // Run tsc
  const tscPath = path.join(
    process.cwd(),
    'node_modules',
    '.bin',
    os.platform() === 'win32' ? 'tsc.cmd' : 'tsc'
  );

  const result = await execFileNoThrow(tscPath, ['-p', tsconfigPath], {
    cwd: skillPath,
    env: {
      ...process.env,
      PATH: `${path.join(process.cwd(), 'node_modules', '.bin')}${path.delimiter}${process.env.PATH}`,
    },
  });

  // Clean up tsconfig
  await fs.unlink(tsconfigPath).catch((_e) => { /* compiler: temp file cleanup */ });

  // Parse results
  const files: string[] = [];
  const sourceMaps: string[] = [];
  const declarations: string[] = [];
  const errors: CompilationError[] = [];

  // Find output files - proceed if no error or if compilation succeeded despite errors
  if (!result.error) {
    const outFiles = await findCompiledFiles(outDir);
    files.push(...outFiles.js);
    sourceMaps.push(...outFiles.maps);
    declarations.push(...outFiles.declarations);
  }

  // Parse errors from stderr
  if (result.stderr) {
    const errorLines = result.stderr.split('\n').filter(line => line.trim());
    for (const line of errorLines) {
      const error = parseTsError(line);
      if (error) {
        errors.push(error);
      }
    }
  }

  return { files, sourceMaps, declarations, errors };
}

/**
 * Find compiled JavaScript files
 */
async function findCompiledFiles(dir: string): Promise<{
  js: string[];
  maps: string[];
  declarations: string[];
}> {
  const js: string[] = [];
  const maps: string[] = [];
  const declarations: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await findCompiledFiles(fullPath);
      js.push(...subFiles.js);
      maps.push(...subFiles.maps);
      declarations.push(...subFiles.declarations);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.js')) {
        js.push(fullPath);
      } else if (entry.name.endsWith('.js.map')) {
        maps.push(fullPath);
      } else if (entry.name.endsWith('.d.ts')) {
        declarations.push(fullPath);
      }
    }
  }

  return { js, maps, declarations };
}

/**
 * Parse TypeScript error line
 * Format: file.ts(line,column): error TScode: message
 */
function parseTsError(line: string): CompilationError | null {
  const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+TS(\d+):\s+(.+)$/);
  if (!match) {
    return null;
  }

  const [, file, lineStr, colStr, codeStr, message] = match;
  return {
    file,
    line: parseInt(lineStr, 10),
    column: parseInt(colStr, 10),
    code: parseInt(codeStr, 10),
    message,
  };
}

/**
 * Watch skill for changes and recompile
 */
export async function watchSkill(
  skillPath: string,
  options: CompilationOptions = {},
  onChange: (result: CompilationResult) => void
): Promise<() => void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let timer: NodeJS.Timeout | null = null;

  // Initial compilation
  onChange(await compileSkill(skillPath, opts));

  // Watch for changes (using chokidar if available, otherwise fs.watch)
  try {
    const chokidar = await import('chokidar');
    const watcher = chokidar.watch('**/*.ts', {
      cwd: skillPath,
      ignored: /node_modules|dist/,
    });

    watcher.on('change', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const result = await compileSkill(skillPath, opts);
        onChange(result);
      }, 300); // Debounce 300ms
    });

    return () => watcher.close();
  } catch {
    // Fallback to fs.watch
    const watcher = fs.watch(skillPath, { recursive: true } as any);
    (watcher as any).on('change', (eventType: any, filename: string) => {
      if (eventType === 'change' && filename && filename.endsWith('.ts')) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          compileSkill(skillPath, opts).then(result => {
            onChange(result);
          });
        }, 300);
      }
    });

    return () => {
      try {
        (watcher as any).close();
      } catch {
        // Ignore close errors
      }
    };
  }
}
