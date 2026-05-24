# Self-Healing System Integration Guide

## Overview

The self-healing system enables Newma to:
1. **Detect issues** automatically from execution patterns
2. **Diagnose root causes** using AI
3. **Generate specialized tools** to handle recurring problems
4. **Auto-repair** issues when safe
5. **Learn from repairs** to improve over time

## Architecture

```
┌─────────────────────────────────────────────────────┐
│          Self-Healing System                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐    ┌──────────────┐             │
│  │   Issue      │    │   Tool       │             │
│  │  Detector    │───▶│  Generator   │             │
│  │              │    │              │             │
│  └──────────────┘    └──────────────┘             │
│         │                     │                    │
│         ↓                     ↓                    │
│  ┌──────────────┐    ┌──────────────┐             │
│  │   Repair     │    │  Learning    │             │
│  │   Engine     │    │   System     │             │
│  │              │    │              │             │
│  └──────────────┘    └──────────────┘             │
│         │                                        │
│         └──────────────┬─────────────────────────┘
│                        ↓
│              ┌──────────────────┐
│              │ SelfHealing      │
│              │    Manager       │
│              └──────────────────┘
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Components

### 1. IssueDetector (`src/self-healing/detector.ts`)
- Analyzes execution history for patterns
- Detects recurring errors
- Categorizes issues by type and severity
- Provides diagnosis with suggested actions

### 2. ToolGenerator (`src/self-healing/tool-generator.ts`)
- Uses AI to generate specialized tools
- Validates tool specifications
- Saves tools to files (secure approach)
- Converts specs to Tool interface

### 3. RepairEngine (`src/self-healing/repair-engine.ts`)
- Executes suggested fixes
- Creates rollback checkpoints
- Verifies repairs
- Maintains repair history

### 4. SelfHealingManager (`src/self-healing/manager.ts`)
- Main orchestrator
- Coordinates all components
- Manages learning data
- Provides health checks

## Integration Steps

### Step 1: Add to SessionManager

In `src/session.ts`, add self-healing manager:

```typescript
import { SelfHealingManager } from './self-healing';

export class SessionManager {
  private selfHealingManager?: SelfHealingManager;

  constructor(/* ... */) {
    // Initialize self-healing if enabled
    const selfHealingConfig = config.selfHealing || {};
    if (selfHealingConfig.enabled) {
      this.selfHealingManager = new SelfHealingManager(
        this.getTracker(),
        this.getRollbackManager(),
        this.getVerifier(),
        this.getConfig(),
        selfHealingConfig
      );
      await this.selfHealingManager.initialize();
    }
  }

  getSelfHealingManager(): SelfHealingManager | undefined {
    return this.selfHealingManager;
  }
}
```

### Step 2: Process Executions

In `src/repl.ts` or `src/executor-v2.ts`, feed executions to self-healing:

```typescript
// After executing an action
const record = tracker.recordAction(action, result, duration);

// Feed to self-healing manager
const selfHealing = session.getSelfHealingManager();
if (selfHealing) {
  await selfHealing.processExecution(record);
}
```

### Step 3: Add Commands

Add new REPL commands for self-healing interaction:

```typescript
// In src/repl.ts, handleSpecialCommand method
case 'diagnose':
  if (!args) {
    console.log('Usage: /diagnose <issue>');
    return;
  }
  const diagnosis = await session.getSelfHealingManager()?.diagnose(args);
  break;

case 'create-tool':
  if (!args) {
    console.log('Usage: /create-tool <description>');
    return;
  }
  await session.getSelfHealingManager()?.createTool(args, config);
  break;

case 'health-check':
  const health = await session.getSelfHealingManager()?.healthCheck();
  console.log(`Health: ${health?.overallHealth}`);
  health?.checks.forEach(check => {
    console.log(`  [${check.status}] ${check.message}`);
  });
  break;

case 'self-heal':
  const stats = session.getSelfHealingManager()?.getStats();
  console.log('Self-Healing Stats:', stats);
  break;
