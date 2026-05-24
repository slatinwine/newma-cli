# Newma (牛码) Skill CLI - Quick Reference

Complete command reference for the `kode-skill` CLI tool.

## Installation

```bash
# Install globally (after building)
npm install -g .

# Or use with npx
npx kode-skill <command>
```

## Commands

### compile

Compile TypeScript skill to JavaScript.

```bash
kode-skill compile <path> [options]
```

**Options**:
- `-o, --out-dir <dir>` - Output directory (default: ./dist)
- `-s, --source-map` - Generate source maps
- `-d, --declaration` - Generate declaration files
- `-m, --minify` - Minify output
- `-w, --watch` - Watch for changes and recompile

**Examples**:
```bash
# Basic compilation
kode-skill compile ./skills/my-skill

# With source maps and declarations
kode-skill compile ./skills/my-skill --source-map --declaration

# Watch mode for development
kode-skill compile ./skills/my-skill --watch
```

### package

Create a distributable .kode.tar.gz package.

```bash
kode-skill package <path> [options]
```

**Options**:
- `-o, --output <file>` - Output file path
- `--no-source` - Exclude source files
- `-m, --minify` - Minify output
- `-v, --verbose` - Verbose output

**Examples**:
```bash
# Basic package
kode-skill package ./skills/my-skill

# Custom output location
kode-skill package ./skills/my-skill --output ./dist/my-skill-1.0.0.kode.tar.gz

# Exclude source files
kode-skill package ./skills/my-skill --no-source
```

### install

Install a skill from a package file.

```bash
kode-skill install <package> [options]
```

**Options**:
- `-t, --target <dir>` - Target installation directory
- `--no-symlink` - Do not create symlink
- `--no-verify` - Skip package verification
- `-f, --force` - Force reinstall
- `-v, --verbose` - Verbose output

**Examples**:
```bash
# Basic installation
kode-skill install ./my-skill-1.0.0.kode.tar.gz

# Force reinstall
kode-skill install ./my-skill-1.0.0.kode.tar.gz --force

# Custom install location
kode-skill install ./my-sill-1.0.0.kode.tar.gz --target ~/.local/skills
```

### uninstall

Uninstall a skill.

```bash
kode-skill uninstall <skillId> [options]
```

**Options**:
- `--remove-config` - Remove configuration files
- `-f, --force` - Force removal
- `-v, --verbose` - Verbose output

**Examples**:
```bash
# Basic uninstall
kode-skill uninstall my-skill

# Remove config files too
kode-skill uninstall my-skill --remove-config

# Force removal
kode-skill uninstall my-skill --force
```

### list

List all installed skills.

```bash
kode-skill list
```

**Example output**:
```
📚 Installed Skills

frontend-design v1.0.0
   Create distinctive, production-grade frontend interfaces
   Path: ~/.kode/skills/frontend-design
   Size: 45.23 KB
   Installed: 1/29/2026
```

### search

Search the skills registry.

```bash
kode-skill search [query] [options]
```

**Options**:
- `-c, --category <category>` - Filter by category
- `-t, --tag <tag>` - Filter by tag
- `-r, --min-rating <rating>` - Minimum rating
- `-s, --sort <field>` - Sort by field (relevance|name|version|downloads|rating)
- `-l, --limit <n>` - Limit results (default: 20)

**Examples**:
```bash
# Search all
kode-skill search

# Search by query
kode-skill search frontend

# Filter and sort
kode-skill search --category frontend --sort rating --limit 10

# By tag
kode-skill search --tag design
```

### publish

Publish skill to local registry.

```bash
kode-skill publish <package> [options]
```

**Options**:
- `-u, --url <url>` - Package URL
- `--public` - Make public

**Examples**:
```bash
# Basic publish
kode-skill publish ./my-skill-1.0.0.kode.tar.gz

# With custom URL
kode-skill publish ./my-skill-1.0.0.kode.tar.gz --url https://example.com/skills
```

