#!/usr/bin/env python3
"""Migrate AppColors.ink/inkMuted/inkSubtle/inkFaint/border to Theme.of(context) equivalents."""

import re
import os
import sys

FLUTTER_LIB = os.path.join(os.path.dirname(__file__), '..', 'mobile', 'lib')

SKIP_FILES = {'app_theme.dart'}

# Order matters: longest tokens first to avoid prefix corruption
# e.g. "AppColors.inkSubtle" must be replaced before "AppColors.ink"
TOKEN_MAP = {
    'AppColors.inkSubtle': 'Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)',
    'AppColors.inkMuted': 'Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)',
    'AppColors.inkFaint': 'Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)',
    'AppColors.inkStrong': 'Theme.of(context).colorScheme.onSurface',
    'AppColors.borderStrong': 'Theme.of(context).colorScheme.outlineVariant',
    'AppColors.border': 'Theme.of(context).colorScheme.outline',
    'AppColors.ink': 'Theme.of(context).colorScheme.onSurface',
}

def find_dart_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        for f in filenames:
            if f.endswith('.dart'):
                yield os.path.join(dirpath, f)

def has_any_token(content):
    for token in TOKEN_MAP:
        if token in content:
            return True
    return False

def migrate_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if not has_any_token(content):
        return False, 0
    
    original = content
    total_replacements = 0
    
    # Replace tokens (longest first, so order in TOKEN_MAP is critical)
    for old, new in TOKEN_MAP.items():
        count = content.count(old)
        if count > 0:
            total_replacements += count
            content = content.replace(old, new)
    
    # Now fix const_eval_method_invocation:
    # Find "const" followed by a constructor that contains Theme.of(context)
    # Pattern: "const <Identifier>(" where the block contains Theme.of(context)
    constructors = [
        'TextStyle', 'Icon', 'BorderSide', 'EdgeInsets', 'BoxDecoration',
        'RoundedRectangleBorder', 'UnderlineInputBorder', 'InputDecoration',
        'BoxConstraints', 'Offset', 'Size', 'EdgeInsetsDirectional',
        'Border', 'ClipRRect', 'SliverGrid', 'SliverGridDelegateWithFixedCrossAxisCount',
    ]
    
    for ctor in constructors:
        # Find "const Constructor(" and check if Theme.of appears in the upcoming content
        idx = 0
        while True:
            search = f'const {ctor}('
            pos = content.find(search, idx)
            if pos == -1:
                break
            
            # Check next 1000 chars for Theme.of(context)
            end_check = min(pos + 1000, len(content))
            snippet = content[pos:end_check]
            if 'Theme.of(context)' in snippet:
                # Remove 'const ' (6 characters: c-o-n-s-t-space)
                content = content[:pos] + content[pos + 6:]
                total_replacements += 1
            
            idx = pos + 1
    
    # Also handle "const" before custom widgets that now use Theme.of
    # e.g. "const ServiqSurface(" -> "ServiqSurface("
    # This is harder to generalize, so handle common patterns
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True, total_replacements
    
    return False, 0

def main():
    root = os.path.abspath(FLUTTER_LIB)
    if not os.path.exists(root):
        print(f"Error: {root} does not exist")
        sys.exit(1)
    
    changed_files = []
    total_replacements = 0
    
    for filepath in sorted(find_dart_files(root)):
        basename = os.path.basename(filepath)
        if basename in SKIP_FILES:
            continue
        
        changed, count = migrate_file(filepath)
        if changed:
            rel = os.path.relpath(filepath, root)
            changed_files.append((rel, count))
            total_replacements += count
    
    print(f"\nMigration complete!")
    print(f"Files changed: {len(changed_files)}")
    print(f"Total replacements: {total_replacements}")
    print()
    for rel, count in sorted(changed_files):
        print(f"  {rel}: {count} replacements")

if __name__ == '__main__':
    main()
