#!/usr/bin/env bun
/**
 * Example script for empty-plugin
 *
 * This script demonstrates how to use the plugin outside of Kode.
 * Run: bun run scripts/example.ts
 */

import plugin from '../plugin';

async function main() {
  console.log('Running empty-plugin example...');

  // Example: Initialize plugin
  await plugin.initialize({
    projectRoot: process.cwd(),
    pluginRoot: __dirname,
    config: {},
  });

  // Example tool call
  if (plugin.tools.length > 0) {
    const tool = plugin.tools[0];
    console.log(`\nCalling tool: ${tool.name}`);

    const result = await tool.handler(
      { /* Add tool parameters here */ },
      {
        projectRoot: process.cwd(),
        pluginRoot: __dirname,
        config: {},
      }
    );

    console.log('Result:', result);
  }

  // Cleanup
  await plugin.cleanup({});
}

main().catch(console.error);
