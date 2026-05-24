# Loop Mode Verification Fix

## Problem Description

In Newma (牛码)'s `--loop` mode, the CLI was prematurely exiting the loop when automatic verification failed, instead of continuing to iterate and attempt fixes. This violated the design principle of loop mode, which should:

1. Continue iterating until `MAX_ITERATIONS` is reached
2. Return exit code 1 (not done) when task is incomplete, allowing bash scripts to retry
3. Only return exit code 0 when the task is truly complete

## Root Cause

**File**: `src/cli.ts:578`

```typescript
// BEFORE (BUGGY):
} else {
  console.log(chalk.red('\n❌ Verification still failing. Please review manually.'));
  done = true; // ❌ This exits loop prematurely!
}
```

The bug: When automatic verification (Phase 2 Verifier class) failed after attempting auto-fix, the code set `done = true`. This caused:

1. **In loop mode**: Exit with code 0 (success path) even though task failed
2. **In non-loop mode**: Prematurely stop iteration instead of allowing manual intervention

### Why This Happened

There are TWO verification systems in Newma (牛码):

1. **AI-based verification** (line 392-400):
   - Uses `mode === 'verify'` in `callAI()`
   - Checks `aiResp.done` to determine completion
   - Works correctly in loop mode

2. **Automatic verification** (line 519-594):
   - Uses `Verifier` class with built-in checks (TypeScript, ESLint, tests, build)
   - Attempts auto-fix when verification fails
   - **BUG**: Set `done = true` when re-verification failed

The two systems weren't coordinated, and the automatic verifier didn't account for loop mode semantics.

## The Fix

**File**: `src/cli.ts:577-583`

```typescript
// AFTER (FIXED):
} else {
  console.log(chalk.red('\n❌ Verification still failing. Please review manually.'));
  // In loop mode, don't set done=true - let the loop continue naturally
  // In non-loop mode, stop for manual review
  if (!loopMode) {
    done = true; // Stop iteration for manual review
  }
}
```

### Key Changes

1. **Added loop mode check**: Only set `done = true` in non-loop mode
2. **Loop mode behavior**: Let loop continue naturally to next iteration
3. **Preserved non-loop behavior**: Still stop for manual review when not in loop mode

## Behavior After Fix

### In Loop Mode (`--loop` flag):

```bash
npx newma-cli --loop --verify "Fix TypeScript errors"
```

**Flow**:
1. Iteration 1: AI generates plan → Execute → Verification fails → Auto-fix attempt
2. Re-verification fails
3. **Does NOT set `done = true`** ← FIX
4. Loop continues to iteration 2 (if MAX_ITERATIONS not reached)
5. Eventually exits with:
   - **Exit code 0**: Task completed successfully
   - **Exit code 1**: Task not completed (can retry)
   - **Exit code 2**: Execution error
   - **Exit code 130**: User interrupted (Ctrl+C)

### In Non-Loop Mode (default):

```bash
npx newma-cli --verify "Fix TypeScript errors"
```

**Flow**:
1. Same as above
2. When verification fails after auto-fix → **Sets `done = true`** ← UNCHANGED
3. Stops for manual review
4. Asks user if they want to continue

## Testing

### Manual Test

```bash
# Create test project with intentional errors
mkdir /tmp/test-loop
cd /tmp/test-loop
cat > package.json << 'EOF'
{ "scripts": { "build": "exit 1" } }
EOF

# Run in loop mode
npx newma-cli --loop --verify --max-iterations 2 "Fix build errors"

# Expected behavior:
# - Should attempt to fix errors
# - Should NOT exit with code 0 if verification fails
# - Should exit with code 1 (not done) to allow retry
```

### Automated Test

See `test-loop-verification-fix.sh` for automated test script.

## Impact

### What Changed:
- ✅ Loop mode now correctly continues after verification failure
- ✅ Exit codes match expected semantics (0 = done, 1 = not done, 2 = error)
- ✅ Bash scripts can properly detect completion status
- ✅ Non-loop behavior unchanged

### What Stayed the Same:
- ✅ AI-based verification still works
- ✅ Auto-fix on verification failure still attempts
- ✅ Non-loop mode behavior preserved
- ✅ All other CLI features unchanged

## Exit Code Reference

| Exit Code | Meaning | When It Happens |
|-----------|---------|-----------------|
| 0 | Success | Task completed (`done = true`) |
| 1 | Not Done | Max iterations reached, task incomplete |
| 2 | Error | Execution failed (exception, command error) |
| 130 | Interrupted | User pressed Ctrl+C |

## Related Files

- `src/cli.ts` - Main CLI entry point, loop logic
- `src/verifier.ts` - Automatic verification system
- `test-loop-verification-fix.sh` - Test script for this fix

## Lessons Learned

1. **Loop mode semantics differ**: Loop mode is designed for bash scripts, not interactive use
2. **Exit codes matter**: Bash scripts rely on correct exit codes for flow control
3. **Multiple verification systems**: Newma (牛码) has two verification systems that must be coordinated
4. **Test both modes**: Changes to verification logic must test both `--loop` and non-loop modes
5. **Documentation helps**: Clear exit code documentation prevents confusion

## Future Improvements

1. **Add integration tests**: Automated tests for loop mode behavior
2. **Unify verification systems**: Consider merging AI-based and automatic verification
3. **Better error messages**: More explicit about what's happening in loop mode
4. **Loop mode statistics**: Show iteration count and remaining iterations in output
