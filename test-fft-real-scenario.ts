/**
 * Real scenario test for FFT planner JSON fixes
 * This test simulates the exact AI responses that were causing failures
 */

import { FFTPlanner } from './src/fft/planner';
import { Config } from './src/config';

// Save original fetch
const originalFetch = global.fetch;

// Test scenarios with exact AI responses that failed before
const testScenarios = [
  {
    name: 'Mario Game (Original Bug)',
    requirement: '搜索一下马里奥游戏，再生成一个马里奥游戏 单html应用',
    complexityResponse: `1.  **分析请求：**
    *   **任务：** 搜索马里奥游戏，然后生成一个马里奥游戏的单 HTML 应用。
    *   **标准：**
        *   SIMPLE（简单）：单个文件、小功能、明确步骤、单一技术栈。
        *   COMPLEX（复杂）：多个文件、多技术栈、需要设计决策、架构考虑。
    *   **输出：** 仅 JSON 格式。

{"level":"simple","reasoning":"单个HTML文件游戏"}

2.  **结论：** 简单任务`,

    planResponse: `1.  **Analyze the Request:**
    *   **Core Task:** The user wants me to "search for Mario games" (conceptually) and then "generate a Mario game" as a single HTML application.
    *   **Format:** The output should be a single, self-contained HTML file.
    *   **Tech Stack:** HTML5, CSS3, vanilla JavaScript.
    *   **Constraints:** Single file, no external dependencies, simple gameplay.

{
  "name": "Super Mario Bros Clone",
  "description": "Create a simple Mario-like platformer game in a single HTML file with basic jumping mechanics and coin collection.",
  "actions": [
    {
      "type": "create",
      "path": "mario-game.html",
      "content": "<!DOCTYPE html>\\n<html>\\n<head>\\n  <title>Super Mario Bros Clone</title>\\n  <style>\\n    body { margin: 0; overflow: hidden; background: #5c94fc; }\\n    canvas { display: block; margin: 0 auto; }\\n  </style>\\n</head>\\n<body>\\n  <canvas id='gameCanvas' width='800' height='600'></canvas>\\n  <script>\\n    const canvas = document.getElementById('gameCanvas');\\n    const ctx = canvas.getContext('2d');\\n    // Game logic here...\\n  </script>\\n</body>\\n</html>"
    },
    {
      "type": "run",
      "command": "open mario-game.html"
    }
  ],
  "estimatedTime": 15000,
  "riskLevel": "low",
  "pros": ["Quick implementation", "No dependencies", "Fun demo"],
  "cons": ["Simple mechanics", "Limited gameplay"],
  "confidence": 0.85
}

3.  **Output:** Complete JSON object above.`
  },
  {
    name: 'Complex Task with Markdown',
    requirement: '重构整个后端架构，使用微服务',
    complexityResponse: `\`\`\`json
{"level":"complex","reasoning":"涉及微服务架构，多个服务"}
\`\`\``,

    planResponse: `\`\`\`json
{
  "options": [
    {
      "name": "保守方案",
      "description": "渐进式迁移",
      "strategy": "conservative",
      "actions": [
        {"type": "create", "path": "microservice-1.js", "content": "..."},
        {"type": "run", "command": "node microservice-1.js"}
      ],
      "estimatedTime": 10000,
      "riskLevel": "low",
      "pros": ["低风险"],
      "cons": ["慢"]
    },
    {
      "name": "激进方案",
      "description": "完全重构",
      "strategy": "aggressive",
      "actions": [],
      "estimatedTime": 30000,
      "riskLevel": "high",
      "pros": ["最佳实践"],
      "cons": ["耗时长"]
    },
    {
      "name": "平衡方案",
      "description": "混合策略",
      "strategy": "balanced",
      "actions": [],
      "estimatedTime": 20000,
      "riskLevel": "medium",
      "pros": ["平衡"],
      "cons": ["需迭代"]
    }
  ]
}
\`\`\``
  },
  {
    name: 'Plain JSON (Control)',
    requirement: 'Create a simple text file',
    complexityResponse: '{"level":"simple","reasoning":"Single file"}',
    planResponse: '{"name":"Simple Plan","description":"Create text file","actions":[{"type":"create","path":"test.txt","content":"Hello"}],"estimatedTime":5000,"riskLevel":"low","pros":["Fast"],"cons":["Basic"],"confidence":0.9}'
  }
];

async function runRealScenarioTest() {
  console.log('🧪 FFT Planner Real Scenario Test\n');
  console.log('═'.repeat(70));

  const config: Config = {
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com',
    model: 'gpt-4o-mini',
  };

  const planner = new FFTPlanner(config);
  let passedTests = 0;
  let failedTests = 0;

  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    console.log(`\n📋 Test ${i + 1}: ${scenario.name}`);
    console.log('─'.repeat(70));

    // Mock fetch to return exact AI responses
    let callCount = 0;
    global.fetch = jest.fn((url: string, options: any) => {
      callCount++;
      const requestBody = JSON.parse(options.body);

      // First call: complexity check
      // Second call: plan generation
      const response = callCount === 1 ? scenario.complexityResponse : scenario.planResponse;

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: response
            }
          }]
        })
      } as any);
    });

    try {
      const input = {
        requirement: scenario.requirement,
        projectInfo: {},
        userProfile: undefined,
      };

      const result = await planner.generatePlan(input);

      // Verify results
      console.log(`✅ Plan generated successfully`);
      console.log(`   Complexity: ${result.complexity.toUpperCase()}`);
      console.log(`   Reasoning: ${result.reasoning}`);
      console.log(`   Time: ${result.analysisTime}ms`);

      if (result.plan) {
        console.log(`   Plan: ${result.plan.name}`);
        console.log(`   Actions: ${result.plan.actions.length}`);

        if (result.plan.actions.length > 0) {
          console.log(`   ✅ Has actions - BUG FIXED!`);
          passedTests++;
        } else {
          console.log(`   ❌ No actions - Fallback triggered`);
          failedTests++;
        }
      } else if (result.options) {
        console.log(`   Options: ${result.options.length}`);

        const totalActions = result.options.reduce((sum, opt) => sum + opt.actions.length, 0);
        console.log(`   Total Actions: ${totalActions}`);

        if (totalActions > 0) {
          console.log(`   ✅ Has actions - BUG FIXED!`);
          passedTests++;
        } else {
          console.log(`   ❌ No actions - Fallback triggered`);
          failedTests++;
        }
      }

      // Verify response_format was used
      const calls = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls;
      if (calls.length > 0) {
        const lastCall = calls[calls.length - 1];
        const requestBody = JSON.parse(lastCall[1].body);
        if (requestBody.response_format) {
          console.log(`   ✅ response_format enabled`);
        }
      }

    } catch (error: any) {
      console.error(`   ❌ Test failed: ${error.message}`);
      failedTests++;
    }

    // Restore fetch
    global.fetch = originalFetch;
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passedTests}/${testScenarios.length}`);
  console.log(`   Failed: ${failedTests}/${testScenarios.length}`);
  console.log(`   Success Rate: ${((passedTests / testScenarios.length) * 100).toFixed(0)}%`);

  if (passedTests === testScenarios.length) {
    console.log('\n✅ All tests passed! FFT JSON parsing bug is FIXED! 🎉\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please review.\n');
  }

  return passedTests === testScenarios.length;
}

// Run the test
runRealScenarioTest().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
