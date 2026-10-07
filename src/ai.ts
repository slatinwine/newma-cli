// src/ai.ts
import fetch from 'node-fetch';
import chalk from 'chalk';
import { AIResponse, ImageReference, MessageContent, ImageContent, TextContent } from './types';
import { Config } from './config';
import { buildSystemPrompt } from './prompt';
import { ExecutionRecord } from './history';
import { Permission } from './tools/types';
import { CompressionManager, CompressionConfig } from './compressor';
import { generatePlansWithToT, PlanAlternatives } from './ultrathink/planner';
import { ThoughtTree } from './ultrathink/types';
import { formatThoughtTree, formatPlanAlternatives } from './ultrathink/utils';
import { ToolRegistry } from './tools/registry';
import { ToolExecutor } from './executor-v2';
import { ParallelToolExecutor, ToolCall as ParallelToolCall, ToolExecutionResult } from './tools/parallelExecutor';
import { SimpleSkillManager, SimpleSkill } from './skills/simple-loader';
import { skillsToOpenAITools, filterSkillsByAllowedTools } from './skills/tool-converter';
import { renderMarkdown } from './markdown-renderer';
import { HookType } from './hooks/types';
import { getGlobalAICache, createAIRequest } from './cache/ai-cache';
import { httpsAgent } from './http-agent';
import { MemoCliPlugin } from './loop/plugins/memo-cli-plugin';
import * as path from 'path';
import { extractImageReferences, loadImageAsBase64, generateDataURL, detectImageType, estimateImageTokens, compressImage } from './utils/image-processor';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Vision/Multimodal Support Types
 */
interface ImageData {
  absolutePath: string;
  base64: string;
  dataURL: string;
  type: string;
  estimatedTokens: number;
}

/**
 * 🔥 创建HTTP代理agent(如果配置了)
 * @param config 配置对象
 * @returns agent实例或undefined
 */
