# Manual Loop Mode Test Plan

**Date:** 2026-01-19
**Goal:** Verify loop mode can exit via validation

## Test Setup

### Test Environment
```bash
cd /tmp/kode-test-$$
mkdir -p /tmp/kode-test-loop
cd /tmp/kode-test-loop
```

### Test Project
Create a minimal Node.js project:
```bash
# Initialize project
echo '# Test Project' > README.md
echo 'console.log("hello");' > index.js

# Create .env if needed
echo "OPENAI_API_KEY=your_key_here" > .env
```

## Test Case 1: Simple File Creation

### Command
```bash
npx newma-cli -i
> /loop 3 "add a function named greet that returns 'Hello World' to index.js"
```

### Expected Behavior

**Iteration 1 (plan mode):**
```
📌 Iteration 1/3
Calling AI (plan mode)...
=== TODO List ===
  1. Add greet function to index.js
=== Action Plan ===
  1. Modify index.js to add greet function
⚙️  Executing 1 actions...
✅ Modify index.js to add greet function
Switched to verify mode
```

**Iteration 2 (verify mode):**
```
📌 Iteration 2/3
Calling AI (verify mode)...
=== TODO List ===
  (No todo items)
=== Action Plan ===
  (No actions)

✅ Requirement satisfied!
AI verification confirmed the task is complete.
```

**Expected Exit:** ✅ Should exit after iteration 2

### What to Check

1. ✅ Does iteration 2 show "No todo items" and "No actions"?
2. ✅ Does AI set `done: true`?
3. ✅ Does loop exit with success message?
4. ✅ Total iterations = 2 (not 3)

## Test Case 2: Multiple Steps (Needs 2-3 iterations)

### Command
```bash
> /loop 5 "create a TypeScript project with a hello world function"
```

### Expected Behavior

**Iteration 1:** Plan to create tsconfig.json and index.ts
**Iteration 2:** Verify, find missing tsconfig.json, create it
**Iteration 3:** Verify again, all done, exit

**Expected Exit:** ✅ Should exit after iteration 3

## Test Case 3: Impossible Task (Max Iterations)

### Command
```bash
> /loop 3 "solve world hunger using JavaScript"
```

### Expected Behavior

**Iteration 1-3:** AI tries but can't complete
**Expected Exit:** ⚠️ Should stop after iteration 3 (max iterations)

## Test Case 4: Manual Test with Actual Execution

### Step-by-Step

```bash
# 1. Create test directory
TEST_DIR="/tmp/kode-loop-$(date +%s)"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# 2. Initialize minimal project
echo "# Test" > README.md

# 3. Start kode
npx newma-cli -i

# 4. Run loop command
/loop 3 "add a hello world function to test.js"

# 5. Observe output
# Expected: 2 iterations, then exit with "Requirement satisfied!"

# 6. Verify result
cat test.js
# Expected: Should contain hello world function
```

## Troubleshooting

### If Loop Doesn't Exit

**Symptom:** Loop continues to iteration 3 even though task is done

**Possible Causes:**

1. **AI not setting done: true**
   - Check: Does AI response include `"done": true`?
   - Fix: Prompt needs more emphasis on done flag

2. **Verify mode not being used**
   - Check: Is mode switching to 'verify' after iteration 1?
   - Fix: Check `session.setMode('verify')` is being called

3. **Exit check not working**
   - Check: Is line 1833 check being evaluated?
   - Fix: Verify condition `mode === 'verify' && aiResp.done === true`

4. **AI returns actions when it shouldn't**
   - Check: Does AI return empty actions array?
   - Fix: Prompt needs to clarify when to return empty arrays

### Debug Mode

Add debug output to see what's happening:

```typescript
// In repl.ts around line 1833
console.log(`[DEBUG] mode=${mode}, done=${aiResp.done}`);
console.log(`[DEBUG] todo=${JSON.stringify(aiResp.todo)}`);
console.log(`[DEBUG] actions=${JSON.stringify(aiResp.actions)}`);
```

## Success Criteria

✅ **Test Passes If:**
- Loop exits after 2 iterations for simple tasks
- AI correctly sets `done: true` in verify mode
- Success message is displayed
- No unnecessary iterations

❌ **Test Fails If:**
- Loop continues to max iterations
- AI never sets `done: true`
- No exit message shown
- Task completes but loop doesn't exit

## Next Steps

1. Run Test Case 1 manually
2. Document actual behavior
3. If fails, identify specific issue
4. Apply targeted fix
5. Re-test until passing
