export type CodexExecutionMethod = 'host-native' | 'native-windows';
export type CodexExecutionPlatformOs = 'windows' | 'linux' | 'macos';
export type CodexExecutionPlatformFamily = 'windows' | 'unix';

export interface CodexExecutionTarget {
  method: CodexExecutionMethod;
  platformFamily: CodexExecutionPlatformFamily;
  platformOs: CodexExecutionPlatformOs;
}

export interface CodexPathMapper {
  target: CodexExecutionTarget;
  toTargetPath(hostPath: string): string | null;
  toHostPath(targetPath: string): string | null;
  mapTargetPathList(hostPaths: string[]): string[];
  canRepresentHostPath(hostPath: string): boolean;
}

export interface CodexLaunchSpec {
  target: CodexExecutionTarget;
  command: string;
  args: string[];
  spawnCwd: string;
  targetCwd: string;
  env: Record<string, string>;
  pathMapper: CodexPathMapper;
}
