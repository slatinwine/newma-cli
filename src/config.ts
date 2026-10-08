// src/config.ts
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MCPServerConfig, MCPConfig } from './mcp/types';
import { Config } from './config.types';
export { Config } from './config.types';
import { validateConfig, displayValidationErrors, getConfigSummary } from './config-validator';
dotenv.config();

/** Settings.json 配置文件结构 */
export interface SettingsConfig {
  openai?: {
    apiKey?: string;
    baseUrl?: string;
    endpoint?: string;  // 可选：完整的 API 端点 URL
    model?: string;
    visionModel?: string;  // 视觉模型名称
    supportsResponseFormat?: boolean;  // API 是否支持 response_format 参数
    proxy?: string;  // HTTPS 代理地址（例如 http://proxy.example.com:8080）
  };
  project?: {
    rootDir?: string;
    maxIterations?: number;
    enableTools?: boolean;
    permissionLevel?: 'read_only' | 'safe' | 'standard' | 'dangerous';
    enableVerification?: boolean;
    enableMultiAgent?: boolean;
    enableFunctionCalling?: boolean;  // 是否启用 Function Calling API
    executionMode?: 'function-calling' | 'two-phase' | 'multi-agent' | 'subagent' | 'standard';  // 执行模式
    useFFT?: boolean;  // 是否启用 FFT（快速节俭树）模式
    useLandmark?: boolean;  // 是否启用 Landmark Counting（路标计数启发式）模式
    autoAlgorithm?: boolean;  // 是否启用自动算法选择（基于意图识别）
    enableVision?: boolean;  // 是否启用视觉功能
  };
  reviewMode?: {
    enabled?: boolean;  // 是否启用Review模式（默认 false）
    autoBackup?: boolean;  // 是否在review前自动备份（默认 true）
    showDiff?: boolean;  // 是否显示差异（默认 true）
    requireConfirm?: boolean;  // 是否需要确认（默认 true）
  };
  eventSystem?: {
    enabled?: boolean;  // 是否启用事件驱动系统（默认 false，渐进迁移）
    debugMode?: boolean;  // 是否启用调试模式（默认 false）
    logAllEvents?: boolean;  // 是否记录所有事件（默认 false）
  };
  hooks?: {
    enabled?: boolean;  // 是否启用 hook 系统（默认 false）
    directory?: string;  // Hook 文件目录（默认 .kode/hooks）
    timeout?: number;  // Hook 执行超时（毫秒，默认 5000）
    verbose?: boolean;  // 是否输出详细日志（默认 false）
  };
  mcp?: {
    enabled?: boolean;  // 是否启用 MCP（默认 false）
    servers?: Record<string, MCPServerConfig>;  // MCP 服务器配置
  };
  precipitation?: {
    enabled?: boolean;  // 是否启用经验沉淀系统（默认 true）
    schedule?: string;  // Cron 表达式（默认 "0 2 * * *"）
    confidenceThreshold?: number;  // 置信度阈值（默认 0.6）
    maxDailySkills?: number;  // 每日最大生成数量（默认 5）
    draftRetentionDays?: number;  // 草稿保留天数（默认 30）
    autoApproveBelow?: number;  // 低于此阈值自动批准（可选）
    autoRejectAbove?: number;  // 高于此阈值自动拒绝（可选）
    analysisDays?: number;  // 分析数据时间范围（天数，默认 7）
  };
  exploration?: {
    enabled?: boolean;  // 是否启用自主探索（默认 true）
    schedule?: string;  // Cron 表达式（默认每4小时）
    domains?: string[];  // 探索领域（默认全部）
    maxActionsPerDomain?: number;  // 每个领域最大动作数（默认 3）
    actionTimeout?: number;  // 单个动作超时时间（毫秒，默认 30000）
    logRetentionDays?: number;  // 日志保留天数（默认 30）
    maxLogSize?: number;  // 最大日志大小（MB，默认 100）
  };
  intentRecognition?: {
    enabled?: boolean;  // 是否启用意图识别（默认 false）
    autoRedirect?: boolean;  // 是否自动重定向到合适的模式（默认 true）
    confidenceThreshold?: number;  // 置信度阈值（默认 0.6）
    autoRedirectQuestions?: boolean;  // 是否自动重定向简单问题到 /chat（默认 true）
  };
  claudeCode?: {
    enabled?: boolean;  // 是否启用 Claude Code subagent 系统（默认 true）
    complexityThreshold?: number;  // 复杂度阈值（默认 70）
    maxSubagents?: number;  // 最大并行 subagent 数量（默认 5）
    taskTimeout?: number;  // 单个任务超时时间（毫秒，默认 60000）
    enableComplexityCheck?: boolean;  // 是否启用复杂度检测（默认 true）
    enableParallelSubagent?: boolean;  // 是否启用并行 subagent（默认 true）
  };
}

