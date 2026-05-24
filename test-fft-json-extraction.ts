/**
 * Test script for FFT JSON extraction logic
 */

/**
 * Extract JSON from AI response
 * Handles multiple formats:
 * 1. ```json ... ```
 * 2. ``` ... ```
 * 3. Text with JSON embedded (extract first { to last })
 * 4. Plain JSON
 */
function extractJSON(content: string): string {
  let cleaned = content.trim();

  // Step 1: Remove markdown code blocks
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }

  // Step 2: Find first '{' and last '}'
  // This handles cases where AI adds explanatory text before/after JSON
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

// Test cases
console.log('Testing JSON extraction...\n');

// Test 1: Markdown code block
const test1 = `Here's my analysis:

\`\`\`json
{"level": "simple", "reasoning": "Single file"}
\`\`\`

That's my conclusion.`;

console.log('Test 1: Markdown code block');
const result1 = extractJSON(test1);
console.log('Result:', result1);
console.log('Valid JSON:', JSON.parse(result1));
console.log('✓ PASSED\n');

// Test 2: Numbered list with embedded JSON (the actual bug)
const test2 = `1. **Analyze the Request:**
   *   **Core Task:** The user wants me to "search for Mario games" and then "generate a Mario game" as a single HTML application.
   *   **Format:** Single HTML file

{"level": "simple", "reasoning": "Single HTML game file"}

2. **Conclusion:** Simple task`;

console.log('Test 2: Numbered list with embedded JSON');
const result2 = extractJSON(test2);
console.log('Result:', result2);
console.log('Valid JSON:', JSON.parse(result2));
console.log('✓ PASSED\n');

// Test 3: Plain JSON
const test3 = `{"level": "complex", "reasoning": "Multiple technologies involved"}`;

console.log('Test 3: Plain JSON');
const result3 = extractJSON(test3);
console.log('Result:', result3);
console.log('Valid JSON:', JSON.parse(result3));
console.log('✓ PASSED\n');

// Test 4: Markdown without json keyword
const test4 = `
\`\`\`
{"name": "Plan", "actions": []}
\`\`\`
`;

console.log('Test 4: Markdown without json keyword');
const result4 = extractJSON(test4);
console.log('Result:', result4);
console.log('Valid JSON:', JSON.parse(result4));
console.log('✓ PASSED\n');

console.log('All tests passed! ✓');
