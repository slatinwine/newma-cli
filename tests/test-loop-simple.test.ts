/**
 * Loop System Simple Tests
 * 快速功能验证测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CliFrontend } from '../src/loop/frontends/cli-frontend';
import { EventSourceManager } from '../src/loop/event/event-source-manager';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('Loop System - Simple Tests', () => {
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

  describe('EventSourceManager', () => {
    let manager: EventSourceManager;
    let testDir: string;

    beforeEach(() => {
      manager = new EventSourceManager({
        maxSources: 10,
        debug: false,
      });
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kode-test-'));
    });

    afterEach(() => {
      manager.dispose();
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should create manager', () => {
      expect(manager).toBeDefined();
      expect(manager.getAllSources()).toHaveLength(0);
    });

    it('should add file watcher source', () => {
      const id = manager.addFileWatcher({
        watchPath: testDir,
        recursive: false,
        debounceMs: 100,
      });

      expect(id).toBeDefined();
      expect(id.startsWith('fw-')).toBe(true);
      expect(manager.getAllSources()).toHaveLength(1);
    });

    it('should report correct stats', () => {
      manager.addFileWatcher({ watchPath: testDir, recursive: false });

      // 惰性启动设计：新增 source 处于 Start 态（下次 poll 时启动）
      const stats = manager.getStats();
      expect(stats.total).toBe(1);
      expect(stats.running).toBe(0);
      expect(stats.stopped).toBe(1);
      expect(stats.byType['file-watcher']).toBe(1);
    });

    it('should stop and start sources', () => {
      const id = manager.addFileWatcher({
        watchPath: testDir,
        recursive: false,
      });

      // 惰性启动：显式 start 后进入 Running
      expect(manager.startSource(id)).toBe(true);

      let stats = manager.getStats();
      expect(stats.running).toBe(1);

      // Stop
      const stopped = manager.stopSource(id);
      expect(stopped).toBe(true);

      stats = manager.getStats();
      expect(stats.running).toBe(0);
      expect(stats.stopped).toBe(1);

      // Start
      const started = manager.startSource(id);
      expect(started).toBe(true);

      stats = manager.getStats();
      expect(stats.running).toBe(1);
    });

    it('should remove sources', () => {
      const id = manager.addFileWatcher({
        watchPath: testDir,
        recursive: false,
      });

      expect(manager.getAllSources()).toHaveLength(1);

      const removed = manager.removeSource(id);
      expect(removed).toBe(true);
      expect(manager.getAllSources()).toHaveLength(0);
    });

    it('should clear all sources', () => {
      manager.addFileWatcher({ watchPath: testDir, recursive: false });
      manager.addFileWatcher({ watchPath: testDir, recursive: false });

      expect(manager.getAllSources()).toHaveLength(2);

      manager.clearAll();

      expect(manager.getAllSources()).toHaveLength(0);
      const stats = manager.getStats();
      expect(stats.total).toBe(0);
    });

    it('should respect max sources limit', () => {
      const limitedManager = new EventSourceManager({ maxSources: 2 });

      limitedManager.addFileWatcher({ watchPath: testDir, recursive: false });
      limitedManager.addFileWatcher({ watchPath: testDir, recursive: false });

      expect(() => {
        limitedManager.addFileWatcher({ watchPath: testDir, recursive: false });
      }).toThrow();

      limitedManager.dispose();
    });

    it('should return null for poll when no sources', async () => {
      const event = await manager.pollNext(10);
      expect(event).toBeNull();
    });

    it('should poll from sources', async () => {
      manager.addFileWatcher({
        watchPath: testDir,
        recursive: false,
      });

      // Poll should complete without error
      const event = await manager.pollNext(10);
      // pollNext 不抛错即通过：无变更时返回 null，有变更返回事件对象
      expect(event === null || typeof event === 'object').toBe(true);
    });

    it('should get source by ID', () => {
      const id = manager.addFileWatcher({
        watchPath: testDir,
        recursive: false,
      });

      const source = manager.getSource(id);
      expect(source).toBeDefined();
      expect(source?.id).toBe(id);
    });

    it('should return undefined for non-existent source', () => {
      const source = manager.getSource('nonexistent');
      expect(source).toBeUndefined();
    });

    it('should handle invalid source IDs', () => {
      const stopped = manager.stopSource('invalid');
      expect(stopped).toBe(false);

      const started = manager.startSource('invalid');
      expect(started).toBe(false);

      const removed = manager.removeSource('invalid');
      expect(removed).toBe(false);
    });
  });
});
