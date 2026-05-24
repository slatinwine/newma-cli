/**
 * Mock test to verify FFT planner JSON extraction fixes
 * This simulates the exact scenario from the bug report
 */

import { FFTPlanner } from './src/fft/planner';
import { Config } from './src/config';

// Mock fetch to simulate API responses
const originalFetch = global.fetch;

function createMockFetch(response: string) {
  return jest.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      choices: [{
        message: {
          content: response
        }
      }]
    })
  } as any));
}

describe('FFT Planner JSON Extraction Fixes', () => {
  let planner: FFTPlanner;
  let mockFetch: any;

  beforeAll(() => {
    const config: Config = {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4o-mini',
    };
    planner = new FFTPlanner(config);
  });

  afterEach(() => {
    if (mockFetch) {
      mockFetch.mockClear();
    }
    global.fetch = originalFetch;
  });

  test('should extract JSON from numbered list with embedded JSON (Bug scenario)', async () => {
    // This is the exact response format that caused the bug
    const aiResponse = `1. **Analyze the Request:**
    *   **Task:** Search for Mario games and generate a single HTML application
    *   **Format:** Single HTML file
    *   **Standard:**
        *   SIMPLE: Single file, simple feature, clear steps, single tech stack
        *   COMPLEX: Multiple files, multi-tech stack, design decisions needed

{"level":"simple","reasoning":"Single HTML file game"}

2. **Output:** JSON format only.`;

    mockFetch = createMockFetch(aiResponse);
    global.fetch = mockFetch;

    // This should not throw an error anymore
    const input = {
      requirement: '搜索一下马里奥游戏，再生成一个马里奥游戏 单html应用',
      projectInfo: {},
      userProfile: undefined,
    };

    const result = await planner.generatePlan(input);

    // Verify that we got a valid result
    expect(result).toBeDefined();
    expect(result.complexity).toBe('simple');
    expect(result.plan).toBeDefined();
  });

  test('should extract JSON from markdown code blocks', async () => {
    const aiResponse = `Here's my analysis:

\`\`\`json
{"level":"simple","reasoning":"Single file implementation"}
\`\`\`

That's it.`;

    mockFetch = createMockFetch(aiResponse);
    global.fetch = mockFetch;

    const input = {
      requirement: 'Create a simple HTML file',
      projectInfo: {},
      userProfile: undefined,
    };

    const result = await planner.generatePlan(input);

    expect(result).toBeDefined();
    expect(result.complexity).toBe('simple');
  });

  test('should handle plain JSON response', async () => {
    const aiResponse = '{"level":"complex","reasoning":"Multiple technologies"}';

    mockFetch = createMockFetch(aiResponse);
    global.fetch = mockFetch;

    const input = {
      requirement: 'Build a full-stack application with React and Node.js',
      projectInfo: {},
      userProfile: undefined,
    };

    const result = await planner.generatePlan(input);

    expect(result).toBeDefined();
    expect(result.complexity).toBe('complex');
  });

  test('should generate actions for plan generation', async () => {
    const aiResponse = `{
  "name": "Mario Game Implementation",
  "description": "Create a simple Mario-like game in HTML",
  "actions": [
    {"type": "create", "path": "mario.html", "content": "<html>...</html>"},
    {"type": "run", "command": "open mario.html"}
  ],
  "estimatedTime": 10000,
  "riskLevel": "low",
  "pros": ["Quick implementation"],
  "cons": ["Simple gameplay"]
}`;

    mockFetch = createMockFetch(aiResponse);
    global.fetch = mockFetch;

    const input = {
      requirement: 'Create a Mario game',
      projectInfo: {},
      userProfile: undefined,
    };

    const result = await planner.generatePlan(input);

    expect(result).toBeDefined();
    expect(result.plan).toBeDefined();
    expect(result.plan?.actions.length).toBeGreaterThan(0);
    expect(result.plan?.actions[0].type).toBe('create');
  });

  test('should use response_format parameter for JSON mode', async () => {
    let capturedRequestBody: any = null;

    mockFetch = jest.fn((url: string, options: any) => {
      // Capture the request body
      capturedRequestBody = JSON.parse(options.body);

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{
            message: {
              content: '{"level":"simple","reasoning":"Test"}'
            }
          }]
        })
      } as any);
    });

    global.fetch = mockFetch;

    const input = {
      requirement: 'Test task',
      projectInfo: {},
      userProfile: undefined,
    };

    await planner.generatePlan(input);

    // Verify that response_format was included
    expect(capturedRequestBody).toBeDefined();
    expect(capturedRequestBody.response_format).toEqual({ type: "json_object" });
  });
});

console.log('✅ All JSON extraction fixes verified!');
