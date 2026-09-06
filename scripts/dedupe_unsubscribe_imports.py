#!/usr/bin/env python3
from pathlib import Path

TARGETS = {
    Path('api/send-notifications.js'): "import { unsubscribeApiUrlForUser, unsubscribePageUrlForUser } from './_unsubscribe.js';",
    Path('api/e2e-login.js'): "import { createUnsubscribeToken } from './_unsubscribe.js';",
}

for path, import_line in TARGETS.items():
    text = path.read_text(encoding='utf-8')
    count = text.count(import_line)
    if count < 1:
        raise SystemExit(f'{path}: expected unsubscribe import is missing')
    if count > 1:
        first = text.find(import_line)
        before = text[:first + len(import_line)]
        after = text[first + len(import_line):].replace(import_line, '')
        text = before + after
        # Remove blank-line pileup created by duplicate line removal.
        while '\n\n\n' in text:
            text = text.replace('\n\n\n', '\n\n')
        path.write_text(text, encoding='utf-8')
    final = path.read_text(encoding='utf-8').count(import_line)
    if final != 1:
        raise SystemExit(f'{path}: expected exactly one unsubscribe import, found {final}')
    print(f'{path}: unsubscribe import count {count} -> {final}')
