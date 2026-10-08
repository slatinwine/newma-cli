const fs = require('fs');
const path = require('path');

/**
 * 测试多种可能导致 JSON 损坏的场景
 */
async function testJsonCorruption() {
  const testDir = '/tmp/test-json-corruption';
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  console.log('🧪 Testing JSON corruption scenarios...\n');

  // 场景 1: 手动构建 JSON 字符串时出错
  console.log('Scenario 1: Manual JSON string construction');
  const file1 = path.join(testDir, 'manual-construct.json');
  const obj = { id: 1, name: 'test' };
  let content = JSON.stringify(obj, null, 2);
  content += '\n}'; // 故意多加一个括号
  fs.writeFileSync(file1, content);
  console.log(`Written ${content.length} bytes`);
  try {
    JSON.parse(fs.readFileSync(file1, 'utf8'));
    console.log('✅ Valid');
  } catch (e) {
    console.log('❌ Invalid:', e.message);
  }

  // 场景 2: 多次 writeFile 调用
  console.log('\nScenario 2: Multiple writeFile calls');
  const file2 = path.join(testDir, 'multiple-writes.json');
  const obj2 = { id: 2, name: 'test2' };

  // 写入两次（模拟可能的竞态）
  fs.writeFileSync(file2, JSON.stringify(obj2, null, 2));
  fs.writeFileSync(file2, JSON.stringify({ ...obj2, status: 'updated' }, null, 2));

  const raw2 = fs.readFileSync(file2, 'utf8');
  console.log(`Written ${raw2.length} bytes`);
  console.log('Content:');
  console.log(raw2);
  try {
    JSON.parse(raw2);
    console.log('✅ Valid');
  } catch (e) {
    console.log('❌ Invalid:', e.message);
  }

  // 场景 3: 错误的字符串拼接
  console.log('\nScenario 3: Incorrect string concatenation');
  const file3 = path.join(testDir, 'concat-error.json');
  const obj3 = { id: 3, name: 'test3' };
  const json1 = JSON.stringify(obj3, null, 2);
  // 模拟错误的拼接
  const wrongConcat = json1 + '\n' + json2.slice(0, 10) + '}\n}';
  fs.writeFileSync(file3, wrongConcat);
  console.log(`Written ${wrongConcat.length} bytes`);
  try {
    JSON.parse(fs.readFileSync(file3, 'utf8'));
    console.log('✅ Valid');
  } catch (e) {
    console.log('❌ Invalid:', e.message);
  }

  // 场景 4: 使用错误的缩进参数
  console.log('\nScenario 4: Wrong indent parameter');
  const file4 = path.join(testDir, 'wrong-indent.json');
  const obj4 = { id: 4, nested: { value: 42 } };
  // 使用字符串而不是数字
  const wrongIndent = JSON.stringify(obj4, null, '  '); // 这是正确的
  const veryWrong = JSON.stringify(obj4, null, 2) + '    }'; // 错误的额外缩进和括号
  fs.writeFileSync(file4, veryWrong);
  console.log(`Written ${veryWrong.length} bytes`);
  try {
    JSON.parse(fs.readFileSync(file4, 'utf8'));
    console.log('✅ Valid');
  } catch (e) {
    console.log('❌ Invalid:', e.message);
  }

  // 场景 5: 检查实际文件
  console.log('\nScenario 5: Analyzing actual corrupted file');
  const actualFile = '.memo/tasks/session-2.json.bak';
  try {
    // 先备份
    const actual = fs.readFileSync('.memo/tasks/session-2.json', 'utf8');
    fs.writeFileSync(actualFile, actual);

    console.log('File content (hex dump of last 100 bytes):');
    const buffer = Buffer.from(actual.slice(-100));
    console.log(buffer.toString('hex'));
    console.log('\nLast 200 chars as text:');
    console.log(actual.slice(-200));

    // 分析模式
    const lastBrace = actual.lastIndexOf('}');
    const afterBrace = actual.slice(lastBrace + 1);
    console.log(`\nLast } at position ${lastBrace}`);
    console.log(`Characters after last }: ${JSON.stringify(afterBrace)}`);

    // 尝试找到重复的尾部
    const lines = actual.split('\n');
    console.log(`\nTotal lines: ${lines.length}`);
    console.log('Last 10 lines:');
    lines.slice(-10).forEach((line, i) => {
      const n = lines.length - 10 + i + 1;
      console.log(`${n}: ${JSON.stringify(line)}`);
    });
  } catch (e) {
    console.log('Could not analyze file:', e.message);
  }
}

testJsonCorruption().catch(console.error);
