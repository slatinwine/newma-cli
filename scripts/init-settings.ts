#!/usr/bin/env ts-node
/**
 * 初始化 settings.json 配置文件
 * 用法: npm run init-settings
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function initSettings() {
  console.log('🚀 Kode 配置文件初始化向导\n');

  // 询问是全局配置还是项目配置
  const scope = await question('配置类型?\n  1. 全局配置 (~/.kode/settings.json)\n  2. 项目配置 (./settings.json)\n请选择 (1/2, 默认: 1): ');

  const useGlobal = scope.trim() !== '2';
  const settingsDir = useGlobal ? path.join(os.homedir(), '.kode') : process.cwd();
  const settingsPath = path.join(settingsDir, 'settings.json');

  // 检查是否已存在
  if (fs.existsSync(settingsPath)) {
    const overwrite = await question(`\n⚠️  配置文件已存在: ${settingsPath}\n是否覆盖? (y/N): `);
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ 取消操作');
      rl.close();
      return;
    }
  }

  console.log('\n请输入 OpenAI 配置信息:\n');

  const apiKey = await question('API Key (必填): ');
  if (!apiKey.trim()) {
    console.log('❌ API Key 不能为空');
    rl.close();
    return;
  }

  const baseUrl = await question('Base URL (默认: https://api.openai.com): ');
  const defaultEndpoint = `${baseUrl.trim() || 'https://api.openai.com'}/v1/chat/completions`;
  const endpoint = await question(`完整 API Endpoint (可选，直接回车使用 Base URL+标准路径):\n  例如: https://open.bigmodel.cn/api/paas/v4/chat/completions\n  留空则自动使用: ${defaultEndpoint}\n`);
  const model = await question('Model (默认: gpt-4o-mini): ');

  console.log('\n请输入项目配置 (可选，直接回车使用默认值):\n');

  const maxIterations = await question('最大迭代次数 (默认: 3): ');
  const enableTools = await question('启用工具系统? (y/N, 默认: N): ');
  const permissionLevel = await question('权限级别 (read_only/safe/standard/dangerous, 默认: standard): ');
  const enableVerification = await question('启用自动验证? (y/N, 默认: N): ');
  const enableMultiAgent = await question('启用多代理系统? (y/N, 默认: N): ');

  // 构建配置对象
  const config = {
    openai: {
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || 'https://api.openai.com',
      endpoint: endpoint.trim() || undefined,
      model: model.trim() || 'gpt-4o-mini'
    },
    project: {
      rootDir: './',
      maxIterations: parseInt(maxIterations) || 3,
      enableTools: enableTools.toLowerCase() === 'y',
      permissionLevel: (permissionLevel.trim() || 'standard') as 'read_only' | 'safe' | 'standard' | 'dangerous',
      enableVerification: enableVerification.toLowerCase() === 'y',
      enableMultiAgent: enableMultiAgent.toLowerCase() === 'y'
    }
  };

  // 创建目录（如果不存在）
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  // 写入配置文件
  fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2), 'utf-8');

  console.log(`\n✅ 配置文件已创建: ${settingsPath}`);
  console.log('\n配置内容:');
  console.log(JSON.stringify(config, null, 2));

  // 安全提示
  if (useGlobal) {
    console.log('\n🔒 安全提示: 全局配置文件包含敏感信息，请确保文件权限正确');
    try {
      fs.chmodSync(settingsPath, 0o600); // 仅所有者可读写
      console.log('   已设置文件权限为 600 (仅所有者可读写)');
    } catch (error) {
      console.log('   ⚠️  无法自动设置文件权限，请手动运行: chmod 600 ' + settingsPath);
    }
  }

  console.log('\n你现在可以运行:');
  console.log('  npm run dev -- "你的需求"');
  console.log('  或者编译后: kode "你的需求"');

  rl.close();
}

initSettings().catch(error => {
  console.error('❌ 初始化失败:', error);
  rl.close();
  process.exit(1);
});
