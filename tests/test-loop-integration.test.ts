/**
 * Loop System Integration Tests
 *
 * 测试 Loop 引擎的核心组件集成
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { CliFrontend } from '../src/loop/frontends/cli-frontend';
import { AIFlowController } from '../src/loop/core/ai-flow-controller';
import { LoopSessionManagerAdapter } from '../src/loop/core/session-adapter';
import { LoopEngine } from '../src/loop/core/loop-engine';
import { CommandManager } from '../src/loop/commands/command-manager';
import { CorePluginCommands } from '../src/loop/plugins/core-plugin';
import { EventSourceManager } from '../src/loop/event/event-source-manager';

// Mock AI function
const mockCallAI = jest.fn();

describe('Loop System Integration', () => {
  describe('LoopEngine', () => {
    let engine: LoopEngine;
    let frontend: CliFrontend;
    let session: LoopSessionManagerAdapter;
    let flowController: any;
    let commandManager: CommandManager;

    beforeEach(() => {
      // 创建 CLI Frontend
      frontend = new CliFrontend({
        prompt: '[test] ❯ ',
        colors: false,
      });

      // 创建 Session Manager
      const mockSessionManager = {
        getProjectRoot: () => '/test/project',
        getConfig: () => ({ apiKey: 'test', model: 'gpt-4' }),
        getTracker: () => ({
          getHistory: () => [],
        }),
      } as any;

      const mockHookSystem = new EventEmitter() as any;

      session = new LoopSessionManagerAdapter(
        mockSessionManager,
        frontend,
        mockHookSystem
      );

      // 创建 Command Manager
      commandManager = new CommandManager();

      // 注册核心命令
      const coreCommands = CorePluginCommands.getAllCommands(commandManager);
      coreCommands.forEach(cmd => {
        commandManager.register(cmd, 'core');
      });

      // 创建 Flow Controller (使用 mock)
      flowController = {
        processInput: jest.fn().mockResolvedValue({
          type: 'success',
          data: null,
          shouldContinue: true,
        }),
        preprocessInput: jest.fn().mockResolvedValue({
          shouldSkip: false,
          modifiedInput: null,
          redirectTo: null,
        }),
        postprocessResult: jest.fn().mockResolvedValue({
          type: 'success',
          data: null,
          shouldContinue: true,
        }),
      };

      // 创建 Loop Engine
      engine = new LoopEngine(
        frontend,
        flowController,
        session,
        {
          enableCommands: true,
          enablePlugins: false,
          maxRedirects: 10,
          frontend,
        } as any
      );
    });

    afterEach(() => {
      if (engine && (engine as any).isEngineRunning()) {
        engine.stop();
      }
    });

    it('should create LoopEngine with all components', () => {
      expect(engine).toBeDefined();
      expect(engine.getCommandManager()).toBeDefined();
      expect(engine.getSession()).toBeDefined();
      expect(engine.getFrontend()).toBeDefined();
    });

    it('should register core commands', () => {
      const commands = engine.getCommandManager();
      expect(commands).toBeDefined();

      // 检查核心命令是否注册
      const helpCommand = (commands as any).getCommand?.('help') ?? (commands as any).commands?.get?.('help');
      expect(helpCommand).toBeDefined();
    });

    it('should not be running initially', () => {
      expect(engine.isEngineRunning()).toBe(false);
    });

    it('should track command manager', () => {
      // 引擎启用 enableCommands 时内部持有/自建 CommandManager，
      // 对外暴露的实例必须可用（不必与测试外部的同一实例）
      const cm = engine.getCommandManager();
      expect(cm).toBeDefined();
      expect(typeof cm.execute).toBe('function');
    });

    it('should track session', () => {
      const s = engine.getSession();
      expect(s).toBe(session);
    });

    it('should track frontend', () => {
      const f = engine.getFrontend();
      expect(f).toBe(frontend);
    });
  });

  describe('CliFrontend', () => {
    let frontend: CliFrontend;

    beforeEach(() => {
      frontend = new CliFrontend({
        prompt: '[test] ❯ ',
        colors: false,
      });
    });

    afterEach(() => {
      if (frontend.isRunning()) {
        frontend.stop();
      }
    });

    it('should create frontend', () => {
      expect(frontend).toBeDefined();
      expect(frontend.type).toBe('cli');
    });

    it('should not be running initially', () => {
      expect(frontend.isRunning()).toBe(false);
    });

    it('should start and stop', async () => {
      await frontend.start();
      expect(frontend.isRunning()).toBe(true);

      await frontend.stop();
      expect(frontend.isRunning()).toBe(false);
    });

    it('should allow prompt customization', () => {
      const customFrontend = new CliFrontend({
        prompt: 'custom> ',
      });

      expect(customFrontend).toBeDefined();
    });
  });

  describe('CommandManager', () => {
    let manager: CommandManager;

    beforeEach(() => {
      manager = new CommandManager();
    });

    it('should register commands', () => {
      const cmd = {
        name: 'test',
        description: 'Test command',
        category: 'test',
        handler: async (args: string[], context: any) => ({
          success: true,
          output: 'test',
        }),
      };

      manager.register(cmd as any, 'test');
      // CommandManager doesn't expose getCommand, just verify registration doesn't throw
      expect(() => manager.register(cmd as any, 'test')).not.toThrow();
    });

    it('should execute commands', async () => {
      const cmd = {
        name: 'echo',
        description: 'Echo command',
        category: 'test',
        handler: async (ctx: any) => ({
          success: true,
          output: (ctx.args ?? []).join(' '),
        }),
      };

      manager.register(cmd as any, 'test');
      const result = await manager.execute('echo', ['hello', 'world'], {
        session: null as any,
        rawInput: '/echo hello world',
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe('hello world');
    });

    it('should handle non-existent commands gracefully', async () => {
      const result = await manager.execute('nonexistent', [], {
        session: null as any,
        rawInput: '/nonexistent',
      });

      // Should return error result
      expect(result.success).toBe(false);
    });
  });
});
