# Fix: Search Tool Auto-Call in Non-Chat Modes

## Problem Description

In Phase 6 (Default Chat Mode), the AI assistant's ability to automatically use the search tool was broken in `/plan` and `/do` modes. While the search tool was properly registered in the tool registry, the AI could not access it when planning tasks.

### Root Cause

The issue was in `src/ai.ts` at lines 920-949. The code explicitly **disabled** Function Calling API (with tools) in plan/verify modes:

```typescript
// OLD CODE (BROKEN):
if (mode !== 'think' && mode !== 'plan' && mode !== 'verify' && availableTools && availableTools.length > 0) {
  // Only use tools in non-plan/verify modes
  requestBody.tools = ...
}
```

This meant:
- In `/plan` mode: AI had to return structured JSON, but had NO tool access
- In `/do` mode: Same as `/plan`
- In chat mode (default): Used `chatAI()` which also had NO tool access
- Only Function Calling mode (explicitly enabled) had tool access

### Why This Was Wrong

When AI needs to search for information before generating a plan, it should:
1. Automatically detect that search is needed
2. Call the search tool
3. Use the search results
4. Generate a plan based on the gathered information

However, the old implementation forced the AI to generate a plan immediately without access to tools.

## Solution

### 1. Enable Function Calling API in All Modes (`src/ai.ts`)

**Changed lines 920-960** to enable tools for ALL modes when available:

```typescript
// NEW CODE (FIXED):
if (hasTools) {
  // Use Function Calling API with tools
  // This enables automatic tool calling (including search)
  requestBody.tools = availableTools.map(toolName => ({
    type: "function",
    function: {
      name: toolName,
      description: `Capability: ${toolName}`,
      parameters: {
        type: "object",
        properties: {},
      }
    }
  }));

  // Don't use response_format when using tools (they're mutually exclusive)
  // The AI will return structured data based on the system prompt
}
```

**Key Changes:**
- Removed the check that excluded `plan` and `verify` modes from using tools
- Now ALL modes (plan, verify, think) can use tools when available
- Prioritize tools over `response_format` since they're mutually exclusive

### 2. Handle Tool Calls in Plan/Verify Modes (`src/repl.ts`)

**Added lines 938-1032** to properly handle when AI uses tools:

```typescript
if ((aiResp as any).type === 'tool_calls' && (aiResp as any).toolCalls) {
  // AI decided to use tools (e.g., search)
  // Execute the tool calls and then call AI again with the results

  // 1. Execute all tool calls
  for (const call of toolCalls) {
    const result = await this.toolExecutor.executeToolCall({
      tool: call.function.name,
      parameters: args,
      id: call.id,
    });
    toolResults.push(...);
  }

  // 2. Call AI again with tool results
  const enhancedRequirement = `${requirement}\n\n[Tool Results Available:]\n${toolResultsText}\n\nBased on these tool results, please generate your plan.`;

  const followUpResp = await callAI(..., enhancedRequirement, ...);

  // 3. Update aiResp and continue processing
  Object.assign(aiResp, followUpResp);
}
```

**How It Works:**
1. AI returns `tool_calls` instead of a direct plan
2. REPL executes all tool calls (e.g., search)
3. REPL makes a follow-up AI call with the tool results
4. AI uses the tool results to generate the actual plan
5. REPL processes the plan as normal

## Technical Details

### Function Calling API vs. JSON Mode

The OpenAI API has two mutually exclusive modes:

1. **Function Calling (`tools` parameter)**:
   - AI can call tools/functions
   - AI returns `tool_calls` in response
   - Client must execute tools and call AI again
   - Enables dynamic tool usage

2. **JSON Mode (`response_format` parameter)**:
   - AI returns structured JSON
   - No tool calling allowed
   - Single round-trip
   - Simpler but less flexible

**Our Fix:** Prioritize Function Calling mode when tools are available, falling back to JSON mode only when no tools are registered.

### Multi-Turn Conversation Flow