### info

Get detailed information about a skill.

```bash
kode-skill info <skillId>
```

**Example output**:
```
ℹ️  Skill Info: frontend-design

Installed Version
   Version: 1.0.0
   Path: ~/.kode/skills/frontend-design
   Size: 45.23 KB
   Installed: 1/29/2026
   Updated: 1/29/2026

Metadata
   Name: Frontend Design
   Description: Create distinctive, production-grade frontend interfaces
   Type: hybrid
   Category: frontend
   Author: Newma (牛码) Development Team
   License: MIT
```

## Common Workflows

### Create and Distribute a New Skill

```bash
# 1. Create skill with wizard
npx newma-cli -i
> /create-plugin

# 2. Compile skill
kode-skill compile ./skills/my-skill --source-map

# 3. Create package
kode-skill package ./skills/my-skill

# 4. Publish to registry
kode-skill publish ./my-skill-1.0.0.kode.tar.gz

# 5. Install (test)
kode-skill install ./my-skill-1.0.0.kode.tar.gz

# 6. Verify
kode-skill info my-skill
```

### Development Workflow

```bash
# Start watch mode
kode-skill compile ./skills/my-skill --watch

# In another terminal, make changes to skill
# Compilation happens automatically

# When ready, package and test
kode-skill package ./skills/my-skill
kode-skill install ./my-skill-1.0.0.kode.tar.gz
```

### Update an Existing Skill

```bash
# 1. Make changes to skill
# 2. Rebuild
kode-skill compile ./skills/my-skill

# 3. Create new package (bump version first)
kode-skill package ./skills/my-skill

# 4. Publish new version
kode-skill publish ./my-skill-1.1.0.kode.tar.gz

# 5. Upgrade
kode-skill upgrade my-skill
```

## File Locations

| Location | Path |
|----------|------|
| **Installed Skills** | `~/.kode/skills/` |
| **Registry Cache** | `~/.kode/registry/cache.json` |
| **Installed DB** | `~/.kode/skills/installed.json` |
| **Config** | `~/.kode/config/<skillId>/` |

## Package Format (.kode.tar.gz)

```
my-skill-1.0.0.kode.tar.gz
├── package.json          # Metadata
├── SKILL.md              # Documentation
├── code.js               # Compiled code
├── code.js.map           # Source map
├── code.d.ts             # Type declarations
├── references/           # Progressive sections
└── test/                 # Tests
```

## Troubleshooting

### Compilation fails

```bash
# Enable verbose output
kode-skill compile ./skills/my-skill --verbose

# Check TypeScript version
npm list typescript

# Clean and rebuild
rm -rf ./dist
kode-skill compile ./skills/my-skill
```

### Installation fails

```bash
# Skip verification
kode-skill install ./package.kode.tar.gz --no-verify

# Force reinstall
kode-skill install ./package.kode.tar.gz --force

# Check installed skills
kode-skill list
```

### Package not found in registry

```bash
# Update registry cache
kode-skill update-registry

# List all registry entries
kode-sill search

# Publish manually
kode-skill publish ./package.kode.tar.gz
```

## Tips

1. **Use watch mode during development** - Auto-compile on changes
2. **Always verify packages** - Ensures integrity
3. **Keep versions semantic** - Follow semver (MAJOR.MINOR.PATCH)
4. **Test before publishing** - Install package locally first
5. **Use symlinks** - Makes version management easier
6. **Document your skills** - Good SKILL.md files improve discoverability
7. **Tag appropriately** - Helps with registry search
8. **Clean old versions** - Uninstall outdated versions to save space

## Security Notes

- All compilation uses `execFileNoThrow` (safe execution)
- Packages are verified before installation (SHA-256 checksums)
- Skills install to user directory only (`~/.kode/skills/`)
- No system-wide modifications
- Easy to uninstall completely

---

**Version**: 1.0.0
**Last Updated**: 2026-01-29
**Status**: Production Ready ✅
