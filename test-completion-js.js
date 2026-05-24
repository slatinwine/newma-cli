const { AutoCompleter, createDefaultCompletionConfig } = require("./dist/completion");

const config = createDefaultCompletionConfig(process.cwd());
const completer = new AutoCompleter(config);

// 使用 hex 来确保尾部空格被保留
const input = "/set "; // This string should have trailing space

console.log("Input:", JSON.stringify(input));
console.log("Length:", input.length);
console.log("Bytes:", Buffer.from(input).toString("hex"));
console.log("Ends with space:", input.endsWith(" "));

process.env.DEBUG_COMPLETION = "1";
const result = completer.complete(input);
console.log("\nResult:", result);
