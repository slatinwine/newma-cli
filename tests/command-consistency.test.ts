/**
 * 命令体系一致性门禁
 *
 * 防三角腐化：handleSpecialCommand 分发器、Tab 补全表、/help 文本
 * 三者必须互相覆盖。历史上 36 个已分发命令不在补全表——用户按 Tab
 * 根本补不出来。本测试让它不能再悄悄退化。
 */

import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const completionSrc = fs.readFileSync(path.join(root, 'src/completion.ts'), 'utf-8');
const replSrc = fs.readFileSync(path.join(root, 'src/repl.ts'), 'utf-8');

/** completion.ts 的 commands 数组里注册的命令 */
const compCmds = new Set(
  [...completionSrc.matchAll(/'(\/[a-z-]+)'/g)].map((m) => m[1])
);

/** handleSpecialCommand 分发的命令 */
const dispatchCmds = new Set(
  (replSrc.match(/case '(\/[a-z-]+)':/g) ?? [])
    .map((m) => m.match(/'(\/[^']+)'/)![1])
    .filter((c) => c.startsWith('/'))
);

/** 补全别名表覆盖的命令（如 q -> /exit） */
const aliasTargets = new Set(
  [...completionSrc.matchAll(/\['[^']+',\s*'(\/[a-z-]+)'\]/g)].map((m) => m[1])
);

describe('🧭 命令体系一致性', () => {
  test('每个分发命令都可被 Tab 补全（或在别名表中）', () => {
    const missing = [...dispatchCmds].filter(
      (c) => !compCmds.has(c) && !aliasTargets.has(c) && c !== '/exit'
    );
    expect(
      missing.length === 0
        ? 'ok'
        : `以下命令已分发但 Tab 无法补全（加进 src/completion.ts 的 commands）:\n  ${missing.join('\n  ')}`
    ).toBe('ok');
  });

  test('核心用户命令必须在 /help 文本中出现', () => {
    // printHelp 函数体：从函数声明到下一个同级方法注释
    const helpFn = replSrc.match(
      /private printHelp\(\): void \{[\s\S]*?\n  \}\n\n  \/\*\*/
    )?.[0];
    expect(helpFn).toBeTruthy();

    const core = [
      '/plan', '/chat', '/status', '/undo', '/diff', '/help', '/exit',
      // 🎮 存档/分支（本产品的核心卖点必须可见）
      '/save', '/saves', '/load', '/tree', '/flags', '/back-to', '/next',
      '/continue',
      // 记忆与沉淀
      '/memory-stats', '/drafts',
      // Skills
      '/skill-list', '/skill-info',
      // Review
      '/review-on',
    ];
    const missing = core.filter(
      (c) =>
        !helpFn!
          .replace(/\[[^\]]*\]/g, '') // /save [name] → /save
          .replace(/<[^>]*>/g, '') // /back-to <id> → /back-to
          .includes(c)
    );
    expect(
      missing.length === 0
        ? 'ok'
        : `以下核心命令不在 printHelp 中（src/repl.ts）:\n  ${missing.join(', ')}`
    ).toBe('ok');
  });

  test('补全表里的命令要么可分发、要么属于 loop 插件（防拼错）', () => {
    // loop 插件命令（registerMemoCommands 等）不在 handleSpecialCommand 中，属合法
    const loopPluginCommands = new Set([
      '/plan', '/do', '/loop', '/execute', '/verify', '/chat',
      '/profile', '/plugins', '/hooks', '/event-source',
      '/decision', '/decisions', '/memo-index', '/find', '/memo-doc',
      '/memo-stats', '/tasks', '/task-search', '/memory-history',
      '/memory-prefs', '/memory-reasoning', '/skills', '/help', '/status',
      '/clear', '/exit', '/time',
    ]);
    const broken = [...compCmds].filter(
      (c) => !dispatchCmds.has(c) && !loopPluginCommands.has(c)
    );
    expect(
      broken.length === 0
        ? 'ok'
        : `补全表里有拼错/未实现的命令:\n  ${broken.join(', ')}`
    ).toBe('ok');
  });
});
