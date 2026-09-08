#!/usr/bin/env python3
"""Fail CI if editor/merge/backup artifacts are committed to the repository.

These files are easy to mistake for live source during review and can preserve
obsolete security-sensitive code after the real implementation has changed.
"""

import subprocess
from pathlib import PurePosixPath

tracked = subprocess.run(
    ["git", "ls-tree", "-r", "HEAD", "--name-only"],
    check=True,
    capture_output=True,
    text=True,
).stdout.splitlines()

BAD_SUFFIXES = (".orig", ".bak", ".old", ".rej", ".swp", ".swo", ".tmp")
BAD_NAMES = {".DS_Store", "Thumbs.db"}

bad = []
for path in tracked:
    name = PurePosixPath(path).name
    if name in BAD_NAMES or name.endswith(BAD_SUFFIXES) or name.endswith("~"):
        bad.append(path)

if bad:
    print("FAIL: tracked backup/editor artifacts found:")
    for path in bad:
        print(f"  - {path}")
    raise SystemExit(1)

print(f"PASS: no tracked backup/editor artifacts ({len(tracked)} tracked paths checked)")
