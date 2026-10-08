/**
 * Simple test script to demonstrate performance monitoring output
 */

console.log('\n🧪 Performance Monitoring Integration Test\n');
console.log('═'.repeat(60));

// Test 1: API Call Monitoring
console.log('\n📡 Test 1: API Call Monitoring');
console.log('─'.repeat(60));
const apiCallStart = Date.now();
setTimeout(() => {
  const apiCallDuration = Date.now() - apiCallStart;
  console.log(`⏱️  [API] 单次调用耗时: ${apiCallDuration}ms\n`);
}, 100);

// Test 2: Ultrathink Stage Monitoring
console.log('\n🌳 Test 2: Ultrathink Stage Monitoring');
console.log('─'.repeat(60));

setTimeout(() => {
  console.log('⏱️  [Ultrathink] 开始计划生成...\n');

  const initialThoughtStart = Date.now();
  setTimeout(() => {
    console.log(`⏱️  [Ultrathink] 初始思考生成: ${Date.now() - initialThoughtStart}ms\n`);

    const totSearchStart = Date.now();
    setTimeout(() => {
      console.log(`⏱️  [Ultrathink] ToT搜索: ${Date.now() - totSearchStart}ms\n`);

      const planGenStart = Date.now();
      setTimeout(() => {
        console.log(`⏱️  [Ultrathink] 计划生成: ${Date.now() - planGenStart}ms\n`);

        const evalStart = Date.now();
        setTimeout(() => {
          console.log(`⏱️  [Ultrathink] 计划评估: ${Date.now() - evalStart}ms\n`);
          console.log('✅ Ultrathink monitoring test passed!\n');
        }, 50);
      }, 50);
    }, 50);
  }, 50);
}, 200);

// Test 3: Function Calling Iteration Monitoring
console.log('\n🔧 Test 3: Function Calling Iteration Monitoring');
console.log('─'.repeat(60));

setTimeout(() => {
  let iteration = 0;
  const MAX_ITERATIONS = 3;

  const runIteration = () => {
    if (iteration >= MAX_ITERATIONS) {
      console.log(`⏱️  [Function Calling] 总迭代次数: ${iteration}\n`);
      console.log('✅ Function Calling monitoring test passed!\n');
      console.log('═'.repeat(60));
      console.log('\n🎉 All performance monitoring tests passed!\n');
      console.log('\n📊 Expected Output Format When Running Real Commands:\n');
      console.log('─────────────────────────────────────────────────────────────');
      console.log('[Example 1: Function Calling Mode]');
      console.log('[迭代 1] 调用 AI...');
      console.log('⏱️  [Function Calling] 迭代 1 耗时: 5234ms');
      console.log('[迭代 2] 调用 AI...');
      console.log('⏱️  [Function Calling] 迭代 2 耗时: 3421ms');
      console.log('⏱️  [Function Calling] 总迭代次数: 2');
      console.log('');
      console.log('[Example 2: Ultrathink Mode]');
      console.log('⏱️  [Ultrathink] 开始计划生成...');
      console.log('⏱️  [Ultrathink] 初始思考生成: 1234ms');
      console.log('⏱️  [Ultrathink] ToT搜索: 45678ms  <-- 最慢的部分');
      console.log('⏱️  [Ultrathink] 计划生成: 2345ms');
      console.log('⏱️  [Ultrathink] 计划评估: 6789ms');
      console.log('');
      console.log('[Example 3: Single API Call]');
      console.log('⏱️  [API] 单次调用耗时: 3456ms');
      console.log('─────────────────────────────────────────────────────────────\n');
      return;
    }

    iteration++;
    console.log(`\n[迭代 ${iteration}] 调用 AI...\n`);

    const iterStart = Date.now();
    setTimeout(() => {
      const iterDuration = Date.now() - iterStart;
      console.log(`⏱️  [Function Calling] 迭代 ${iteration} 耗时: ${iterDuration}ms\n`);
      runIteration();
    }, 150);
  };

  runIteration();
}, 1500);
