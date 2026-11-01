/**
 * BaseSubAgent 白名单强制与容错行为测试
 *
 * 覆盖审查必修项:
 * - Phase 1 (Planning) 工具白名单是硬性边界:不允许的工具不经过执行器
 * - 畸形 JSON 参数 in-band 报错而非炸掉整个执行
 * - Phase 2 (Execution, '*') 放行全部已注册工具
 * - 迭代耗尽如实返回失败 (MAX_ITERATIONS_REACHED)
 */

jest.mock('../../ai', () => ({
  callAIWithFunctionCalling: jest.fn(),
}));

import { callAIWithFunctionCalling } from '../../ai';
import { PlanningSubAgent } from './planning-subagent';
import { ExecutionSubAgent } from './execution-subagent';
import { ToolRegistry } from '../../tools/registry';
import { fileTool } from '../../tools/builtin/file';
import { commandTool } from '../../tools/builtin/command';
import { SubAgentContext } from './types';

const mockCallAI = callAIWithFunctionCalling as jest.Mock;

function makeContext(): { context: SubAgentContext; executorMock: jest.Mock } {
  const registry = new ToolRegistry();
  registry.register(fileTool);
  registry.register(commandTool);

  const executorMock = jest.fn(async () => ({ success: true, output: 'ok' }));

  const context: SubAgentContext = {
    projectRoot: process.cwd(),
    projectInfo: {},
    config: { executionMode: 'standard' } as any,
    toolRegistry: registry,
    toolExecutor: { executeToolCall: executorMock } as any,
    signal: undefined,
  };

  return { context, executorMock };
}

function toolCallsResponse(calls: Array<{ name: string; args: string }>) {
  return {
    type: 'tool_calls',
    toolCalls: calls.map((c, i) => ({
      id: `call_${i}`,
      type: 'function',
      function: { name: c.name, arguments: c.args },
    })),
    done: false,
  };
}

function textResponse(content: string) {
  return { type: 'text', content, done: true };
}

/** 取第 n 次 AI 调用收到的 history 里 role='tool' 的消息内容 */
function toolMessagesOfCall(n: number): string[] {
  const history = mockCallAI.mock.calls[n][3] as any[];
  return history.filter((m) => m.role === 'tool').map((m) => m.content);
}

beforeEach(() => {
  mockCallAI.mockReset();
});

describe('PlanningSubAgent whitelist enforcement', () => {
  it('rejects a disallowed tool (command) without touching the executor', async () => {
    const { context, executorMock } = makeContext();
    mockCallAI
      .mockResolvedValueOnce(toolCallsResponse([{ name: 'command', args: '{"command":"rm -rf /"}' }]))
      .mockResolvedValueOnce(textResponse('Plan ready'));

    const agent = new PlanningSubAgent(context);
    const result = await agent.execute('do something');

    expect(executorMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true); // 循环以文本响应正常结束
    const toolMsgs = toolMessagesOfCall(1).join('\n');
    expect(toolMsgs).toContain('Tool not allowed');
    expect(toolMsgs).toContain('command');
  });

  it('returns an in-band error for malformed JSON arguments instead of throwing', async () => {
    const { context, executorMock } = makeContext();
    mockCallAI
      .mockResolvedValueOnce(toolCallsResponse([{ name: 'read_file', args: '{oops not json' }]))
      .mockResolvedValueOnce(textResponse('Plan ready'));

    const agent = new PlanningSubAgent(context);

    await expect(agent.execute('do something')).resolves.toBeTruthy();
    expect(executorMock).not.toHaveBeenCalled();
    expect(toolMessagesOfCall(1).join('\n')).toContain('Invalid JSON in tool arguments');
  });

  it('executes an allowed read-only tool', async () => {
    const { context, executorMock } = makeContext();
    mockCallAI
      .mockResolvedValueOnce(
        toolCallsResponse([{ name: 'read_file', args: '{"path":"src/index.ts"}' }])
      )
      .mockResolvedValueOnce(textResponse('Plan ready'));

    const agent = new PlanningSubAgent(context);
    await agent.execute('do something');

    expect(executorMock).toHaveBeenCalledTimes(1);
    expect(executorMock.mock.calls[0][0]).toMatchObject({ tool: 'read_file' });
  });
});

describe('ExecutionSubAgent wildcard whitelist', () => {
  it('allows write/execute tools registered in the real registry', async () => {
    const { context, executorMock } = makeContext();
    mockCallAI
      .mockResolvedValueOnce(
        toolCallsResponse([
          { name: 'file', args: '{"operation":"create","path":"a.txt","content":"hi"}' },
          { name: 'command', args: '{"command":"echo hi"}' },
        ])
      )
      .mockResolvedValueOnce(textResponse('All actions completed'));

    const agent = new ExecutionSubAgent(context);
    const result = await agent.execute('do something');

    expect(executorMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });
});

describe('iteration budget', () => {
  it('reports failure (not fake success) when max iterations are exhausted', async () => {
    const { context, executorMock } = makeContext();
    mockCallAI.mockResolvedValue(
      toolCallsResponse([{ name: 'read_file', args: '{"path":"a.ts"}' }])
    );

    const agent = new PlanningSubAgent(context); // maxIterations: 10
    const result = await agent.execute('never-ending task');

    expect(result.success).toBe(false);
    expect(result.error).toBe('MAX_ITERATIONS_REACHED');
    expect(result.toolCallsExecuted).toBe(10);
  });
});