export function createProxyAgent(config: Config): any {
  if (!config.proxy) {
    return undefined;
  }

  try {
    return new HttpsProxyAgent(config.proxy);
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Failed to create proxy agent: ${error}`));
    return undefined;
  }
}

/**
 * 构建多模态消息内容（文本 + 图片）
 * @param text 文本内容
 * @param images 图片引用数组
 * @param projectRoot 项目根目录
 * @returns 多模态消息内容
 */
export async function buildMultimodalMessage(
  text: string,
  images: ImageReference[],
  projectRoot: string
): Promise<MessageContent> {
  // 如果没有图片，返回纯文本
  if (!images || images.length === 0) {
    return text;
  }

  const content: (TextContent | ImageContent)[] = [];
  let totalImageTokens = 0;
  const MAX_IMAGE_SIZE = 2048; // 最大尺寸

  // 添加图片内容
  for (const imageRef of images) {
    if (!imageRef.exists) {
      console.warn(`⚠️  Image not found: ${imageRef.path}, skipping...`);
      continue;
    }

    try {
      // 加载图片
      let base64 = loadImageAsBase64(imageRef.absolutePath);
      const imageType = imageRef.type || detectImageType(imageRef.absolutePath) || 'png';

      // 压缩图片
      console.log(`📷 Compressing image: ${imageRef.path}...`);
      base64 = await compressImage(base64, MAX_IMAGE_SIZE, imageType);

      const dataURL = generateDataURL(base64, imageType);
      const estimatedTokens = estimateImageTokens(base64);

      totalImageTokens += estimatedTokens;

      // 添加图片到内容数组
      content.push({
        type: 'image_url',
        image_url: {
          url: dataURL
        }
      } as ImageContent);

      console.log(`📷 Loaded image: ${imageRef.path} (~${estimatedTokens} tokens)`);
    } catch (error) {
      console.error(`❌ Failed to load image ${imageRef.path}: ${error}`);
    }
  }

  // 添加文本内容（如果没有，提供默认提示）
  const cleanText = text.trim() || 'Please analyze the image(s) above.';
  content.push({
    type: 'text',
    text: cleanText
  } as TextContent);

  if (totalImageTokens > 0) {
    console.log(`📊 Total image tokens: ~${totalImageTokens}`);
  }

  return content;
}

/**
 * 从用户输入中提取图片引用并构建多模态消息
 * @param userInput 用户输入文本
 * @param projectRoot 项目根目录
 * @returns { message: MessageContent, images: ImageReference[] }
 */
export function parseUserInputWithImages(
  userInput: string,
  projectRoot: string
): { message: MessageContent; images: ImageReference[] } {
  // 提取图片引用
  const images = extractImageReferences(userInput, projectRoot);

  // 如果找到图片引用，移除 @ 符号标记（保留文件名作为上下文）
  let cleanedText = userInput;
  if (images.length > 0) {
    cleanedText = userInput.replace(/@([\w\-.\/]+\.(png|jpg|jpeg|gif|webp|bmp))/gi, '$1');
  }

  return {
    message: cleanedText, // 实际的多模态消息在后续异步构建
    images
  };
}

/**
 * 获取 Memo 上下文
 *
 * 从 memo 中检索相关决策、代码和任务，增强 AI 上下文
 *
 * @param requirement 用户需求
 * @param memoPlugin Memo 插件实例（可选）
 * @returns 格式化的上下文字符串
 */
async function getMemoContext(
  requirement: string,
  memoPlugin?: MemoCliPlugin
): Promise<string> {
  if (!memoPlugin) {
    return '';
  }

  try {
    let context = '\n\n📚 PROJECT MEMORY:\n';

    // 搜索相关决策
    const decisions = await memoPlugin.searchDecisions(requirement);
    if (decisions.length > 0) {
      context += '\nRelevant Decisions:\n';
      decisions.slice(0, 5).forEach((d) => {
        const date = new Date(d.timestamp).toLocaleDateString();
        context += `- [${date}] ${d.title}\n`;
        context += `  ${d.content.substring(0, 100)}${d.content.length > 100 ? '...' : ''}\n`;
        if (d.tags.length > 0) {
          context += `  Tags: ${d.tags.join(', ')}\n`;
        }
      });
      context += `\nFound ${decisions.length} relevant decision(s)\n`;
    }

    // 查找相关代码
    const relatedCode = await memoPlugin.findRelated(requirement);
    if (relatedCode.length > 0) {
      context += '\nRelated Code:\n';
      relatedCode.slice(0, 5).forEach(({ file, info }) => {
        context += `- ${file}`;
        if (info.classes.length > 0) {
          context += ` (classes: ${info.classes.join(', ')})`;
        }
        context += '\n';
      });
      context += `\nFound ${relatedCode.length} relevant file(s)\n`;
    }

    // 🔥 新增：搜索相关任务
    const tasks = await memoPlugin.searchTasks(requirement);
    if (tasks.length > 0) {
      context += '\nRelated Tasks:\n';
      tasks.slice(0, 5).forEach((t) => {
        const date = new Date(t.createdAt).toLocaleDateString();
        context += `- [${date}] ${t.status.toUpperCase()} | ${t.mode}\n`;
        context += `  ${t.requirement.substring(0, 80)}${t.requirement.length > 80 ? '...' : ''}\n`;
      });
      context += `\nFound ${tasks.length} relevant task(s)\n`;
    }

    // 🆕 新增：项目上下文
    const projectSummary = await memoPlugin.getProjectSummary();
    if (projectSummary) {
      context += '\n' + projectSummary;
    }

    // 🎯 Phase 9: 新增 - 相似推理链搜索
    // 根据当前模式（plan/verify）搜索历史推理
    const taskType = requirement.includes('验证') || requirement.includes('verify') ? 'verification' : 'planning';

    // 获取推理上下文摘要
    const reasoningSummary = await memoPlugin.getReasoningAIContext(requirement, taskType);
    if (reasoningSummary) {
      context += '\n' + reasoningSummary;
    }

    // 🔥 Phase 1-5: BM25搜索结果 + 排名上下文
    // 使用新的 MemoryContextInjector 获取高质量的相关记忆
    try {
      const searchContext = await memoPlugin.getMemoryContext(requirement, 1500);
      if (searchContext) {
        context += '\n' + searchContext;
      }
    } catch (error) {
      // 静默失败，不影响主流程
    }

    // 🎮 Galgame 上下文：会话 flags（事件标记）+ 被弃分支结论（前世记忆）
    try {
      const branchContext = await memoPlugin.getActiveBranchContext();
      if (branchContext) {
        context += branchContext;
      }
    } catch (error) {
      // 静默失败，不影响主流程
    }

    // 🕘 活跃对话回放：读档/续聊后当前会话的消息流进入 AI 上下文
    // （存档系统的最后一公里：恢复的不只是状态，还有对话记忆）
    try {
      const conversationContext = await memoPlugin.getActiveConversationContext();
      if (conversationContext) {
        context += conversationContext;
      }
    } catch (error) {
      // 静默失败，不影响主流程
    }

    return context;
  } catch (error) {
    // 静默失败，不影响主流程
    console.log(chalk.gray(`[Memo] Failed to get context: ${error}`));
    return '';
  }
}

/**
 * 智能提取 JSON 字符串
 *
 * 尝试从可能包含额外文本的响应中提取有效的 JSON 对象
 * 使用花括号计数来找到第一个完整的 JSON 对象
 *
 * Exported for use in ReAct verification and other modules
 */
export function extractJSON(rawMessage: string): string | null {
  // 首先尝试直接解析整个消息
  try {
    JSON.parse(rawMessage);
    return rawMessage;
  } catch {
    // 不是纯 JSON，继续尝试提取
  }

  // 使用花括号计数来提取第一个完整的 JSON 对象
  let braceCount = 0;
  let startIndex = -1;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < rawMessage.length; i++) {
    const char = rawMessage[i];

    // 处理转义字符
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    // 处理字符串内部
    if (char === '"') {
      inString = !inString;
      continue;
    }

    // 只在字符串外部计数花括号
    if (!inString) {
      if (char === '{') {
        if (startIndex === -1) {
          startIndex = i; // 记录第一个 { 的位置
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          // 找到完整的 JSON 对象
          const jsonStr = rawMessage.substring(startIndex, i + 1);

          // 验证是否是有效的 JSON
          try {
            JSON.parse(jsonStr);
            return jsonStr;
          } catch {
            // 提取的不是有效 JSON，继续寻找
            startIndex = -1;
            braceCount = 0;
          }
        }
      }
    }
  }

  // 如果没有找到完整的 JSON，返回 null
  return null;
}

/**
 * Detect if current AI provider supports Function Calling API
 * Based on baseUrl patterns and model capabilities
 *
 * @param config - Kode configuration
 * @returns true if Function Calling is supported
 */
export function supportsFunctionCalling(config: Config): boolean {
  // 1. Explicit setting takes precedence
  if (config.functionCallingEnabled !== undefined) {
    return config.functionCallingEnabled;
  }

  // 2. Detect by provider baseUrl
  const baseUrl = config.baseUrl || '';

  // OpenAI officially supports Function Calling
  if (baseUrl.includes('api.openai.com')) {
    return true;
  }

  // Known compatible providers
  const compatiblePatterns = [
    'open.bigmodel.cn',  // 智谱AI (Zhipu AI)
    'api.anthropic.com', // Anthropic (when available)
  ];

  return compatiblePatterns.some(pattern => baseUrl.includes(pattern));
}

/**
 * Create a default tool registry with search tools
 * This ensures search tools are always available even when --use-tools is not enabled
 *
 * Search tools are safe to include by default because:
 * - They are read-only operations
 * - They require NETWORK_ACCESS permission
 * - They are essential for AI to gather information
 *
 * @returns ToolRegistry with search tools registered
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Import search tools dynamically to avoid circular dependencies
  try {
    // Dynamic import to avoid loading search dependencies unless needed
    const { searchTool } = require('./tools/builtin/search');
    const { searchAndFetchTool } = require('./tools/builtin/search-and-fetch');
    const { webScrapeTool } = require('./tools/builtin/web-scrape');

    registry.register(searchTool);
    registry.register(searchAndFetchTool);
    registry.register(webScrapeTool);

    console.log(chalk.gray('✅ Search tools enabled by default\n'));
  } catch (error) {
    console.log(chalk.yellow('⚠️  Warning: Could not load search tools\n'));
  }

  return registry;
}

/**
 * Build OpenAI Function Calling tool definitions from ToolRegistry
 * Converts Tool objects to OpenAI API format
 *
 * Enhanced to include skills from SimpleSkillManager.
 *
 * @param registry - Tool registry containing all registered tools
 * @param skillManager - Optional skill manager to include skills
 * @returns Array of tool definitions in OpenAI Function Calling format
 */
export function buildToolDefinitions(
  registry: ToolRegistry,
  skillManager?: SimpleSkillManager
): any[] {
  const tools = registry.list();
  const toolDefinitions = tools.map(tool => {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    // Build JSON Schema for each parameter
    for (const param of tool.parameters || []) {
      const paramDef: any = {
        type: param.type,
        description: param.description || `Parameter: ${param.name}`,
      };

      // Add default value if specified
      if (param.default !== undefined) {
        paramDef.default = param.default;
      }

      // Add enum values if specified
      if (param.values && param.values.length > 0) {
        paramDef.enum = param.values;
      }

      // Add array item type if applicable
      if (param.type === 'array') {
        paramDef.items = {
          type: 'string', // Default item type
        };
      }

      properties[param.name] = paramDef;

      // Track required parameters
      if (param.required) {
        required.push(param.name);
      }
    }

    // Return OpenAI Function Calling format
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties,
          required: required.length > 0 ? required : undefined,
        },
      },
    };
  });

  // Add skills if skill manager is provided
  if (skillManager) {
    const allSkills = skillManager.getAllSkills();

    // Get available tool names for filtering
    const availableToolNames = tools.map(t => t.name);

    // Filter skills by allowed-tools
    const enabledSkills = filterSkillsByAllowedTools(allSkills, availableToolNames);

    // Convert skills to OpenAI tool definitions
    const skillTools = skillsToOpenAITools(enabledSkills);

    // Combine tools and skills
    return [...toolDefinitions, ...skillTools];
  }

  return toolDefinitions;
}

/**
 * Ultrathink options for enhanced AI reasoning
 */
export interface UltrathinkOptions {
  enabled?: boolean;
  numAlternatives?: number;
  searchStrategy?: 'bfs' | 'dfs' | 'beam';
  maxDepth?: number;
  beamWidth?: number;
  showThoughts?: boolean;
  showRejected?: boolean;
}

/**
 * Extended AI response with ultrathink data
 */
export interface ExtendedAIResponse extends AIResponse {
  thoughtTree?: ThoughtTree;
  planAlternatives?: PlanAlternatives;
  ultrathinkEnabled?: boolean;
  content?: string; // Raw response content for think mode
  type?: 'task' | 'analysis' | 'error' | 'tool_calls' | 'choice'; // Response type (added 'choice')
  message?: string; // Error message or analysis result
  toolCalls?: any[]; // Tool calls from Function Calling API
  // Adventure mode fields
  scenario?: string; // Scenario description
  choices?: any[]; // Choice options (from AdventureResponse)
  // Landmark Counting fields
  landmarkPlan?: import('./landmark/types').LandmarkPlan; // Landmark-based planning result
}

/**
 * 简单的聊天模式 - 直接对话，不需要JSON响应
 *
 * 支持两种模式：
 * 1. FFT模式（config.useFFT=true）：快速决策树，预设决策路径
 * 2. 标准模式（默认）：AI自由决策是否使用工具
 *
 * @param config          OpenAI 配置
 * @param message         用户消息
 * @param signal          AbortSignal 用于取消请求（可选）
 * @param userProfile     用户侧写信息（可选）
 * @param toolRegistry    工具注册表（可选，如果未提供则使用默认搜索工具）
 * @param toolExecutor    工具执行器（可选，用于执行工具调用）
 */
export async function chatAI(
  config: Config,
  userMessage: string,
  signal?: AbortSignal,
  userProfile?: string,
  toolRegistry?: ToolRegistry,
  toolExecutor?: ToolExecutor,
  hookSystem?: any, // TODO: Add proper type
  frontend?: any, // Frontend for output (WebFrontend)
  imageRefs?: ImageReference[], // NEW: Image references for multimodal input
  projectRoot?: string, // NEW: Project root for resolving image paths
  skillManager?: SimpleSkillManager, // NEW: Skill manager for AI tool integration
  memoPlugin?: MemoCliPlugin // NEW: Memo plugin for memory context
): Promise<string> {
  // FFT Mode: Use fast decision tree for quick decisions
  if (config.useFFT === true) {
    const { chatAIWithFFT } = await import('./fft/chat-fft');
    return await chatAIWithFFT(
      config,
      userMessage,
      signal,
      userProfile,
      toolRegistry,
      toolExecutor,
      hookSystem,
      frontend,
      imageRefs,
      projectRoot,
      skillManager,
      memoPlugin // 🔥 Pass memoPlugin to FFT mode
    );
  }

  // Standard Mode: AI decides freely (original logic below)
  const endpoint = config.endpoint ||
    `${(config.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')}/v1/chat/completions`;

  // Load chat mode system prompt from file
  const { PromptType, loadSystemPrompt } = await import('./prompt');

  // Load base system prompt
  let systemPrompt = loadSystemPrompt(PromptType.CHAT);

  // Replace placeholders with current time context
  const currentDate = new Date();
  systemPrompt = systemPrompt.replace(/\{CURRENT_DATE\}/g, currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
  systemPrompt = systemPrompt.replace(/\{CURRENT_YEAR\}/g, String(currentDate.getFullYear()));
  systemPrompt = systemPrompt.replace(/\{CURRENT_MONTH\}/g, String(currentDate.getMonth() + 1));

  // Add user profile if available
  if (userProfile) {
    systemPrompt += `\n\nUSER PROFILE:\n${userProfile}\n\nIMPORTANT: Adapt your responses to match the user's language preference and communication style as described in their profile.`;
  }

  // FIX: Ensure search tools are available if no registry provided
  const effectiveToolRegistry = toolRegistry || createDefaultToolRegistry();

  // Build user message content (with or without images)
  let userMessageContent: MessageContent = userMessage;

  // If vision is enabled and images are provided, build multimodal message
  if (config.enableVision && imageRefs && imageRefs.length > 0 && projectRoot) {
    console.log(chalk.cyan('📷 Building multimodal message with images...'));
    userMessageContent = await buildMultimodalMessage(userMessage, imageRefs, projectRoot);

    // Switch to vision model if configured
    if (config.visionModel) {
      console.log(chalk.gray(`🔭 Using vision model: ${config.visionModel}`));
    }
  }

  // Add tools if available for Function Calling (but NOT for vision requests)
  const hasTools = effectiveToolRegistry && effectiveToolRegistry.list().length > 0;
  // IMPORTANT: Don't include tools when sending images (most vision models don't support function calling)
  const includeTools = hasTools && !(config.enableVision && imageRefs && imageRefs.length > 0);

  // 🚀 AI 缓存：检查是否有缓存的响应
  const aiCache = getGlobalAICache();

  console.log(chalk.gray('📤 Sending message to AI...'));

  const startTime = Date.now();
  const MAX_TOOL_ITERATIONS = includeTools ? 10 : 1; // Only iterate if tools are included

  // Initialize message history (only create once, avoiding duplication)
  let messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessageContent },
  ];

  // 🔥 添加 Memo 上下文（相关决策和代码）
  if (memoPlugin) {
    try {
      const memoContext = await getMemoContext(userMessage, memoPlugin);
      if (memoContext) {
        messages[1].content = userMessageContent + memoContext;
      }
    } catch (error) {
      // 静默失败，不影响主流程
      console.log(chalk.gray(`[Memo] Failed to get context: ${error}`));
    }
  }

  // 🔥 计算动态 max_tokens（用于缓存和请求）
  const userMessageLength = userMessageContent?.toString().length || 0;
  let dynamicMaxTokens: number;

  if (userMessageLength < 50) {
    dynamicMaxTokens = 2000;
  } else if (userMessageLength < 200) {
    dynamicMaxTokens = 4000;
  } else if (userMessageLength < 1000) {
    dynamicMaxTokens = 8000;
  } else {
    dynamicMaxTokens = 16000;
  }

  // 检查缓存（在循环开始前检查）
  try {
    const cachedResponse = await aiCache.get(
      { model: config.model, messages, temperature: 0.7, maxTokens: dynamicMaxTokens }
    );

    if (cachedResponse) {
      console.log(chalk.gray(`✨ [AI Cache] Using cached response (saved ${Date.now() - cachedResponse.timestamp}ms ago)`));
      return cachedResponse.content || '';
    }
  } catch (error) {
    console.log(chalk.gray(`⚠️  [AI Cache] Cache check failed: ${error}`));
    // 继续执行 API 调用
  }

  let totalTokens = 0;
  let iteration = 0;

  // Multi-round tool calling loop
  let parallelExec: ParallelToolExecutor | null = null;
  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;

    // Build request body with tools for each iteration
    const requestPayload: any = {
      model: config.model,
      temperature: 0.7,
      max_tokens: dynamicMaxTokens,  // 🔥 使用预先计算的动态值
      messages,
    };

    // CRITICAL: Include tools in every request so AI can use them
    // Enhanced to include skills from skillManager
    if (hasTools) {
      requestPayload.tools = buildToolDefinitions(effectiveToolRegistry, skillManager);
    }

    // Execute beforeAIRequest hooks
    if (hookSystem && hookSystem.hasHooks('beforeAIRequest')) {
      await hookSystem.execute('beforeAIRequest', {
        data: {
          mode: 'chat',
          requestBody: requestPayload,
          endpoint,
        },
        session: null,
        config,
      });
    }

    const fetchResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal,
      agent: endpoint.startsWith('https') ? (createProxyAgent(config) || httpsAgent) : undefined, // 🔥 支持代理 + 连接池复用
    });

    if (!fetchResponse.ok) {
      const err = await fetchResponse.text();
      throw new Error(`OpenAI API error: ${fetchResponse.status} - ${err}`);
    }

    const data = (await fetchResponse.json()) as any;

    // Execute afterAIResponse hooks
    if (hookSystem && hookSystem.hasHooks('afterAIResponse')) {
      await hookSystem.execute('afterAIResponse', {
        data: {
          mode: 'chat',
          endpoint,
          response: data,
          duration: Date.now() - startTime,
        },
        session: null,
        config,
      });
    }

    const responseMessage = data.choices?.[0]?.message;

    // Track token usage
    if (data.usage) {
      totalTokens += data.usage.total_tokens;
    }

    // Add response to history
    messages.push(responseMessage);

    // Check if AI made tool calls
    if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      const duration = Date.now() - startTime;
      console.log(chalk.gray(`📥 Received tool call request in ${duration}ms`));

      // If toolExecutor is provided, execute tools
      if (toolExecutor) {
        console.log(chalk.cyan(`\n⚙️  Executing ${responseMessage.tool_calls.length} tool call(s)...\n`));

        // Build parallel executor from registered tools (lazy, once per call batch)
        const registry = toolExecutor.getRegistry();
        const registeredTools = registry.list();
        const simpleTools = registeredTools.map(t => ({
          name: t.name,
          description: t.description,
          handler: (params: Record<string, unknown>) =>
            toolExecutor.executeToolCall({ tool: t.name, parameters: params, id: '__parallel__' }),
        }));
        if (!parallelExec) {
          parallelExec = new ParallelToolExecutor(simpleTools);
        }

        // Convert API tool_calls to parallelExecutor format
        const parallelCalls: ParallelToolCall[] = responseMessage.tool_calls.map((call: any) => ({
          name: call.function.name,
          parameters: (() => { try { return JSON.parse(call.function.arguments); } catch { return {}; } })(),
          id: call.id,
        }));

        // Log all tool calls
        for (const call of responseMessage.tool_calls) {
          console.log(`  ⚙️  [${chalk.cyan(call.function.name)}] ${call.function.arguments}`);
        }

        // Execute with dependency-aware parallel scheduling
        let execResults: ToolExecutionResult[];
        try {
          execResults = await parallelExec.execute(parallelCalls);
        } catch (e: any) {
          // Fallback: if parallel executor fails (e.g. unregistered tool), use original sequential execution
          console.log(chalk.yellow(`  ⚠️  Parallel executor failed (${e.message}), falling back to sequential`));
          execResults = [];
          for (const call of parallelCalls) {
            try {
              const result = await toolExecutor.executeToolCall({ tool: call.name, parameters: call.parameters, id: call.id });
                  // Apply metadata formatting (same as parallel path)
              if (result.success && result.output) {
                let content = result.output;
                if (result.metadata && (result.metadata as any).results) {
                  content += '\n\n搜索结果:\n';
                  (result.metadata as any).results.forEach((r: any, i: number) => {
                    content += `\n[${i + 1}] ${r.title}\n    URL: ${r.url}\n    摘要: ${r.snippet}\n`;
                  });
                } else if (result.metadata && (result.metadata as any).text) {
                  content += '\n\n页面内容:\n';
                  content += `标题: ${(result.metadata as any).title}\nURL: ${(result.metadata as any).url}\n内容长度: ${(result.metadata as any).text_length} 字符\n\n${(result.metadata as any).text}\n`;
                } else if (result.metadata && Object.keys(result.metadata).length > 0) {
                  content += '\n\nMetadata:\n' + JSON.stringify(result.metadata, null, 2);
                }
                result.output = content;
              }
              execResults.push({ id: call.id, name: call.name, result, duration: 0, startTime: new Date(), endTime: new Date() });
            } catch (err: any) {
              execResults.push({ id: call.id, name: call.name, result: { success: false, error: err.message }, duration: 0, startTime: new Date(), endTime: new Date() });
            }
          }
        }

        // Format results back to API message format
        const toolResults = execResults.map((execResult) => {
          const toolName = chalk.cyan(execResult.name);
          const { result } = execResult;

          try {
            if (result.success) {
              console.log(chalk.green(`  ✅ [${toolName}] 成功 (${execResult.duration}ms)`));
              const output = result.output?.slice(0, 200) || 'Done';
              if ((result.output?.length || 0) > 200) {
                console.log(chalk.gray(`  ${output}... (${result.output?.length} chars total)`));
              } else {
                console.log(chalk.gray(`  ${output}`));
              }

              let content = result.output || 'Success';

              if (result.metadata && (result.metadata as any).results) {
                content += '\n\n搜索结果:\n';
                (result.metadata as any).results.forEach((r: any, i: number) => {
                  content += `\n[${i + 1}] ${r.title}\n`;
                  content += `    URL: ${r.url}\n`;
                  content += `    摘要: ${r.snippet}\n`;
                });
              } else if (result.metadata && (result.metadata as any).text) {
                content += '\n\n页面内容:\n';
                content += `标题: ${(result.metadata as any).title}\n`;
                content += `URL: ${(result.metadata as any).url}\n`;
                content += `内容长度: ${(result.metadata as any).text_length} 字符\n`;
                content += `\n${(result.metadata as any).text}\n`;
              } else if (result.metadata && Object.keys(result.metadata).length > 0) {
                content += '\n\nMetadata:\n' + JSON.stringify(result.metadata, null, 2);
              }

              return { tool_call_id: execResult.id, role: 'tool', content };
            } else {
              console.log(chalk.red(`  ❌ [${toolName}] 失败: ${result.error}`));
              return { tool_call_id: execResult.id, role: 'tool', content: `Error: ${result.error}` };
            }
          } catch (error: any) {
            console.log(chalk.red(`  ❌ [${toolName}] 异常: ${error.message}`));
            let errorMsg = `Exception: ${error.message}`;
            if (error.message.includes('403')) {
              errorMsg += '\n\nHint: This page has anti-scraping protection. Try searching for alternative sources or summaries.';
            } else if (error.message.includes('404')) {
              errorMsg += '\n\nHint: This page was not found. The URL may be incorrect or the page may have been removed.';
            } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
              errorMsg += '\n\nHint: The request timed out. The server may be slow or unavailable. Try again or search for alternative sources.';
            }
            return { tool_call_id: execResult.id, role: 'tool', content: errorMsg };
          }
        });

        // Add tool results to message history
        messages.push(...toolResults);

        console.log(chalk.gray('\n📤 Sending tool results back to AI...\n'));

        // Continue the loop to let AI decide whether to make more tool calls or answer
        continue;
      } else {
        // No toolExecutor provided
        console.log(chalk.yellow('⚠️  AI requested to use tools, but no tool executor was provided.'));
        console.log(chalk.gray('Tool calls:'), JSON.stringify(responseMessage.tool_calls, null, 2));
        return 'AI requested to use tools, but tool execution is not available in this context.';
      }
    }

    // No more tool calls - this is the final answer
    if (!responseMessage?.content) {
      return 'Error: AI did not provide a final response.';
    }

    const totalDuration = Date.now() - startTime;

    // Display final response
    const filteredMessage = filterThinkingProcess(responseMessage.content);

    // Use frontend if available, otherwise console.log
    if (frontend) {
      frontend.writeOutput(filteredMessage);
    } else {
      console.log(chalk.gray(`📥 Received final response in ${totalDuration}ms\n`));
      const renderedMessage = renderMarkdown(filteredMessage);
      console.log(renderedMessage);
    }

    console.log(chalk.gray(`\n📊 Total Tokens: ${totalTokens} (including tool calls)`));

    // 🚀 AI 缓存：保存成功的响应
    try {
      await aiCache.set(
        { model: config.model, messages, temperature: 0.7, maxTokens: dynamicMaxTokens },
        filteredMessage,
        1000 * 60 * 10  // 10 分钟 TTL
      );
      console.log(chalk.gray(`💾 [AI Cache] Response cached for 10 minutes`));
    } catch (error) {
      console.log(chalk.gray(`⚠️  [AI Cache] Failed to save cache: ${error}`));
      // 不影响主流程
    }

    return filteredMessage;
  }

  // Exceeded max iterations - try one more time without tools to force an answer
  console.log(chalk.yellow('\n⚠️  Reached maximum search iterations, requesting final answer...\n'));

  const finalRequest = {
    model: config.model,
    temperature: 0.7,
    max_tokens: 16000,  // Increased from 2048 for consistency
    messages: [
      ...messages,
      {
        role: 'system',
        content: 'You have reached the maximum number of tool calls. You MUST now provide a final answer based on the information you have gathered. Do NOT make any more tool calls. Synthesize all the search results and page content you have collected into a comprehensive answer.'
      }
    ],
  };

  try {
    const finalResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalRequest),
      signal,
      agent: endpoint.startsWith('https') ? (createProxyAgent(config) || httpsAgent) : undefined, // 🔥 支持代理 + 连接池复用
    });

    if (finalResponse.ok) {
      const finalData = await finalResponse.json();
      const finalMessage = finalData.choices?.[0]?.message;

      if (finalMessage?.content) {
        const totalDuration = Date.now() - startTime;
        const filteredMessage = filterThinkingProcess(finalMessage.content);

        // Use frontend if available, otherwise console.log
        if (frontend) {
          frontend.writeOutput(filteredMessage);
        } else {
          console.log(chalk.gray(`📥 Received final response in ${totalDuration}ms\n`));
          const renderedMessage = renderMarkdown(filteredMessage);
          console.log(renderedMessage);
        }

        if (finalData.usage) {
          totalTokens += finalData.usage.total_tokens;
        }
        console.log(chalk.gray(`\n📊 Total Tokens: ${totalTokens} (including tool calls)`));

        return filteredMessage;
      }
    }
  } catch (error) {
    console.log(chalk.red('Error getting final response:', error));
  }

  return 'Error: Unable to get final answer after multiple search attempts. The query may be too complex or the search results may be insufficient.';
}

