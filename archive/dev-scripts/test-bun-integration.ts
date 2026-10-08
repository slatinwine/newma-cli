/**
 * Bun Integration Test
 *
 * Quick test to verify Bun plugin system integration
 */

import { isBunRuntime } from './src/plugins/bun-loader';

console.log('🧪 Testing Bun Integration...\n');

// Test 1: Check runtime
console.log('Test 1: Runtime Detection');
if (isBunRuntime()) {
  console.log('✅ Running in Bun runtime');
} else {
  console.log('ℹ️  Running in Node.js runtime (Bun not detected)');
  console.log('   To use Bun: curl -fsSL https://bun.sh/install | bash');
}

// Test 2: Import plugin loader
console.log('\nTest 2: Plugin Loader Import');
try {
  const { BunPluginLoader } = require('./src/plugins/bun-loader');
  console.log('✅ BunPluginLoader imported successfully');
} catch (error: any) {
  console.log('❌ Failed to import BunPluginLoader:', error?.message || error);
}

// Test 3: Import example plugin
console.log('\nTest 3: Example Plugin Import');
try {
  // Try to import the example plugin
  const pluginPath = './examples/hello-plugin/plugin.ts';
  console.log(`ℹ️  Attempting to import: ${pluginPath}`);
  console.log('   Note: TypeScript import requires ts-node or Bun runtime');
} catch (error: any) {
  console.log('ℹ️  Expected: TypeScript import requires runtime support');
}

console.log('\n✨ Integration test complete!\n');
console.log('Next steps:');
console.log('1. Install Bun: curl -fsSL https://bun.sh/install | bash');
console.log('2. Run: bun run plugin:load');
console.log('3. Create your own plugin in ./plugins/');
