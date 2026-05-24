// Node.js ESM loader that auto-resolves imports without .js extension
// Usage: node --loader ./loader.mjs dist/cli.js
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

export function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return nextResolve(specifier, context);
  }
  if (specifier.endsWith('.js') || specifier.endsWith('.mjs') || specifier.endsWith('.json')) {
    return nextResolve(specifier, context);
  }

  const parentDir = context.parentURL
    ? new URL(context.parentURL).pathname.replace(/\/[^/]*$/, '')
    : process.cwd();

  const asFile = parentDir + '/' + specifier + '.js';
  if (fs.existsSync(asFile)) {
    return nextResolve(specifier + '.js', context);
  }

  const asIndex = parentDir + '/' + specifier + '/index.js';
  if (fs.existsSync(asIndex)) {
    return nextResolve(specifier + '/index.js', context);
  }

  return nextResolve(specifier, context);
}
