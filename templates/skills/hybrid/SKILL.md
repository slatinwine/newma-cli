---
name: Hybrid Skill Template
description: A template for hybrid skills (combines knowledge and code capabilities)
type: hybrid
complexity: 5
tags: [template, hybrid]
whenToUse:
  - User needs both information and code
  - Task requires understanding concepts and implementing solutions
triggers:
  - hybrid template trigger 1
  - hybrid template trigger 2
---

# Hybrid Skill Name

A brief description of what this hybrid skill does.

## Quick Start

1. **Understand context**: Gather information about the user's needs
2. **Provide knowledge**: Explain relevant concepts
3. **Implement solution**: Write code if needed
4. **Guide user**: Help them understand and use the solution

---

## When to Use This Skill

**Trigger conditions**:
- User asks questions that require both explanation and code
- User needs to understand concepts before implementing
- Task involves API integration, data processing, etc.

**Initial offer**:
"I can help you with [task]. I'll explain the concepts and provide code examples."

---

## Knowledge Base

### Concept 1: Concept Name

**Explanation**: [Clear explanation of the concept]

**Key points**:
- Point 1
- Point 2
- Point 3

**Code example**:
```typescript
// Example demonstrating the concept
```

### Concept 2: Concept Name

**Explanation**: [Clear explanation of the concept]

**Key points**:
- Point 1
- Point 2
- Point 3

**Code example**:
```typescript
// Example demonstrating the concept
```

---

## Code Library

### Function 1: Function Name

```typescript
/**
 * [Description]
 * @param [param] - [Description]
 * @returns [Description]
 */
function example(param: Type): ReturnType {
  // Implementation
  return result;
}
```

**Usage**:
```typescript
const result = example(value);
```

### Function 2: Function Name

```typescript
/**
 * [Description]
 * @param [param] - [Description]
 * @returns [Description]
 */
function example(param: Type): ReturnType {
  // Implementation
  return result;
}
```

**Usage**:
```typescript
const result = example(value);
```

---

## Response Templates

### Template 1: Explain and Implement

**Concept**: [Explanation of the concept]

**Implementation**:
```typescript
// Code implementation
```

**How it works**:
- [Point 1]
- [Point 2]

**Usage**:
```typescript
// Example usage
```

### Template 2: Troubleshooting

**Problem**: [Description of the issue]

**Root cause**: [Explanation]

**Solution**:
```typescript
// Fixed code
```

**Prevention**: [How to avoid in the future]

---

## Best Practices

### For Knowledge Delivery

1. **Start simple**: Begin with high-level explanation
2. **Add detail progressively**: Go deeper as needed
3. **Use analogies**: Relate to familiar concepts
4. **Check understanding**: Ask if clarification is needed

### For Code Delivery

1. **Write clean code**: Follow language conventions
2. **Comment liberally**: Explain non-obvious parts
3. **Provide examples**: Show how to use the code
4. **Handle errors**: Include proper error handling

---

## Examples

### Example 1: Concept + Implementation

**User**: "[Question requiring explanation and code]"

**AI Response**:
**Understanding [Concept]**:
[Clear explanation]

**Implementation**:
```typescript
// Working code
```

**Explanation**:
- [How it works]
- [Why this approach]

**Next steps**:
1. [Step 1]
2. [Step 2]

### Example 2: Debug with Explanation

**User**: "[Debugging request]"

**AI Response**:
**What's happening**: [Explanation of the issue]

**Why it occurs**: [Root cause analysis]

**Fix**:
```typescript
// Corrected code
```

**Testing**:
```typescript
// Test to verify the fix
```

---

## Integration Points

### API Integration

**Endpoint**: [API endpoint]
**Method**: [GET/POST/etc]
**Parameters**: [Required and optional parameters]

**Code**:
```typescript
async function callApi(params: Params): Promise<Result> {
  // Implementation
}
```

### Data Processing

**Input format**: [Description]
**Output format**: [Description]
**Transformations**: [Steps to process data]

**Code**:
```typescript
function processData(input: Input): Output {
  // Implementation
  return output;
}
```

---

## Common Patterns

### Pattern 1: Pattern Name

**When to use**: [Scenario]
**Concept**: [Explanation]
**Code**:
```typescript
// Implementation
```

### Pattern 2: Pattern Name

**When to use**: [Scenario]
**Concept**: [Explanation]
**Code**:
```typescript
// Implementation
```

---

## Resources

- **Documentation**: [Link]
- **API Reference**: [Link]
- **Examples**: [Link]
- **Tutorials**: [Link]