/**
 * 过滤掉思考过程，只保留最终答案
 *
 * 识别模式：
 * 1. 编号列表 (1. 2. 3. 等) - 思考步骤
 * 2. 包含 "思考" "分析" "步骤" 等关键词的行
 * 3. 只保留最后的简洁答案
 */
function filterThinkingProcess(response: string): string {
  const lines = response.split('\n');
  const filteredLines: string[] = [];
  let inThinkingProcess = false;
  let hasSeenThinkingProcess = false;

  for (const line of lines) {
    // 检测是否是思考过程的开始（编号列表）
    const numberedStepMatch = line.match(/^\s*\d+\.\s+/);

    // 检测是否包含思考关键词
    const thinkingKeywords = ['识别', '分析', '确定', '起草', '选择', '格式化', '最终输出'];
    const hasThinkingKeyword = thinkingKeywords.some(keyword => line.includes(keyword));

    // 如果是编号步骤或包含思考关键词，标记为思考过程
    if (numberedStepMatch || (hasThinkingKeyword && line.includes('**'))) {
      inThinkingProcess = true;
      hasSeenThinkingProcess = true;
      continue;
    }

    // 如果在思考过程中，跳过这些行
    if (inThinkingProcess) {
      // 检查是否到达最终答案（空行或非列表行）
      if (line.trim() === '' || (!numberedStepMatch && !hasThinkingKeyword)) {
        inThinkingProcess = false;
        // 不要添加空行
        continue;
      }
      continue;
    }

    // 添加非思考过程的行
    filteredLines.push(line);
  }

  // 如果整个响应都是思考过程，返回最后一行或最后几行
  if (filteredLines.length === 0 && hasSeenThinkingProcess) {
    // 尝试找到最后的答案（通常是最后几行）
    const allLines = response.split('\n').filter(l => l.trim());
    if (allLines.length > 0) {
      // 返回最后几行（通常是最终答案）
      const lastLines = allLines.slice(-3);
      return lastLines.join('\n');
    }
  }

  const filtered = filteredLines.join('\n').trim();

  // 如果过滤后为空，返回原始响应
  if (!filtered) {
    return response.trim();
  }

  return filtered;
}

