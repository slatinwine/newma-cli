// src/config-validator.ts
/**
 * Configuration Validator
 *
 * 验证配置的有效性和提供友好的错误提示
 */

import { Config } from './config.types';
import chalk from 'chalk';

/**
 * 验证错误类型
 */
export enum ValidationError {
  MISSING_API_KEY = 'MISSING_API_KEY',
  INVALID_API_KEY = 'INVALID_API_KEY',
  INVALID_BASE_URL = 'INVALID_BASE_URL',
  INVALID_MODEL = 'INVALID_MODEL',
  MISSING_REQUIRED_CONFIG = 'MISSING_REQUIRED_CONFIG',
  INVALID_TIMEOUT = 'INVALID_TIMEOUT',
  INVALID_RETRY_CONFIG = 'INVALID_RETRY_CONFIG',
  INVALID_CACHE_CONFIG = 'INVALID_CACHE_CONFIG',
}

/**
 * 验证错误信息
 */
interface ValidationErrorInfo {
  type: ValidationError;
  message: string;
  field?: string;
  suggestion?: string;
  critical: boolean; // 是否是致命错误（阻止启动）
}

/**
 * 验证配置对象
 * @param config 配置对象
 * @returns 验证错误列表（空表示无错误）
 */
export function validateConfig(config: Config): ValidationErrorInfo[] {
  const errors: ValidationErrorInfo[] = [];

  // 1. 验证 API Key
  if (!config.apiKey || config.apiKey.trim() === '') {
    errors.push({
      type: ValidationError.MISSING_API_KEY,
      message: '未找到 OpenAI API Key',
      field: 'OPENAI_API_KEY',
      suggestion: '请在 .env 文件中设置 OPENAI_API_KEY，或在 settings.json 中配置 openai.apiKey',
      critical: true,
    });
  } else if (config.apiKey.length < 10) {
    errors.push({
      type: ValidationError.INVALID_API_KEY,
      message: 'API Key 长度不足',
      field: 'OPENAI_API_KEY',
      suggestion: 'API Key 长度应该至少 10 个字符',
      critical: false,
    });
  } else if (config.apiKey.startsWith('your-api-key') || config.apiKey.includes('your-api-key')) {
    errors.push({
      type: ValidationError.INVALID_API_KEY,
      message: 'API Key 使用了默认占位符',
      field: 'OPENAI_API_KEY',
      suggestion: '请将 OPENAI_API_KEY 替换为实际的 API Key',
      critical: true,
    });
  }

  // 2. 验证 Base URL
  if (!config.baseUrl || config.baseUrl.trim() === '') {
    errors.push({
      type: ValidationError.INVALID_BASE_URL,
      message: '未配置 API Base URL',
      field: 'OPENAI_BASE_URL',
      suggestion: '请在 .env 中设置 OPENAI_BASE_URL，或在 settings.json 中配置 openai.baseUrl',
      critical: true,
    });
  } else {
    try {
      const url = new URL(config.baseUrl);
      // 检查协议
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push({
          type: ValidationError.INVALID_BASE_URL,
          message: 'API Base URL 协议无效',
          field: 'OPENAI_BASE_URL',
          suggestion: 'URL 应该以 http:// 或 https:// 开头',
          critical: true,
        });
      }
      // 检查是否为空路径
      if (url.pathname === '/' || url.pathname === '') {
        errors.push({
          type: ValidationError.INVALID_BASE_URL,
          message: 'API Base URL 缺少路径',
          field: 'OPENAI_BASE_URL',
          suggestion: 'URL 应该包含 API 路径，例如 /v1/chat/completions',
          critical: false,
        });
      }
    } catch {
      // URL 解析失败
      errors.push({
        type: ValidationError.INVALID_BASE_URL,
        message: 'API Base URL 格式无效',
        field: 'OPENAI_BASE_URL',
        suggestion: '请检查 OPENAI_BASE_URL 格式，例如：https://open.bigmodel.cn/api/coding/paas/v4',
        critical: true,
      });
    }
  }

  // 3. 验证 Model
  if (!config.model || config.model.trim() === '') {
    errors.push({
      type: ValidationError.INVALID_MODEL,
      message: '未配置模型名称',
      field: 'OPENAI_MODEL',
      suggestion: '请在 .env 中设置 OPENAI_MODEL，或在 settings.json 中配置 openai.model',
      critical: true,
    });
  }

  // 4. 验证超时配置（从环境变量读取）
  const retryMaxAttempts = parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10);
  const retryInitialDelay = parseInt(process.env.RETRY_INITIAL_DELAY || '1000', 10);
  const retryMaxDelay = parseInt(process.env.RETRY_MAX_DELAY || '10000', 10);
  const retryBackoffMultiplier = Number.parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER || '2');

  if (retryMaxAttempts < 1 || retryMaxAttempts > 10) {
    errors.push({
      type: ValidationError.INVALID_RETRY_CONFIG,
      message: '重试次数配置无效',
      field: 'RETRY_MAX_ATTEMPTS',
      suggestion: '重试次数应该在 1-10 之间',
      critical: false,
    });
  }

  if (retryInitialDelay < 100 || retryInitialDelay > 60000) {
    errors.push({
      type: ValidationError.INVALID_RETRY_CONFIG,
      message: '重试初始延迟配置无效',
      field: 'RETRY_INITIAL_DELAY',
      suggestion: '初始延迟应该在 100-60000ms 之间',
      critical: false,
    });
  }

  if (retryMaxDelay < 1000 || retryMaxDelay > 60000) {
    errors.push({
      type: ValidationError.INVALID_RETRY_CONFIG,
      message: '重试最大延迟配置无效',
      field: 'RETRY_MAX_DELAY',
      suggestion: '最大延迟应该在 1000-60000ms 之间',
      critical: false,
    });
  }

  if (retryBackoffMultiplier < 1.1 || retryBackoffMultiplier > 5) {
    errors.push({
      type: ValidationError.INVALID_RETRY_CONFIG,
      message: '重试退避倍数配置无效',
      field: 'RETRY_BACKOFF_MULTIPLIER',
      suggestion: '退避倍数应该在 1.1-5.0 之间',
      critical: false,
    });
  }

  return errors;
}

