// Bundles the extension, the tests or the README updater with esbuild.
//   node scripts/build.mjs extension   dist/extension.js, the file VS Code loads
//   node scripts/build.mjs tests       out/test/*.js, run with node --test
//   node scripts/build.mjs readme      rewrites the languages table in README.md
import * as esbuild from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  logLevel: 'warning',
};

const what = process.argv[2] ?? 'extension';

if (what === 'extension') {
  await esbuild.build({ ...common, entryPoints: ['src/extension.ts'], outfile: 'dist/extension.js' });
} else if (what === 'tests') {
  await esbuild.build({ ...common, entryPoints: ['test/*.test.ts', 'test/e2e/*.ts'], outdir: 'out/test' });
} else if (what === 'readme') {
  await esbuild.build({ ...common, entryPoints: ['scripts/update-readme.ts'], outfile: 'out/update-readme.js' });
  const { createRequire } = await import('node:module');
  createRequire(import.meta.url)('../out/update-readme.js');
} else {
  console.error(`Unknown target: ${what}`);
  process.exit(1);
}
