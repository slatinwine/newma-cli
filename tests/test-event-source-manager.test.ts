/**
 * EventSourceManager Tests
 *
 * 测试事件源管理器的功能
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventSourceManager, EventSourceType } from '../src/loop/event/event-source-manager';
import { FileWatcherEventSource } from '../src/loop/event/file-watcher-source';
import { WebSocketEventSource } from '../src/loop/event/websocket-source';
import { HTTPEventSource } from '../src/loop/event/http-source';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('EventSourceManager', () => {
  let manager: EventSourceManager;
  let testDir: string;

  beforeEach(() => {
    manager = new EventSourceManager({
      maxSources: 10,
      debug: false,
    });

    // Create temp directory for tests
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kode-es-test-'));
  });

  afterEach(() => {
    manager.dispose();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    it('should create manager', () => {
      expect(manager).toBeDefined();
    });

    it('should have no sources initially', () => {
      const sources = manager.getAllSources();
      expect(sources).toHaveLength(0);
    });

    it('should report correct stats', () => {
      const stats = manager.getStats();
      expect(stats.total).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.stopped).toBe(0);
    });
  });

  describe('File Watcher Sources', () => {
    it('should add file watcher source', () => {
      const id = manager.addFileWatcher({
        watchPath: testDir,
        recursive: false,
        debounceMs: 100,
      });

      expect(id).toBeDefined();
      expect(id.startsWith('fw-')).toBe(true);
    });

    it('should track file watcher stats', () => {
      manager.addFileWatcher({
        watchPath: testDir,
        recursive: false,
      });

      const stats = manager.getStats();
      expect(stats.total).toBe(1);
      expect(stats.byType['file-watcher']).toBe(1);
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
  });

  describe('Source Lifecycle', () => {
    it('should start and stop sources', () => {
      const id = manager.addFileWatcher({
        watchPath: testDir,
        recursive: false,
      });

      // Stop（Start 态下 stopSource 返回 false——设计如此）
      const stopped = manager.stopSource(id);
      expect(stopped).toBe(false);
      expect(manager.startSource(id)).toBe(true);
      const stopRunning = manager.stopSource(id);
      expect(stopRunning).toBe(true);

      // Start
      const started = manager.startSource(id);
      expect(started).toBe(true);
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

    it('should return false for invalid source ID', () => {
      const stopped = manager.stopSource('invalid-id');
      expect(stopped).toBe(false);

      const started = manager.startSource('invalid-id');
      expect(started).toBe(false);

      const removed = manager.removeSource('invalid-id');
      expect(removed).toBe(false);
    });
  });

  describe('Source Statistics', () => {
    it('should track multiple source types', () => {
      // Add file watcher
      manager.addFileWatcher({ watchPath: testDir, recursive: false });

      // Note: WebSocket and HTTP require actual servers, so we'll skip those in unit tests

      const stats = manager.getStats();
      expect(stats.total).toBe(1);
      expect(stats.byType['file-watcher']).toBe(1);
    });

    it('should track running vs stopped sources', () => {
      const id = manager.addFileWatcher({
        watchPath: testDir,
        recursive: false,
      });

      // 惰性启动：显式 start 后进入 Running
      manager.startSource(id);
      let stats = manager.getStats();
      expect(stats.running).toBe(1);
      expect(stats.stopped).toBe(0);

      manager.stopSource(id);

      stats = manager.getStats();
      expect(stats.running).toBe(0);
      expect(stats.stopped).toBe(1);
    });
  });

  describe('Clear All', () => {
    it('should clear all sources', () => {
      manager.addFileWatcher({ watchPath: testDir, recursive: false });
      manager.addFileWatcher({ watchPath: testDir, recursive: false });

      expect(manager.getAllSources()).toHaveLength(2);

      manager.clearAll();

      expect(manager.getAllSources()).toHaveLength(0);
    });

    it('should stop all sources before clearing', () => {
      const id1 = manager.addFileWatcher({ watchPath: testDir, recursive: false });
      const id2 = manager.addFileWatcher({ watchPath: testDir, recursive: false });

      manager.clearAll();

      const stats = manager.getStats();
      expect(stats.running).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe('Get Source', () => {
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
  });

  describe('Poll Next', () => {
    it('should return null when no sources', async () => {
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
      // May be null if no events, but should not throw
      expect(event === null || typeof event === 'object').toBe(true);
    });
  });
});
