// src/types.ts

/** 单条 AI 操作 */
export interface Action {
  type: 'create' | 'modify' | 'delete' | 'run' | 'verify';
  /** 相对路径（除 run 外必填） */
  path?: string;
  /** 对于 create：完整文件内容 */
  content?: string;
  /** 对于 modify：要替换的旧内容（用于精确匹配） */
  oldContent?: string;
  /** 对于 modify：替换后的新内容 */
  newContent?: string;
  /** 对于 run：要执行的 Shell 命令 */
  command?: string;
  /** Optional description for better tracking */
  description?: string;
  /** Whether this action is retryable on failure */
  retryable?: boolean;
  /** Whether this is a dangerous operation (for rollback decisions) */
  dangerous?: boolean;
}

/** Token usage information from OpenAI API */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Adventure Mode - Choice option for branching paths
 */
export interface Choice {
  id: string;           // e.g., "A", "B", "C"
  title: string;        // Short name like "JWT 认证"
  description: string;  // 1-2 sentence explanation
  pros: string[];       // Advantages
  cons: string[];       // Disadvantages
  todo: string[];       // Step-by-step tasks
  actions: Action[];    // Concrete actions to execute
}

/**
 * Adventure Mode - Response with multiple choices
 */
export interface AdventureResponse {
  type: 'choice';       // Discriminator for choice mode
  scenario: string;     // Brief description of the situation
  choices: Choice[];    // Available options for user to select
}

/**
 * Claude / OpenAI 必须返回的结构。
 *
 * - `todo` 与 `actions` 用来 **规划**（第一次调用）。
 * - 当模型认为需求已经完成时，它可以只返回 `{ done: true }`（验证阶段）。
 * - `done` 为 `false` 时可再次返回新的 `todo` / `actions`，进入下一轮循环。
 */
export interface AIResponse {
  /** 人类可读的待办列表 */
  todo: string[];
  /** 按顺序要执行的动作 */
  actions: Action[];

  /** 【验证阶段】是否已经完成需求（若为 true，循环直接结束） */
  done?: boolean;

  /** AI request duration in milliseconds */
  duration?: number;

  /** Token usage from OpenAI API */
  usage?: TokenUsage;
}

/**
 * Execution result from an action
 */
export interface ExecutionResult {
  success: boolean;
  error?: string;
  rollbackData?: import('./rollback').Checkpoint;
  duration: number;
}

/**
 * Vision/Multimodal Types
 */

/** Image content in multimodal message */
export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string;  // data:image/png;base64,... or file reference like @image.png
  };
}

/** Text content in multimodal message */
export interface TextContent {
  type: 'text';
  text: string;
}

/** Multimodal message content (text + images) */
export type MessageContent = string | (TextContent | ImageContent)[];

/** Vision model configuration */
export interface VisionConfig {
  /** Enable vision features */
  enableVision: boolean;
  /** Model to use for vision requests (e.g., 'gpt-4o', 'glm-4v') */
  visionModel: string;
  /** Maximum image dimension (width/height) for compression */
  maxImageSize: number;
  /** Compress images before sending */
  compressImages: boolean;
  /** Supported image file extensions */
  supportedExtensions: string[];
}

/** Parsed image references from user input */
export interface ImageReference {
  /** Original file path (e.g., 'screenshot.png') */
  path: string;
  /** Absolute path to the image file */
  absolutePath: string;
  /** Whether file exists and is accessible */
  exists: boolean;
  /** Image type (png, jpeg, etc.) */
  type?: string;
}

/** Rich user input with image references */
export interface RichUserInput {
  /** Original input text */
  text: string;
  /** Extracted image references */
  images: ImageReference[];
  /** Whether input contains clipboard image */
  hasClipboardImage: boolean;
}
