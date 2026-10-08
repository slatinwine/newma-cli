// src/index.ts
/**
 * Newma CLI — public library entry
 *
 * `main` 指向本文件的编译产物（dist/index.js），让
 * `require('newma-cli')` / `import ... from 'newma-cli'` 可用。
 * 只导出稳定面：配置、存档/分支树/时间旅行、日志、版本。
 */

export { getDefaultConfig } from './config';
export { setLogLevel, getLogLevel, logger } from './logger';
export { SessionContextManager, createSessionContextManager, filterActiveMessages } from './memory/session-context-manager';
export { SavePointManager, createSavePointManager } from './memory/save-point-manager';
export { BranchTreeManager, createBranchTreeManager } from './memory/branch-tree-manager';
export { outcomeReward } from './memory/branch-tree-types';
export type { SavePoint } from './memory/save-point-types';
export type { DecisionNode, DecisionOption, BranchOutcome, SessionFlag } from './memory/branch-tree-types';
export { TimeTravelManager } from './time-travel';
