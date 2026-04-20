import esbuild from 'esbuild';
import path from 'path';
import process from 'process';
import builtins from 'builtin-modules';
import { readPluginId } from './scripts/lib/read-plugin-id.mjs';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  promises as fsPromises,
  readFileSync,
  rmSync,
} from 'fs';

// Load .env.local if it exists
if (existsSync('.env.local')) {
  const envContent = readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=["']?(.+?)["']?$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

const prod = process.argv[2] === 'production';
const repoRoot = process.cwd();
/** 生产构建：产物目录（由 scripts/build.mjs 设置）；开发模式为仓库根目录 */
const pluginBundleDir = process.env.CLAUDIAN_PLUGIN_OUT_DIR || repoRoot;
const manifestSrcPath = path.join(repoRoot, 'manifest.json');
const pluginId = readPluginId(repoRoot);

const patchCodexSdkImportMeta = {
  name: 'patch-codex-sdk-import-meta',
  setup(build) {
    build.onLoad(
      { filter: /[\\/]node_modules[\\/]@openai[\\/]codex-sdk[\\/]dist[\\/]index\.js$/ },
      async (args) => {
        const contents = await fsPromises.readFile(args.path, 'utf8');
        return {
          contents: contents.replace('createRequire(import.meta.url)', 'createRequire(__filename)'),
          loader: 'js',
        };
      },
    );
  },
};

// Obsidian plugin folder path (set via OBSIDIAN_VAULT env var or .env.local)
const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT;
const OBSIDIAN_PLUGIN_PATH = OBSIDIAN_VAULT && existsSync(OBSIDIAN_VAULT)
  ? path.join(OBSIDIAN_VAULT, '.obsidian', 'plugins', pluginId)
  : null;

// Plugin to copy built files to Obsidian plugin folder
const copyToObsidian = {
  name: 'copy-to-obsidian',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return;
      rmSync(path.join(repoRoot, '.codex-vendor'), { recursive: true, force: true });

      if (!OBSIDIAN_PLUGIN_PATH) return;

      if (!existsSync(OBSIDIAN_PLUGIN_PATH)) {
        mkdirSync(OBSIDIAN_PLUGIN_PATH, { recursive: true });
      }

      const bundleFiles = [
        { src: path.join(pluginBundleDir, 'main.js'), name: 'main.js' },
        { src: path.join(pluginBundleDir, 'styles.css'), name: 'styles.css' },
        { src: manifestSrcPath, name: 'manifest.json' },
      ];
      for (const { src, name } of bundleFiles) {
        if (existsSync(src)) {
          copyFileSync(src, path.join(OBSIDIAN_PLUGIN_PATH, name));
          console.log(`Copied ${name} to Obsidian plugin folder`);
        }
      }

      const pluginVendorRoot = path.join(OBSIDIAN_PLUGIN_PATH, '.codex-vendor');
      rmSync(pluginVendorRoot, { recursive: true, force: true });
    });
  }
};

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  plugins: [patchCodexSdkImportMeta, copyToObsidian],
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtins,
    ...builtins.map(m => `node:${m}`),
  ],
  format: 'cjs',
  target: 'es2018',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: path.join(pluginBundleDir, 'main.js'),
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
