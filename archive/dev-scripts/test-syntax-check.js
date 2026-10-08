// Test arrow function detection

const code = `function reverseString(str) {
  return str.split('').reverse().join('');
}`;

// Test 1: Check if it has arrow
console.log("Code:", code);
console.log("Has '=>':", code.includes('=>'));

// Test 2: Check for valid arrow function pattern
const arrowPattern = /(\w+)\s*=>\s*\{?/;
console.log("Valid arrow function?", arrowPattern.test(code));

// Test 3: Extract code blocks
const markdownRegex = /```(\w*)\n([\s\S]*?)```/g;
const match = code.match(markdownRegex);
console.log("Markdown match:", match);
if (match && match[2]) {
  console.log("Code block:", match[2]);
}
