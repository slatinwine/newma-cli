// Manual test of enhanced verifier

import { EnhancedVerifier } from './src/verification/enhanced-verifier';
import { Config } from './src/config';
import * as fs from 'fs';

async function main() {
  const config: Config = JSON.parse(fs.readFileSync('.claude/settings.local.json', 'utf-8'));
  const verifier = new EnhancedVerifier(config, process.cwd());

  const testCode = `function sortArray(arr) {
  return arr.sort((a, b) => a - b);
}`;

  console.log("Test Code:");
  console.log(testCode);
  console.log("");

  const result = await verifier.verify(
    "Sort an array",
    testCode,
    {
      level: 2,
      useAICheck: false,
      checkSyntax: true,
      checkQuality: false,
      checkCompleteness: false
    }
  );

  console.log("Verification Result:");
  console.log("  Passed:", result.passed);
  console.log("  Overall Score:", result.overallScore);
  console.log("  Reason:", result.reason);
  console.log("");
  console.log("Details:");
  console.log("  Length:", result.details.length.score);
  console.log("  Syntax:", result.details.syntax.score);
  console.log("  Issues:", result.details.syntax.issues);
}

main();
