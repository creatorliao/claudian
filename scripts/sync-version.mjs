#!/usr/bin/env node
/**
 * npm version 生命周期钩子：将 package.json 的 version 同步到 manifest.json。
 * 与 package.json 中 "version": "node scripts/sync-version.mjs && git add manifest.json" 配合使用。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const packagePath = join(ROOT, 'package.json');
const manifestPath = join(ROOT, 'manifest.json');

const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
const manifestJson = JSON.parse(readFileSync(manifestPath, 'utf8'));

manifestJson.version = packageJson.version;

writeFileSync(manifestPath, `${JSON.stringify(manifestJson, null, 2)}\n`, 'utf8');

console.log(`Synced version to ${packageJson.version}`);
