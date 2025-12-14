import * as esbuild from 'esbuild';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

function getEntryPoints(dir, extensions = ['.ts']) {
  const entries = [];
  const files = readdirSync(dir);
  
  for (const file of files) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      entries.push(...getEntryPoints(fullPath, extensions));
    } else if (extensions.some(ext => file.endsWith(ext))) {
      entries.push(fullPath);
    }
  }
  
  return entries;
}

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
  ],
  sourcemap: false,
  minify: true,
  treeShaking: true,
});

console.log('Server build complete: dist/server.js (production)');
