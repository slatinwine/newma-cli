/**
 * Plugin Loading Test
 *
 * This test verifies that the plugins can be loaded and instantiated correctly
 */

const path = require('path');

console.log('==================================');
console.log('🧪 Plugin Loading Test');
console.log('==================================\n');

try {
  // 1. Load Plan Mode Plugin
  console.log('1️⃣  Loading PlanModePlugin...');
  const { PlanModePlugin } = require('./dist/loop/plugins/plan-mode-plugin');
  const planPlugin = new PlanModePlugin();
  console.log('  ✓ PlanModePlugin loaded');
  console.log(`    id: ${planPlugin.id}`);
  console.log(`    name: ${planPlugin.name}`);
  console.log(`    version: ${planPlugin.version}`);
  console.log(`    type: ${planPlugin.type}`);
  console.log(`    tools: ${planPlugin.tools.length} (should be 0)`);
  console.log(`    has onBeforeInput: ${typeof planPlugin.onBeforeInput === 'function'}`);

  // Test validation method
  const validInput = 'add a login feature';
  const invalidInput = 'ab';
  console.log(`  ✓ Validation test:`);
  console.log(`    "${validInput}" → ${planPlugin.isValidTaskRequirement(validInput)}`);
  console.log(`    "${invalidInput}" → ${planPlugin.isValidTaskRequirement(invalidInput)}`);
  console.log('');

  // 2. Load Do Mode Plugin
  console.log('2️⃣  Loading DoModePlugin...');
  const { DoModePlugin } = require('./dist/loop/plugins/do-mode-plugin');
  const mockConfig = {
    apiKey: 'test',
    baseUrl: 'https://test.com',
    model: 'test-model'
  };
  const doPlugin = new DoModePlugin(mockConfig);
  console.log('  ✓ DoModePlugin loaded');
  console.log(`    id: ${doPlugin.id}`);
  console.log(`    name: ${doPlugin.name}`);
  console.log(`    version: ${doPlugin.version}`);
  console.log(`    type: ${doPlugin.type}`);
  console.log(`    tools: ${doPlugin.tools.length} (should be 0)`);
  console.log(`    has onBeforeInput: ${typeof doPlugin.onBeforeInput === 'function'}`);
  console.log('');

  // 3. Load Intent Recognition Plugin
  console.log('3️⃣  Loading IntentRecognitionPlugin...');
  const { IntentRecognitionPlugin } = require('./dist/loop/plugins/intent-integration-plugin');
  const intentPlugin = new IntentRecognitionPlugin(mockConfig);
  console.log('  ✓ IntentRecognitionPlugin loaded');
  console.log(`    id: ${intentPlugin.id}`);
  console.log(`    name: ${intentPlugin.name}`);
  console.log(`    version: ${intentPlugin.version}`);
  console.log(`    type: ${intentPlugin.type}`);
  console.log(`    tools: ${intentPlugin.tools.length} (should be 0)`);
  console.log(`    has onBeforeInput: ${typeof intentPlugin.onBeforeInput === 'function'}`);
  console.log(`    has onSessionStart: ${typeof intentPlugin.onSessionStart === 'function'}`);

  // Test config methods
  console.log(`  ✓ Config test:`);
  const config = intentPlugin.getConfig();
  console.log(`    enabled: ${config.enabled} (should be false)`);
  console.log(`    autoRedirect: ${config.autoRedirect} (should be true)`);
  console.log(`    confidenceThreshold: ${config.confidenceThreshold} (should be 0.6)`);

  intentPlugin.updateConfig({ enabled: true });
  const updatedConfig = intentPlugin.getConfig();
  console.log(`    After update: ${updatedConfig.enabled} (should be true)`);
  console.log('');

  // 4. Test Mode Commands Plugin
  console.log('4️⃣  Loading ModeCommandsPlugin...');
  const { ModeCommandsPlugin } = require('./dist/loop/plugins/mode-commands-plugin');
  console.log('  ✓ ModeCommandsPlugin loaded');

  const planCommand = ModeCommandsPlugin.createPlanCommand();
  console.log(`    /plan command: ${planCommand.name}`);
  console.log(`    description: ${planCommand.description}`);
  console.log(`    has handler: ${typeof planCommand.handler === 'function'}`);

  const doCommand = ModeCommandsPlugin.createDoCommand();
  console.log(`    /do command: ${doCommand.name}`);
  console.log(`    description: ${doCommand.description}`);
  console.log(`    has handler: ${typeof doCommand.handler === 'function'}`);

  const loopCommand = ModeCommandsPlugin.createLoopCommand();
  console.log(`    /loop command: ${loopCommand.name}`);
  console.log(`    description: ${loopCommand.description}`);
  console.log('');

  // 5. Test Config Integration
  console.log('5️⃣  Testing config integration...');
  const configModule = require('./dist/config');
  console.log('  ✓ Config module loaded');
  console.log(`    has getIntentRecognitionConfig: ${typeof configModule.getIntentRecognitionConfig === 'function'}`);

  const intentConfig = configModule.getIntentRecognitionConfig();
  console.log(`    intentRecognition config: ${JSON.stringify(intentConfig)}`);
  console.log('');

  // Summary
  console.log('==================================');
  console.log('✅ All plugins loaded successfully!');
  console.log('==================================\n');

  console.log('📊 Summary:');
  console.log('  • PlanModePlugin: ✓');
  console.log('  • DoModePlugin: ✓');
  console.log('  • IntentRecognitionPlugin: ✓');
  console.log('  • ModeCommandsPlugin: ✓');
  console.log('  • Config integration: ✓\n');

  console.log('🚀 Plugins are ready to use!\n');

} catch (error) {
  console.error('❌ Error during plugin loading test:');
  console.error(error);
  process.exit(1);
}
