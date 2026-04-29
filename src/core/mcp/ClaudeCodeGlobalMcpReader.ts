/**
 * 读取 Claude Code 全局/本地 MCP 配置（~/.claude.json）。
 *
 * 作用域说明（与 CC CLI 一致）：
 *   local → ~/.claude.json 中 projects[vaultPath].mcpServers，优先级最高
 *   user  → ~/.claude.json 中顶层 mcpServers（全局），优先级最低
 *
 * Claudian 对此文件只读，不写入。
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ManagedMcpServer } from '../types/mcp';
import { isValidMcpServerConfig } from '../types/mcp';

/**
 * 跨平台获取 ~/.claude.json 绝对路径。
 * 使用 os.homedir() 作为主要来源（Node.js 跨平台标准实现）。
 */
function getClaudeJsonPath(): string {
  return path.join(os.homedir(), '.claude.json');
}

/**
 * 读取 ~/.claude.json 并返回全局/本地 MCP 列表，按优先级排列（local 在前）。
 *
 * @param vaultPath vault 根目录绝对路径，用于匹配 ~/.claude.json 中的 projects[vaultPath]
 * @returns 带 source 标记的服务器列表；读取失败时返回空数组
 */
export async function readClaudeCodeGlobalMcps(vaultPath: string): Promise<ManagedMcpServer[]> {
  const filePath = getClaudeJsonPath();

  let raw: string;
  try {
    raw = await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    // 文件不存在或无读取权限，直接返回空列表
    return [];
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }

  const result: ManagedMcpServer[] = [];

  // Local scope：projects[vaultPath].mcpServers（优先级最高，排前）
  //
  // 路径格式差异（Windows）：
  //   Obsidian basePath  → D:\obsidian-vaults\claudian（反斜杠）
  //   ~/.claude.json key → D:/obsidian-vaults/claudian（正斜杠）
  // 统一转为正斜杠后再比较。
  //
  // 大小写处理：
  //   Windows → NTFS 不区分大小写，额外 toLowerCase() 兜底
  //   macOS/Linux → 文件系统区分大小写，保留原始大小写
  const isWindows = process.platform === 'win32';
  const normalizeProjPath = (p: string): string => {
    const withForwardSlash = p.replace(/\\/g, '/');
    return isWindows ? withForwardSlash.toLowerCase() : withForwardSlash;
  };

  const projects = json.projects as Record<string, { mcpServers?: Record<string, unknown> }> | undefined;
  const normalizedVaultPath = normalizeProjPath(vaultPath);
  const matchedProjectKey = projects
    ? Object.keys(projects).find(
        (k) => normalizeProjPath(k) === normalizedVaultPath
      )
    : undefined;
  const localServers = (matchedProjectKey ? projects?.[matchedProjectKey]?.mcpServers : undefined) ?? {};
  for (const [name, config] of Object.entries(localServers)) {
    if (isValidMcpServerConfig(config)) {
      result.push({
        name,
        config,
        enabled: true,
        contextSaving: true,
        source: 'local',
      });
    }
  }

  // User scope：顶层 mcpServers（全局，优先级低于 local，同名跳过）
  const userServers = (json.mcpServers as Record<string, unknown>) ?? {};
  for (const [name, config] of Object.entries(userServers)) {
    if (isValidMcpServerConfig(config) && !result.find((s) => s.name === name)) {
      result.push({
        name,
        config,
        enabled: true,
        contextSaving: true,
        source: 'user',
      });
    }
  }

  return result;
}
