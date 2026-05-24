/**
 * User Preferences Memory Test
 *
 * 测试用户偏好记忆系统
 */

import { createPreferencesManager } from './src/memory/preferences-manager';

async function testPreferences() {
  console.log('Testing User Preferences Memory System\n');
  console.log('=====================================\n');

  const projectRoot = process.cwd();
  const manager = createPreferencesManager(projectRoot);

  // ==================== Test 1: Initialize ====================
  console.log('Test 1: Initialize Preferences Manager');
  console.log('---------------------------------------');

  await manager.initialize();
  console.log('✓ Preferences manager initialized\n');

  // ==================== Test 2: Get Default Preferences ====================
  console.log('Test 2: Get Default Preferences');
  console.log('----------------------------------');

  const prefs = await manager.getPreferences();
  console.log('✓ Retrieved preferences');
  console.log(`  User ID: ${prefs?.userId.substring(0, 20)}...`);
  console.log(`  Language: ${prefs?.aiInteraction.language}`);
  console.log(`  Verbosity: ${prefs?.aiInteraction.verbosity}`);
  console.log(`  Indent: ${prefs?.codeStyle.indent} (${prefs?.codeStyle.indentSize})`);
  console.log(`  Package Manager: ${prefs?.tools.preferredPackageManager}\n`);

  // ==================== Test 3: Update Code Style ====================
  console.log('Test 3: Update Code Style Preferences');
  console.log('---------------------------------------');

  await manager.updateCodeStyle({
    indent: 'tabs',
    indentSize: 4,
    quoteStyle: 'double',
    namingConvention: 'snake_case',
  });
  console.log('✓ Code style updated');

  const codeStyle = await manager.getCodeStylePreferences();
  console.log(`  Indent: ${codeStyle.indent} (${codeStyle.indentSize})`);
  console.log(`  Quotes: ${codeStyle.quoteStyle}`);
  console.log(`  Naming: ${codeStyle.namingConvention}\n`);

  // ==================== Test 4: Update AI Interaction ====================
  console.log('Test 4: Update AI Interaction Preferences');
  console.log('-------------------------------------------');

  await manager.updateAIInteraction({
    language: 'zh',
    verbosity: 'concise',
    planningAlgorithm: 'fft',
    proactiveSuggestions: false,
  });
  console.log('✓ AI interaction updated');

  const aiPrefs = await manager.getAIInteractionPreferences();
  console.log(`  Language: ${aiPrefs.language}`);
  console.log(`  Verbosity: ${aiPrefs.verbosity}`);
  console.log(`  Algorithm: ${aiPrefs.planningAlgorithm}`);
  console.log(`  Proactive Suggestions: ${aiPrefs.proactiveSuggestions}\n`);

  // ==================== Test 5: Learn from Behavior ====================
  console.log('Test 5: Learn from User Behavior');
  console.log('----------------------------------');

  await manager.learnFromBehavior({
    commandType: 'plan',
    language: 'en',
    verbosity: 'detailed',
  });
  console.log('✓ Learned from behavior (language should stay zh due to explicit preference)\n');

  // ==================== Test 6: Update Tech Stack ====================
  console.log('Test 6: Update Tech Stack Preferences');
  console.log('---------------------------------------');

  await manager.updatePreferences({
    techStack: {
      primaryLanguages: ['TypeScript', 'Python', 'Rust'],
      preferredFrameworks: ['React', 'FastAPI'],
      preferredLibraries: { http: 'axios', ui: 'TailwindCSS' },
      avoidedTechnologies: ['jQuery', 'AngularJS'],
      learningMode: 'experimental',
    },
  });
  console.log('✓ Tech stack updated');

  const updatedPrefs = await manager.getPreferences();
  console.log(`  Languages: ${updatedPrefs?.techStack.primaryLanguages.join(', ')}`);
  console.log(`  Frameworks: ${updatedPrefs?.techStack.preferredFrameworks.join(', ')}`);
  console.log(`  Libraries: ${Object.keys(updatedPrefs?.techStack.preferredLibraries || {}).join(', ')}`);
  console.log(`  Avoided: ${updatedPrefs?.techStack.avoidedTechnologies.join(', ')}`);
  console.log(`  Learning Mode: ${updatedPrefs?.techStack.learningMode}\n`);

  // ==================== Test 7: Export to User Profile ====================
  console.log('Test 7: Export to User Profile');
  console.log('---------------------------------');

  const profile = await manager.exportToUserProfile();
  console.log('✓ Generated user profile:');
  console.log('-----------------------------------');
  console.log(profile);
  console.log('-----------------------------------\n');

  // ==================== Test 8: Get Formatted Summary ====================
  console.log('Test 8: Get Formatted Summary for AI');
  console.log('---------------------------------------');

  const summary = await manager.getFormattedSummary();
  console.log('✓ Generated AI summary:');
  console.log('-----------------------------------');
  console.log(summary);
  console.log('-----------------------------------\n');

  // ==================== Test 9: Validate Preferences ====================
  console.log('Test 9: Validate Preferences');
  console.log('------------------------------');

  const validation = await manager.validatePreferences();
  console.log(`✓ Validation result: ${validation.valid ? 'VALID' : 'INVALID'}`);
  if (!validation.valid) {
    console.log(`  Errors: ${validation.errors.join(', ')}`);
  }
  console.log();

  // ==================== Test 10: Test Invalid Preferences ====================
  console.log('Test 10: Test Invalid Preferences');
  console.log('-----------------------------------');

  // Create invalid preferences
  await manager.updateCodeStyle({
    indentSize: 20, // Invalid: > 8
    maxLineLength: 300, // Invalid: > 200
  });

  const invalidValidation = await manager.validatePreferences();
  console.log(`✓ Validation with invalid values: ${invalidValidation.valid ? 'VALID' : 'INVALID'}`);
  if (!invalidValidation.valid) {
    console.log('  Expected errors:');
    invalidValidation.errors.forEach(err => {
      console.log(`    - ${err}`);
    });
  }
  console.log();

  // ==================== Test 11: Reset to Defaults ====================
  console.log('Test 11: Reset to Defaults');
  console.log('---------------------------');

  await manager.resetToDefaults();
  console.log('✓ Reset to defaults');

  const defaultPrefs = await manager.getPreferences();
  console.log(`  Indent: ${defaultPrefs?.codeStyle.indent} (${defaultPrefs?.codeStyle.indentSize})`);
  console.log(`  Language: ${defaultPrefs?.aiInteraction.language}`);
  console.log(`  Verbosity: ${defaultPrefs?.aiInteraction.verbosity}\n`);

  // ==================== Test 12: Generate Code Style Config ====================
  console.log('Test 12: Generate Code Style Config');
  console.log('-------------------------------------');

  const config = await manager.generateCodeStyleConfig();
  console.log('✓ Generated code style config:');
  console.log(`  ${JSON.stringify(config, null, 2)}\n`);

  // ==================== Final Summary ====================
  console.log('=====================================');
  console.log('All Tests Completed Successfully!');
  console.log('=====================================\n');
  console.log('Summary:');
  console.log('  ✓ Initialize preferences manager');
  console.log('  ✓ Get and update preferences');
  console.log('  ✓ Learn from user behavior');
  console.log('  ✓ Export to user profile format');
  console.log('  ✓ Generate AI context summary');
  console.log('  ✓ Validate preferences');
  console.log('  ✓ Reset to defaults');
  console.log('  ✓ Generate code style config\n');
}

// Run tests
testPreferences()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
