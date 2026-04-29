export type HiddenProviderCommands = Record<string, string[]>;

export interface ApprovalSelectionDecision {
  type: 'select-option';
  value: string;
}

/** User decision from the approval modal. */
export type ApprovalDecision =
  | 'allow'
  | 'allow-always'
  | 'deny'
  | 'cancel'
  | ApprovalSelectionDecision;

/** Saved environment variable configuration. */
export interface EnvSnippet {
  id: string;
  name: string;
  description: string;
  envVars: string;
  scope?: EnvironmentScope;
  contextLimits?: Record<string, number>;  // Optional: context limits for custom models
}

/** Source of a slash command. */
export type SlashCommandSource = 'builtin' | 'user' | 'plugin' | 'sdk';

/** Slash command configuration shared by the UI, storage, and runtime boundary. */
export interface SlashCommand {
  id: string;
  name: string;                // Command name used after / (e.g., "review-code")
  description?: string;        // Optional description shown in dropdown
  argumentHint?: string;       // Placeholder text for arguments (e.g., "[file] [focus]")
  allowedTools?: string[];     // Restrict tools when command is used
  model?: string;              // Optional provider-specific model override
  content: string;             // Prompt template with placeholders
  source?: SlashCommandSource; // Origin of the command (builtin, user, plugin, sdk)
  kind?: 'command' | 'skill';  // Explicit type — replaces id-prefix heuristic
  // Provider-owned command metadata that the UI preserves and round-trips.
  disableModelInvocation?: boolean;  // Disable model invocation for this skill
  userInvocable?: boolean;           // Whether user can invoke this skill directly
  context?: 'fork';                  // Subagent execution mode
  agent?: string;                    // Subagent type when context='fork'
  hooks?: Record<string, unknown>;   // Pass-through to SDK
}

/** Keyboard navigation settings for vim-style scrolling. */
export interface KeyboardNavigationSettings {
  scrollUpKey: string;         // Key to scroll up when focused on messages (default: 'w')
  scrollDownKey: string;       // Key to scroll down when focused on messages (default: 's')
  focusInputKey: string;       // Key to focus input (default: 'i', like vim insert mode)
}

/** Tab bar position setting. */
export type TabBarPosition = 'input' | 'header';

/** Result from instruction refinement agent query. */
export interface InstructionRefineResult {
  success: boolean;
  refinedInstruction?: string;  // The refined instruction text
  clarification?: string;       // Agent's clarifying question (if any)
  error?: string;               // Error message (if failed)
}

/** Permission mode for tool execution. */
export type PermissionMode = 'yolo' | 'plan' | 'normal';

/** Scope for environment variable storage and snippets. */
export type EnvironmentScope = 'shared' | `provider:${string}`;

/** Hostname-keyed CLI paths for per-device configuration. */
export type HostnameCliPaths = Record<string, string>;

/** Opaque provider-owned settings bags keyed by provider id. */
export type ProviderConfigMap = Partial<Record<string, Record<string, unknown>>>;

/**
 * Application settings stored in .claudian/claudian-settings.json.
 *
 * Provider-specific fields (model, thinkingBudget, effortLevel, serviceTier, etc.) use
 * `string` here.  The active provider casts internally when it needs
 * narrower types.
 */
export interface ClaudianSettings {
  // User preferences
  userName: string;
  /** 对话界面左上角（Logo 旁）展示的智能体名称；留空则显示默认「Claudian」 */
  agentName: string;

  // Security
  permissionMode: PermissionMode;

  // Model & thinking (provider interprets values)
  model: string;
  thinkingBudget: string;
  effortLevel: string;
  serviceTier: string;
  enableAutoTitleGeneration: boolean;
  titleGenerationModel: string;

  // Content settings
  excludedTags: string[];
  mediaFolder: string;
  systemPrompt: string;
  persistentExternalContextPaths: string[];

  // Environment
  sharedEnvironmentVariables: string;
  envSnippets: EnvSnippet[];
  customContextLimits: Record<string, number>;

  // UI settings
  keyboardNavigation: KeyboardNavigationSettings;

  // Internationalization
  locale: string;

  // Provider-owned settings
  providerConfigs: ProviderConfigMap;

  // Provider selection
  settingsProvider: string;  // ProviderId — which provider's model/effort/budget is projected to top-level fields
  savedProviderModel: Partial<Record<string, string>>;
  savedProviderEffort: Partial<Record<string, string>>;
  savedProviderServiceTier: Partial<Record<string, string>>;
  savedProviderThinkingBudget: Partial<Record<string, string>>;

  // State (provider-specific, round-tripped opaquely)
  lastCustomModel?: string;

  /** 通用设置页是否展开「更多选项」（显示系统提示词、环境变量等）；默认关闭以降低初次上手门槛 */
  showMoreGeneralOptions: boolean;

  /**
   * 各提供商设置页「显示更多选项」开关；缺失的键视为 `false`（简易模式）。
   * 当前仅 Claude 页使用；Codex/Cursor 可后续对齐。
   */
  providerShowMoreOptions?: Partial<Record<'claude' | 'codex' | 'cursor', boolean>>;

  // UI preferences
  maxTabs: number;
  /**
   * 全局偏好：侧栏对话底部组合器（.claudian-input-container）的 min-height（px），已由运行时钳制。
   * 缺省表示不覆盖默认布局。
   */
  composerPreferredMinHeightPx?: number;
  tabBarPosition: TabBarPosition;
  enableAutoScroll: boolean;
  openInMainTab: boolean;

  /**
   * 是否允许用户在文件库右键与标题栏重置工作空间等处切换会话工作目录（子文件夹）。
   * 默认关闭，语义为始终在 Vault 根运行；关闭时也会清空持久化的默认工作空间路径。
   */
  allowWorkspaceSwitch: boolean;

  // Provider command visibility
  hiddenProviderCommands: HiddenProviderCommands;

  // Allow provider-specific extension fields
  [key: string]: unknown;
}
