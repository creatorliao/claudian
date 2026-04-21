import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/** Windows 上 spawn 不能直接执行 .cmd/.bat（会报 spawn EINVAL），需走 .exe 或 shell。 */
const WIN_SCRIPT_EXT = /\.(cmd|bat)$/i;

function tryWindowsExeSibling(scriptPath: string): string | null {
  const dir = path.dirname(scriptPath);
  const base = path.basename(scriptPath, path.extname(scriptPath));
  const exePath = path.join(dir, `${base}.exe`);
  try {
    if (fs.statSync(exePath).isFile()) {
      return exePath;
    }
  } catch {
    // 忽略：无同基名 .exe
  }
  return null;
}

export type CursorSpawnOptions = Parameters<typeof spawn>[2];

/**
 * 启动 Cursor Agent CLI（跨平台）。
 *
 * - Windows + `agent.cmd` / `.bat`：不能直接 spawn（EINVAL）；优先同目录 `*.exe`，否则 `shell: true`。
 * - macOS / Linux：直接 spawn 可执行文件或官方包内的 `cursor-agent`（与 PATH / versions 解析一致）。
 */
export function spawnCursorCli(
  cliPath: string,
  args: string[],
  options: CursorSpawnOptions,
): ReturnType<typeof spawn> {
  if (process.platform === 'win32' && WIN_SCRIPT_EXT.test(cliPath)) {
    const exe = tryWindowsExeSibling(cliPath);
    if (exe) {
      return spawn(exe, args, options);
    }
    return spawn(cliPath, args, { ...options, shell: true });
  }
  return spawn(cliPath, args, options);
}
