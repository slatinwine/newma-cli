# Calculator Plugin

A simple calculator plugin for Newma (牛码) that provides basic mathematical operations.

## Version

v1.0.0

## Tools

### `add`
Add two numbers together.

**Parameters:**
- `a` (number): First number
- `b` (number): Second number

**Returns:** `a + b`

**Example:**
```typescript
{ "a": 5, "b": 3 } → "5 + 3 = 8"
```

### `subtract`
Subtract b from a.

**Parameters:**
- `a` (number): First number
- `b` (number): Second number

**Returns:** `a - b`

**Example:**
```typescript
{ "a": 10, "b": 4 } → "10 - 4 = 6"
```

### `multiply`
Multiply two numbers.

**Parameters:**
- `a` (number): First number
- `b` (number): Second number

**Returns:** `a × b`

**Example:**
```typescript
{ "a": 6, "b": 7 } → "6 × 7 = 42"
```

### `divide`
Divide a by b (with zero-division protection).

**Parameters:**
- `a` (number): First number
- `b` (number): Second number

**Returns:** `a ÷ b`

**Example:**
```typescript
{ "a": 20, "b": 4 } → "20 ÷ 4 = 5"
```

**Error Handling:**
- Returns error if `b === 0` (division by zero)

## Installation

```bash
# Copy to your Newma (牛码) plugins directory
cp -r calculator-plugin ~/.kode/plugins/
```

## Usage

### In Newma (牛码) REPL

```bash
$ npx newma-cli -i

# Load the plugin
> /plugin-load calculator-plugin

# Use the tools
> add a=5 b=3
> subtract a=10 b=4
> multiply a=6 b=7
> divide a=20 b=4
```

## Features

- ✅ All operations are read_only (safe)
- ✅ Input validation (type checking)
- ✅ Error handling (zero-division protection)
- ✅ Clear output formatting
- ✅ JSDoc comments

## Author

Newma (牛码) User

## License

MIT
