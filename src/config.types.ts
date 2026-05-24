// src/config.types.ts
/**
 * Config type definitions
 * Extracted to avoid circular dependency between config.ts and config-validator.ts
 */

/** 运行时需要的 OpenAI 配置 */
export interface Config {
  apiKey: string;     // OPENAI_API_KEY
  baseUrl: string;    // 不带 /v1 的根地址（默认 https://open.bigmodel.cn/api/paas/v4）
  endpoint?: string;  // 可选：完整的 API 端点 URL（优先使用）
  model: string;      // 模型名称，例如 glm-5
  functionCallingEnabled?: boolean;  // 是否启用 Function Calling API（默认 false）
  executionMode?: 'function-calling' | 'two-phase' | 'multi-agent' | 'subagent' | 'standard';  // 执行模式（默认 standard）
  supportsResponseFormat?: boolean;  // API 是否支持 response_format 参数（默认自动检测）
  useFFT?: boolean;  // 是否启用 FFT（快速节俭树）模式（默认 false）
  useLandmark?: boolean;  // 是否启用 Landmark Counting（路标计数启发式）模式（默认 false）
  autoAlgorithm?: boolean;  // 是否启用自动算法选择（基于意图识别，默认 true）
  useStrategy?: boolean;  // 是否使用策略执行器（默认 true）

  // Vision/Multimodal configuration
  enableVision?: boolean;  // 是否启用视觉功能（默认 false）
  visionModel?: string;    // 视觉模型名称（例如 'gpt-4o', 'glm-4v'）

  // New configurations
  proxy?: string;  // HTTPS代理地址
  reviewMode?: {
    enabled?: boolean;
    autoBackup?: boolean;
    showDiff?: boolean;
    requireConfirm?: boolean;
  };
  eventSystem?: {
    enabled?: boolean;
    debugMode?: boolean;
    logAllEvents?: boolean;
  };
}