```

### Step 4: Configuration

Add to `settings.json`:

```json
{
  "selfHealing": {
    "enabled": true,
    "autoRepair": false,
    "autoToolCreation": true,
    "learningEnabled": true,
    "maxAutoFixRisk": "low",
    "minConfidenceThreshold": 0.7,
    "patternRetentionDays": 30
  }
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | false | Enable self-healing system |
| `autoRepair` | boolean | false | Automatically fix issues without confirmation |
| `autoToolCreation` | boolean | false | Automatically generate tools for patterns |
| `learningEnabled` | boolean | true | Learn from past repairs |
| `maxAutoFixRisk` | string | "low" | Maximum risk for auto-fix (low/medium/high) |
| `minConfidenceThreshold` | number | 0.7 | Minimum confidence for auto-actions |
| `patternRetentionDays` | number | 30 | How long to keep pattern data |

## Usage Examples

### Manual Diagnosis

```bash
[newma] ❯ /diagnose "frequently getting file not found errors"

📊 Diagnosis Result:
  Issue: frequently getting file not found errors
  Category: tool_error
  Severity: medium
  Root Cause: Tool may be missing or improperly configured
  Confidence: 75%
  Can Auto-Fix: No

💡 Suggested Actions:
  1. [create_tool] Create specialized tool to handle: file_not_found
     Priority: 60%
     Risk: low
```

### Create Tool

```bash
[newma] ❯ /create-tool "create a tool that checks if a file exists before reading it"

[ToolGenerator] 🛠️  Generating tool from request...
[SelfHealing] ✅ Tool created: file-exists-checker
```

### Health Check

```bash
[newma] ❯ /health-check

Health: degraded
  [pass] No critical error patterns
  [warn] High-frequency error patterns detected
  [pass] Good repair success rate: 85%

Recommendations:
  - Consider generating specialized tools to handle frequent errors
```

### Self-Healing Stats

```bash
[newma] ❯ /self-heal

Self-Healing Stats:
  Patterns Detected: 12
  Tools Generated: 3
  Repairs Attempted: 7
  Repairs Successful: 6
```

## File Structure

```
.kode/self-healing/
├── tools/              # Auto-generated tools
│   ├── retry-wrapper.ts
│   └── file-checker.ts
└── learning.json       # Learning data (for AI improvement)
```

## Safety Features

1. **Rollback Checkpoints**: Every repair creates a git checkpoint
2. **Risk Assessment**: Actions categorized by risk (low/medium/high)
3. **Confirmation Required**: Most actions require user approval
4. **Validation**: Tools validated before saving
5. **Verification**: Repairs verified before completion

## Learning System

The self-healing system learns from:
- Error patterns
- Successful repairs
- Failed repairs
- Tool effectiveness

Learning data is saved to `.kode/self-healing/learning.json` and used to:
- Improve pattern recognition
- Suggest better fixes
- Avoid repeating failed repairs
- Prioritize effective solutions

## Future Improvements

1. **Predictive Detection**: Anticipate issues before they occur
2. **Collaborative Learning**: Share patterns across projects
3. **Tool Marketplace**: Share useful tools with community
4. **Advanced ML**: Use machine learning for better pattern recognition
5. **Cross-Project Learning**: Learn from multiple codebases

## Troubleshooting

### Self-Healing Not Working

1. Check if enabled: `/self-heal` should show stats
2. Verify config: Check `settings.json` for `selfHealing.enabled`
3. Check logs: Look for `[SelfHealing]` prefixed messages

### Tools Not Being Generated

1. Verify `autoToolCreation: true` in config
2. Check pattern frequency threshold (default: 3 occurrences)
3. Review AI configuration (must be working for tool generation)

### Auto-Repair Not Triggering

1. Verify `autoRepair: true` in config
2. Check confidence threshold (default: 0.7)
3. Ensure risk level is within `maxAutoFixRisk`

## Security Considerations

1. **Tool Code Review**: Always review auto-generated tools before use
2. **Sandboxing**: Tools run with permission restrictions
3. **File Storage**: Tools saved to files, not eval'd (safer)
4. **Rollback Available**: All repairs can be undone
5. **User Confirmation**: High-risk actions require approval

## Performance Impact

- **Minimal overhead**: Pattern detection is lightweight
- **Async processing**: Most operations run in background
- **Selective activation**: Only processes relevant executions
- **Configurable**: Can disable heavy features (auto-tool-creation)
