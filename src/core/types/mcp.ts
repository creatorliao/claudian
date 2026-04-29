/**
 * MCP (Model Context Protocol) type definitions used by the shared manager/UI.
 *
 * 文件分工（CC 官方格式）：
 *   {vault}/.mcp.json              → 项目级主配置，纯官方格式，无自创字段
 *   {vault}/.claude/mcp-meta.json  → Claudian 专用元数据（enabled / contextSaving / disabledTools / description）
 *   ~/.claude.json                 → 全局/本地 MCP，Claudian 只读不写
 */

/** Stdio server configuration (local command-line programs). */
export interface McpStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** Server-Sent Events remote server configuration. */
export interface McpSSEServerConfig {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

/** HTTP remote server configuration. */
export interface McpHttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

/** Union type for all MCP server configurations. */
export type McpServerConfig =
  | McpStdioServerConfig
  | McpSSEServerConfig
  | McpHttpServerConfig;

/** Server type identifier. */
export type McpServerType = 'stdio' | 'sse' | 'http';

/**
 * MCP 服务器的来源作用域：
 *   project → {vault}/.mcp.json，可完整 CRUD
 *   local   → ~/.claude.json projects[vaultPath].mcpServers，只读
 *   user    → ~/.claude.json mcpServers（全局），只读
 */
export type McpServerSource = 'project' | 'local' | 'user';

/** Managed MCP server configuration with UI/runtime metadata. */
export interface ManagedMcpServer {
  /** Unique server name (key in mcpServers record). */
  name: string;
  config: McpServerConfig;
  enabled: boolean;
  /** Context-saving mode: hide tools unless @-mentioned. */
  contextSaving: boolean;
  /** Tool names disabled for this server. */
  disabledTools?: string[];
  description?: string;
  /**
   * 来源作用域；未定义时视为 'project'（向下兼容 & 默认值）。
   * 只有 'project' 来源的服务器可被 Claudian 写入。
   */
  source?: McpServerSource;
}

/** .mcp.json 文件格式（CC 官方格式，无自创字段）。 */
export interface McpConfigFile {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * .claude/mcp-meta.json 文件格式（Claudian 专用元数据）。
 * 与 .mcp.json 分离，保持主配置文件纯净。
 */
export interface McpMetaFile {
  servers: Record<
    string,
    {
      enabled?: boolean;
      contextSaving?: boolean;
      disabledTools?: string[];
      description?: string;
    }
  >;
}

/** Result of parsing clipboard config. */
export interface ParsedMcpConfig {
  servers: Array<{ name: string; config: McpServerConfig }>;
  needsName: boolean;
}

export function getMcpServerType(config: McpServerConfig): McpServerType {
  if (config.type === 'sse') return 'sse';
  if (config.type === 'http') return 'http';
  if ('url' in config) return 'http'; // URL without explicit type defaults to http
  return 'stdio';
}

export function isValidMcpServerConfig(obj: unknown): obj is McpServerConfig {
  if (!obj || typeof obj !== 'object') return false;
  const config = obj as Record<string, unknown>;

  // Check for stdio (command required)
  if (config.command && typeof config.command === 'string') return true;

  // Check for sse/http (url required, type is optional - defaults to http)
  if (config.url && typeof config.url === 'string') return true;

  return false;
}

export const DEFAULT_MCP_SERVER: Omit<ManagedMcpServer, 'name' | 'config'> = {
  enabled: true,
  contextSaving: true,
};
