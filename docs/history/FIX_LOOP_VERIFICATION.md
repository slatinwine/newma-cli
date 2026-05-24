# Fix: Loop Mode Auto-Exit on Verification

## Problem Description

In `/loop` mode, the AI could not properly exit the loop when the requirement was satisfied. The loop would continue indefinitely even after the task was completed.

### Root Cause

The issue was in `src/repl.ts` in the `handleLoopCommand` method (lines 1827-1941). The verification check had multiple problems:

1. **Used Custom Check Instead of Standard Verify Mode:**
   ```typescript
   // OLD CODE (BROKEN):
   // Used a custom checkPrompt instead of proper verify mode
   const checkPrompt = `Review the execution history...`;
   const checkResp = await callAI(..., 'plan', ...); // Wrong mode!
   ```

2. **Unreliable JSON Parsing:**
   - Tried to extract JSON from `action.description`
   - Used regex to find JSON in description text
   - Very fragile and prone to parsing errors

3. **Only Ran After Execution:**
   - Check happened at iteration >= 2
   - Didn't use AI's built-in `verify` mode evaluation
   - Missed the standard `done` flag from verify mode

4. **No Early Exit in Verify Mode:**
   - When `mode === 'verify'`, the code didn't check `aiResp.done` before execution
   - Would execute actions even when AI said requirement was satisfied

## Solution

### 1. Added Proper Verify Mode Exit Check (Lines 1828-1845)

**Added explicit check for verify mode completion:**

```typescript
// NEW CODE (FIXED):
// ========================================
// Check if done in verify mode (before execution)
// In verify mode, AI evaluates if requirement is satisfied
// If done === true, exit the loop
// ========================================
if (mode === 'verify' && aiResp.done === true) {
  console.log(chalk.green('\n✅ Requirement satisfied!'));
  console.log(chalk.gray('AI verification confirmed the task is complete.\n'));
  done = true;
  break;
}

// Check if done (basic check before execution) for plan mode
if (aiResp.done) {
  console.log(chalk.green('\n✅ Task completed!\n'));
  done = true;
  break;
}
```

**Key Changes:**
- Added explicit `mode === 'verify'` check before execution
- Check AI's `done` flag which indicates requirement is satisfied
- Exit loop immediately when `done === true`
- Clear user feedback about why loop exited

### 2. Improved Fallback Verification (Lines 1884-1962) - USER ENHANCEMENT ⭐

**Added robust fallback verification check:**

```typescript
// USER ENHANCEMENT: Improved fallback check
// Runs when: mode === 'verify' && iteration >= 2 && !done
if (mode === 'verify' && iteration >= 2 && !done) {
  console.log(chalk.gray(`\n🔍 Checking if requirement is satisfied...\n`));

  const checkPrompt = `Review the execution history and determine if the original requirement is satisfied.

Original requirement: ${requirement}

Execution history:
${history.map(h => `- ${h.action.description || h.action.type}: ${h.status}`).join('\n')}

Respond with ONLY JSON in the "analysis" field of an action: {"satisfied": true|false, "reasoning": "brief explanation"}`;

  const checkResp = await callAI(..., checkPrompt, 'plan', ...);

  // Robust JSON parsing using extractJSON utility
  let checkResult: { satisfied: boolean; reasoning: string } | null = null;

  // Method 1: Try from content first (most reliable)
  if (checkResp.content) {
    const jsonStr = extractJSON(checkResp.content);
    if (jsonStr) {
      try {
        checkResult = JSON.parse(jsonStr);
      } catch (e) {
        // Fall through to method 2
      }
    }
  }

  // Method 2: Fallback to action description (backward compatibility)
  if (!checkResult && checkResp.actions && checkResp.actions.length > 0) {
    const jsonStr = extractJSON(firstAction.description);
    if (jsonStr) {
      try {
        checkResult = JSON.parse(jsonStr);
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  if (checkResult && checkResult.satisfied) {
    console.log(chalk.green('\n✅ Requirement satisfied!'));
    done = true;
    break;
  }
}
```

