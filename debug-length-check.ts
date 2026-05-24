// Debug test for length check

import { EnhancedVerifier } from './src/verification/enhanced-verifier';
import { Config } from './src/config';
import * as fs from 'fs';

async function main() {
  const config: Config = JSON.parse(fs.readFileSync('.claude/settings.local.json', 'utf-8'));
  const verifier = new EnhancedVerifier(config, process.cwd());

  // Test Case 1: Short response without code blocks
  const response1 = "Hi!";
  console.log("=== Test 1: Short response (11 chars) ===");
  const result1 = await verifier.verify(
    "Test requirement",
    response1,
    {
      level: 2,
      useAICheck: false,
      checkSyntax: false,
      checkQuality: false,
      checkCompleteness: false
    }
  );
  console.log("Response 1:", response1);
  console.log("Length:", response1.length);
  console.log("Length check result:", result1.details.length);
  console.log("Pass/Fail:", result1.passed);
  console.log("Reason:", result1.reason);
  console.log("");

  // Test Case 3: Short code (82 chars)
  const response3 = `Here's a JavaScript function:

function reverseString(str) {
  return str.split('').reverse().join('');
}

This should work for most strings.`;
  console.log("=== Test 3: Short code (82 chars) ===");
  const result3 = await verifier.verify(
    "Test requirement",
    response3,
    {
      level: 2,
      useAICheck: false,
      checkSyntax: true,
      checkQuality: false,
      checkCompleteness: false
    }
  );
  console.log("Response 3:", response3);
  console.log("Length:", response3.length);
  console.log("Length check result:", result3.details.length);
  console.log("Pass/Fail:", result3.passed);
  console.log("Reason:", result3.reason);
  console.log("");

  // Test Case 4: Check minLength logic
  console.log("=== Test 4: Check minLength logic ===");
  const minLength = 50;
  const shortResponse = "A"; // 1 char
  const longResponse = "A".repeat(51); // 51 chars
  const okResponse = "A".repeat(52); // 52 chars

  console.log("Short response (" + shortResponse.length + " chars):", shortResponse);
  const result4a = await verifier.verify("Test", shortResponse, { level: 2, useAICheck: false, checkSyntax: false, checkQuality: false, checkCompleteness: false });
  console.log("Pass/Fail:", result4a.passed, "- Expected: false");
  console.log("Reason:", result4a.reason);
  console.log("");

  console.log("Long response (" + longResponse.length + " chars):", longResponse);
  const result4b = await verifier.verify("Test", longResponse, { level: 2, useAICheck: false, checkSyntax: false, checkQuality: false, checkCompleteness: false });
  console.log("Pass/Fail:", result4b.passed, "- Expected: false");
  console.log("Reason:", result4b.reason);
  console.log("");

  console.log("OK response (" + okResponse.length + " chars):", okResponse);
  const result4c = await verifier.verify("Test", okResponse, { level: 2, useAICheck: false, checkSyntax: false, checkQuality: false, checkCompleteness: false });
  console.log("Pass/Fail:", result4c.passed, "- Expected: true");
  console.log("Reason:", result4c.reason);
  console.log("");
}

main();