/**
 * Function Calling API response types
 */
export interface FunctionCallingToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface FunctionCallingResponse {
  type: 'tool_calls' | 'text' | 'error';
  toolCalls?: FunctionCallingToolCall[];
  content?: string;
  done?: boolean;
  message?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  duration?: number;
}

/**
 * Call AI with OpenAI Function Calling API (Phase 2 - Core Implementation)
 *
 * This function implements the full Function Calling logic:
 * 1. Sends tools definition to OpenAI API
 * 2. Receives tool_calls or text response
 * 3. Returns structured response for execution
 *
 * @param config          OpenAI configuration
 * @param projectInfo     Project file tree
 * @param userRequirement User requirement
 * @param history         Message history for multi-turn conversation
 * @param registry        Tool registry
 * @param signal          AbortSignal for cancellation
 * @returns FunctionCallingResponse with tool_calls or text content
 */
export async function callAIWithFunctionCalling(
  config: Config,
  projectInfo: Record<string, string>,
  userRequirement: string,
  history: any[],
  registry: ToolRegistry,
  signal?: AbortSignal,
  skillManager?: SimpleSkillManager // NEW: Skill manager for AI tool integration
): Promise<FunctionCallingResponse> {
  // Build endpoint URL
  const endpoint = config.endpoint ||
    `${(config.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')}/v1/chat/completions`;

  // Build system prompt for Function Calling mode (OPTIMIZED for speed)
  const systemPrompt = `You are KODE, an AI assistant with tools.

Complete tasks efficiently using available tools.
Be concise. Keep responses under 3 sentences when possible.`;

  // Build user prompt with project context
  const fileTreeSnippet = JSON.stringify(projectInfo, null, 2);
  const userPrompt = `Project: ${fileTreeSnippet}

Task: ${userRequirement}

Use tools to complete this task.`;

  // Build tool definitions using our helper function
  // Enhanced to include skills from skillManager
  const toolDefinitions = buildToolDefinitions(registry, skillManager);

  // Build request body for Function Calling
  const requestBody: any = {
    model: config.model,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userPrompt },
    ],
    tools: toolDefinitions,
    // ❌ Do NOT use response_format with tools (they are mutually exclusive)
  };

  // Track request start time
  const startTime = Date.now();
  const apiCallStart = Date.now(); // 性能监控：API调用开始

  try {
    const fetchResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal,
    });

    const apiCallDuration = Date.now() - apiCallStart; // 性能监控：API调用耗时
    console.log(chalk.gray(`⏱️  [API] 单次调用耗时: ${apiCallDuration}ms\n`));

    if (!fetchResponse.ok) {
      const err = await fetchResponse.text();
      throw new Error(`OpenAI API error: ${fetchResponse.status} - ${err}`);
    }

    const data = await fetchResponse.json();
    const duration = Date.now() - startTime;

    // Extract usage information
    const usage = data.usage ? {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens,
    } : undefined;

    // Get the message from response
    const message = data.choices?.[0]?.message;

    if (!message) {
      return {
        type: 'error',
        message: 'No message in API response',
        duration,
        usage,
      };
    }

    // Check if AI wants to call tools
    if (message.tool_calls && message.tool_calls.length > 0) {
      return {
        type: 'tool_calls',
        toolCalls: message.tool_calls,
        done: false,
        duration,
        usage,
      };
    }

    // AI returned text content (final answer or analysis)
    if (message.content) {
      // Check if task is done
      const done = checkIfTaskDone(message.content);

      return {
        type: 'text',
        content: message.content,
        done,
        duration,
        usage,
      };
    }

    // Neither tool_calls nor content - should not happen
    return {
      type: 'error',
      message: 'API response missing both tool_calls and content',
      duration,
      usage,
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Handle AbortError
    if (error.name === 'AbortError') {
      return {
        type: 'error',
        message: 'Request was cancelled',
        duration,
      };
    }

    // Handle other errors
    console.error(chalk.red('❌ Function Calling API error:'), error.message);
    return {
      type: 'error',
      message: error.message || 'Unknown error occurred',
      duration,
    };
  }
}

