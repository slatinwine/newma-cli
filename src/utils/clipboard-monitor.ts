// src/utils/clipboard-monitor.ts
import { execFileNoThrow } from './execFileNoThrow';

/**
 * 检测剪贴板是否包含图片数据
 * 注意：实现依赖于操作系统
 *
 * @returns Promise<boolean> 剪贴板是否包含图片
 */
export async function hasClipboardImage(): Promise<boolean> {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      // macOS: 使用 osascript
      const result = await execFileNoThrow('osascript', ['-e', 'tell application "System Events" to (the clipboard as «class PNGf») is not false']);
      return result.stdout?.trim().toLowerCase() === 'true';
    } else if (platform === 'linux') {
      // Linux: 使用 xclip 或 wl-paste
      try {
        // 尝试 xclip
        const result = await execFileNoThrow('xclip', ['-selection', 'clipboard', '-t', 'TARGETS', '-o']);
        return !result.error && result.stdout.length > 0;
      } catch {
        // 尝试 wl-paste (Wayland)
        const result = await execFileNoThrow('wl-paste', ['--type', 'image/png']);
        return !result.error && result.stdout.length > 0;
      }
    } else if (platform === 'win32') {
      // Windows: 使用 PowerShell
      const result = await execFileNoThrow('PowerShell', [
        '-Command',
        'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::ContainsImage()'
      ]);
      return result.stdout?.trim().toLowerCase() === 'true';
    }
  } catch (error) {
    // 如果命令失败，假设没有图片
    return false;
  }

  return false;
}

/**
 * 从剪贴板读取图片数据
 *
 * @returns Promise<string | null> base64 编码的图片数据，如果失败则返回 null
 */
export async function readClipboardImage(): Promise<string | null> {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      return await readClipboardImageMacOS();
    } else if (platform === 'linux') {
      return await readClipboardImageLinux();
    } else if (platform === 'win32') {
      return await readClipboardImageWindows();
    }
  } catch (error) {
    console.error(`❌ Failed to read clipboard image: ${error}`);
    return null;
  }

  console.warn(`⚠️  Clipboard image reading not supported on platform: ${platform}`);
  return null;
}

/**
 * macOS: 从剪贴板读取图片
 */
async function readClipboardImageMacOS(): Promise<string | null> {
  try {
    // 方法 1: 使用 pngpaste（如果已安装）
    // 首先检查 pngpaste 是否可用
    try {
      const whichResult = await execFileNoThrow('which', ['pngpaste']);
      if (whichResult.stdout?.trim()) {
        // pngpaste 可用，使用它读取图片
        const result = await execFileNoThrow('sh', ['-c', 'pngpaste - | base64']);
        const imageBase64 = result.stdout?.trim();
        if (imageBase64) {
          return imageBase64;
        }
      }
    } catch {
      // pngpaste 不可用，尝试其他方法
    }

    // 方法 2: 使用 osascript（AppleScript）
    const script = `
      tell application "System Events"
        try
          set theData to the clipboard as «class PNGf»
          set theFile to open for access POSIX file "/tmp/clipboard_image.png" with write permission
          write theData to theFile
          close access theFile
          return "/tmp/clipboard_image.png"
        on error
          return ""
        end try
      end tell
    `;

    const result = await execFileNoThrow('osascript', ['-e', script]);
    const tempFile = result.stdout?.trim();

    if (tempFile && tempFile !== '""') {
      // 读取文件并转换为 base64
      const fs = await import('fs');
      const imageBuffer = fs.readFileSync(tempFile);
      const base64 = imageBuffer.toString('base64');

      // 清理临时文件
      fs.unlinkSync(tempFile);

      return base64;
    }

    return null;
  } catch (error) {
    console.error(`❌ macOS clipboard read failed: ${error}`);
    return null;
  }
}

/**
 * Linux: 从剪贴板读取图片
 */
async function readClipboardImageLinux(): Promise<string | null> {
  try {
    // 尝试 xclip (X11)
    try {
      const result = await execFileNoThrow('sh', ['-c', 'xclip -selection clipboard -t image/png -o | base64']);
      const imageBase64 = result.stdout?.trim();
      if (imageBase64) {
        return imageBase64;
      }
    } catch (xclipError) {
      // xclip 失败，尝试 wl-paste (Wayland)
    }

    // 尝试 wl-paste (Wayland)
    try {
      const result = await execFileNoThrow('sh', ['-c', 'wl-paste --type image/png | base64']);
      const imageBase64 = result.stdout?.trim();
      if (imageBase64) {
        return imageBase64;
      }
    } catch (wlPasteError) {
      // wl-paste 也失败
    }

    return null;
  } catch (error) {
    console.error(`❌ Linux clipboard read failed: ${error}`);
    return null;
  }
}

/**
 * Windows: 从剪贴板读取图片
 */
async function readClipboardImageWindows(): Promise<string | null> {
  try {
    // 使用 PowerShell 读取剪贴板图片
    const script = `
      Add-Type -AssemblyName System.Windows.Forms;
      Add-Type -AssemblyName System.Drawing;

      $image = [System.Windows.Forms.Clipboard]::GetImage();
      if ($image -eq $null) {
        exit 1;
      }

      $tempPath = "$env:TEMP\\clipboard_image.png";
      $image.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png);
      $image.Dispose();

      # 转换为 base64
      $bytes = [System.IO.File]::ReadAllBytes($tempPath);
      $base64 = [System.Convert]::ToBase64String($bytes);
      Write-Output $base64;

      # 清理临时文件
      Remove-Item $tempPath;
    `;

    const result = await execFileNoThrow('PowerShell', ['-Command', script]);
    const base64 = result.stdout?.trim();

    if (base64) {
      return base64;
    }

    return null;
  } catch (error) {
    console.error(`❌ Windows clipboard read failed: ${error}`);
    return null;
  }
}

/**
 * 保存图片到临时文件
 * @param base64Data base64 编码的图片数据
 * @param imageType 图片类型（png, jpeg, etc.）
 * @returns 临时文件路径
 */
export async function saveImageToTempFile(
  base64Data: string,
  imageType: string = 'png'
): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const tempDir = os.tmpdir();
  const fileName = `clipboard_${Date.now()}.${imageType}`;
  const tempFilePath = path.join(tempDir, fileName);

  const imageBuffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(tempFilePath, imageBuffer);

  return tempFilePath;
}

/**
 * 清理临时图片文件
 * @param filePath 文件路径
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    const fs = await import('fs');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`⚠️  Failed to cleanup temp file ${filePath}: ${error}`);
  }
}
