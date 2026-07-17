#!/usr/bin/env python3
"""Second pass: for every Theme.of(context) call, walk backwards through
parentheses to find the enclosing const constructor and remove ONLY the
`const ` prefix (not the constructor name)."""

import os
import re

MOBILE_LIB = os.path.join(os.path.dirname(__file__), '..', 'mobile', 'lib')


def find_const_to_remove(content: str, theme_pos: int):
    """Walk backwards from theme_pos to find enclosing `const` keyword.
    Returns (start, end) of just the 'const ' text, or None."""
    i = theme_pos - 1
    depth = 0

    while i >= 0:
        ch = content[i]
        if ch == ')':
            depth += 1
        elif ch == '(':
            if depth > 0:
                depth -= 1
            else:
                # Found opening `(` of enclosing constructor
                # Look backwards for just 'const ' (the keyword + whitespace)
                # Allow newlines between const and constructor name
                j = i - 1
                # Skip whitespace before (
                while j >= 0 and content[j] in ' \t\n\r':
                    j -= 1
                # Now j points to last char of constructor name
                # Walk back through identifier
                name_end = j + 1
                while j >= 0 and (content[j].isalnum() or content[j] == '_'):
                    j -= 1
                # j is now just before the constructor name
                # Skip whitespace between const and name
                k = j
                while k >= 0 and content[k] in ' \t\n\r':
                    k -= 1
                # Check if 'const' is right here
                if k >= 4 and content[k - 4:k + 1] == 'const':
                    # Make sure it's the keyword, not part of an identifier
                    if k - 5 < 0 or not content[k - 5].isalnum():
                        # Found! Remove from 'const' start to just past the trailing space
                        # const_start = k - 4, const_end = k + 1 (one past 'const')
                        # But we want to remove 'const ' including the space(s) after
                        # Find the end of whitespace after 'const'
                        ws_start = k + 1
                        ws_end = ws_start
                        while ws_end < i and content[ws_end] in ' \t\n\r':
                            ws_end += 1
                        return (k - 4, ws_end)
                # No const found before this ( — continue walking out
                # Don't return None; keep searching outer constructors
        i -= 1

    return None


def fix_file(filepath: str) -> int:
    with open(filepath, 'r') as f:
        content = f.read()

    original = content
    total = 0

    pattern = 'Theme.of(context)'
    idx = 0
    removals = []

    while True:
        pos = content.find(pattern, idx)
        if pos == -1:
            break
        result = find_const_to_remove(content, pos)
        if result:
            removals.append(result)
        idx = pos + len(pattern)

    # De-duplicate
    unique = set()
    deduped = []
    for start, end in removals:
        key = (start, end)
        if key not in unique:
            unique.add(key)
            deduped.append((start, end))

    # Remove in reverse order
    deduped.sort(key=lambda x: x[0], reverse=True)
    for start, end in deduped:
        text = content[start:end]
        if 'const' in text:
            content = content[:start] + content[end:]
            total += 1

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)

    return total


def main():
    total = 0
    files_changed = 0
    for root, dirs, files in os.walk(MOBILE_LIB):
        for fname in sorted(files):
            if not fname.endswith('.dart'):
                continue
            filepath = os.path.join(root, fname)
            count = fix_file(filepath)
            if count > 0:
                relpath = os.path.relpath(filepath, os.path.join(os.path.dirname(__file__), '..', 'mobile', 'lib'))
                print(f"  {relpath}: {count} const removals")
                total += count
                files_changed += 1

    print(f"\nDone! {total} const removals across {files_changed} files")


if __name__ == '__main__':
    main()
