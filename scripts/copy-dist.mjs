#!/usr/bin/env node
/**
 * 将生产构建产物复制到 dist/，便于打包或离线分发。
 */
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const FILES = ['main.js', 'styles.css', 'manifest.json'];

mkdirSync(DIST, { recursive: true });

for (const name of FILES) {
  const src = join(ROOT, name);
  if (!existsSync(src)) {
    console.error(`copy-dist: 缺少 ${name}，请先执行 npm run build`);
    process.exit(1);
  }
  copyFileSync(src, join(DIST, name));
}

console.log(`copy-dist: 已复制 ${FILES.join(', ')} → dist/`);
