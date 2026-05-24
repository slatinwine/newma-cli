// src/utils/image-processor.ts
import * as fs from 'fs';
import * as path from 'path';
import { ImageReference } from '../types';
import sharp from 'sharp';

/** 支持的图片格式 */
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

/** 默认最大图片尺寸（宽度和高度） */
const DEFAULT_MAX_SIZE = 2048;

/**
 * 从用户输入中提取图片引用
 * 支持语法：@filename.png 或 @path/to/image.jpg
 */
export function extractImageReferences(input: string, projectRoot: string): ImageReference[] {
  const imagePattern = /@([\w\-.\/]+\.(png|jpg|jpeg|gif|webp|bmp))/gi;
  const matches = [...input.matchAll(imagePattern)];

  return matches.map((match) => {
    const imagePath = match[1];
    const absolutePath = path.resolve(projectRoot, imagePath);

    let exists = false;
    let type: string | undefined;

    try {
      exists = fs.existsSync(absolutePath);
      if (exists) {
        const ext = path.extname(absolutePath).toLowerCase();
        type = ext.replace('.', '');
      }
    } catch (error) {
      // File doesn't exist or isn't accessible
      exists = false;
    }

    return {
      path: imagePath,
      absolutePath,
      exists,
      type,
    };
  });
}

/**
 * 从文件加载图片并转换为 base64
 * @param absolutePath 图片文件的绝对路径
 * @returns base64 编码的图片数据（不带 data URL 前缀）
 */
export function loadImageAsBase64(absolutePath: string): string {
  try {
    const imageBuffer = fs.readFileSync(absolutePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    throw new Error(`Failed to load image from ${absolutePath}: ${error}`);
  }
}

/**
 * 生成完整的 data URL（带 MIME 类型前缀）
 * @param base64Data base64 编码的图片数据
 * @param imageType 图片类型（png, jpeg, etc.）
 * @returns 完整的 data URL，如 "data:image/png;base64,..."
 */
export function generateDataURL(base64Data: string, imageType: string = 'png'): string {
  const mimeType = getMimeType(imageType);
  return `data:${mimeType};base64,${base64Data}`;
}

/**
 * 获取图片的 MIME 类型
 * @param imageType 图片扩展名（不带点）
 * @returns MIME 类型字符串
 */
export function getMimeType(imageType: string): string {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
  };

  return mimeTypes[imageType.toLowerCase()] || 'image/png';
}

/**
 * 检测图片类型（从文件扩展名）
 * @param filePath 图片文件路径
 * @returns 图片类型（png, jpeg, etc.）或 undefined
 */
export function detectImageType(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  if (!ext) return undefined;

  return ext.replace('.', '');
}

/**
 * 图片压缩（使用 sharp 库）
 *
 * @param base64Data base64 编码的图片数据
 * @param maxSize 最大尺寸（宽度和高度都将限制在此值）
 * @param imageType 图片类型
 * @returns 压缩后的 base64 数据
 */
export async function compressImage(
  base64Data: string,
  maxSize: number = DEFAULT_MAX_SIZE,
  imageType: string = 'png'
): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');

    // 使用 sharp 进行图片处理
    let pipeline = sharp(buffer)
      .resize(maxSize, maxSize, {
        fit: 'inside',    // 保持宽高比，适应容器
        withoutEnlargement: true  // 不放大小图片
      });

    // 根据图片类型设置压缩参数
    const format = imageType.toLowerCase();
    if (format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9, quality: 80 });
    } else if (format === 'jpg' || format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality: 80 });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({ quality: 80 });
    } else {
      // 其他格式默认使用 PNG
      pipeline = pipeline.png({ compressionLevel: 9, quality: 80 });
    }

    const compressedBuffer = await pipeline.toBuffer();
    const compressedBase64 = compressedBuffer.toString('base64');

    // 计算压缩率
    const originalSize = buffer.length;
    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    if (compressedSize < originalSize) {
      console.log(`✂️  Image compressed: ${compressionRatio}% reduction (${(originalSize / 1024).toFixed(1)}KB → ${(compressedSize / 1024).toFixed(1)}KB)`);
    } else {
      console.log(`ℹ️  Image already optimized, no compression needed`);
    }

    return compressedBase64;
  } catch (error) {
    console.warn(`⚠️  Image compression failed: ${error}`);
    console.warn(`   Returning original data`);
    return base64Data;
  }
}

/**
 * 验证图片文件是否存在且可读
 * @param absolutePath 图片文件的绝对路径
 * @returns 文件是否有效
 */
export function validateImageFile(absolutePath: string): boolean {
  try {
    if (!fs.existsSync(absolutePath)) {
      return false;
    }

    const stats = fs.statSync(absolutePath);
    if (!stats.isFile()) {
      return false;
    }

    // 检查文件大小（限制为 10MB）
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (stats.size > MAX_SIZE) {
      console.warn(`⚠️  Image file too large: ${stats.size} bytes (max: ${MAX_SIZE})`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error validating image file: ${error}`);
    return false;
  }
}

/**
 * 检查文件扩展名是否为支持的图片格式
 * @param filePath 文件路径
 * @returns 是否为支持的图片格式
 */
export function isSupportedImageFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * 从图片引用数组中加载所有有效图片
 * @param images 图片引用数组
 * @returns Map<absolutePath, base64Data>
 */
export function loadAllImages(images: ImageReference[]): Map<string, string> {
  const loadedImages = new Map<string, string>();

  for (const image of images) {
    if (!image.exists) {
      console.warn(`⚠️  Image file not found: ${image.path}`);
      continue;
    }

    if (!validateImageFile(image.absolutePath)) {
      console.warn(`⚠️  Invalid image file: ${image.path}`);
      continue;
    }

    try {
      const base64 = loadImageAsBase64(image.absolutePath);
      loadedImages.set(image.absolutePath, base64);
    } catch (error) {
      console.error(`❌ Failed to load image ${image.path}: ${error}`);
    }
  }

  return loadedImages;
}

/**
 * 计算图片文件的 token 估算（用于成本控制）
 * 粗略估算：base64 长度 / 4 * 3 = 原始字节数
 * 每 1MB 图片大约需要 1000-2000 tokens
 * @param base64Data base64 编码的图片数据
 * @returns 估算的 token 数量
 */
export function estimateImageTokens(base64Data: string): number {
  const bytes = (base64Data.length * 3) / 4;
  // 粗略估算：每 1000 字节 ≈ 1-2 tokens（取决于模型）
  return Math.ceil(bytes / 1000);
}
