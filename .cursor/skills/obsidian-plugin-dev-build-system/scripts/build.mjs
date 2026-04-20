#!/usr/bin/env node
/**
 * 构建入口脚本（参考实现）
 * 
 * 本脚本是参考实现，可以根据项目实际情况进行适配或替换。
 * 但必须遵守核心行为规范：
 * - 构建产物输出到 dist/{pluginName}/
 * - 遵守目录命名规范（当前项目用 id，上级目录用 name）
 * - 实现自动复制到 Obsidian 插件目录
 * 
 * 功能：
 * - 运行 CSS 构建（如果项目需要）
 * - 运行 esbuild 构建
 * - 避免 npm 回显命令
 */

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Run CSS build silently
execSync('node scripts/build-css.mjs', { cwd: ROOT, stdio: 'inherit' });

// Run esbuild with args passed through
const args = process.argv.slice(2).join(' ');
execSync(`node scripts/esbuild.config.mjs ${args}`, { cwd: ROOT, stdio: 'inherit' });
