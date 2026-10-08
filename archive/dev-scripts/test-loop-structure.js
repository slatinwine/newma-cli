#!/usr/bin/env node
/**
 * 快速测试 Loop 模式退出逻辑
 */

const fs = require('fs');

// 读取当前代码
const code = fs.readFileSync('./src/repl.ts', 'utf8');

// 检查关键结构
const lines = code.split('\n');

let inActionsBlock = false;
let actionsBlockEnd = -1;
let simpleCheckStart = -1;
let simpleCheckLine = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // 查找 actions 块开始
  if (trimmed.includes('if (aiResp.actions && aiResp.actions.length > 0)')) {
    inActionsBlock = true;
    console.log(`✅ 找到 actions 块开始: 第 ${i + 1} 行`);
  }

  // 查找 actions 块结束 (第一个不包含 actions 块内容的 })
  if (inActionsBlock && trimmed === '}' && !actionsBlockEnd) {
    // 检查接下来的行是否是 Simple Check
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j].includes('Simple satisfaction check') ||
          lines[j].includes('mode === verify && iteration >= 2')) {
        actionsBlockEnd = i + 1;
        simpleCheckStart = j + 1;
        simpleCheckLine = lines[j].trim();
        break;
      }
    }
    if (actionsBlockEnd) break;
  }
}

console.log(`\n📊 结构分析:`);
console.log(`actions 块结束: 第 ${actionsBlockEnd} 行`);
console.log(`Simple Check 开始: 第 ${simpleCheckStart} 行`);

if (actionsBlockEnd > 0 && simpleCheckStart > 0) {
  if (simpleCheckStart > actionsBlockEnd) {
    console.log(`\n✅ 修复成功! Simple Check 在 actions 块外部!`);
    console.log(`   差距: ${simpleCheckStart - actionsBlockEnd} 行`);
  } else {
    console.log(`\n❌ 问题: Simple Check 仍在 actions 块内部!`);
  }
} else {
  console.log(`\n⚠️  无法确定结构`);
}

// 显示关键代码片段
console.log(`\n📝 关键代码 (${actionsBlockEnd - 2} 到 ${simpleCheckStart + 2}):`);
for (let i = Math.max(0, actionsBlockEnd - 3); i < Math.min(lines.length, simpleCheckStart + 3); i++) {
  const prefix = i === actionsBlockEnd - 1 ? '→ ' : '  ';
  console.log(`${prefix}${i + 1}: ${lines[i].substring(0, 80)}`);
}
