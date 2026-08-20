// Self-contained tsdown config for the standalone dsh-reply-usage plugin.
// Mirrors the monorepo clientBundle preset without the repo-shared helpers:
// emits the node-half lib/index.js (ESM) plus the browser client bundle
// lib/client.js (CJS closure that window.__ModuleLoader__.load adopts).
import type { UserConfig } from 'tsdown'

/** Browser platform modules externalized from the client bundle: they live in
 *  the shell's frozen module table, so the bundle must `require()` them
 *  instead of inlining a second copy. */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
]

/** The runtime/client face is an immediately-tier module-table entry; the
 *  bundle must require it lazily rather than inline its snapshot store. */
const RUNTIME_CLIENT = '@deepseek-ai/dsh-client-runtime/client'

const nodeConfig: UserConfig = {
  name: 'dsh-reply-usage',
  // Source entry so a git install's `prepare` (tsdown only, no tsc) can build
  // the node half; tsc still emits lib/types/*.d.ts for types consumers.
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}

const clientConfig: UserConfig = {
  name: 'dsh-reply-usage/client',
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  clean: false,
  external: [...PLATFORM_MODULES, RUNTIME_CLIENT],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  // Bundle every non-platform dependency inline; only module-table entries
  // may be required at runtime.
  noExternal: (id: string) => (PLATFORM_MODULES.includes(id) || id === RUNTIME_CLIENT ? undefined : true),
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: "dsh-reply-usage", factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default (config: { env?: Record<string, unknown> }): UserConfig[] => {
  const face = config.env?.DSH_BUILD_FACE
  if (face === 'host') return [nodeConfig]
  if (face === 'client') return [clientConfig]
  return [nodeConfig, clientConfig]
}
