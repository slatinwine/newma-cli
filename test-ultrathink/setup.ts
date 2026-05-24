/**
 * Jest setup file for ultrathink tests
 */

// Mock chalk module - handle both default and named exports
jest.mock('chalk', () => {
  const createMockFunction = () => (str: string) => str;

  const mockChalk = {
    cyan: createMockFunction(),
    green: createMockFunction(),
    yellow: createMockFunction(),
    red: createMockFunction(),
    gray: createMockFunction(),
    white: createMockFunction(),
    magenta: createMockFunction(),
    blue: createMockFunction(),
    bold: createMockFunction(),
  };

  // Create chained properties like bold.cyan, bold.green, etc.
  const boldMock = {
    cyan: createMockFunction(),
    green: createMockFunction(),
    white: createMockFunction(),
    red: createMockFunction(),
    yellow: createMockFunction(),
    gray: createMockFunction(),
    blue: createMockFunction(),
  };

  // Make bold callable and also have properties
  const boldFunction = createMockFunction() as any;
  Object.assign(boldFunction, boldMock);
  mockChalk.bold = boldFunction;

  return {
    __esModule: true,
    default: mockChalk,
    ...mockChalk,
  };
});

// Mock inquirer
jest.mock('inquirer', () => ({
  __esModule: true,
  prompt: jest.fn(() => Promise.resolve({ confirmed: true })),
}));

// Global mock callAI function with default behavior
const mockCallAI = jest.fn().mockImplementation(async () => {
  return {
    content: 'Default AI response',
    todo: [],
    actions: [],
    done: false,
    duration: 100,
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}) as any;

// Mock callAI with proper typing
jest.mock('../src/ai', () => ({
  callAI: () => mockCallAI(),
  ExtendedAIResponse: {},
}));

// Export for test files to use
export { mockCallAI };

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Reset to default implementation after clearing
  mockCallAI.mockImplementation(async () => {
    return {
      content: 'Default AI response',
      todo: [],
      actions: [],
      done: false,
      duration: 100,
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };
  });
});
