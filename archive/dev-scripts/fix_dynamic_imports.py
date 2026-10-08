#!/usr/bin/env python3
"""
Script to fix dynamic imports that are missing .js extensions
"""
import os
import re
from pathlib import Path

def fix_dynamic_imports(file_path):
    """Fix dynamic imports missing .js extensions"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix dynamic imports: import('path') -> import('path.js')
        # Pattern: await import('../path') where path doesn't end with .js
        content = re.sub(
            r"await import\('(\.\./[^']+)'\)",
            lambda m: f"await import('{m.group(1)}.js')" if not m.group(1).endswith('.js') else m.group(0),
            content
        )

        # Fix dynamic imports with ./
        content = re.sub(
            r"await import\('\./[^']+([^']+)'\)",
            lambda m: m.group(0) if m.group(1).endswith('.js') or m.group(1).endswith('.ts') else m.group(0).replace("'", ".js'"),
            content
        )

        # Fix all other import() calls
        content = re.sub(
            r"import\('(\.\.?/[^']+)'\)",
            lambda m: f"import('{m.group(1)}.js')" if not m.group(1).endswith('.js') and not m.group(1).endswith('.ts') else m.group(0),
            content
        )

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return content != original_content
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

    # Exclude specific files
    excluded_parts = ['src/ui', 'src/skills', 'src/skills-creator', 'tui-frontend', 'repl-tui']
    ts_files = [f for f in ts_files if not any(excluded in str(f) for excluded in excluded_parts)]

    print(f"Found {len(ts_files)} TypeScript files to fix")

    fixed_count = 0
    for file_path in ts_files:
        if fix_dynamic_imports(file_path):
            print(f"Fixed: {file_path}")
            fixed_count += 1

    print(f"Fixed {fixed_count} files")

if __name__ == '__main__':
    main()