/**
 * Check if AI's response indicates the task is complete
 */
function checkIfTaskDone(content: string): boolean {
  const doneKeywords = [
    'done',
    'completed',
    'finished',
    '总结',
    '完成',
    'complete',
    'successfully',
  ];

  const lowerContent = content.toLowerCase();
  return doneKeywords.some(keyword => lowerContent.includes(keyword));
}

/**
 * 调用 LLM 获得规划或验证结果。
 *
 * @param config          OpenAI 配置（apiKey、baseUrl、model）
 * @param projectInfo     当前项目的文件树（键: 相对路径, 值: 前 N 行内容）
 * @param userRequirement 用户需求描述
 * @param mode            "plan"（首次规划）或 "verify"（循环验证）
 * @param executionHistory 执行历史记录（可选，用于验证模式）
 * @param toolRegistryOrTools  工具注册表（ToolRegistry）或工具名称列表（string[]），用于 Function Calling
 * @param grantedPermissions 已授予的权限（可选）
 * @param compression     压缩配置（可选）
 * @param projectRoot     项目根目录（用于上下文压缩）
 * @param signal          AbortSignal 用于取消请求（可选）
 * @param ultrathink      Ultrathink 配置（可选，启用增强推理）
 * @param userProfile     用户侧写信息（可选）
 */
