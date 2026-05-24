---
name: Doc Coauthoring
description: Guide users through a structured workflow for co-authoring documentation
type: knowledge
complexity: 3
tags: [documentation, workflow, collaboration]
whenToUse:
  - User mentions writing documentation
  - User mentions technical specs
  - User needs help structuring content
  - User wants to improve existing docs
triggers:
  - write docs
  - create documentation
  - technical spec
  - API documentation
  - README
  - documentation workflow
---

# Doc Co-Authoring Workflow

This skill provides a structured workflow for guiding users through creating high-quality technical documentation.

## When to Offer This Workflow

**Trigger conditions:**
- User mentions writing documentation
- User mentions specific doc types (API docs, technical specs, README)
- User needs help with document structure
- User wants to improve existing documentation

**Initial offer:**
Offer the user a structured workflow that breaks documentation into three stages, with the option to focus on specific areas if they prefer.

---

## Quick Start

1. **Ask**: What type of document are you creating? (API docs, technical spec, README, tutorial)
2. **Stage 1**: Gather context about audience and purpose
3. **Stage 2**: Structure and refine content
4. **Stage 3**: Test with readers and iterate

---

## Stage 1: Context Gathering

### Ask the User:

1. **Document Type**: What type of document is this?
   - API reference
   - Technical specification
   - Tutorial / How-to guide
   - README / Overview
   - Architecture documentation
   - Decision record
   - Other (specify)

2. **Primary Audience**: Who is the primary audience?
   - New users / Beginners
   - Developers familiar with the codebase
   - External API users
   - Stakeholders / Managers
   - Future maintainers (yourself, included)
   - Other (specify)

3. **Desired Impact**: What should readers get out of this document?
   - Learn how to do something (tutorial)
   - Understand a system (architecture)
   - Make decisions (technical spec)
   - Solve problems quickly (API reference)
   - Get started quickly (README)
   - Other (specify)

4. **Key Questions**: What are the 3-5 most important questions this document should answer?

### Example Response:

```
Based on your inputs, I recommend the following structure:

**Document Type**: API Reference
**Audience**: External developers integrating with our service
**Impact**: Enable quick integration with clear examples

**Suggested Structure**:
1. Quick Start (5 min read)
2. Authentication
3. Core Endpoints (with examples)
4. Error Handling
5. Rate Limits & Best Practices
```

---

## Stage 2: Refinement & Structure

### Based on document type, apply appropriate structure:

#### For API Documentation:

```markdown
# [API Name] API Reference

## Quick Start
<brief getting started snippet>

## Authentication
<auth details>

## Endpoints

### [Endpoint 1]
**Description**: <what it does>
**Method**: GET/POST/PUT/DELETE
**Path**: /path/to/endpoint
**Parameters**:
- param1 (type, required): description
- param2 (type, optional): description

**Example**:
\```json
{
  "param1": "value1"
}
\```

**Response**:
\```json
{
  "result": "success"
}
\```

### [Endpoint 2]
<repeat structure>

## Error Codes
| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check parameters |
| 401 | Unauthorized | Check API key |

## Rate Limits & Best Practices
<limits and tips>
```

#### For Technical Specifications:

```markdown
# [Feature Name] Technical Specification

## Overview
<brief summary (2-3 sentences)>

## Background & Motivation
<why we're doing this>

## Goals
- Goal 1
- Goal 2
- Goal 3

## Non-Goals
- What we're explicitly not addressing
- Future work items

## Proposed Solution

### Architecture
<diagram or description>

### API Changes
\```typescript
interface NewAPI {
  // changes
}
\```

### Data Model
<schema changes>

## Alternatives Considered
1. Alternative A
   - Pros: ...
   - Cons: ...
   - Why not chosen: ...

2. Alternative B
   - Pros: ...
   - Cons: ...
   - Why not chosen: ...

## Implementation Plan
1. Phase 1: <description> (estimate)
2. Phase 2: <description> (estimate)
3. Phase 3: <description> (estimate)

## Success Metrics
- <measurable outcome 1>
- <measurable outcome 2>

## Open Questions
- Question 1?
- Question 2?
```

#### For README:

```markdown
# [Project Name]

## What is this?
<one-line description>

## Quick Start
\```bash
# 3-5 commands to get started
npm install
npm start
\```

## Key Features
- Feature 1
- Feature 2
- Feature 3

## Documentation
- [API Reference](link)
- [Tutorials](link)
- [Contributing](link)

## Examples
<1-2 quick examples>

## Community
- Link to docs
- Link to issues
- Link to discussions
```

### Refinement Tips:

1. **Active Voice**: Use "Click the button" not "The button should be clicked"
2. **Present Tense**: Use "This function calculates" not "This function will calculate"
3. **Specific Over General**: "Returns a 404 error" not "Returns an error"
4. **Code First**: Show code examples before explaining
5. **Progressive Disclosure**: Start simple, link to advanced topics

---

## Stage 3: Reader Testing

### Review Checklist:

**Clarity**:
- [ ] Can a new user understand the first paragraph?
- [ ] Are all technical terms explained or linked?
- [ ] Is the language simple and direct?

**Completeness**:
- [ ] Does it answer the 3-5 key questions from Stage 1?
- [ ] Are all steps actionable?
- [ ] Are common edge cases covered?

**Accuracy**:
- [ ] Have code examples been tested?
- [ ] Are all commands copy-pasteable?
- [ ] Are links valid?

**Structure**:
- [ ] Is there a clear hierarchy?
- [ ] Are headings descriptive?
- [ ] Is there a table of contents for long docs?

### Testing Methods:

1. **The "Newbie" Test**: Ask someone unfamiliar with the project to follow the documentation
2. **The "Break" Test**: Deliberately make mistakes and see if the docs help you recover
3. **The "Update" Test**: Change the code and see if docs make updates obvious

---

## Common Anti-Patterns to Avoid

❌ **Don't**:
- Start with "This document describes..."
- Use passive voice extensively
- Bury the lead (important info deep in the doc)
- Assume reader context they might not have
- Mix conceptual and procedural content
- Use jargon without definition

✅ **Instead**:
- Start with what the user wants to do
- Use active voice
- Put key info first (inverted pyramid)
- Link to prerequisite knowledge
- Separate concepts from procedures
- Define terms or link to glossary

---

## Advanced Topics

See `references/advanced.md` for:
- Internationalization (i18n)
- Documentation as Code
- Automated testing of docs
- Versioning strategies
