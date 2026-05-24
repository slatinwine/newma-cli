#!/usr/bin/env python3
"""
Final comprehensive fix for TypeScript imports
"""
import os
import re
from pathlib import Path

def fix_file(file_path):
    """Fix all import issues in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # Fix 1: Remove incorrect /index.js from non-directory imports
        content = re.sub(r'/types/index\.js', '/types.js', content)
        content = re.sub(r'/registry/index\.js', '/registry.js', content)
        content = re.sub(r'/utils/index\.js', '/utils.js', content)
        content = re.sub(r'/history/index\.js', '/history.js', content)
        content = re.sub(r'/execFileNoThrow/index\.js', '/execFileNoThrow.js', content)
        content = re.sub(r'/stream/index\.js', '/stream.js', content)
        content = re.sub(r'/skill-types/index\.js', '/skill-types.js', content)
        content = re.sub(r'/coordinator/index\.js', '/coordinator.js', content)
        content = re.sub(r'/optimizer/index\.js', '/optimizer.js', content)
        content = re.sub(r'/loader/index\.js', '/loader.js', content)
        content = re.sub(r'/manager/index\.js', '/manager.js', content)
        content = re.sub(r'/executor/index\.js', '/executor.js', content)
        content = re.sub(r'/types/index\.js', '/types.js', content)

        # Fix 2: Fix broken dynamic imports like import(.js'path')
        content = re.sub(r"import(\.js'", "import('", content)

        # Fix 3: Ensure all relative imports in import() have .js extension
        def fix_dynamic_import(match):
            import_path = match.group(1)
            if not import_path.endswith('.js') and not import_path.endswith('.ts'):
                return f"await import('{import_path}.js')"
            return match.group(0)

        content = re.sub(r"await import\('(\.\.?/[^']+)'\)", fix_dynamic_import, content)
        content = re.sub(r"import\('(\.\.?/[^']+)'\)", fix_dynamic_import, content)

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
        if fix_file(file_path):
            print(f"Fixed: {file_path}")
            fixed_count += 1

    print(f"Fixed {fixed_count} files")

if __name__ == '__main__':
    main()
