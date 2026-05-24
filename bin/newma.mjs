#!/usr/bin/env node
// Wrapper that uses the ESM loader to resolve extensionless imports
// This is needed because tsconfig uses moduleResolution: "bundler" which
// omits .js extensions, but Node.js ESM requires them.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

register('./loader.mjs', pathToFileURL(import.meta.dirname));

await import('../dist/cli.js');