/** 配置文件路径 */
function getSettingsPath(): string {
  // 优先使用当前目录的 settings.json
  const localSettings = path.join(process.cwd(), 'settings.json');
  if (fs.existsSync(localSettings)) {
    return localSettings;
  }

  // 其次使用用户主目录的 .kode/settings.json
  const homeDir = os.homedir();
  const globalSettings = path.join(homeDir, '.kode', 'settings.json');
  return globalSettings;
}

/** 读取 settings.json 配置文件 */
function loadSettingsFile(): SettingsConfig | null {
  const settingsPath = getSettingsPath();

  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content) as SettingsConfig;
  } catch (error) {
    console.warn(`⚠️  警告: 无法读取配置文件 ${settingsPath}:`, error);
    return null;
  }
}

/** 
 * 从 CLI flag（已注入 env）、环境变量、settings.json 读取配置。
 * 优先级：CLI flag > 环境变量 > settings.json > 默认值
 * （12-factor 惯例：环境变量覆盖文件配置，保证 CI/容器可注入、
 *  不会被用户目录里的过期配置压住）
 */
export function getDefaultConfig(): Config {
  // 1. 读取 settings.json（最低优先级的显式配置）
  const settings = loadSettingsFile();

  // 2. 读取环境变量（优先于 settings.json）
  const envApiKey = process.env.OPENAI_API_KEY;
  const envBaseUrl = process.env.OPENAI_BASE_URL?.replace(/\/+$/, '');
  const envEndpoint = process.env.OPENAI_ENDPOINT?.trim();
  const envModel = process.env.OPENAI_MODEL;
  const envVisionModel = process.env.OPENAI_VISION_MODEL;
  const envEnableVision = process.env.ENABLE_VISION?.toLowerCase() === 'true';
  const envSupportsResponseFormat = process.env.OPENAI_SUPPORTS_RESPONSE_FORMAT?.toLowerCase() === 'true';
  const envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;

  // 3. 合并配置（环境变量 > settings.json > 默认值）
  const apiKey = envApiKey ?? settings?.openai?.apiKey;
  if (!apiKey) {
    console.error('❌ 请在 settings.json 或 .env 中配置 OPENAI_API_KEY');
    console.error('   可以运行: npm run init-settings 来生成配置文件模板');
    process.exit(1);
  }

  const baseUrl = envBaseUrl ?? settings?.openai?.baseUrl ?? 'https://open.bigmodel.cn/api/coding/paas/v4';
  const endpoint = envEndpoint ?? settings?.openai?.endpoint;
  const model = envModel ?? settings?.openai?.model ?? 'glm-5';
  const functionCallingEnabled = settings?.project?.enableFunctionCalling ?? false;
  const executionMode = settings?.project?.executionMode ?? 'subagent';
  const supportsResponseFormat = envSupportsResponseFormat ?? settings?.openai?.supportsResponseFormat ?? undefined;
  const useFFT = settings?.project?.useFFT ?? false;  // 默认不启用FFT
  const useLandmark = settings?.project?.useLandmark ?? false;  // 默认不启用Landmark
  const autoAlgorithm = settings?.project?.autoAlgorithm ?? true;  // 默认启用自动算法选择

  // Vision configuration
  const enableVision = envEnableVision ?? settings?.project?.enableVision ?? false;
  const visionModel = envVisionModel ?? settings?.openai?.visionModel ?? getDefaultVisionModel(baseUrl);

  // New configurations
  const proxy = envProxy ?? settings?.openai?.proxy;
  const reviewMode = settings?.reviewMode ?? { enabled: false };
  const eventSystem = settings?.eventSystem ?? { enabled: false };

  // 🔍 配置验证
  const tempConfig = {
    apiKey,
    baseUrl,
    endpoint,
    model,
    functionCallingEnabled,
    executionMode,
    supportsResponseFormat,
    useFFT,
    useLandmark,
    autoAlgorithm,
    enableVision,
    visionModel,
    proxy,
    reviewMode,
    eventSystem,
  };

  const validationErrors = validateConfig(tempConfig);

  // 如果有致命错误，显示并退出
  const criticalErrors = validationErrors.filter(e => e.critical);
  if (criticalErrors.length > 0) {
    displayValidationErrors(validationErrors);
    // 终止程序（在验证器中已经调用process.exit(1)）
    throw new Error('Configuration validation failed');
  }

  // 显示配置摘要（仅在验证通过时）
  if (process.env.NEWMA_SHOW_CONFIG_SUMMARY !== 'false') {
    console.log(getConfigSummary(tempConfig));
    console.log(''); // 空行分隔
  }

  return {
    apiKey,
    baseUrl,
    endpoint,
    model,
    functionCallingEnabled,
    executionMode,
    supportsResponseFormat,
    useFFT,
    useLandmark,
    autoAlgorithm,
    enableVision,
    visionModel,
    proxy,
    reviewMode,
    eventSystem
  };
}

