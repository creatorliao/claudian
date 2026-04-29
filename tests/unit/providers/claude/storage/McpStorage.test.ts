import { parseClipboardConfig, tryParseClipboardConfig } from '@/core/mcp/McpConfigParser';
import type { VaultFileAdapter } from '@/core/storage/VaultFileAdapter';
import { MCP_CONFIG_PATH, MCP_META_PATH, McpStorage } from '@/providers/claude/storage/McpStorage';

/** Mock adapter with exposed store for test assertions. */
type MockAdapter = VaultFileAdapter & { _store: Record<string, string> };

// Mock VaultFileAdapter with minimal implementation for McpStorage tests
function createMockAdapter(files: Record<string, string> = {}): MockAdapter {
  const store = { ...files };
  return {
    exists: async (path: string) => path in store,
    read: async (path: string) => {
      if (!(path in store)) throw new Error(`File not found: ${path}`);
      return store[path];
    },
    write: async (path: string, content: string) => {
      store[path] = content;
    },
    delete: async (path: string) => {
      delete store[path];
    },
    // Expose store for assertions
    _store: store,
  } as unknown as MockAdapter;
}

describe('McpStorage', () => {
  describe('load', () => {
    it('returns empty array when file does not exist', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);
      const servers = await storage.load();
      expect(servers).toEqual([]);
    });

    it('loads servers from .mcp.json with meta from mcp-meta.json', async () => {
      const config = {
        mcpServers: {
          alpha: { command: 'alpha-cmd', args: ['--arg'] },
        },
      };
      const meta = {
        servers: {
          alpha: {
            enabled: true,
            contextSaving: true,
            disabledTools: ['tool_a', 'tool_b'],
          },
        },
      };

      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: JSON.stringify(config),
        [MCP_META_PATH]: JSON.stringify(meta),
      });
      const storage = new McpStorage(adapter);
      const servers = await storage.load();

      expect(servers).toHaveLength(1);
      expect(servers[0]).toMatchObject({
        name: 'alpha',
        config: { command: 'alpha-cmd', args: ['--arg'] },
        enabled: true,
        contextSaving: true,
        disabledTools: ['tool_a', 'tool_b'],
        source: 'project',
      });
    });

    it('filters out non-string disabledTools', async () => {
      const config = {
        mcpServers: {
          alpha: { command: 'alpha-cmd' },
        },
      };
      const meta = {
        servers: {
          alpha: {
            disabledTools: ['valid', 123, null, 'also_valid'],
          },
        },
      };

      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: JSON.stringify(config),
        [MCP_META_PATH]: JSON.stringify(meta),
      });
      const storage = new McpStorage(adapter);
      const servers = await storage.load();

      expect(servers[0].disabledTools).toEqual(['valid', 'also_valid']);
    });

    it('returns undefined disabledTools when array is empty', async () => {
      const config = {
        mcpServers: {
          alpha: { command: 'alpha-cmd' },
        },
      };
      const meta = {
        servers: {
          alpha: {
            disabledTools: [],
          },
        },
      };

      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: JSON.stringify(config),
        [MCP_META_PATH]: JSON.stringify(meta),
      });
      const storage = new McpStorage(adapter);
      const servers = await storage.load();

      expect(servers[0].disabledTools).toBeUndefined();
    });

    it('returns empty array on JSON parse error', async () => {
      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: 'invalid json{',
      });
      const storage = new McpStorage(adapter);

      const servers = await storage.load();
      expect(servers).toEqual([]);
    });

    it('returns empty array when mcpServers is missing', async () => {
      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: JSON.stringify({}),
      });
      const storage = new McpStorage(adapter);
      const servers = await storage.load();
      expect(servers).toEqual([]);
    });

    it('returns empty array when mcpServers is not an object', async () => {
      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: JSON.stringify({ mcpServers: 'invalid' }),
      });
      const storage = new McpStorage(adapter);
      const servers = await storage.load();
      expect(servers).toEqual([]);
    });

    it('skips invalid server configs', async () => {
      const config = {
        mcpServers: {
          valid: { command: 'valid-cmd' },
          invalid: { notACommand: true },
        },
      };
      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: JSON.stringify(config),
      });
      const storage = new McpStorage(adapter);
      const servers = await storage.load();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('valid');
    });

    it('applies defaults when no meta file exists', async () => {
      const config = {
        mcpServers: {
          alpha: { command: 'alpha-cmd' },
        },
      };
      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: JSON.stringify(config),
      });
      const storage = new McpStorage(adapter);
      const servers = await storage.load();

      expect(servers[0]).toMatchObject({
        name: 'alpha',
        enabled: true,
        contextSaving: true,
        disabledTools: undefined,
        source: 'project',
      });
    });

    it('loads description from meta file', async () => {
      const config = {
        mcpServers: { alpha: { command: 'cmd' } },
      };
      const meta = {
        servers: {
          alpha: { description: 'My server' },
        },
      };
      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: JSON.stringify(config),
        [MCP_META_PATH]: JSON.stringify(meta),
      });
      const storage = new McpStorage(adapter);
      const servers = await storage.load();
      expect(servers[0].description).toBe('My server');
    });

    it('does not read old .claude/mcp.json (废弃路径)', async () => {
      // 旧路径有数据，新路径无数据 → 返回空（不再读旧路径）
      const adapter = createMockAdapter({
        '.claude/mcp.json': JSON.stringify({
          mcpServers: { old: { command: 'old-cmd' } },
        }),
      });
      const storage = new McpStorage(adapter);
      const servers = await storage.load();
      expect(servers).toEqual([]);
    });
  });

  describe('save', () => {
    it('writes pure CC format to .mcp.json (no _claudian key)', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'alpha',
          config: { command: 'alpha-cmd' },
          enabled: true,
          contextSaving: true,
          source: 'project',
        },
      ]);

      const saved = JSON.parse(adapter._store[MCP_CONFIG_PATH]);
      expect(saved._claudian).toBeUndefined();
      expect(saved.mcpServers.alpha).toEqual({ command: 'alpha-cmd' });
    });

    it('omits type field for stdio servers (CC default)', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'stdio-server',
          config: { type: 'stdio', command: 'cmd', args: ['--flag'] },
          enabled: true,
          contextSaving: true,
          source: 'project',
        },
      ]);

      const saved = JSON.parse(adapter._store[MCP_CONFIG_PATH]);
      // type 字段应被省略（CC 默认即 stdio）
      expect(saved.mcpServers['stdio-server'].type).toBeUndefined();
      expect(saved.mcpServers['stdio-server'].command).toBe('cmd');
    });

    it('preserves type for HTTP servers', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'http-server',
          config: { type: 'http', url: 'https://example.com/mcp' },
          enabled: true,
          contextSaving: true,
          source: 'project',
        },
      ]);

      const saved = JSON.parse(adapter._store[MCP_CONFIG_PATH]);
      expect(saved.mcpServers['http-server'].type).toBe('http');
      expect(saved.mcpServers['http-server'].url).toBe('https://example.com/mcp');
    });

    it('saves disabledTools to mcp-meta.json', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'alpha',
          config: { command: 'alpha-cmd' },
          enabled: true,
          contextSaving: true,
          disabledTools: ['tool_a', 'tool_b'],
          source: 'project',
        },
      ]);

      const meta = JSON.parse(adapter._store[MCP_META_PATH]);
      expect(meta.servers.alpha.disabledTools).toEqual(['tool_a', 'tool_b']);
    });

    it('trims and filters blank disabledTools on save', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'alpha',
          config: { command: 'alpha-cmd' },
          enabled: true,
          contextSaving: true,
          disabledTools: ['  tool_a  ', '', '  ', 'tool_b'],
          source: 'project',
        },
      ]);

      const meta = JSON.parse(adapter._store[MCP_META_PATH]);
      expect(meta.servers.alpha.disabledTools).toEqual(['tool_a', 'tool_b']);
    });

    it('omits server from meta when all fields are default', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'alpha',
          config: { command: 'alpha-cmd' },
          enabled: true,  // default
          contextSaving: true,  // default
          disabledTools: [],
          source: 'project',
        },
      ]);

      const meta = JSON.parse(adapter._store[MCP_META_PATH]);
      // 所有字段均为默认值，meta 中不写入该服务器
      expect(meta.servers.alpha).toBeUndefined();
    });

    it('round-trips disabledTools correctly', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      const original = [
        {
          name: 'alpha',
          config: { command: 'alpha-cmd' },
          enabled: true,
          contextSaving: true,
          disabledTools: ['tool_a', 'tool_b'],
          source: 'project' as const,
        },
        {
          name: 'beta',
          config: { command: 'beta-cmd' },
          enabled: false,
          contextSaving: false,
          disabledTools: undefined,
          source: 'project' as const,
        },
      ];

      await storage.save(original);
      const loaded = await storage.load();

      expect(loaded).toHaveLength(2);
      expect(loaded[0]).toMatchObject({
        name: 'alpha',
        disabledTools: ['tool_a', 'tool_b'],
      });
      expect(loaded[1]).toMatchObject({
        name: 'beta',
        disabledTools: undefined,
      });
    });

    it('saves description to meta file', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'alpha',
          config: { command: 'cmd' },
          enabled: true,
          contextSaving: true,
          description: 'A test server',
          source: 'project',
        },
      ]);

      const meta = JSON.parse(adapter._store[MCP_META_PATH]);
      expect(meta.servers.alpha.description).toBe('A test server');
    });

    it('stores enabled=false in meta when different from default', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'alpha',
          config: { command: 'cmd' },
          enabled: false,
          contextSaving: true,
          source: 'project',
        },
      ]);

      const meta = JSON.parse(adapter._store[MCP_META_PATH]);
      expect(meta.servers.alpha.enabled).toBe(false);
    });

    it('stores contextSaving=false in meta when different from default', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'alpha',
          config: { command: 'cmd' },
          enabled: true,
          contextSaving: false,
          source: 'project',
        },
      ]);

      const meta = JSON.parse(adapter._store[MCP_META_PATH]);
      expect(meta.servers.alpha.contextSaving).toBe(false);
    });

    it('skips non-project servers (source = local/user)', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'project-server',
          config: { command: 'project-cmd' },
          enabled: true,
          contextSaving: true,
          source: 'project',
        },
        {
          name: 'global-server',
          config: { command: 'global-cmd' },
          enabled: true,
          contextSaving: true,
          source: 'user',
        },
        {
          name: 'local-server',
          config: { command: 'local-cmd' },
          enabled: true,
          contextSaving: true,
          source: 'local',
        },
      ]);

      const config = JSON.parse(adapter._store[MCP_CONFIG_PATH]);
      // 只有项目级服务器写入 .mcp.json
      expect(Object.keys(config.mcpServers)).toEqual(['project-server']);
    });

    it('handles corrupted existing files gracefully', async () => {
      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: 'not json',
        [MCP_META_PATH]: 'not json',
      });
      const storage = new McpStorage(adapter);

      // save 应该成功覆盖损坏的文件
      await storage.save([
        {
          name: 'alpha',
          config: { command: 'cmd' },
          enabled: true,
          contextSaving: true,
          source: 'project',
        },
      ]);

      const saved = JSON.parse(adapter._store[MCP_CONFIG_PATH]);
      expect(saved.mcpServers.alpha).toEqual({ command: 'cmd' });
    });

    it('omits empty args and env from stdout config', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);

      await storage.save([
        {
          name: 'alpha',
          config: { command: 'cmd', args: [], env: {} },
          enabled: true,
          contextSaving: true,
          source: 'project',
        },
      ]);

      const saved = JSON.parse(adapter._store[MCP_CONFIG_PATH]);
      // 空 args 和 env 应省略（保持 CC 输出最简洁）
      expect(saved.mcpServers.alpha.args).toBeUndefined();
      expect(saved.mcpServers.alpha.env).toBeUndefined();
    });
  });

  describe('exists', () => {
    it('returns false when .mcp.json does not exist', async () => {
      const adapter = createMockAdapter();
      const storage = new McpStorage(adapter);
      expect(await storage.exists()).toBe(false);
    });

    it('returns true when .mcp.json exists', async () => {
      const adapter = createMockAdapter({
        [MCP_CONFIG_PATH]: '{}',
      });
      const storage = new McpStorage(adapter);
      expect(await storage.exists()).toBe(true);
    });
  });

  describe('parseClipboardConfig', () => {
    it('parses full Claude Code format (mcpServers wrapper)', () => {
      const json = JSON.stringify({
        mcpServers: {
          'my-server': { command: 'node', args: ['server.js'] },
        },
      });

      const result = parseClipboardConfig(json);
      expect(result.needsName).toBe(false);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('my-server');
      expect(result.servers[0].config).toEqual({ command: 'node', args: ['server.js'] });
    });

    it('parses multiple servers in mcpServers format', () => {
      const json = JSON.stringify({
        mcpServers: {
          alpha: { command: 'alpha-cmd' },
          beta: { type: 'sse', url: 'http://localhost:3000' },
        },
      });

      const result = parseClipboardConfig(json);
      expect(result.servers).toHaveLength(2);
      expect(result.needsName).toBe(false);
    });

    it('parses single server config without name (command-based)', () => {
      const json = JSON.stringify({ command: 'node', args: ['server.js'] });

      const result = parseClipboardConfig(json);
      expect(result.needsName).toBe(true);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('');
      expect((result.servers[0].config as { command: string }).command).toBe('node');
    });

    it('parses single server config without name (url-based)', () => {
      const json = JSON.stringify({ type: 'sse', url: 'http://example.com' });

      const result = parseClipboardConfig(json);
      expect(result.needsName).toBe(true);
      expect(result.servers[0].config).toEqual({ type: 'sse', url: 'http://example.com' });
    });

    it('parses single named server', () => {
      const json = JSON.stringify({
        'my-server': { command: 'node', args: ['server.js'] },
      });

      const result = parseClipboardConfig(json);
      expect(result.needsName).toBe(false);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('my-server');
    });

    it('parses multiple named servers without mcpServers wrapper', () => {
      const json = JSON.stringify({
        server1: { command: 'cmd1' },
        server2: { command: 'cmd2' },
      });

      const result = parseClipboardConfig(json);
      expect(result.needsName).toBe(false);
      expect(result.servers).toHaveLength(2);
    });

    it('throws for invalid JSON', () => {
      expect(() => parseClipboardConfig('not json'))
        .toThrow('Invalid JSON');
    });

    it('throws for non-object JSON', () => {
      expect(() => parseClipboardConfig('"string"'))
        .toThrow('Invalid JSON object');
    });

    it('throws when mcpServers contains no valid configs', () => {
      const json = JSON.stringify({
        mcpServers: {
          invalid: { notACommand: true },
        },
      });

      expect(() => parseClipboardConfig(json))
        .toThrow('No valid server configs found');
    });

    it('throws for unrecognized format', () => {
      const json = JSON.stringify({ someRandomField: 123 });

      expect(() => parseClipboardConfig(json))
        .toThrow('Invalid MCP configuration format');
    });

    it('skips invalid entries in mcpServers but includes valid ones', () => {
      const json = JSON.stringify({
        mcpServers: {
          valid: { command: 'cmd' },
          invalid: { notACommand: true },
        },
      });

      const result = parseClipboardConfig(json);
      expect(result.servers).toHaveLength(1);
      expect(result.servers[0].name).toBe('valid');
    });
  });

  describe('tryParseClipboardConfig', () => {
    it('returns parsed config for valid JSON', () => {
      const text = JSON.stringify({ command: 'node', args: ['server.js'] });
      const result = tryParseClipboardConfig(text);
      expect(result).not.toBeNull();
      expect(result!.needsName).toBe(true);
    });

    it('returns null for non-JSON text', () => {
      expect(tryParseClipboardConfig('hello world')).toBeNull();
    });

    it('returns null for text not starting with {', () => {
      expect(tryParseClipboardConfig('[1, 2, 3]')).toBeNull();
    });

    it('returns null for invalid MCP config that is valid JSON', () => {
      expect(tryParseClipboardConfig('{ "random": 42 }')).toBeNull();
    });

    it('trims whitespace before checking', () => {
      const text = '  \n  ' + JSON.stringify({ command: 'node' }) + '  \n';
      const result = tryParseClipboardConfig(text);
      expect(result).not.toBeNull();
    });
  });
});
