// 测试新的prompt是否能生成actions
const { callAI } = require('./dist/ai.js');
const { scanDirectory } = require('./dist/scanner.js');
const { getDefaultConfig } = require('./dist/config.js');

async function test() {
  console.log('🧪 Testing new prompt...\n');

  try {
    // Load config
    const config = getDefaultConfig();

    // Scan project
    const projectInfo = await scanDirectory(process.cwd());

    // Test requirement
    const requirement = '总结一下当前项目';

    console.log('📋 Requirement:', requirement);
    console.log('🤖 Calling AI...\n');

    const response = await callAI(
      config,
      projectInfo,
      requirement,
      'plan',
      undefined, // no history
      undefined, // no tools
      undefined, // no permissions
      undefined, // no compression
      process.cwd(), // project root
      undefined, // no abort signal
      undefined, // no ultrathink
      undefined  // no user profile
    );

    console.log('\n✅ AI Response:\n');
    console.log('Type:', response.type || 'task');
    console.log('Todo:', response.todo);
    console.log('Actions:', response.actions);
    console.log('\n');

    // Check if actions are generated
    if (response.actions && response.actions.length > 0) {
      console.log('✅ SUCCESS: AI generated actions!');
      console.log('\nActions to execute:');
      response.actions.forEach((action, i) => {
        console.log(`  ${i + 1}. ${action.type}: ${action.command || action.path || 'N/A'}`);
      });
    } else {
      console.log('❌ FAIL: No actions generated');
      console.log('Response content:', response.content);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

test();
