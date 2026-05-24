import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Execute a command file without throwing on error
 * Returns the result even if the command fails
 */
export async function execFileNoThrow(
  file: string,
  args?: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
): Promise<{ stdout: string; stderr: string; error?: Error }> {
  try {
    const result = await execFileAsync(file, args || [], options);
    return {
      stdout: typeof result.stdout === 'string' ? result.stdout : String(result.stdout),
      stderr: typeof result.stderr === 'string' ? result.stderr : String(result.stderr),
    };
  } catch (error: any) {
    return {
      stdout: error.stdout ? (typeof error.stdout === 'string' ? error.stdout : String(error.stdout)) : '',
      stderr: error.stderr ? (typeof error.stderr === 'string' ? error.stderr : String(error.stderr)) : '',
      error,
    };
  }
}
