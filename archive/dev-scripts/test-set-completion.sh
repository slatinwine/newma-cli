#!/bin/bash
export DEBUG_COMPLETION=1
node -e '
const { AutoCompleter, createDefaultCompletionConfig } = require("./dist/completion");
const config = createDefaultCompletionConfig(process.cwd());
const completer = new AutoCompleter(config);

console.log("\n=== Test 1: /set (no space) ===");
let result = completer.complete("/set");
console.log("Result:", result);

console.log("\n=== Test 2: /set (with trailing space) ===");
result = completer.complete("/set ");
console.log("Result:", result);

console.log("\n=== Test 3: /set u ===");
result = completer.complete("/set u");
console.log("Result:", result);

console.log("\n=== Test 4: /set ultrathink (with trailing space) ===");
result = completer.complete("/set ultrathink ");
console.log("Result:", result);
' 2>&1 | grep -v "DEBUG completeCommand"
