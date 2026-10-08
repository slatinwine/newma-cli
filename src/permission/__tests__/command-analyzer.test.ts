/**
 * 命令安全分析器单元测试
 *
 * 覆盖：不完整命令、命令注入、危险模式、路径白名单、子命令拆分
 */

import { checkers, analyzeCommand } from '../command-analyzer';
import { PermissionContext } from '../types';
import path from 'path';

// 跨平台：路径断言用当前平台的绝对路径构造，POSIX 风格输入仅用于
// “白名单外”类负向用例（任何平台下都不在白名单内）
const PROJ = path.resolve('/home/user/project');
const inWhitelist = (p: string) => path.join(PROJ, p);

function makeContext(overrides?: Partial<PermissionContext>): PermissionContext {
  return {
    toolName: 'shell',
    action: '',
    cwd: PROJ,
    mode: 'normal',
    sessionRules: [],
    localRules: [],
    globalRules: [],
    workingDirectories: [PROJ],
    ...overrides,
  };
}

describe('command-analyzer', () => {
  // ─── 1. 不完整命令检测 ───
  describe('incompleteCommandCheck', () => {
    const check = checkers.incompleteCommandCheck;

    it('检测 tab 开头的命令', () => {
      const result = check('\trm -rf /tmp', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
      expect(result!.message).toContain('tab');
    });

    it('检测 flag 开头的命令', () => {
      const result = check('-rf /tmp', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
      expect(result!.message).toContain('flag');
    });

    it('检测 operator 开头的命令', () => {
      const result = check('&& echo done', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
    });

    it('正常命令通过', () => {
      const result = check('ls -la', makeContext());
      expect(result).toBeNull();
    });
  });

  // ─── 2. 命令注入检测 ───
  describe('commandInjectionCheck', () => {
    const check = checkers.commandInjectionCheck;

    it('检测 IFS 注入', () => {
      const result = check('cat $IFS/etc/passwd', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('deny');
    });

    it('检测 ${IFS} 注入', () => {
      const result = check('cat ${IFS}/etc/passwd', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('deny');
    });

    it('检测 $() 命令替换', () => {
      const result = check('echo $(whoami)', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
      expect(result!.message).toContain('$()');
    });

    it('检测 ${} 参数替换', () => {
      const result = check('echo ${PATH}', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
    });

    it('检测进程替换 <()', () => {
      const result = check('wc -l <(ls)', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
    });

    it('正常命令通过', () => {
      const result = check('ls -la /tmp', makeContext());
      expect(result).toBeNull();
    });
  });

  // ─── 3. 危险模式检测 ───
  describe('dangerousPatternCheck', () => {
    const check = checkers.dangerousPatternCheck;

    it('检测未引用的输入重定向（白名单外）', () => {
      const result = check('sort < /tmp/data.txt', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
      expect(result!.message).toContain('输入重定向');
    });

    it('白名单内输入重定向不触发', () => {
      const result = check(`sort < "${inWhitelist('data.txt')}"`, makeContext());
      expect(result).toBeNull();
    });

    it('检测未引用的输出重定向（白名单外）', () => {
      const result = check('echo hello > /tmp/out.txt', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
    });

    it('白名单内输出重定向不触发', () => {
      const result = check(`echo hello > "${inWhitelist('out.txt')}"`, makeContext());
      expect(result).toBeNull();
    });

    it('引用的重定向不触发', () => {
      const result = check("echo '>'", makeContext());
      expect(result).toBeNull();
    });

    it('正常命令通过', () => {
      const result = check('ls -la /tmp', makeContext());
      expect(result).toBeNull();
    });
  });

  // ─── 4. Heredoc 检测 ───
  describe('heredocCheck', () => {
    const check = checkers.heredocCheck;

    it('检测命令替换中的 heredoc', () => {
      const result = check('$(cat << EOF\nhello\nEOF)', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
    });

    it('正常 heredoc 通过', () => {
      const result = check('cat << EOF\nhello\nEOF', makeContext());
      expect(result).toBeNull();
    });
  });

  // ─── 5. 混淆 flag 检测 ───
  describe('obfuscatedFlagCheck', () => {
    const check = checkers.obfuscatedFlagCheck;

    it('检测单引号包裹的 flag', () => {
      const result = check("rm -'r'f /tmp", makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
    });

    it('检测双引号包裹的 flag', () => {
      const result = check('ls --"help"', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
    });

    it('正常 flag 通过', () => {
      const result = check('ls -la', makeContext());
      expect(result).toBeNull();
    });
  });

  // ─── 6. 路径白名单验证 ───
  describe('pathValidationCheck', () => {
    const check = checkers.pathValidationCheck;
    const ctx = makeContext({ workingDirectories: [PROJ] });

    it('白名单内路径通过', () => {
      const result = check(`cat "${inWhitelist('src/index.ts')}"`, ctx);
      expect(result).toBeNull();
    });

    it('白名单外路径触发 ask', () => {
      const result = check('cat /etc/passwd', ctx);
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('ask');
      expect(result!.message).toContain('白名单');
    });

    it('无白名单时跳过检查', () => {
      const noWhitelistCtx = makeContext({ workingDirectories: [] });
      const result = check('cat /etc/passwd', noWhitelistCtx);
      expect(result).toBeNull();
    });

    it('相对路径解析后检查', () => {
      // 相对路径按 cwd 解析后应落在白名单内（cwd 即白名单目录）
      const result = check('cat ./src/index.ts', ctx);
      expect(result).toBeNull();
    });
  });

  // ─── 7. 子命令拆分验证 ───
  describe('subcommandSplitCheck', () => {
    const check = checkers.subcommandSplitCheck;
    const ctx = makeContext({ workingDirectories: ['/home/user/project'] });

    it('检测子命令中的危险模式', () => {
      const result = check('ls && cat /etc/passwd', ctx);
      expect(result).not.toBeNull();
      expect(result!.message).toContain('子命令');
    });

    it('安全子命令通过', () => {
      const result = check('echo hello && echo world', ctx);
      expect(result).toBeNull();
    });

    it('单命令不拆分', () => {
      const result = check('ls -la', ctx);
      expect(result).toBeNull();
    });

    it('|| 操作符拆分验证', () => {
      const result = check('ls || cat /etc/passwd', ctx);
      expect(result).not.toBeNull();
    });
  });

  // ─── analyzeCommand 完整流程 ───
  describe('analyzeCommand', () => {
    it('第一个匹配的检查器返回决策', () => {
      const result = analyzeCommand('$IFS cat /etc/passwd', makeContext());
      expect(result).not.toBeNull();
      expect(result!.behavior).toBe('deny');
    });

    it('正常命令返回 null', () => {
      const result = analyzeCommand('ls -la', makeContext({ workingDirectories: [] }));
      expect(result).toBeNull();
    });
  });
});

describe('rule-engine prefix matching', () => {
  // Import ruleContentMatches is not exported; test via analyzeCommand + rules
  it('git:* should match git status', async () => {
    const { ruleContentMatches } = await import('../rule-engine') as any;
    expect(ruleContentMatches('git:*', 'git status')).toBe(true);
    expect(ruleContentMatches('git:*', 'git commit -m "test"')).toBe(true);
    expect(ruleContentMatches('git:*', 'npm install')).toBe(false);
    expect(ruleContentMatches('git:*', 'gitpush')).toBe(false);
  });
});