**User's Improvements:**
- ✅ **More Robust JSON Parsing:** Uses `extractJSON()` utility function
- ✅ **Two Parsing Methods:** Tries content first, then falls back to description
- ✅ **Better Prompt:** Asks for JSON in "analysis" field
- ✅ **User Profile Support:** Includes user profile in AI call
- ✅ **Error Handling:** Silently skips on errors to avoid breaking loop
- ✅ **Conditional Execution:** Only runs when `!done` (avoids redundant checks)

### 3. Removed Unreliable Custom Check (Lines 1877-1941)

**Added explicit check for verify mode completion:**

```typescript
// NEW CODE (FIXED):
// ========================================
// Check if done in verify mode (before execution)
// In verify mode, AI evaluates if requirement is satisfied
// If done === true, exit the loop
// ========================================
if (mode === 'verify' && aiResp.done === true) {
  console.log(chalk.green('\n✅ Requirement satisfied!'));
  console.log(chalk.gray('AI verification confirmed the task is complete.\n'));
  done = true;
  break;
}

// Check if done (basic check before execution) for plan mode
if (aiResp.done) {
  console.log(chalk.green('\n✅ Task completed!\n'));
  done = true;
  break;
}
```

**Key Changes:**
- Added explicit `mode === 'verify'` check before execution
- Check AI's `done` flag which indicates requirement is satisfied
- Exit loop immediately when `done === true`
- Clear user feedback about why loop exited

### 2. Removed Unreliable Custom Check (Lines 1877-1941)

**Deleted the problematic custom verification code:**

```typescript
// REMOVED (BROKEN):
if (mode === 'verify' && iteration >= 2) {
  console.log(chalk.gray(`\n🔍 Checking if requirement is satisfied...\n`));

  const checkPrompt = `Review the execution history...`;
  const checkResp = await callAI(..., 'plan', ...); // Wrong!

  // Unreliable JSON parsing
  const jsonMatch = firstAction.description.match(/\{[^}]*\}/);
  checkResult = JSON.parse(jsonMatch[0]);

  if (checkResult && checkResult.satisfied) {
    done = true;
    break;
  }
}
```

**Why It Was Removed:**
- Used wrong AI mode (`plan` instead of `verify`)
- Fragile JSON parsing from description text
- Didn't leverage AI's built-in verification capability
- Confusing to have two different verification mechanisms

### 3. Added User Profile Support (Line 1806)

**Added user profile to loop mode AI call:**

```typescript
const aiResp = await callAI(
  config,
  projectInfo,
  requirement,
  mode,
  this.session.getTracker().getHistory(),
  this.toolExecutor?.getRegistry().list().map(t => t.name),
  undefined,  // grantedPermissions
  undefined,  // compression
  projectRoot,
  this.getAbortSignal(),
  ultrathinkEnabled ? { ... } : undefined,
  await this.session.getUserProfile() || undefined // user profile - NEW!
);
```

**Benefit:**
- AI adapts to user's language and style
- Better response quality
- Consistent with other modes

## How It Works Now

### Loop Mode Execution Flow

```
┌─────────────────────────────────────────┐
│ Iteration 1 (plan mode)                 │
│ 1. Scan project                         │
│ 2. Call AI in 'plan' mode               │
│ 3. AI returns todo + actions            │
│ 4. Execute actions                      │
│ 5. Switch to 'verify' mode              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ Iteration 2+ (verify mode)              │
│ 1. Scan project                         │
│ 2. Call AI in 'verify' mode             │
│ 3. ✅ Check: if aiResp.done === true   │ ← NEW!
│    → Exit loop with success message    │
│ 4. If not done, execute new actions    │
│ 5. Continue loop                        │
└─────────────────────────────────────────┘
```

### Verify Mode Evaluation

When in `verify` mode, the AI:

1. **Reviews Execution History:** Sees what actions were taken
2. **Evaluates Original Requirement:** Checks if it's satisfied
3. **Returns `done` Flag:**
   - `done: true` → Requirement satisfied, exit loop
   - `done: false` → Not satisfied, continue with more actions
