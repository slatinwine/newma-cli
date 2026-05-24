import { describe, it, expect, beforeEach } from 'bun:test';
import plugin from './plugin';

describe('empty-plugin', () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      pluginRoot: '/tmp/plugin',
      projectRoot: '/tmp/project',
      config: {},
    };
  });

  it('should have correct metadata', () => {
    expect(plugin.id).toBe('empty-plugin');
    expect(plugin.name).toBe('empty-plugin');
    expect(plugin.tools).toBeDefined();
  });

  it('should have tools', () => {
    expect(plugin.tools.length).toBeGreaterThan(0);
  });
});
