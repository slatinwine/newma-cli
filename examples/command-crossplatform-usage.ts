// examples/command-crossplatform-usage.ts
/**
 * Example: Using the cross-platform command tool
 */

import { isSafeCommand, getCommandRisk } from '../src/tools/builtin/command';

async function example() {
  console.log('🌍 Cross-Platform Command Tool Examples\n');

  // Example 1: Check command safety
  console.log('📋 Example 1: Command Safety Checks\n');

  const commands = [
    'npm install',
    'git status',
    'rm -rf /tmp/test',
    'node --version',
  ];

  for (const cmd of commands) {
    const safe = isSafeCommand(cmd);
    const risk = getCommandRisk(cmd);
    console.log(`  Command: ${cmd}`);
    console.log(`    Safe: ${safe ? '✅ Yes' : '❌ No'}`);
    console.log(`    Risk: ${risk}\n`);
  }

  // Example 2: Platform-specific commands
  console.log('🖥️  Example 2: Platform-Specific Commands\n');

  const platform = process.platform;
  console.log(`Current Platform: ${platform}\n`);

  if (platform === 'win32') {
    console.log('Windows Examples:');
    console.log('  CMD: dir');
    console.log('  PowerShell: Get-ChildItem\n');

    // PowerShell example
    console.log('Running PowerShell command...');
    // await toolExecutor.executeToolCall({
    //   tool: 'command',
    //   parameters: {
    //     command: 'Get-Process',
    //     shell: 'powershell',
    //   },
    //   id: '1',
    // });
  } else {
    console.log('Unix Examples:');
    console.log('  Shell: ls -la');
    console.log('  Shell: ps aux\n');

    // Shell example
    console.log('Running shell command...');
    // await toolExecutor.executeToolCall({
    //   tool: 'command',
    //   parameters: {
    //     command: 'ls -la',
    //   },
    //   id: '1',
    // });
  }

  // Example 3: Working directory
  console.log('📁 Example 3: Working Directory\n');
  console.log('Run command in specific directory:');

  const cwdExample = {
    tool: 'command',
    parameters: {
      command: 'npm test',
      cwd: './test-directory',
    },
    id: '3',
  };
  console.log(JSON.stringify(cwdExample, null, 2));
  console.log();

  // Example 4: Shell selection (Windows only)
  if (platform === 'win32') {
    console.log('🪟 Example 4: Windows Shell Selection\n');

    const shells = ['auto', 'cmd', 'powershell'];
    for (const shell of shells) {
      console.log(`Shell: ${shell}`);
      console.log(`  Command: echo "Hello from ${shell}"`);
    }
    console.log();
  }

  // Example 5: Error handling
  console.log('⚠️  Example 5: Dangerous Command Detection\n');

  const dangerousCommands = platform === 'win32'
    ? [
        'Remove-Item -Recurse -Force C:\\temp',
        'format C:',
        'rmdir /s /q C:\\test',
      ]
    : [
        'rm -rf /tmp/test',
        'chmod 777 /etc/passwd',
        'dd if=/dev/zero of=/dev/sda',
      ];

  for (const cmd of dangerousCommands) {
    const risk = getCommandRisk(cmd);
    console.log(`  Command: ${cmd}`);
    console.log(`    Risk: ${risk} ⚠️\n`);
  }

  console.log('═══════════════════════════════════════════════════\n');
}

// Run examples
example().catch(console.error);
