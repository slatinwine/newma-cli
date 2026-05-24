/**
 * Search Tool Permission Test
 *
 * 测试搜索工具是否不需要权限验证
 */

import { ToolRegistry } from './src/tools/registry';
import { searchTool } from './src/tools/builtin/search';
import { searchAndFetchTool } from './src/tools/builtin/search-and-fetch';
import { webScrapeTool } from './src/tools/builtin/web-scrape';
import chalk from 'chalk';

console.log(chalk.cyan('\n📋 Search Tool Permissions Test'));
console.log(chalk.cyan('═'.repeat(60)) + '\n');

// 创建工具注册表
const registry = new ToolRegistry();

// 注册搜索工具
registry.register(searchTool);
registry.register(searchAndFetchTool);
registry.register(webScrapeTool);

// 检查所有搜索工具的权限
const searchTools = ['search', 'search_and_fetch', 'web_scrape'];
let allNoPermission = true;

for (const toolName of searchTools) {
  const tool = registry.get(toolName);

  if (tool) {
    const permissions = tool.permissions || [];
    const hasNoPermission = permissions.length === 0;

    console.log(chalk.white(`Tool: ${toolName}`));
    console.log(chalk.gray(`  Permissions: ${permissions.length > 0 ? permissions.join(', ') : '(none)'}`));
    console.log(chalk.gray(`  Requires Permission: ${permissions.length > 0 ? 'Yes' : 'No'}`));

    if (hasNoPermission) {
      console.log(chalk.green(`  ✓ No permission required\n`));
    } else {
      console.log(chalk.red(`  ✗ Still requires permissions\n`));
      allNoPermission = false;
    }
  }
}

console.log(chalk.cyan('═'.repeat(60)));

if (allNoPermission) {
  console.log(chalk.green.bold('\n✓ All search tools require NO permissions!\n'));
  process.exit(0);
} else {
  console.log(chalk.red.bold('\n✗ Some search tools still require permissions\n'));
  process.exit(1);
}