The new implementation supports a multi-turn flow:

```
Round 1:
User: /plan search for latest React best practices and implement them
  → AI: tool_calls=[{name: "search", arguments: {...}}]
  → REPL: Execute search, get results
  → REPL: Call AI again with search results

Round 2:
User: /plan search for latest React best practices and implement them (with search results)
  → AI: {todo: [...], actions: [...]}
  → REPL: Execute actions
```

This allows AI to gather information before planning, which is essential for tasks that require up-to-date information.

## Testing

### Manual Testing Steps

1. **Test Search in /plan Mode:**
   ```bash
   npx newma-cli -i
   > /plan search for TypeScript 5.0 new features and summarize them
   ```

   Expected behavior:
   - AI calls search tool automatically
   - Search results are displayed
   - AI generates summary plan based on search results

2. **Test Direct Planning (No Search Needed):**
   ```bash
   > /plan add a simple hello world function
   ```

   Expected behavior:
   - AI directly generates plan without calling search
   - Plan should be immediate

3. **Test /do Mode:**
   ```bash
   > /do search for npm best practices and implement package.json
   ```

   Expected behavior:
   - Same as /plan mode
   - Search followed by plan generation

### Known Limitations

1. **Limited Tool Rounds:** Currently limits to one round of tool calls. If AI needs to use tools again after the first round, it will ask the user to run the command again.

2. **Tool Result Formatting:** Tool results are embedded as text in the enhanced requirement. A more sophisticated approach would be to use the proper OpenAI Function Calling multi-turn conversation format.

## Files Changed

1. **`src/ai.ts`** (lines 920-960):
   - Changed tool availability logic to include plan/verify modes
   - Prioritize tools over response_format

2. **`src/repl.ts`** (lines 938-1032):
   - Added handler for `type === 'tool_calls'` responses
   - Implemented tool execution and follow-up AI call
   - Embedded tool results in enhanced requirement

## Impact Assessment

### Positive Impacts ✅

1. **AI Can Now Use Search in Planning:** The most important fix - AI can gather information before generating plans
2. **Better Up-to-Date Information:** AI can search for latest best practices, documentation, etc.
3. **More Intelligent Responses:** AI not limited to its training data cutoff
4. **Backward Compatible:** Falls back to JSON mode when no tools available
5. **Works Across All Modes:** /plan, /do, /loop all benefit from tool access

### Potential Issues ⚠️

1. **Increased API Usage:** One tool call round = 2 AI API calls instead of 1
2. **Slightly Slower:** Tool execution adds ~1-3 seconds per search
3. **More Complex Flow:** Multi-turn conversation harder to debug
4. **Cost Increase:** Double API calls for tasks requiring search

### Mitigation Strategies

- Use search sparingly (AI should only call when needed)
- Cache search results when possible (future enhancement)
- Provide clear feedback to users about tool usage
- Allow users to disable tools if not needed

## Future Enhancements

1. **Proper Multi-Turn Conversations:**
   - Use OpenAI's multi-turn conversation format with message history
   - Include assistant message with tool_calls
   - Include tool result messages
   - Allow unlimited tool rounds (with configurable max)

2. **Search Result Caching:**
   - Cache search results for a period (e.g., 5 minutes)
   - Avoid redundant searches for the same query
   - Reduce API usage and costs

3. **Tool Selection Strategy:**
   - Learn when search is needed vs. not needed
   - Prefer project-local information (files) over web search
   - Use search only for external/up-to-date information

4. **Better Error Handling:**
   - Retry failed tool calls
   - Provide clearer error messages
   - Graceful fallback when tools fail

## Conclusion

This fix restores the AI assistant's ability to automatically use search and other tools in plan/verify modes, which is essential for generating high-quality, up-to-date responses. The implementation follows OpenAI's Function Calling API best practices and maintains backward compatibility with existing code.

---

**Fix Date:** 2026-01-19
**Fixed By:** Claude Code (with Ralph Loop iteration)
**Version:** 3.1.0+