4. **Optional: Returns New Actions:** If more work needed

### Key Improvements

1. **Early Exit:** Loop exits as soon as AI confirms satisfaction
2. **Standard Mode:** Uses AI's built-in `verify` mode (not custom checks)
3. **Reliable:** No fragile JSON parsing
4. **Clear Feedback:** User sees why loop exited
5. **Faster:** No unnecessary AI calls or iterations

## Testing

### Test Case 1: Simple Task (Should Exit Quickly)

```bash
npx newma-cli -i
> /loop add a hello world function to src/main.ts
```

**Expected Flow:**
1. Iteration 1 (plan): AI plans to add function
2. Execute: Function is added
3. Iteration 2 (verify): AI checks if done
4. ✅ **Exit:** `aiResp.done === true`
5. Success message displayed

**Expected Output:**
```
📌 Iteration 1/∞
Calling AI (plan mode)...
=== TODO List ===
  1. Add hello world function
=== Action Plan ===
  1. Create src/main.ts
⚙️  Executing 1 actions...
✅ Create src/main.ts
Switched to verify mode

📌 Iteration 2/∞
Calling AI (verify mode)...
=== TODO List ===
  (No todo items)
=== Action Plan ===
  (No actions)

✅ Requirement satisfied!
AI verification confirmed the task is complete.

──────────────────────────────────────────────────────
📊 Summary: 2 iterations | ✅ Completed
──────────────────────────────────────────────────────
```

### Test Case 2: Multi-Step Task

```bash
> /loop 10 create a React component with tests
```

**Expected Flow:**
1. Iteration 1-3: Plan and implement component
2. Iteration 4: Verify and add tests
3. Iteration 5: Verify and exit
4. ✅ **Exit:** Within 10 iterations (if successful)

### Test Case 3: Impossible Task (Max Iterations)

```bash
> /loop 3 solve world hunger
```

**Expected Flow:**
1. Iteration 1-3: AI tries but can't complete
2. ⚠️ **Max iterations reached:** Exit after 3 iterations
3. Summary shows incomplete

## Comparison: Before vs After

### Before (Broken)

```typescript
// Execution flow:
1. Call AI (verify mode)
2. Get response with todo/actions
3. Execute actions
4. ❌ Call AI AGAIN with custom checkPrompt (WRONG MODE!)
5. Try to parse JSON from description (FRAGILE!)
6. Maybe exit if parsing succeeds
```

**Problems:**
- Extra unnecessary AI call
- Wrong AI mode (`plan` instead of `verify`)
- Fragile JSON parsing
- Inconsistent with standard flow
- User confusion about when/why loop exits

### After (Fixed)

```typescript
// Execution flow:
1. Call AI (verify mode)
2. Get response with todo/actions
3. ✅ Check: if aiResp.done === true → EXIT
4. Execute actions (if not done)
5. Continue loop
```

**Benefits:**
- Single AI call per iteration
- Uses correct `verify` mode
- Reliable `done` flag check
- Consistent with standard flow
- Clear exit conditions

## Technical Details

### Verify Mode Response Format

In `verify` mode, AI returns:

```json
{
  "done": true,
  "todo": [],
  "actions": []
}
```

When requirement is satisfied, or:

```json
{
  "done": false,
  "todo": ["Add error handling"],
  "actions": [
    {"type": "modify", "path": "...", ...}
  ]
}
```

When more work needed.

### Mode Switching Logic

```typescript
// Iteration 1: Always start in 'plan' mode
let mode = 'plan';

// After first execution: Switch to 'verify' mode
if (iteration === 1 && mode === 'plan') {
  this.session.setMode('verify');
  mode = 'verify';
}

// In verify mode: Check done flag before executing
if (mode === 'verify' && aiResp.done === true) {
  done = true;
  break;
}
```

### Interaction with ReAct Verification

**Pre-execution ReAct check** (iteration >= 3):
- Runs before AI call
- If satisfied → exits early
- Saves API call time

**Standard verify mode** (every iteration after 1):
- Runs as part of AI call
- Checks `done` flag after response
- Most reliable method

