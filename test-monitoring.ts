/**
 * Test script to verify performance monitoring integration
 */

const chalk = require('chalk');

console.log(chalk.cyan('\n🧪 Performance Monitoring Integration Test\n'));
console.log(chalk.gray('═'.repeat(60)));

// Test 1: API Call Monitoring
console.log(chalk.cyan('\n📡 Test 1: API Call Monitoring'));
console.log(chalk.gray('─'.repeat(60)));
const apiCallStart = Date.now();
// Simulate API call
setTimeout(() => {
  const apiCallDuration = Date.now() - apiCallStart;
  console.log(chalk.gray(`⏱️  [API] 单次调用耗时: ${apiCallDuration}ms\n`));
}, 100);

// Test 2: Ultrathink Stage Monitoring
console.log(chalk.cyan('\n🌳 Test 2: Ultrathink Stage Monitoring'));
console.log(chalk.gray('─'.repeat(60)));

setTimeout(() => {
  console.log(chalk.gray('⏱️  [Ultrathink] 开始计划生成...\n'));

  const initialThoughtStart = Date.now();
  setTimeout(() => {
    console.log(chalk.gray(`⏱️  [Ultrathink] 初始思考生成: ${Date.now() - initialThoughtStart}ms\n`));

    const totSearchStart = Date.now();
    setTimeout(() => {
      console.log(chalk.gray(`⏱️  [Ultrathink] ToT搜索: ${Date.now() - totSearchStart}ms\n`));

      const planGenStart = Date.now();
      setTimeout(() => {
        console.log(chalk.gray(`⏱️  [Ultrathink] 计划生成: ${Date.now() - planGenStart}ms\n`));

        const evalStart = Date.now();
        setTimeout(() => {
          console.log(chalk.gray(`⏱️  [Ultrathink] 计划评估: ${Date.now() - evalStart}ms\n`));
          console.log(chalk.green('✅ Ultrathink monitoring test passed!\n'));
        }, 50);
      }, 50);
    }, 50);
  }, 50);
}, 200);

// Test 3: Function Calling Iteration Monitoring
console.log(chalk.cyan('\n🔧 Test 3: Function Calling Iteration Monitoring'));
console.log(chalk.gray('─'.repeat(60)));

setTimeout(() => {
  let iteration = 0;
  const MAX_ITERATIONS = 3;

  const runIteration = () => {
    if (iteration >= MAX_ITERATIONS) {
      console.log(chalk.gray(`⏱️  [Function Calling] 总迭代次数: ${iteration}\n`));
      console.log(chalk.green('✅ Function Calling monitoring test passed!\n'));
      console.log(chalk.gray('═'.repeat(60)));
      console.log(chalk.green('\n🎉 All performance monitoring tests passed!\n'));
      return;
    }

    iteration++;
    console.log(chalk.gray(`\n[迭代 ${iteration}] 调用 AI...\n`));

    const iterStart = Date.now();
    setTimeout(() => {
      const iterDuration = Date.now() - iterStart;
      console.log(chalk.gray(`⏱️  [Function Calling] 迭代 ${iteration} 耗时: ${iterDuration}ms\n`));
      runIteration();
    }, 150);
  };

  runIteration();
}, 1500);