/** 根据提供商返回默认视觉模型 */
function getDefaultVisionModel(baseUrl: string): string {
  // 检测是否为 OpenAI
  if (baseUrl.includes('api.openai.com') || baseUrl.includes('openai.com')) {
    return 'gpt-4o';  // OpenAI 的视觉模型
  }
  // 检测是否为 GLM (智谱)
  if (baseUrl.includes('bigmodel.cn')) {
    return 'glm-4v';  // GLM 的视觉模型
  }
  // 其他提供商默认使用 gpt-4o 兼容模型
  return 'gpt-4o';
}

/** Newma 完整配置 */
export interface NewmaConfig extends Config {
  precipitation?: {
    enabled?: boolean;  // 是否启用经验沉淀系统（默认 true）
    schedule?: string;  // Cron 表达式（默认 "0 2 * * *"）
    confidenceThreshold?: number;  // 置信度阈值（默认 0.6）
    maxDailySkills?: number;  // 每日最大生成数量（默认 5）
    draftRetentionDays?: number;  // 草稿保留天数（默认 30）
    autoApproveBelow?: number;  // 低于此阈值自动批准（可选）
    autoRejectAbove?: number;  // 高于此阈值自动拒绝（可选）
    analysisDays?: number;  // 分析数据时间范围（天数，默认 7）
  };
  exploration?: {
    enabled?: boolean;  // 是否启用自主探索（默认 true）
    schedule?: string;  // Cron 表达式（默认每4小时）
    domains?: string[];  // 探索领域（默认全部）
    maxActionsPerDomain?: number;  // 每个领域最大动作数（默认 3）
    actionTimeout?: number;  // 单个动作超时时间（毫秒，默认 30000）
    logRetentionDays?: number;  // 日志保留天数（默认 30）
    maxLogSize?: number;  // 最大日志大小（MB，默认 100）
  };
  intentRecognition?: {
    enabled?: boolean;  // 是否启用意图识别（默认 false）
    autoRedirect?: boolean;  // 是否自动重定向到合适的模式（默认 true）
    confidenceThreshold?: number;  // 置信度阈值（默认 0.6）
    autoRedirectQuestions?: boolean;  // 是否自动重定向简单问题到 /chat（默认 true）
  };
}

/** 获取项目配置（从 settings.json） */
export function getProjectSettings(): SettingsConfig['project'] {
  const settings = loadSettingsFile();
  return settings?.project ?? {};
}

/** 获取 MCP 配置（从 settings.json） */
export function getMCPConfig(): { enabled: boolean; servers: Record<string, MCPServerConfig> } {
  const settings = loadSettingsFile();
  const mcpConfig = settings?.mcp;

  return {
    enabled: mcpConfig?.enabled ?? false,
    servers: mcpConfig?.servers ?? {},
  };
}

/** 获取沉淀系统配置（从 settings.json） */
export function getPrecipitationConfig(): SettingsConfig['precipitation'] {
  const settings = loadSettingsFile();
  return settings?.precipitation ?? {};
}

/** 获取意图识别配置（从 settings.json） */
export function getIntentRecognitionConfig(): SettingsConfig['intentRecognition'] {
  const settings = loadSettingsFile();
  return settings?.intentRecognition ?? {};
}

/** 获取自主探索配置（从 settings.json） */
export function getExplorationConfig(): SettingsConfig['exploration'] {
  const settings = loadSettingsFile();
  return settings?.exploration ?? {};
}

/** 获取Review模式配置（从 settings.json） */
export function getReviewModeConfig(): SettingsConfig['reviewMode'] {
  const settings = loadSettingsFile();
  return settings?.reviewMode ?? { enabled: false };
}

/** 获取事件系统配置（从 settings.json） */
export function getEventSystemConfig(): SettingsConfig['eventSystem'] {
  const settings = loadSettingsFile();
  return settings?.eventSystem ?? { enabled: false };
}

/** 获取代理配置（从 settings.json 或环境变量） */
export function getProxyConfig(): string | undefined {
  const settings = loadSettingsFile();
  return settings?.openai?.proxy ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? process.env.ALL_PROXY;
}