/**
 * 显示验证错误
 * @param errors 验证错误列表
 */
export function displayValidationErrors(errors: ValidationErrorInfo[]): void {
  if (errors.length === 0) {
    console.log(chalk.green('✅ 配置验证通过！\n'));
    return;
  }

  console.log(chalk.red.bold('❌ 配置验证失败\n'));
  console.log(chalk.gray('─'.repeat(50)));

  // 分组显示：致命错误 vs. 警告
  const criticalErrors = errors.filter(e => e.critical);
  const warnings = errors.filter(e => !e.critical);

  if (criticalErrors.length > 0) {
    console.log(chalk.red.bold('\n🚨 致命错误（必须修复才能运行）：\n'));
    criticalErrors.forEach((error, index) => {
      console.log(chalk.red(`${index + 1}. ${error.message}`));
      if (error.field) {
        console.log(chalk.gray(`   字段: ${error.field}`));
      }
      if (error.suggestion) {
        console.log(chalk.cyan(`   💡 建议: ${error.suggestion}`));
      }
      console.log('');
    });
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow.bold('\n⚠️  警告（建议修复）：\n'));
    warnings.forEach((error, index) => {
      console.log(chalk.yellow(`${index + 1}. ${error.message}`));
      if (error.field) {
        console.log(chalk.gray(`   字段: ${error.field}`));
      }
      if (error.suggestion) {
        console.log(chalk.cyan(`   💡 建议: ${error.suggestion}`));
      }
      console.log('');
    });
  }

  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.gray(`\n📊 总计: ${criticalErrors.length} 个致命错误，${warnings.length} 个警告\n`));

  // 如果有致命错误，退出程序
  if (criticalErrors.length > 0) {
    console.log(chalk.red('\n❌ 由于存在致命配置错误，程序无法启动。'));
    console.log(chalk.cyan('💡 提示: 运行 "npm run init-settings" 生成配置文件模板\n'));
    process.exit(1);
  }
}

/**
 * 获取配置摘要信息
 * @param config 配置对象
 */
export function getConfigSummary(config: Config): string {
  const parts: string[] = [];

  parts.push(chalk.bold('📋 配置摘要'));
  parts.push(chalk.gray('─'.repeat(40)));

  // API 配置
  parts.push(chalk.cyan('\n🔑 API 配置：'));
  parts.push(`  模型: ${chalk.green(config.model)}`);
  parts.push(`  端点: ${chalk.green(config.baseUrl)}`);
  const maskedKey = config.apiKey.length > 4
    ? '***' + config.apiKey.slice(-4) + '***'
    : '***';
  parts.push('  API Key: ' + chalk.yellow(maskedKey));
  const execMode = config.executionMode || 'standard';
  parts.push('  执行模式: ' + chalk.green(execMode));

  // 重试配置
  const retryMaxAttempts = process.env.RETRY_MAX_ATTEMPTS || '3';
  const retryInitialDelay = process.env.RETRY_INITIAL_DELAY || '1000';
  parts.push(chalk.cyan('\n⚡ 重试机制：'));
  parts.push('  最大重试: ' + chalk.green(retryMaxAttempts + ' 次'));
  parts.push('  初始延迟: ' + chalk.green(retryInitialDelay + 'ms'));

  // 缓存配置
  const cacheEnabled = true;
  parts.push(chalk.cyan('\n💾 缓存系统：'));
  parts.push('  状态: ' + chalk.green(cacheEnabled ? '已启用' : '未启用'));
  parts.push('  缓存时间: ' + chalk.green('10 分钟'));

  parts.push(chalk.gray('─'.repeat(40)));

  return parts.join('\n');
}
