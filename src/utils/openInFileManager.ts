import * as fs from 'fs';
import * as path from 'path';

/** Electron shell 中与打开文件管理器相关的最小接口（Obsidian 桌面端为 external） */
export interface ElectronShellLike {
  openPath: (filePath: string) => Promise<string>;
  showItemInFolder: (fullPath: string) => void;
}

/**
 * 在 Obsidian 桌面版中获取 Electron shell；移动端或无 require 时为 null。
 */
export function getElectronShell(): ElectronShellLike | null {
  try {
    if (typeof require === 'undefined') {
      return null;
    }
    // electron 在 esbuild 中标记为 external，运行时由 Obsidian 提供
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as { shell?: ElectronShellLike } | undefined;
    return electron?.shell ?? null;
  } catch {
    return null;
  }
}

export type OpenInFileManagerResult =
  | { ok: true }
  | { ok: false; reason: 'no-shell' }
  | { ok: false; reason: 'open-path-failed'; detail: string };

/**
 * 用系统文件管理器打开目录或文件（Windows 资源管理器 / macOS Finder）。
 * 依赖 Electron `shell.openPath`，与 Obsidian 桌面端一致；路径经 path.normalize 以适配当前 OS。
 */
export async function openAbsolutePathInFileManager(absolutePath: string): Promise<OpenInFileManagerResult> {
  const shell = getElectronShell();
  if (!shell) {
    return { ok: false, reason: 'no-shell' };
  }
  const normalized = path.normalize(absolutePath);
  const errMsg = await shell.openPath(normalized);
  if (errMsg) {
    return { ok: false, reason: 'open-path-failed', detail: errMsg };
  }
  return { ok: true };
}

/**
 * 在文件管理器中定位到给定文件（Electron `showItemInFolder`）；若文件尚不存在则打开其父目录。
 * 行为在 Windows 与 macOS 上由 Electron 统一实现。
 */
export async function revealFileOrOpenParentDirectory(absoluteFilePath: string): Promise<OpenInFileManagerResult> {
  const shell = getElectronShell();
  if (!shell) {
    return { ok: false, reason: 'no-shell' };
  }
  const normalized = path.normalize(absoluteFilePath);
  if (fs.existsSync(normalized)) {
    shell.showItemInFolder(normalized);
    return { ok: true };
  }
  return openAbsolutePathInFileManager(path.dirname(normalized));
}
