#!/usr/bin/env python3
"""
Script to fix incorrect index.js imports that should be regular .js imports
"""
import os
import re
from pathlib import Path

def fix_index_imports(file_path):
    """Fix incorrect index.js imports in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Fix patterns like './tools/types/index.js' -> './tools/types.js'
        # but keep legitimate index imports like './compressor/index.js'
        content = re.sub(
            r"from '(\./[^']+)/types/index\.js'",
            r"from '\1/types.js'",
            content
        )
        content = re.sub(
            r"from '(\./[^']+)/registry/index\.js'",
            r"from '\1/registry.js'",
            content
        )
        content = re.sub(
            r"from '(\./[^']+)/utils/index\.js'",
            r"from '\1/utils.js'",
            content
        )
        content = re.sub(
            r"from '(\./[^']+)/history/index\.js'",
            r"from '\1/history.js'",
            content
        )
        content = re.sub(
            r"from '(\./[^']+)/execFileNoThrow/index\.js'",
            r"from '\1/execFileNoThrow.js'",
            content
        )

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

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

    # Exclude specific files
    excluded_parts = ['src/ui', 'src/skills', 'src/skills-creator', 'tui-frontend', 'repl-tui']
    ts_files = [f for f in ts_files if not any(excluded in str(f) for excluded in excluded_parts)]

    print(f"Found {len(ts_files)} TypeScript files to fix")

    fixed_count = 0
    for file_path in ts_files:
        if fix_index_imports(file_path):
            fixed_count += 1

    print(f"Fixed {fixed_count}/{len(ts_files)} files")

if __name__ == '__main__':
    main()
