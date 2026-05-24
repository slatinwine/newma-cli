/**
 * API Mode for Newma
 *
 * 提供程序化调用接口，用于集成和测试
 * 直接返回 AI 响应，不包含任何元数据或日志
 */

import { scanDirectory } from './scanner';
import { callAI, chatAI } from './ai';
import { Config } from './config';
import * as path from 'path';

/**
 * API 模式选项
 */
export interface ApiModeOptions {
  mode?: 'chat' | 'plan' | 'do';
  silent?: boolean; // 是否静默模式（默认 true）
}

/**
 * 运行 API 模式
 *
 * @param config - AI 配置
 * @param projectRoot - 项目根目录
 * @param input - 用户输入/需求
 * @param options - 可选参数
 * @returns AI 响应内容（纯文本）
 */
export async function runApiMode(
  config: Config,
  projectRoot: string,
  input: string,
  options: ApiModeOptions = {}
): Promise<string> {
  const { mode = 'chat', silent = true } = options;

  // 扫描项目目录
  const projectInfo = await scanDirectory(projectRoot);

  // 根据模式调用 AI
  let response: string;

  if (mode === 'chat') {
    // 聊天模式：直接使用 chatAI
    response = await chatAI(config, input, undefined, undefined);
  } else {
    // plan 模式：使用 callAI (do 模式映射为 think)
    const aiMode = mode === 'do' ? 'think' : mode;
    const result = await callAI(
      config,
      projectInfo,
      input,
      aiMode, // 使用 'think' 而不是 'do'
      [], // 空 history
      undefined,
      undefined,
      undefined,
      projectRoot
    );
    response = result.content || '';
  }

  return response;
}

/**
 * 从 stdin 读取输入
 *
 * @returns stdin 内容
 */
export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data.trim());
    });

    process.stdin.on('error', (error) => {
      reject(error);
    });

    // 设置超时（防止无限等待）
    setTimeout(() => {
      reject(new Error('stdin read timeout'));
    }, 5000);
  });
}

/**
 * 格式化输出（用于 JSON 等格式化输出）
 *
 * @param response - AI 响应内容
 * @param format - 输出格式（text, json, markdown）
 * @returns 格式化后的输出
 */
export function formatOutput(
  response: string,
  format: 'text' | 'json' | 'markdown' = 'text'
): string {
  if (format === 'json') {
    return JSON.stringify({
      response,
      metadata: {
        timestamp: new Date().toISOString(),
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      },
    }, null, 2);
  }

  // text 和 markdown 格式直接返回响应
  return response;
}