export async function callAI(
  config: Config,
  projectInfo: Record<string, string>,
  userRequirement: string,
  mode: 'plan' | 'verify' | 'think',
  executionHistory?: ExecutionRecord[],
  toolRegistryOrTools?: ToolRegistry | string[],
  grantedPermissions?: Permission[],
  compression?: CompressionConfig,
  projectRoot?: string,
  signal?: AbortSignal,
  ultrathink?: UltrathinkOptions,
  userProfile?: string,
  hookSystem?: any, // TODO: Add proper type import
  memoPlugin?: MemoCliPlugin, // NEW: Memo plugin for memory context
  skillManager?: SimpleSkillManager // NEW: Skill manager for AI tool integration
): Promise<ExtendedAIResponse> {
  // Apply compression if enabled
  let compressedProjectInfo = projectInfo;
  let compressedHistory = executionHistory;
  let compressionReport: any = null;

  if (compression && compression.enabled) {
    const compressor = new CompressionManager(compression);

    // Compress file context
    let fileContext = JSON.stringify(projectInfo, null, 2);

    if (projectRoot) {
      const contextResult = compressor.getContextCompressor().compress(
        fileContext,
        projectRoot
      );
      fileContext = contextResult.data;
    }

    // Compress history
    if (executionHistory && executionHistory.length > 0) {
      const historyResult = compressor.getHistorySummarizer().summarize(executionHistory);
      compressedHistory = historyResult.data;
    }

    // Compress file contents
    const fileMap = new Map(Object.entries(projectInfo));
    const contentResult = compressor.getContentOptimizer().optimizeMultiple(fileMap);
    compressedProjectInfo = Object.fromEntries(contentResult.data);

    // Generate compression report
    compressionReport = compressor.compressAll({
      context: fileContext,
      contextRoot: projectRoot,
      history: executionHistory,
      files: fileMap,
    }).report;
  }

  // Auto-select planning algorithm based on intent recognition
  // Only if user hasn't explicitly specified an algorithm AND autoAlgorithm is enabled
  if (mode === 'plan' && !ultrathink?.enabled && !config.useFFT && !config.useLandmark && config.autoAlgorithm !== false) {
    const { IntentRecognizer } = await import('./intent/recognizer');
    const recognizer = new IntentRecognizer(config);

    console.log(chalk.gray('🎯 [Intent Recognition] Analyzing requirement...\n'));

    try {
      const intent = await recognizer.recognizeIntent(
        userRequirement,
        compressedProjectInfo,
        false  // Use heuristics (fast) by default
      );

      if (intent.confidence >= 0.6) {
        console.log(chalk.cyan(`🎯 [Intent] Task: ${intent.taskType}`));
        console.log(chalk.cyan(`🎯 [Intent] Complexity: ${intent.complexity}`));
        console.log(chalk.cyan(`🎯 [Intent] Algorithm: ${chalk.bold(intent.recommendedAlgorithm)}`));
        console.log(chalk.cyan(`🎯 [Intent] Confidence: ${(intent.confidence * 100).toFixed(0)}%`));
        console.log(chalk.gray(`🎯 [Intent] Reasoning:\n${intent.reasoning}\n`));

        // Auto-enable the recommended algorithm
        switch (intent.recommendedAlgorithm) {
          case 'fft':
            config.useFFT = true;
            console.log(chalk.green('✅ [Intent] Auto-enabled FFT mode\n'));
            break;
          case 'landmark':
            config.useLandmark = true;
            console.log(chalk.green('✅ [Intent] Auto-enabled Landmark Counting mode\n'));
            break;
          case 'tot':
            ultrathink = { enabled: true, numAlternatives: 5, searchStrategy: 'bfs' };
            console.log(chalk.green('✅ [Intent] Auto-enabled Tree of Thoughts mode\n'));
            break;
          case 'standard':
          default:
            // Keep standard mode
            console.log(chalk.gray('ℹ️  [Intent] Using standard planning mode\n'));
            break;
        }
      } else {
        console.log(chalk.yellow(`⚠️  [Intent] Low confidence (${(intent.confidence * 100).toFixed(0)}%), using standard mode\n`));
      }
    } catch (error: any) {
      console.log(chalk.yellow(`⚠️  [Intent] Recognition failed: ${error.message}`));
      console.log(chalk.gray('ℹ️  [Intent] Falling back to standard mode\n'));
    }
  }

  // Use Tree of Thoughts for planning if ultrathink is enabled
  if (ultrathink?.enabled && mode === 'plan') {
    console.log(chalk.cyan('🧠 Ultrathink enabled: Using Tree of Thoughts for multi-path reasoning...\n'));

    const context = JSON.stringify(compressedProjectInfo, null, 2);

    try {
      const planAlternatives = await generatePlansWithToT(
        config,
        compressedProjectInfo,
        userRequirement,
        context,
        {
          numAlternatives: ultrathink.numAlternatives || 5,
          searchStrategy: ultrathink.searchStrategy || 'bfs',
          maxDepth: ultrathink.maxDepth || 4,
          beamWidth: ultrathink.beamWidth || 3,
        }
      );

      // Display thought tree if requested
      if (ultrathink.showThoughts && planAlternatives.selected.metadata.thoughtTree) {
        console.log(formatThoughtTree(
          planAlternatives.selected.metadata.thoughtTree as any,
          false
        ));
      }

      // Display plan alternatives if requested
      if (ultrathink.showRejected) {
        console.log(formatPlanAlternatives(
          planAlternatives.selected,
          planAlternatives.rejected,
          true
        ));
      }

      // Convert selected plan to AIResponse format
      const ultrathinkResponse: ExtendedAIResponse = {
        todo: planAlternatives.selected.actions.map((_, idx) => `Step ${idx + 1}`),
        actions: planAlternatives.selected.actions,
        done: false,
        duration: 0,
        usage: undefined,
        thoughtTree: planAlternatives.selected.metadata.thoughtTree as any,
        planAlternatives,
        ultrathinkEnabled: true,
      };

      return ultrathinkResponse;
    } catch (error) {
      console.error(chalk.red(`Ultrathink error: ${error}`));
      console.log(chalk.yellow('Falling back to standard planning...\n'));
      // Continue to standard planning below
    }
  }

  // Use Landmark Counting for planning if enabled and ToT is not used
  if (!ultrathink?.enabled && mode === 'plan' && config.useLandmark) {
    console.log(chalk.cyan('📍 Landmark Counting enabled: Identifying key milestones...\n'));

    try {
      const { generatePlanWithLandmarks } = await import('./landmark/planner');
      const landmarkPlan = await generatePlanWithLandmarks(
        config,
        userRequirement,
        compressedProjectInfo,
        JSON.stringify(compressedProjectInfo, null, 2),
        {
          maxLandmarks: 10,
          mergeThreshold: 2,
          showReasoning: true,
          allowParallel: false,
        }
      );

      // Convert to AIResponse format
      const landmarkResponse: ExtendedAIResponse = {
        todo: landmarkPlan.landmarks.map(lm => lm.description),
        actions: landmarkPlan.actions,
        done: false,
        duration: 0,
        usage: undefined,
        landmarkPlan,
      };

      return landmarkResponse;
    } catch (error: any) {
      console.error(chalk.red(`Landmark planning error: ${error.message || error}`));
      console.log(chalk.yellow('Falling back to standard planning...\n'));
      // Continue to standard planning below
    }
  }

  const fileTreeSnippet = JSON.stringify(compressedProjectInfo, null, 2);

  // Normalize toolRegistryOrTools to ToolRegistry
  // Support both ToolRegistry (preferred) and string[] (for backward compatibility)
  let toolRegistry: ToolRegistry | undefined;
  let availableToolNames: string[] | undefined;

  if (toolRegistryOrTools) {
    if (Array.isArray(toolRegistryOrTools)) {
      // Backward compatibility: string[] provided
      // This is the OLD way - tool names only, no parameter schemas
      availableToolNames = toolRegistryOrTools;
      console.log(chalk.yellow('⚠️  Warning: Passing tool names (string[]) is deprecated.' +
        ' Please pass ToolRegistry instead for full tool functionality.\n'));
    } else {
      // Preferred: ToolRegistry provided with full tool definitions
      toolRegistry = toolRegistryOrTools;
      availableToolNames = toolRegistry.list().map(t => t.name);
    }
  } else {
    // FIX: If no tool registry provided, create a default one with search tools
    // This ensures search tools are always available for information gathering
    toolRegistry = createDefaultToolRegistry();
    availableToolNames = toolRegistry.list().map(t => t.name);
  }

  // 构建系统提示（包含工具信息）
  let systemMessage = buildSystemPrompt(
    availableToolNames,
    grantedPermissions?.map(p => p.toString())
  );

  // Mode-specific instructions (OPTIMIZED for speed and token efficiency)
  const modePrompt =
    mode === 'plan'
      ? `You are KODE. Generate executable actions as JSON.

**SIMPLE TASKS** (<3 steps):
→ Return: {"todo": [], "actions": [{"type": "run", "command": "..."}]}

**COMPLEX TASKS** (3+ steps):
→ Return: {"todo": ["step 1", "step 2"], "actions": [...]}

**Action types:**
- create: {"type": "create", "path": "file.txt", "content": "..."}
- modify: {"type": "modify", "path": "file.txt", "oldContent": "...", "newContent": "..."}
- run: {"type": "run", "command": "..."}
- verify: {"type": "verify", "command": "..."}

Return valid JSON only. No markdown. No extra text.`
      : mode === 'verify'
      ? (() => {
        // Load detailed verification prompt from file
        const { loadSystemPrompt, PromptType } = require('./prompt');
        const verificationPrompt = loadSystemPrompt(PromptType.VERIFICATION);

        // Add tool information if available
        if (availableToolNames && availableToolNames.length > 0) {
          return verificationPrompt;
        } else {
          return verificationPrompt;
        }
      })()
      : `You are an expert software architect using Tree of Thoughts reasoning with deep analytical capabilities.

Your task is to provide clear, thoughtful text responses for:
- Thought generation: Numbered lists of alternative reasoning paths
- Thought evaluation: Quality scores (0.0-1.0) with brief reasoning
- Plan evaluation: Comparative analysis of alternative approaches

**Guidelines for high-quality reasoning:**
1. Be specific and actionable in your thoughts
2. Consider multiple perspectives and trade-offs
3. Provide concrete scores with clear reasoning (0.0-1.0 scale)
4. Keep responses concise but comprehensive
5. Leverage the full project context available to make informed decisions

**Response format:**
- For thought generation: Use numbered lists (1., 2., 3.)
- For evaluation: Provide scores with "Thought N: X.XX" format
- Include brief reasoning for each score

Respond in plain text (not JSON) with clear structure.`;

  // 构建用户提示词（OPTIMIZED for token efficiency）
  let userPrompt = `Project files: ${fileTreeSnippet}

Task: ${userRequirement}

Return valid JSON with "todo" and "actions" arrays.`;

  // 🔥 获取 Memo 上下文（相关决策和代码）
  const memoContext = await getMemoContext(userRequirement, memoPlugin);
  if (memoContext) {
    userPrompt += memoContext;
  }

  // 如果是验证模式且有执行历史，添加历史信息
  if (mode === 'verify' && compressedHistory && compressedHistory.length > 0) {
    const historyText = formatExecutionHistory(compressedHistory);
    userPrompt = `
--- PROJECT FILES (partial) ---
${fileTreeSnippet}
--- END OF PROJECT FILES ---

--- PREVIOUS EXECUTION HISTORY ---
${historyText}
--- END OF EXECUTION HISTORY ---

User requirement: "${userRequirement}"
`;
  }

  // 如果设置了 endpoint，直接使用；否则使用 baseUrl + 标准路径
  const endpoint = config.endpoint ||
    `${(config.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')}/v1/chat/completions`;

  // GLM-5 compatibility: 根据模型和模式动态设置 max_tokens
  // GLM-5 使用大量 tokens 用于内部推理，但不能超过 API 限制
  const isGLMModel = config.model?.startsWith('glm-');
  // 根据 messages 数量动态调整：简单对话用更少 tokens，复杂任务用更多
  // 注意：此时 messages 尚未构建，但 systemMessage + userMessage 至少有 2 条
  // 如果有 tool 历史，messages 会更多，所以使用保守估计
  const estimatedMessageCount = 3; // system + assistant + user 的典型值
  let maxTokens = 16000; // 默认值
  if (isGLMModel) {
    // GLM 模型：简单对话 1000-2000，复杂任务 4000-6000
    if (estimatedMessageCount <= 3) {
      maxTokens = 1500; // 简单对话
    } else if (estimatedMessageCount <= 5) {
      maxTokens = 3000; // 中等复杂度
    } else {
      maxTokens = 6000; // 复杂任务
    }
  }

  const requestBody: any = {
    model: config.model,
    temperature: 0, // 使用 0 确保最确定的输出，特别对于 JSON 格式
    max_tokens: maxTokens, // GLM-5 需要更大的 max_tokens 来应对 reasoning tokens
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'assistant', content: modePrompt.trim() },
      { role: 'user', content: userPrompt },
    ],
  };

  // Strategy: Enable Function Calling with tools for ALL modes
  // This allows AI to automatically use search and other tools as needed
  //
  // When tools are provided, AI will:
  // 1. Use tools when needed (e.g., search for information)
  // 2. Return structured JSON response for plan/verify modes
  // 3. Return text for think/chat modes
  //
  // NOTE: response_format and tools are mutually exclusive in OpenAI API
  // We prioritize tools when available to enable search functionality

  // Improved API detection logic:
  // - isOpenAI: Only true for official OpenAI API (api.openai.com)
  // - isKnownCompatible: APIs known to be compatible (OpenAI, 智谱AI)
  // - User can override via config.supportsResponseFormat
  const isOpenAI = config.baseUrl?.includes('api.openai.com');
  const isZhipuAI = config.baseUrl?.includes('bigmodel.cn');
  const isKnownCompatible = isOpenAI || isZhipuAI;

  // Check if we have tools available (from registry)
  const hasTools = toolRegistry && toolRegistry.list().length > 0;

  if (hasTools && toolRegistry) {
    // Use Function Calling API with proper tool definitions
    // This enables automatic tool calling (including search) with full parameter schemas
    // Enhanced to include skills from skillManager
    requestBody.tools = buildToolDefinitions(toolRegistry, skillManager);

    // Don't use response_format when using tools (they're mutually exclusive)
    // The AI will return structured data based on the system prompt
  } else if ((mode === 'plan' || mode === 'verify') && isOpenAI) {
    // Only use response_format for official OpenAI API when no tools available
    // Some OpenAI-compatible providers have deprecated json_object type
    requestBody.response_format = { type: "json_object" };
  } else if ((mode === 'plan' || mode === 'verify') &&
             config.supportsResponseFormat === true &&
             isKnownCompatible) {
    // User explicitly enabled response_format for known compatible APIs
    // Note: This may fail with APIs that deprecated json_object
    requestBody.response_format = { type: "json_object" };
    console.log(chalk.gray('ℹ️  Using response_format (user-enabled)\n'));
  } else if (mode === 'plan' || mode === 'verify') {
    // For all other cases, rely on strong prompts
    // This includes:
    // - Third-party OpenAI-compatible APIs (unless user enabled response_format)
    // - APIs that have deprecated json_object type
    // - 智谱AI (known to not fully support response_format)
    // - Any other APIs
    console.log(chalk.gray('ℹ️  Using prompt-based JSON enforcement (API compatibility mode)\n'));
  }

  // Track request start time
  const startTime = Date.now();

  // Execute beforeAIRequest hooks
  if (hookSystem && hookSystem.hasHooks(HookType.BEFORE_AI_REQUEST)) {
    await hookSystem.execute(HookType.BEFORE_AI_REQUEST, {
      data: {
        mode,
        requestBody,
        endpoint,
      },
      session: null, // TODO: Pass session if available
      config,
    });
  }

  // 🚀 AI 缓存：检查是否有缓存的响应
  const aiCache = getGlobalAICache();
  const cacheKey = JSON.stringify({
    model: config.model,
    messages: requestBody.messages,
    temperature: requestBody.temperature,
    max_tokens: requestBody.max_tokens,
  });

  // 尝试从缓存获取（仅对 plan 和 think 模式启用缓存）
  if (mode !== 'verify') {
    try {
      const cachedResponse = await aiCache.get(
        { model: config.model, messages: requestBody.messages, temperature: requestBody.temperature || 0.7, maxTokens: requestBody.max_tokens || 16000 }
      );

      if (cachedResponse) {
        console.log(chalk.gray(`✨ [AI Cache] Using cached response (saved ${Date.now() - cachedResponse.timestamp}ms ago)`));

        // 返回缓存的响应
        return {
          todo: cachedResponse.todo || [],
          actions: cachedResponse.actions || [],
          done: cachedResponse.done || false,
          duration: 0, // 缓存响应不计入 duration
          usage: cachedResponse.tokens ? { prompt_tokens: 0, completion_tokens: 0, total_tokens: cachedResponse.tokens } : undefined,
        } as ExtendedAIResponse;
      }
    } catch (error) {
      console.log(chalk.gray(`⚠️  [AI Cache] Cache check failed: ${error}`));
      // 继续执行 API 调用
    }
  }

  const fetchResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal, // 添加 AbortSignal 支持
    agent: endpoint.startsWith('https') ? (createProxyAgent(config) || httpsAgent) : undefined, // 🔥 支持代理 + 连接池复用
  });

  if (!fetchResponse.ok) {
    const err = await fetchResponse.text();

    // Check if error is due to unsupported response_format parameter
    if (err.includes('response_format') || err.includes('invalid request')) {
      // Retry without response_format
      console.log(chalk.yellow('⚠️  API does not support response_format parameter'));
      console.log(chalk.yellow('Retrying without JSON mode enforcement...\n'));

      // Remove response_format and retry
      const { response_format, ...retryBody } = requestBody;

      const retryResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(retryBody),
        signal,
        agent: endpoint.startsWith('https') ? (createProxyAgent(config) || httpsAgent) : undefined, // 🔥 支持代理 + 连接池复用
      });

      if (!retryResponse.ok) {
        const retryErr = await retryResponse.text();
        throw new Error(`OpenAI API error: ${retryResponse.status} - ${retryErr}`);
      }

      const data = (await retryResponse.json()) as any;

      // Continue processing with retry response
      const message = data.choices?.[0]?.message;

      let rawMessage: string;

      if (mode === 'think') {
        rawMessage = message?.reasoning_content || message?.content || '';
      } else {
        rawMessage = message?.content || message?.reasoning_content || '';
      }

      if (!rawMessage) {
        console.error('❌ Failed to extract message from API response');
        console.error('❌ Response structure:');
        console.error(JSON.stringify(data, null, 2));
        throw new Error('Could not extract message content from API response');
      }

      // Process the response (same logic as below)
      const duration = Date.now() - startTime;
      const usage = data.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens
      } : undefined;

      if (mode === 'think') {
        const response: ExtendedAIResponse = {
          todo: [],
          actions: [],
          done: false,
          duration,
          usage,
          ultrathinkEnabled: false,
          content: rawMessage,
        };
        return response;
      }

      let jsonStr = extractJSON(rawMessage);

      if (!jsonStr) {
        console.log(chalk.yellow('⚠️  AI未返回标准JSON格式\n'));
        console.log(chalk.gray('─'.repeat(50)));
        console.log(chalk.cyan('📝 AI完整响应：\n'));
        console.log(rawMessage);
        console.log(chalk.gray('\n' + '─'.repeat(50)) + '\n');

        // Debug: Check why retry logic might not trigger
        console.log(chalk.gray(`[DEBUG] mode: ${mode}, has response_format: ${!!requestBody.response_format}\n`));

        // Auto-retry for plan/verify modes without response_format
        if ((mode === 'plan' || mode === 'verify') && requestBody.response_format) {
          console.log(chalk.yellow('🔄 检测到JSON格式失败，尝试简化请求重试...\n'));

          // Remove response_format and retry
          const { response_format, ...retryBody } = requestBody;

          // Strengthen the prompt to force JSON
          const strengthenedMessages = [
            ...retryBody.messages.slice(0, -1),
            {
              ...retryBody.messages[retryBody.messages.length - 1],
              content: retryBody.messages[retryBody.messages.length - 1].content +
                '\n\n🚨 CRITICAL: You MUST respond with valid JSON only. No markdown, no code blocks, no explanations.\n' +
                'Response must start with { and end with }.'
            }
          ];

          const retryResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...retryBody, messages: strengthenedMessages }),
            signal,
          });

          if (retryResponse.ok) {
            const retryData = (await retryResponse.json()) as any;
            const retryMessage = retryData.choices?.[0]?.message;
            const retryRawMessage = retryMessage?.content || retryMessage?.reasoning_content || '';

            const retryJsonStr = extractJSON(retryRawMessage);

            if (retryJsonStr) {
              console.log(chalk.green('✅ 重试成功，获得有效JSON响应\n'));

              let parsed: AIResponse;
              try {
                parsed = JSON.parse(retryJsonStr);

                const response: ExtendedAIResponse = {
                  ...parsed,
                  duration: Date.now() - startTime,
                  usage: retryData.usage ? {
                    prompt_tokens: retryData.usage.prompt_tokens,
                    completion_tokens: retryData.usage.completion_tokens,
                    total_tokens: retryData.usage.total_tokens
                  } : usage,
                  ultrathinkEnabled: false,
                  content: retryRawMessage,
                };
                return response;
              } catch (error) {
                console.error(chalk.red('❌ 重试响应解析失败'));
                // Fall through to error response below
              }
            } else {
              console.log(chalk.yellow('⚠️  重试仍然未返回有效JSON\n'));
            }
          }
        }

        console.log(chalk.yellow('💡 提示：AI应该返回JSON格式的actions，而不是直接回答问题\n'));

        const errorResponse: ExtendedAIResponse = {
          todo: [],
          actions: [],
          done: false,
          duration,
          usage,
          ultrathinkEnabled: false,
          content: rawMessage,
          type: 'error',
          message: 'AI returned non-JSON response. Please try rephrasing your requirement.',
        };

        return errorResponse;
      }

      let parsed: AIResponse;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (error) {
        console.error('❌ JSON Parse Error');
        console.error('❌ Failed to parse JSON:');
        console.error('--- Extracted JSON Start ---');
        console.error(jsonStr.substring(0, 1000));
        if (jsonStr.length > 1000) {
          console.error('... (truncated)');
        }
        console.error('--- Extracted JSON End ---');
        throw error;
      }

      const response: ExtendedAIResponse = {
        ...parsed,
        duration,
        usage,
        ultrathinkEnabled: false,
        content: rawMessage,
      };
      return response;
    }

    throw new Error(`OpenAI API error: ${fetchResponse.status} - ${err}`);
  }

  const data = (await fetchResponse.json()) as any;

  // Execute afterAIResponse hooks
  if (hookSystem && hookSystem.hasHooks('afterAIResponse')) {
    await hookSystem.execute('afterAIResponse', {
      data: {
        mode,
        endpoint,
        response: data,
        duration: Date.now() - startTime,
      },
      session: null, // TODO: Pass session if available
      config,
    });
  }

  // Extract message content from response
  // For plan/verify modes: prioritize 'content' (JSON) over 'reasoning_content' (thinking process)
  // For think mode: prioritize 'reasoning_content' if available
  // Zhipu AI GLM-5 returns both fields:
  // - 'reasoning_content': AI's thinking process (human-readable, not JSON)
  // - 'content': Final answer (should be JSON for plan/verify modes)
  const message = data.choices?.[0]?.message;

  // Handle Function Calling responses
  if (message?.tool_calls && message.tool_calls.length > 0) {
    const duration = Date.now() - startTime;
    const usage = data.usage ? {
      prompt_tokens: data.usage.prompt_tokens,
      completion_tokens: data.usage.completion_tokens,
      total_tokens: data.usage.total_tokens
    } : undefined;

    // Return tool_calls for the caller to handle
    const response: ExtendedAIResponse = {
      todo: [],
      actions: [],
      done: false,
      duration,
      usage,
      ultrathinkEnabled: false,
      content: JSON.stringify(message.tool_calls, null, 2),
      toolCalls: message.tool_calls,
      type: 'tool_calls',
    };
    return response;
  }

  let rawMessage: string;

  if (mode === 'think') {
    // In think mode, we want the reasoning process
    rawMessage = message?.reasoning_content || message?.content || '';
  } else {
    // In plan/verify modes, we want structured JSON (content field)
    rawMessage = message?.content || message?.reasoning_content || '';
  }

  if (!rawMessage) {
    console.error('❌ Failed to extract message from API response');
    console.error('❌ Response structure:');
    console.error(JSON.stringify(data, null, 2));
    throw new Error('Could not extract message content from API response');
  }

  // Calculate request duration
  const duration = Date.now() - startTime;

  // Extract token usage from API response
  const usage = data.usage ? {
    prompt_tokens: data.usage.prompt_tokens,
    completion_tokens: data.usage.completion_tokens,
    total_tokens: data.usage.total_tokens
  } : undefined;

  // MODE-CONDITIONAL PARSING
  // 'think' mode returns plain text, 'plan' and 'verify' return JSON
  if (mode === 'think') {
    const response: ExtendedAIResponse = {
      todo: [],
      actions: [],
      done: false,
      duration,
      usage,
      ultrathinkEnabled: false,
      content: rawMessage, // Plain text response for thought generation/evaluation
    };
    return response;
  }

  // 抽取第一个合法 JSON 块 (for 'plan' and 'verify' modes)
  // 使用更智能的方法来提取 JSON，而不是简单的正则匹配
  let jsonStr = extractJSON(rawMessage);

  if (!jsonStr) {
    console.log(chalk.yellow('⚠️  AI未返回标准JSON格式\n'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.cyan('📝 AI完整响应：\n'));
    console.log(rawMessage);
    console.log(chalk.gray('\n' + '─'.repeat(50)) + '\n');

    // ✅ NEW: Auto-retry with strengthened prompt for plan/verify modes
    if ((mode === 'plan' || mode === 'verify') && !signal?.aborted) {
      console.log(chalk.yellow('🔄 自动重试：使用更强的 JSON 提示...\n'));

      try {
        // Build a much stronger prompt for JSON enforcement
        const strengthenPrompt = `
🚨 CRITICAL INSTRUCTION:
You MUST respond with valid JSON format only. No explanations, no analysis, no text.

Response format:
{
  "todo": ["task 1", "task 2"],
  "actions": [
    {"type": "create", "path": "file.txt", "content": "..."}
  ]
}

Original requirement: ${userRequirement}

Respond with JSON ONLY. Start your response with { and end with }.
`;

        // Build retry request with strengthened prompt
        const retryRequestBody: any = {
          model: config.model,
          temperature: 0,  // Lower temperature for more deterministic output
          max_tokens: 16000,  // Increased from 2048 for consistency
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: strengthenPrompt },
          ],
        };

        console.log(chalk.gray('📤 发送重试请求...\n'));

        const retryResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(retryRequestBody),
          signal,
        });

        if (retryResponse.ok) {
          const retryData = await retryResponse.json();
          const retryMessage = retryData.choices?.[0]?.message;
          const retryRawMessage = retryMessage?.content || retryMessage?.reasoning_content || rawMessage;

          // Try to extract JSON again
          const retryJsonStr = extractJSON(retryRawMessage);

          if (retryJsonStr) {
            console.log(chalk.green('✅ 重试成功，获得有效 JSON 响应\n'));

            let parsed: AIResponse;
            try {
              parsed = JSON.parse(retryJsonStr);

              const successResponse: ExtendedAIResponse = {
                ...parsed,
                duration: Date.now() - startTime,
                usage: retryData.usage ? {
                  prompt_tokens: retryData.usage.prompt_tokens,
                  completion_tokens: retryData.usage.completion_tokens,
                  total_tokens: retryData.usage.total_tokens
                } : usage,
                ultrathinkEnabled: false,
                content: retryRawMessage,
              };

              return successResponse;
            } catch (parseError) {
              console.log(chalk.yellow('⚠️  重试响应解析失败\n'));
              // Fall through to error response below
            }
          } else {
            console.log(chalk.yellow('⚠️  重试仍然未返回 JSON\n'));
          }
        } else {
          console.log(chalk.yellow(`⚠️  重试请求失败: ${retryResponse.status}\n`));
        }
      } catch (retryError: any) {
        console.log(chalk.yellow(`⚠️  重试过程出错: ${retryError.message}\n`));
        // Continue to error response below
      }
    }

    console.log(chalk.yellow('💡 提示：如果问题持续存在，尝试:\n'));
    console.log(chalk.gray('  1. 使用 --use-tools 启用 Function Calling 模式\n'));
    console.log(chalk.gray('  2. 设置 OPENAI_SUPPORTS_RESPONSE_FORMAT=false\n'));
    console.log(chalk.gray('  3. 考虑使用官方 OpenAI API 或其他兼容性更好的 API\n'));

    // Return error response instead of empty response
    const errorResponse: ExtendedAIResponse = {
      todo: [],
      actions: [],
      done: false,
      duration,
      usage,
      ultrathinkEnabled: false,
      content: rawMessage,
      type: 'error',
      message: 'AI returned non-JSON response. Please try rephrasing your requirement or using --use-tools mode.',
    };

    return errorResponse;
  }

  let parsed: AIResponse;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    console.error('❌ JSON Parse Error');
    console.error('❌ Failed to parse JSON:');
    console.error('--- Extracted JSON Start ---');
    console.error(jsonStr.substring(0, 1000));
    if (jsonStr.length > 1000) {
      console.error('... (truncated)');
    }
    console.error('--- Extracted JSON End ---');
    // Return error response instead of throwing — prevents caller crash
    return {
      todo: [],
      actions: [],
      done: true,
      content: rawMessage,
      type: 'error',
      message: 'AI returned malformed JSON response.',
    } as ExtendedAIResponse;
  }

  // Validate parsed response against schema
  if (mode === 'plan') {
    const { validatePlanResponse, formatValidationErrors } = await import('./validation/validators');
    const validation = validatePlanResponse(parsed);

    if (!validation.valid) {
      // Check if response is plain text (no todo/actions needed for simple queries)
      const hasTodoOrActions = parsed.todo && parsed.todo.length > 0 || parsed.actions && parsed.actions.length > 0;
      const isPlainTextResponse = !hasTodoOrActions && rawMessage && !rawMessage.startsWith('{');

      if (isPlainTextResponse) {
        // For simple conversational queries, empty todo/actions is acceptable
        console.log(chalk.gray('ℹ️  Plain text response detected (no todo/actions needed)\n'));

        const textResponse: ExtendedAIResponse = {
          todo: [],
          actions: [],
          done: true,
          duration,
          usage,
          ultrathinkEnabled: false,
          content: rawMessage,
          type: 'analysis',  // Plain text is considered analysis
        };
        return textResponse;
      }

      console.error(chalk.yellow('\n⚠️  Schema Validation Failed\n'));
      console.error(formatValidationErrors(validation.errors));
      console.error(chalk.yellow('\n💡 Tip: This usually means the AI returned an incomplete or malformed response.\n'));

      // Return error response instead of crashing
      const errorResponse: ExtendedAIResponse = {
        todo: [],
        actions: [],
        done: false,
        duration,
        usage,
        ultrathinkEnabled: false,
        content: rawMessage,
        type: 'error',
        message: 'AI response failed validation: ' + validation.errors.map(e => e.message).join('; '),
      };
      return errorResponse;
    }
  }

  const response: ExtendedAIResponse = {
    ...parsed,
    duration,
    usage,
    ultrathinkEnabled: false,
    content: rawMessage, // Include raw response content
  };

  // 🚀 AI 缓存：保存成功的响应（仅对 plan 和 think 模式）
  if (mode !== 'verify' && response) {
    try {
      await aiCache.set(
        { model: config.model, messages: requestBody.messages, temperature: requestBody.temperature || 0.7, maxTokens: requestBody.max_tokens || 16000 },
        JSON.stringify(response),
        1000 * 60 * 10  // 10 分钟 TTL
      );
      console.log(chalk.gray(`💾 [AI Cache] Response cached for 10 minutes`));
    } catch (error) {
      console.log(chalk.gray(`⚠️  [AI Cache] Failed to save cache: ${error}`));
      // 不影响主流程
    }
  }

  return response;
}

