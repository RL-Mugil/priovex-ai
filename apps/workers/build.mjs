import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: 'dist/index.js',
  // Keep all npm packages external — only bundle @priovex/* workspace sources
  packages: 'external',
  // Redirect @priovex/* to their TypeScript source (bypasses node_modules lookup)
  alias: {
    '@priovex/types':            '../../packages/types/src/index.ts',
    '@priovex/database':         '../../packages/database/src/index.ts',
    '@priovex/queue':            '../../packages/queue/src/index.ts',
    '@priovex/ai-providers':     '../../packages/ai-providers/src/index.ts',
    '@priovex/bigquery':         '../../packages/bigquery/src/index.ts',
    '@priovex/npl-engine':       '../../packages/npl-engine/src/index.ts',
    '@priovex/report-generator': '../../packages/report-generator/src/index.ts',
  },
});

console.log('Worker bundle built → dist/index.js');
