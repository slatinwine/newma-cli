/**
 * SIMPLE VERIFICATION: Check if detailed verification prompt is loaded
 */

import { loadSystemPrompt, PromptType } from './src/prompt';

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║   VERIFICATION PROMPT LOADING TEST                    ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

try {
  console.log('📋 Step 1: Load verification prompt from file...\n');

  const verificationPrompt = loadSystemPrompt(PromptType.VERIFICATION);

  console.log('✅ Prompt loaded successfully!\n');
  console.log('📊 Statistics:');
  console.log(`   Length: ${verificationPrompt.length} characters`);
  console.log(`   Lines: ${verificationPrompt.split('\n').length} lines`);
  console.log(`   Words: ${verificationPrompt.split(/\s+/).length} words\n`);

  // Check for key content
  console.log('🔍 Checking for key content...\n');

  const hasDoneCriteria = verificationPrompt.includes('done: true') && verificationPrompt.includes('done: false');
  const hasChecklist = verificationPrompt.includes('Verification Checklist');
  const hasExamples = verificationPrompt.includes('Example 1:');
  const hasSuccessCriteria = verificationPrompt.includes('Set `done: true` when:');
  const hasFailureCriteria = verificationPrompt.includes('Set `done: false` when:');

  console.log('Key Content Check:');
  console.log(`   ✓ done: true/false criteria: ${hasDoneCriteria ? '✅' : '❌'}`);
  console.log(`   ✓ Verification Checklist: ${hasChecklist ? '✅' : '❌'}`);
  console.log(`   ✓ Examples: ${hasExamples ? '✅' : '❌'}`);
  console.log(`   ✓ Success criteria: ${hasSuccessCriteria ? '✅' : '❌'}`);
  console.log(`   ✓ Failure criteria: ${hasFailureCriteria ? '✅' : '❌'}\n`);

  if (hasDoneCriteria && hasChecklist && hasExamples && hasSuccessCriteria && hasFailureCriteria) {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   ✅ ALL CHECKS PASSED!                               ║');
    console.log('║                                                     ║');
    console.log('║   The detailed verification prompt is correctly      ║');
    console.log('║   loaded and contains all necessary information     ║');
    console.log('║   for AI to determine when to set done: true.        ║');
    console.log('║                                                     ║');
    console.log('║   This confirms the prompt fix is working!           ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    console.log('📝 Sample from prompt (first 500 chars):\n');
    console.log('─'.repeat(60));
    console.log(verificationPrompt.substring(0, 500) + '...');
    console.log('─'.repeat(60));
    console.log();

    process.exit(0);
  } else {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   ❌ SOME CHECKS FAILED                                ║');
    console.log('║                                                     ║');
    console.log('║   The verification prompt may be incomplete.          ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    process.exit(1);
  }

} catch (error: any) {
  console.error('❌ Error loading verification prompt:', error.message);
  console.error('\nThis means:');
  console.error('  1. prompts/mode-verification.md file is missing');
  console.error('  2. OR loadSystemPrompt function has an issue');
  console.error('  3. OR PromptType.VERIFICATION is not defined\n');
  process.exit(1);
}
