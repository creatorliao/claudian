/**
 * McpStorage：项目级 MCP 配置的读写服务。
 *
 * 文件分工：
 *   .mcp.json               → CC 官方格式主配置，mcpServers，无自创字段
 *   .claude/mcp-meta.json   → Claudian 专用元数据（enabled / contextSaving / disabledTools / description）
 *
 * 旧路径 .claude/mcp.json 已废弃，代码中不再引用；文件若存在直接忽略。
 */

import type { VaultFileAdapter } from '../../../core/storage/VaultFileAdapter';
import type {
  ManagedMcpServer,
  McpConfigFile,
  McpMetaFile,
} from '../../../core/types';
import { DEFAULT_MCP_SERVER, isValidMcpServerConfig } from '../../../core/types';

/** 项目级主配置文件路径（CC 官方格式）。 */
export const MCP_CONFIG_PATH = '.mcp.json';

/** Claudian 元数据文件路径（不被 CC CLI 读取）。 */
export const MCP_META_PATH = '.claude/mcp-meta.json';

export class McpStorage {
  constructor(private adapter: VaultFileAdapter) {}

  // ── 读 ──────────────────────────────────────────────────────────────────

  async load(): Promise<ManagedMcpServer[]> {
    try {
      const [configs, meta] = await Promise.all([
        this.loadConfigFile(),
        this.loadMetaFile(),
      ]);
      return mergeConfigAndMeta(configs, meta);
    } catch {
      return [];
    }
  }

  /** 读取 .mcp.json，返回 mcpServers 记录；文件不存在时返回空对象。 */
  private async loadConfigFile(): Promise<Record<string, unknown>> {
    if (!(await this.adapter.exists(MCP_CONFIG_PATH))) {
      return {};
    }
    try {
      const content = await this.adapter.read(MCP_CONFIG_PATH);
      const file = JSON.parse(content) as McpConfigFile;
      if (!file.mcpServers || typeof file.mcpServers !== 'object') {
        return {};
      }
      return file.mcpServers as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /** 读取 .claude/mcp-meta.json，返回 servers 记录；文件不存在时返回空对象。 */
  private async loadMetaFile(): Promise<McpMetaFile['servers']> {
    if (!(await this.adapter.exists(MCP_META_PATH))) {
      return {};
    }
    try {
      const content = await this.adapter.read(MCP_META_PATH);
      const file = JSON.parse(content) as McpMetaFile;
      if (!file.servers || typeof file.servers !== 'object') {
        return {};
      }
      return file.servers;
    } catch {
      return {};
    }
  }

  // ── 写 ──────────────────────────────────────────────────────────────────

  /**
   * 保存项目级服务器到 .mcp.json + .claude/mcp-meta.json。
   * 全局/本地来源（source === 'local' | 'user'）的服务器不写入，只写项目级。
   */
  async save(servers: ManagedMcpServer[]): Promise<void> {
    // 只保存项目级服务器；全局/本地来源只读，不写回
    const projectServers = servers.filter(
      (s) => !s.source || s.source === 'project'
    );

    // 构造 .mcp.json（纯官方格式，无自创字段）
    const mcpServers: Record<string, unknown> = {};
    for (const server of projectServers) {
      mcpServers[server.name] = toOfficialConfig(server);
    }
    const configFile: McpConfigFile = { mcpServers: mcpServers as McpConfigFile['mcpServers'] };
    await this.adapter.write(MCP_CONFIG_PATH, JSON.stringify(configFile, null, 2));

    // 构造 .claude/mcp-meta.json（Claudian 专用元数据）
    const metaServers: McpMetaFile['servers'] = {};
    for (const server of projectServers) {
      const meta = extractMeta(server);
      if (meta !== null) {
        metaServers[server.name] = meta;
      }
    }
    const metaFile: McpMetaFile = { servers: metaServers };
    await this.adapter.write(MCP_META_PATH, JSON.stringify(metaFile, null, 2));
  }

  async exists(): Promise<boolean> {
    return this.adapter.exists(MCP_CONFIG_PATH);
  }
}

// ── 辅助函数 ──────────────────────────────────────────────────────────────

/**
 * 将 mcpServers 配置记录与元数据记录合并为 ManagedMcpServer 数组。
 * 合并后的服务器 source 均为 'project'。
 */
function mergeConfigAndMeta(
  configs: Record<string, unknown>,
  meta: McpMetaFile['servers']
): ManagedMcpServer[] {
  const servers: ManagedMcpServer[] = [];

  for (const [name, config] of Object.entries(configs)) {
    if (!isValidMcpServerConfig(config)) {
      continue;
    }

    const serverMeta = meta[name] ?? {};
    const rawDisabledTools = serverMeta.disabledTools;
    const disabledTools = Array.isArray(rawDisabledTools)
      ? rawDisabledTools.filter((t): t is string => typeof t === 'string')
      : undefined;
    const normalizedDisabledTools =
      disabledTools && disabledTools.length > 0 ? disabledTools : undefined;

    servers.push({
      name,
      config,
      enabled: serverMeta.enabled ?? DEFAULT_MCP_SERVER.enabled,
      contextSaving: serverMeta.contextSaving ?? DEFAULT_MCP_SERVER.contextSaving,
      disabledTools: normalizedDisabledTools,
      description: serverMeta.description,
      source: 'project',
    });
  }

  return servers;
}

/**
 * 将 ManagedMcpServer 的配置转换为 CC 官方格式。
 *
 * Stdio 服务器：省略 type（CC 默认即 stdio）。
 * HTTP/SSE 服务器：原样透传 type，不强制覆盖（保护第三方非标准值如 streamablehttp）。
 */
function toOfficialConfig(server: ManagedMcpServer): Record<string, unknown> {
  // 统一转为松散类型以便动态操作
  const config = server.config as unknown as Record<string, unknown>;

  if ('command' in config) {
    // Stdio：只保留 command / args / env，省略 type
    const out: Record<string, unknown> = { command: config.command };
    const args = config.args as unknown[] | undefined;
    if (args && args.length > 0) out.args = args;
    const env = config.env as Record<string, string> | undefined;
    if (env && Object.keys(env).length > 0) out.env = env;
    return out;
  } else {
    // HTTP / SSE / 其他 URL 类型：原样保留 type，透传非标准值
    const out: Record<string, unknown> = { url: config.url };
    if (config.type) out.type = config.type;
    const headers = config.headers as Record<string, string> | undefined;
    if (headers && Object.keys(headers).length > 0) out.headers = headers;
    return out;
  }
}

/**
 * 提取与默认值不同的元数据字段。
 * 若所有字段均为默认值，返回 null（不写入 meta 文件，保持简洁）。
 */
function extractMeta(
  server: ManagedMcpServer
): McpMetaFile['servers'][string] | null {
  const meta: McpMetaFile['servers'][string] = {};

  if (server.enabled !== DEFAULT_MCP_SERVER.enabled) {
    meta.enabled = server.enabled;
  }
  if (server.contextSaving !== DEFAULT_MCP_SERVER.contextSaving) {
    meta.contextSaving = server.contextSaving;
  }

  const normalizedDisabledTools = server.disabledTools
    ?.map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (normalizedDisabledTools && normalizedDisabledTools.length > 0) {
    meta.disabledTools = normalizedDisabledTools;
  }

  if (server.description) {
    meta.description = server.description;
  }

  return Object.keys(meta).length > 0 ? meta : null;
}
