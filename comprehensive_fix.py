#!/usr/bin/env python3
"""
Comprehensive fix for TypeScript imports based on actual compilation errors
"""
import os
import re
from pathlib import Path

def fix_imports_in_file(file_path):
    """Fix imports based on actual compilation errors"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix patterns based on actual errors
        replacements = [
            # Fix directory index imports
            (r"from '\./hooks'", "from './hooks/index.js'"),
            (r"from '\./plugins'", "from './plugins/index.js'"),
            (r"from '\./memory'", "from './memory/index.js'"),
            (r"from '\./state'", "from './state/index.js'"),
            (r"from '\./compressor'", "from './compressor/index.js'"),
            (r"from '\./context'", "from './context/index.js'"),
            (r"from '\./core'", "from './core/index.js'"),
            (r"from '\./agents'", "from './agents/index.js'"),

            # Fix wrong relative paths in subdirectories
            (r"from '\../../history\.js'", "from '../history.js'"),
            (r"from '\../../tools/types\.js'", "from '../tools/types.js'"),
            (r"from '\../../tools/registry\.js'", "from '../tools/registry.js'"),
            (r"from '\../../loop/interfaces/plugin\.js'", "from '../loop/interfaces/plugin.js'"),
            (r"from '\../../loop/plugins/memo-cli-plugin\.js'", "from '../loop/plugins/memo-cli-plugin.js'"),

            # Fix paths that go too deep
            (r"from '\../core/types\.js'", "from './core/types.js'"),
            (r"from '\../tools/registry\.js'", "from './tools/registry.js'"),
            (r"from '\../tools/types\.js'", "from './tools/types.js'"),
        ]

        for pattern, replacement in replacements:
            content = re.sub(pattern, replacement, content)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return content != original_content
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")
        return False

def main():
    """Main function"""
    src_dir = Path('src')

    if not src_dir.exists():
        print("src directory not found")
        return

    ts_files = list(src_dir.rglob('*.ts'))

    # Exclude specific files
    excluded_parts = ['src/ui', 'src/skills', 'src/skills-creator', 'tui-frontend', 'repl-tui']
    ts_files = [f for f in ts_files if not any(excluded in str(f) for excluded in excluded_parts)]

    print(f"Processing {len(ts_files)} TypeScript files")

    fixed_count = 0
    for file_path in ts_files:
        if fix_imports_in_file(file_path):
            print(f"Fixed: {file_path}")
            fixed_count += 1

    print(f"Fixed {fixed_count} files")

if __name__ == '__main__':
    main()
