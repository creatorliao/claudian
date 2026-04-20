#!/usr/bin/env node
/**
 * CSS 构建脚本（参考实现）
 * 
 * 本脚本是参考实现，可以根据项目实际情况进行适配或替换。
 * CSS 构建是可选的，如果项目不需要 CSS，可以跳过此步骤。
 * 如果项目有 CSS 但无需构建，可以直接复制现有 CSS 文件。
 * 
 * 核心要求：
 * - 输出到 dist/{pluginName}/styles.css（必须遵守）
 * - 不在项目根目录生成临时文件（必须遵守）
 * 
 * 参考实现方式：
 * - CSS 模块化合并（本脚本）
 * - PostCSS 处理
 * - Sass/Less 编译
 * - 直接复制单个 CSS 文件
 * 
 * 构建流程：
 * 1. 读取 manifest.json 获取插件名称
 * 2. 读取 src/style/index.css 中的 @import 语句
 * 3. 按照顺序合并所有引用的 CSS 文件
 * 4. 直接输出到 dist/{pluginName}/styles.css
 * 
 * 注意：styles.css 是构建产物，会被 .gitignore 忽略，不会被提交到 git
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STYLE_DIR = join(ROOT, 'src', 'style');
const INDEX_FILE = join(STYLE_DIR, 'index.css');

// 从 manifest.json 读取插件名称
const manifestPath = join(ROOT, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('Missing manifest.json');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const pluginName = manifest.name;
const outDir = join(ROOT, 'dist', pluginName);

// 确保输出目录存在
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

// 直接输出到 dist/{pluginName}/styles.css
const OUTPUT = join(outDir, 'styles.css');

const IMPORT_PATTERN = /^\s*@import\s+(?:url\()?['"]([^'"]+)['"]\)?\s*;/gm;

function getModuleOrder() {
  if (!existsSync(INDEX_FILE)) {
    console.error('Missing src/style/index.css');
    process.exit(1);
  }

  const content = readFileSync(INDEX_FILE, 'utf-8');
  const matches = [...content.matchAll(IMPORT_PATTERN)];

  if (matches.length === 0) {
    console.error('No @import entries found in src/style/index.css');
    process.exit(1);
  }

  return matches.map((match) => match[1]);
}

function listCssFiles(dir, baseDir = dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listCssFiles(entryPath, baseDir));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.css')) {
      const relativePath = relative(baseDir, entryPath).split('\\').join('/');
      files.push(relativePath);
    }
  }

  return files;
}

function build() {
  const moduleOrder = getModuleOrder();
  const parts = ['/* Claudian Plugin Styles */\n/* Built from src/style/ modules */\n'];
  const missingFiles = [];
  const invalidImports = [];
  const normalizedImports = [];

  for (const modulePath of moduleOrder) {
    const resolvedPath = resolve(STYLE_DIR, modulePath);
    const relativePath = relative(STYLE_DIR, resolvedPath);

    if (relativePath.startsWith('..') || !relativePath.endsWith('.css')) {
      invalidImports.push(modulePath);
      continue;
    }

    const normalizedPath = relativePath.split('\\').join('/');
    normalizedImports.push(normalizedPath);

    if (!existsSync(resolvedPath)) {
      missingFiles.push(normalizedPath);
      continue;
    }

    const content = readFileSync(resolvedPath, 'utf-8');
    const header = `\n/* ============================================\n   ${normalizedPath}\n   ============================================ */\n`;
    parts.push(header + content);
  }

  let hasErrors = false;

  if (invalidImports.length > 0) {
    console.error('Invalid @import entries in src/style/index.css:');
    invalidImports.forEach((modulePath) => console.error(`  - ${modulePath}`));
    hasErrors = true;
  }

  if (missingFiles.length > 0) {
    console.error('Missing CSS files:');
    missingFiles.forEach((f) => console.error(`  - ${f}`));
    hasErrors = true;
  }

  const allCssFiles = listCssFiles(STYLE_DIR).filter((file) => file !== 'index.css');
  const importedSet = new Set(normalizedImports);
  const unlistedFiles = allCssFiles.filter((file) => !importedSet.has(file));

  if (unlistedFiles.length > 0) {
    console.error('Unlisted CSS files (not imported in src/style/index.css):');
    unlistedFiles.forEach((file) => console.error(`  - ${file}`));
    hasErrors = true;
  }

  if (hasErrors) {
    process.exit(1);
  }

  const output = parts.join('\n');
  writeFileSync(OUTPUT, output);
  console.log(`Built styles.css (${(output.length / 1024).toFixed(1)} KB)`);
}

build();
