// CJS runner: ts-node in ESM packages forces ESM loading, which cannot resolve
// the extensionless imports used throughout src/. Registering ts-node's CJS
// require hook from a .cjs entry avoids that entirely.
require('ts-node').register({
  transpileOnly: true,
  // The package.json declares "type": "module", but src/ is written with
  // extensionless imports that only CJS resolution understands. Force every
  // .ts file through the CJS transpiler; ESM-only deps (chalk 5, inquirer 9)
  // load fine through Node's native require(esm).
  moduleTypes: { '**/*.ts': 'cjs' },
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    target: 'es2022',
    esModuleInterop: true,
    skipLibCheck: true,
  },
});
require('./test-subagent.ts');
