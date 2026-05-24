/**
 * Bun Build Script
 *
 * Fast build using Bun's native bundler
 */

import { build } from 'bun';
import * as fs from 'fs/promises';
import * as path from 'path';

const ENTRY_POINTS = [
  'src/cli.ts',
];

const OUT_DIR = 'dist';

async function copyPrompts() {
  const promptsDir = path.join(process.cwd(), 'prompts');
  const outPromptsDir = path.join(process.cwd(), OUT_DIR, 'prompts');

  try {
    await fs.mkdir(outPromptsDir, { recursive: true });

    const files = await fs.readdir(promptsDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        await fs.copyFile(
          path.join(promptsDir, file),
          path.join(outPromptsDir, file)
        );
      }
    }
  } catch (error) {
    // Prompts directory might not exist, that's ok
    console.log('  No prompts to copy');
  }
}

async function buildWithBun() {
  console.log('🔨 Building with Bun...');

  const startTime = Date.now();

  // Build each entry point
  for (const entry of ENTRY_POINTS) {
    const outFile = path.join(OUT_DIR, entry.replace('src/', '').replace('.ts', '.js'));

    console.log(`  Building ${entry} -> ${outFile}`);

    await build({
      entrypoints: [entry],
      outfile: outFile,
      target: 'node',
      format: 'cjs',
      sourcemap: 'external',
      minify: false,
      keepNames: true,
      // Preserve TypeScript types
      // Note: Bun doesn't emit .d.ts files, so we'll use tsc for that
    });
  }

  const duration = Date.now() - startTime;
  console.log(`✅ Build completed in ${duration}ms`);

  // Copy prompt files
  console.log('📄 Copying prompt files...');
  await copyPrompts();

  // Generate TypeScript definitions using tsc
  console.log('📝 Generating TypeScript definitions...');
  const tscResult = await Bun.spawn(['tsc', '--emitDeclarationOnly'], {
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await tscResult.exited;

  if (tscResult.exitCode !== 0) {
    console.warn('⚠️  TypeScript declaration generation failed');
  } else {
    console.log('✅ TypeScript definitions generated');
  }
}

// Run build
buildWithBun().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});
