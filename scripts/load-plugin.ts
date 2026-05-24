/**
 * Plugin Loading Script
 *
 * Standalone script to load and test plugins using Bun
 */

import { BunPluginLoader, isBunRuntime } from '../src/plugins/bun-loader';
import { PluginRegistry } from '../src/plugins/registry';
import { ToolRegistry } from '../src/tools/registry';
import { HookSystem } from '../src/hooks';
import * as path from 'path';
import chalk from 'chalk';

const projectRoot = process.cwd();

async function main() {
  console.log(chalk.cyan('🔌 Kode Plugin Loader (Bun Edition)\n'));

  if (!isBunRuntime()) {
    console.log(chalk.yellow('⚠️  Not running in Bun - falling back to Node.js with ts-node'));
  } else {
    console.log(chalk.green('✅ Running in Bun - fast plugin loading enabled!\n'));
  }

  // Initialize plugin system
  const toolRegistry = new ToolRegistry();
  const hookSystem = new HookSystem();
  const pluginRegistry = new PluginRegistry();

  const loader = new BunPluginLoader(
    pluginRegistry,
    {
      directories: [
        path.join(projectRoot, 'plugins'),
        path.join(projectRoot, 'examples'),
      ],
      enabled: true,
      timeout: 5000,
      validateDependencies: true,
      verbose: true,
    },
    toolRegistry,
    hookSystem,
    projectRoot
  );

  try {
    // Discover plugins
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.cyan('🔍 Discovering plugins...\n'));

    const manifests = await loader.discover();

    if (manifests.length === 0) {
      console.log(chalk.yellow('No plugins found'));
      console.log(chalk.gray('\nTip: Create a plugin in ./plugins or ./examples directories'));
      return;
    }

    console.log(chalk.green(`Found ${manifests.length} plugin(s):\n`));
    for (const manifest of manifests) {
      console.log(chalk.gray(`  • ${manifest.name} v${manifest.version} (${manifest.id})`));
    }

    // Load plugins
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('📦 Loading plugins...\n'));

    const results = await Promise.all(
      manifests.map(manifest => loader.load(manifest))
    );

    // Show results
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('📊 Load Results:\n'));

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    for (const result of results) {
      if (result.success) {
        console.log(chalk.green(`  ✅ ${result.plugin?.name} (${result.duration}ms)`));

        if (result.warnings && result.warnings.length > 0) {
          for (const warning of result.warnings) {
            console.log(chalk.yellow(`     ⚠️  ${warning}`));
          }
        }
      } else {
        console.log(chalk.red(`  ❌ ${result.error?.message}`));
      }
    }

    // Summary
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('📈 Summary:\n'));
    console.log(chalk.gray(`  Total plugins: ${results.length}`));
    console.log(chalk.green(`  Successful: ${successCount}`));
    console.log(chalk.red(`  Failed: ${failCount}`));

    const stats = pluginRegistry.getStats();
    console.log(chalk.gray(`\n  Loaded plugins: ${stats.total}`));
    console.log(chalk.gray(`  With errors: ${stats.withErrors}`));

    // List tools
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.cyan('🛠️  Registered Tools:\n'));

    const tools = toolRegistry.list();
    if (tools.length === 0) {
      console.log(chalk.yellow('  No tools registered'));
    } else {
      for (const tool of tools) {
        console.log(chalk.gray(`  • ${tool.name}`));
        console.log(chalk.gray(`    ${tool.description}`));
      }
    }

    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.green('\n✅ Plugin loading complete!\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  } finally {
    await loader.cleanup();
  }
}

main();