**Post-execution ReAct check** (iteration >= 6, ultrathink enabled):
- Runs after action execution
- Deep verification with auto-fix
- Quality assurance for complex tasks

All three methods work together and can exit the loop when satisfaction is confirmed.

## Files Changed

1. **`src/repl.ts`**:
   - Lines 1806: Added user profile to AI call
   - Lines 1828-1845: Added verify mode exit check
   - Lines 1871-1941: Removed custom verification check

## Impact Assessment

### Positive Impacts ✅

1. **Reliable Exit:** Loop now exits correctly when requirement is satisfied
2. **Fewer API Calls:** Removed unnecessary verification AI call
3. **Better UX:** Clear feedback about why loop exited
4. **Faster Completion:** No extra round-trip for verification
5. **Consistent:** Uses same verify mode as `/plan` command

### Potential Issues ⚠️

1. **Strict Verify Mode:** Relies on AI correctly setting `done` flag
   - **Mitigation:** AI prompts emphasize `done` flag usage
   - **Fallback:** User can Ctrl+C to stop loop

2. **No Custom Check Logic:** Some users may prefer custom check messages
   - **Mitigation:** Standard verify mode is more reliable
   - **Future:** Could add option to customize verify prompt

## Known Limitations

1. **AI Accuracy:** Depends on AI's ability to evaluate satisfaction
   - If AI incorrectly sets `done: false`, loop continues
   - User can interrupt with Ctrl+C

2. **Complex Requirements:** May need multiple iterations to satisfy
   - This is expected behavior
   - Max iterations provides safety limit

3. **No Partial Success:** Either fully satisfied or not
   - Could enhance with "partially done" status
   - Future enhancement possibility

## Future Enhancements

1. **Progressive Satisfaction:**
   ```typescript
   // Add satisfaction score (0-100%)
   if (aiResp.satisfactionScore >= 90) {
     console.log('90% satisfied, continuing...');
   }
   ```

2. **User Confirmation:**
   ```typescript
   // Ask user before exiting
   if (aiResp.done) {
     const confirmed = await askUser('Task complete. Exit loop?');
     if (!confirmed) continue;
   }
   ```

3. **Smart Iteration Limit:**
   ```typescript
   // Auto-adjust max iterations based on task complexity
   const estimatedIterations = estimateComplexity(requirement);
   const maxIterations = estimatedIterations * 2;
   ```

4. **Detailed Exit Summary:**
   ```typescript
   // Show what was accomplished
   console.log('Tasks completed:');
   history.forEach(h => console.log(`✓ ${h.action.type}`));
   ```

## Conclusion

This fix restores the `/loop` mode's ability to automatically exit when the requirement is satisfied, making it a truly autonomous task execution mode. The implementation uses a **layered verification approach**:

### Three-Layer Verification Strategy

1. **Primary: AI's Built-in Verify Mode**
   - Checks `aiResp.done === true` in verify mode
   - Most reliable method
   - Single AI call per iteration

2. **Fallback: Robust Custom Check**
   - User enhancement with `extractJSON()` utility
   - Two-method JSON parsing (content → description)
   - Runs only when primary check fails

3. **Deep: ReAct Verification** (optional, ultrathink only)
   - Runs at iteration >= 6
   - Comprehensive verification with auto-fix
   - Quality assurance for complex tasks

### Key Improvements Over Original

| Aspect | Before | After |
|--------|--------|-------|
| Exit Method | Custom check only | Layered (primary + fallback + deep) |
| JSON Parsing | Fragile regex | Robust `extractJSON()` utility |
| AI Modes | Wrong mode (`plan`) | Correct mode (`verify`) |
| Error Handling | Could break loop | Silent fallback, continues loop |
| User Feedback | Unclear exit reason | Clear satisfaction messages |
| Redundancy | Always ran check | Conditional (`!done` check) |

---

**Fix Date:** 2026-01-19
**Fixed By:** Claude Code (Ralph Loop iteration)
**Enhanced By:** User (fallback verification improvements)
**Version:** 3.1.0+
