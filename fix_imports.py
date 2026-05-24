#!/usr/bin/env python3
"""
Script to fix TypeScript imports for ESM compatibility
Adds .js extensions to local imports and handles directory imports
"""
import os
import re
from pathlib import Path

# Directories that have index files that should be explicitly imported
INDEX_DIRS = {
    'compressor', 'utils', 'agents', 'tools', 'loop', 'memory', 'skills',
    'plugins', 'hooks', 'executors', 'cache', 'state', 'execution', 'landmark',
    'fft', 'intent', 'ultrathink', 'self-healing', 'optimizer', 'permission',
    'context', 'verification', 'validation', 'planning', 'repl', 'history',
    'task-tracker', 'plan-state-machine', 'runtime', 'mcp', 'core',
}

def should_fix_file(file_path):
    """Check if file should be fixed"""
    excluded_parts = ['src/ui', 'src/skills', 'src/skills-creator', 'tui-frontend', 'repl-tui']
    return not any(excluded in str(file_path) for excluded in excluded_parts)

def fix_import_line(line):
    """Fix import statements in a line"""
    # Pattern to match import statements
    pattern = r"from ['\"]([^'\"]+)['\"]"

    def replace_import(match):
        import_path = match.group(1)

        # Skip external packages and absolute imports
        if not import_path.startswith('.'):
            return match.group(0)

        # Remove leading './' or '../' for processing
        normalized = import_path.lstrip('./')

        # If it already has .js extension, skip
        if normalized.endswith('.js'):
            return match.group(0)

        # If it has .ts extension, replace with .js
        if normalized.endswith('.ts'):
            return f"from '{import_path.replace('.ts', '.js')}'"

        # Check if it's a directory import (no extension)
        if '/' not in normalized or '.' not in normalized.split('/')[-1]:
            # This might be a directory import
            parts = normalized.split('/')

            # Check if any parent directory is an index dir
            for i in range(len(parts)):
                subdir = '/'.join(parts[:i+1])
                if subdir in INDEX_DIRS:
                    # Convert to index.js import
                    return f"from './{normalized}/index.js'"

            # Otherwise, add .js extension
            return f"from '{import_path}.js'"

        return match.group(0)

    return re.sub(pattern, replace_import, line)

def fix_file(file_path):
    """Fix all imports in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        fixed_lines = [fix_import_line(line) for line in lines]

        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(fixed_lines)

        return True
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")
        return False

def main():
    """Main function to process all TypeScript files"""
    src_dir = Path('src')

    if not src_dir.exists():
        print("src directory not found")
        return

    ts_files = list(src_dir.rglob('*.ts'))
    ts_files = [f for f in ts_files if should_fix_file(f)]

    print(f"Found {len(ts_files)} TypeScript files to fix")

    fixed_count = 0
    for file_path in ts_files:
        if fix_file(file_path):
            print(f"Fixed: {file_path}")
            fixed_count += 1

    print(f"\nFixed {fixed_count}/{len(ts_files)} files")

if __name__ == '__main__':
    main()
