import { extractMcpMentions, transformMcpMentions } from '../../utils/mcp';
import type { ManagedMcpServer, McpServerConfig } from '../types';
import { readClaudeCodeGlobalMcps } from './ClaudeCodeGlobalMcpReader';

/** 项目级 MCP 存储适配器接口。 */
export interface McpStorageAdapter {
  load(): Promise<ManagedMcpServer[]>;
  save(servers: ManagedMcpServer[]): Promise<void>;
}

export class McpServerManager {
  private servers: ManagedMcpServer[] = [];
  private storage: McpStorageAdapter;
  /** vault 根目录绝对路径，用于读取 ~/.claude.json 中的 projects[vaultPath] 条目。 */
  private vaultPath: string;

  constructor(storage: McpStorageAdapter, vaultPath: string = '') {
    this.storage = storage;
    this.vaultPath = vaultPath;
  }

  /**
   * 从磁盘加载所有 MCP 服务器，合并三个来源：
   *   1. 项目级（.mcp.json，可编辑，source = 'project'）
   *   2. 本地（~/.claude.json projects[vaultPath]，只读，source = 'local'）
   *   3. 全局（~/.claude.json mcpServers，只读，source = 'user'）
   *
   * 优先级：local > project > user；同名取最高优先级那条，低优先级的同名条目不单独显示。
   */
  async loadServers(): Promise<void> {
    const [projectServers, externalServers] = await Promise.all([
      this.storage.load(),
      this.vaultPath ? readClaudeCodeGlobalMcps(this.vaultPath) : Promise.resolve([]),
    ]);

    this.servers = mergeByPriority(externalServers, projectServers);
  }

  /**
   * 保存项目级服务器到磁盘（只写 source === 'project' 的条目）。
   * 更新内部列表：保留外部（local/user）服务器，替换项目级部分。
   *
   * @param servers 要保存的服务器列表（可包含任意来源，非 project 来源会被过滤）
   */
  async saveProjectServers(servers: ManagedMcpServer[]): Promise<void> {
    const projectServers = servers.filter(
      (s) => !s.source || s.source === 'project'
    );
    await this.storage.save(projectServers);

    // 更新内部缓存：外部来源不变，只替换项目级部分
    const externalServers = this.servers.filter(
      (s) => s.source === 'local' || s.source === 'user'
    );
    this.servers = mergeByPriority(externalServers, projectServers);
  }

  getServers(): ManagedMcpServer[] {
    return this.servers;
  }

  getEnabledCount(): number {
    return this.servers.filter((s) => s.enabled).length;
  }

  /**
   * Get servers to include in SDK options.
   *
   * A server is included if:
   * - It is enabled AND
   * - Either context-saving is disabled OR the server is @-mentioned
   *
   * @param mentionedNames Set of server names that were @-mentioned in the prompt
   */
  getActiveServers(mentionedNames: Set<string>): Record<string, McpServerConfig> {
    const result: Record<string, McpServerConfig> = {};

    for (const server of this.servers) {
      if (!server.enabled) continue;

      // If context-saving is enabled, only include if @-mentioned
      if (server.contextSaving && !mentionedNames.has(server.name)) {
        continue;
      }

      result[server.name] = server.config;
    }

    return result;
  }

  /**
   * Get disabled MCP tools formatted for SDK disallowedTools option.
   *
   * Only returns disabled tools from servers that would be active (same filter as getActiveServers).
   *
   * @param mentionedNames Set of server names that were @-mentioned in the prompt
   */
  getDisallowedMcpTools(mentionedNames: Set<string>): string[] {
    return this.collectDisallowedTools(
      (s) => !s.contextSaving || mentionedNames.has(s.name)
    );
  }

  /**
   * Get all disabled MCP tools from ALL enabled servers (ignoring @-mentions).
   *
   * Used for persistent queries to pre-register all disabled tools upfront,
   * so @-mentioning servers doesn't require cold start.
   */
  getAllDisallowedMcpTools(): string[] {
    return this.collectDisallowedTools().sort();
  }

  private collectDisallowedTools(filter?: (server: ManagedMcpServer) => boolean): string[] {
    const disallowed = new Set<string>();

    for (const server of this.servers) {
      if (!server.enabled) continue;
      if (filter && !filter(server)) continue;
      if (!server.disabledTools || server.disabledTools.length === 0) continue;

      for (const tool of server.disabledTools) {
        const normalized = tool.trim();
        if (!normalized) continue;
        disallowed.add(`mcp__${server.name}__${normalized}`);
      }
    }

    return Array.from(disallowed);
  }

  hasServers(): boolean {
    return this.servers.length > 0;
  }

  getContextSavingServers(): ManagedMcpServer[] {
    return this.servers.filter((s) => s.enabled && s.contextSaving);
  }

  private getContextSavingNames(): Set<string> {
    return new Set(this.getContextSavingServers().map((s) => s.name));
  }

  /** Only matches against enabled servers with context-saving mode. */
  extractMentions(text: string): Set<string> {
    return extractMcpMentions(text, this.getContextSavingNames());
  }

  /**
   * Appends " MCP" after each valid @mention. Applied to API requests only, not shown in UI.
   */
  transformMentions(text: string): string {
    return transformMcpMentions(text, this.getContextSavingNames());
  }
}

/**
 * 按优先级合并 external（local/user）与 project 服务器列表，去同名重复。
 *
 * 优先级：local > project > user
 *   - local 排前面，直接占坑
 *   - project 只填 local 未占用的名称
 *   - user 只填前两者均未占用的名称
 *
 * @param externalServers 来自 ~/.claude.json 的服务器列表（local 在前，user 在后，已去重）
 * @param projectServers  来自 .mcp.json 的服务器列表
 */
function mergeByPriority(
  externalServers: ManagedMcpServer[],
  projectServers: ManagedMcpServer[]
): ManagedMcpServer[] {
  // 使用 Map 保持插入顺序，先处理高优先级的来源
  const seen = new Map<string, ManagedMcpServer>();

  // 1. local 来源（external 中排前，优先级最高）
  for (const s of externalServers) {
    if (s.source === 'local' && !seen.has(s.name)) {
      seen.set(s.name, s);
    }
  }

  // 2. project 来源
  for (const s of projectServers) {
    if (!seen.has(s.name)) {
      seen.set(s.name, s);
    }
  }

  // 3. user 来源（external 中排后，优先级最低）
  for (const s of externalServers) {
    if (s.source === 'user' && !seen.has(s.name)) {
      seen.set(s.name, s);
    }
  }

  return Array.from(seen.values());
}