/**
 * 格式化执行历史为可读文本
 */
function formatExecutionHistory(history: ExecutionRecord[]): string {
  if (history.length === 0) {
    return 'No actions executed yet.';
  }

  const lines: string[] = [];

  // 按迭代分组
  const grouped = new Map<number, ExecutionRecord[]>();
  for (const record of history) {
    const list = grouped.get(record.iteration) ?? [];
    list.push(record);
    grouped.set(record.iteration, list);
  }

  // 格式化每个迭代
  for (const [iteration, records] of grouped.entries()) {
    lines.push(`Iteration ${iteration}:`);

    for (const record of records) {
      const statusIcon = record.status === 'success' ? '✅' : '❌';
      const desc = describeAction(record.action);
      const duration = (record.duration / 1000).toFixed(2);

      lines.push(`  ${statusIcon} ${desc} (${duration}s)`);

      if (record.error) {
        lines.push(`     ❌ Error: ${record.error}`);
      }

      if (record.rollbackData?.commitHash) {
        lines.push(`     💾 Rollback point: ${record.rollbackData.commitHash}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 描述 action
 */
function describeAction(action: any): string {
  switch (action.type) {
    case 'create':
      return `Create file ${action.path}`;
    case 'modify':
      return `Modify file ${action.path}`;
    case 'delete':
      return `Delete file ${action.path}`;
    case 'run':
      return `Run command "${action.command}"`;
    case 'verify':
      return `Verify "${action.command}"`;
    default:
      return `Unknown action: ${JSON.stringify(action)}`;
  }
}
