/**
 * Event Sources Fast Tests
 *
 * Quick tests for core event source functionality
 */

import {
  createFileWatcherSource,
  createHTTPSource,
  FileWatcherEventSource,
  HTTPEventSource,
  EventSourceState,
} from './src/loop/event';

describe('Event Sources - Fast Tests', () => {

  describe('FileWatcherEventSource - Core Tests', () => {
    let watcher: FileWatcherEventSource;

    afterEach(() => {
      if (watcher) {
        watcher.dispose();
      }
    });

    test('should create watcher', () => {
      watcher = createFileWatcherSource({
        watchPath: process.cwd(),
      });

      expect(watcher).toBeDefined();
      expect(watcher.getState()).toBe(EventSourceState.Start);
    });

    test('should start and stop', () => {
      watcher = createFileWatcherSource({
        watchPath: process.cwd(),
      });

      watcher.start();
      expect(watcher.getState()).toBe(EventSourceState.Running);

      watcher.pause();
      expect(watcher.getState()).toBe(EventSourceState.Paused);

      watcher.resume();
      expect(watcher.getState()).toBe(EventSourceState.Running);
    });

    test('should return stats', () => {
      watcher = createFileWatcherSource({
        watchPath: process.cwd(),
      });
      watcher.start();

      const stats = watcher.getStats();

      expect(stats).toHaveProperty('watchedPaths');
      expect(stats).toHaveProperty('queuedEvents');
      expect(stats).toHaveProperty('state');
      expect(typeof stats.watchedPaths).toBe('number');
    });

    test('should handle pollNext gracefully', async () => {
      watcher = createFileWatcherSource({
        watchPath: process.cwd(),
      });
      watcher.start();

      const event = await watcher.pollNext();

      // Should return null or event, never throw
      expect(event === null || typeof event === 'object').toBe(true);
    });
  });

  describe('HTTPEventSource - Core Tests', () => {
    let httpSource: HTTPEventSource;
    const TEST_PORT = 5678;

    afterEach(async () => {
      if (httpSource) {
        httpSource.dispose();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should create HTTP source', () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
      });

      expect(httpSource).toBeDefined();
      expect(httpSource.getState()).toBe(EventSourceState.Start);
    });

    test('should start and stop server', async () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
      });

      await httpSource.start();

      expect(httpSource.isListening()).toBe(true);
      expect(httpSource.getState()).toBe(EventSourceState.Running);

      httpSource.dispose();

      expect(httpSource.isListening()).toBe(false);
    });

    test('should return correct URL', async () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
        host: '127.0.0.1',
      });

      await httpSource.start();

      const url = httpSource.getServerURL();

      expect(url).toBe('http://127.0.0.1:5678');
    });

    test('should return stats', async () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
      });
      await httpSource.start();

      const stats = httpSource.getStats();

      expect(stats).toHaveProperty('isListening');
      expect(stats).toHaveProperty('queuedEvents');
      expect(stats).toHaveProperty('port');
      expect(stats.port).toBe(TEST_PORT);
      expect(stats.isListening).toBe(true);
    });

    test('should handle pollNext gracefully', async () => {
      httpSource = createHTTPSource({
        port: TEST_PORT,
      });
      await httpSource.start();

      const event = await httpSource.pollNext();

      // Should return null or event, never throw
      expect(event === null || typeof event === 'object').toBe(true);
    });
  });

  describe('Event Source State Management', () => {
    test('should track state correctly', () => {
      const watcher = createFileWatcherSource({
        watchPath: process.cwd(),
      });

      expect(watcher.getState()).toBe(EventSourceState.Start);
      expect(watcher.isPaused()).toBe(false);

      watcher.start();

      expect(watcher.getState()).toBe(EventSourceState.Running);
      expect(watcher.isPaused()).toBe(false);

      watcher.pause();

      expect(watcher.getState()).toBe(EventSourceState.Paused);
      expect(watcher.isPaused()).toBe(true);

      watcher.resume();

      expect(watcher.getState()).toBe(EventSourceState.Running);
      expect(watcher.isPaused()).toBe(false);

      watcher.dispose();
    });
  });

  describe('Event Source Error Handling', () => {
    test('should handle invalid path gracefully', () => {
      expect(() => {
        const watcher = createFileWatcherSource({
          watchPath: '/nonexistent/path',
        });
        watcher.start();
      }).not.toThrow();
    });

    test('should handle port conflicts gracefully', async () => {
      const httpSource1 = createHTTPSource({ port: 5679 });
      await httpSource1.start();

      const httpSource2 = createHTTPSource({ port: 5679 });

      await expect(httpSource2.start()).rejects.toThrow();

      httpSource1.dispose();
      httpSource2.dispose();
    });
  });
});
