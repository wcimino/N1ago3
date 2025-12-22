import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  external: [
    '@neondatabase/serverless',
    'express',
    'express-session',
    'connect-pg-simple',
    'passport',
    'openid-client',
    'ws',
    'openai',
    'drizzle-orm',
    'memoizee',
    'parquetjs',
    '@google-cloud/storage',
  ],
  sourcemap: false,
  minify: true,
  treeShaking: true,
});

console.log('Server build complete: dist/server.js (production)');
