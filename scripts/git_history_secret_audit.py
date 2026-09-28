#!/usr/bin/env python3
"""Scan every Git patch for high-confidence secret patterns without printing values.

The report contains only a detector name, commit, path, and a one-way fingerprint.
It intentionally never prints the matched line or credential value.
"""

from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]

PATTERNS = (
    ("private-key", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----")),
    ("aws-access-key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("github-token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})\b")),
    ("openai-api-key", re.compile(r"\b(?:sk-[A-Za-z0-9]{32,}|sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,})\b")),
    ("anthropic-api-key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("stripe-live-key", re.compile(r"\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b")),
    ("stripe-webhook-secret", re.compile(r"\bwhsec_[A-Za-z0-9]{24,}\b")),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{20,}\b")),
    ("resend-api-key", re.compile(r"\bre_[A-Za-z0-9]{24,}\b")),
)

GENERIC_ASSIGNMENT = re.compile(
    r"(?i)\b(?:api[_-]?key|service[_-]?key|private[_-]?key|secret|password|access[_-]?token|auth[_-]?token)\b"
    r"\s*[:=]\s*(?:['\"]([^'\"]{16,})['\"]|([A-Za-z0-9_./+=:$\-]{16,}))"
)
JWT = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")

ALLOWLIST_MARKERS = (
    "example",
    "placeholder",
    "change-me",
    "changeme",
    "dummy",
    "sample",
    "fake",
    "not-a-real",
    "test-key",
    "test-secret",
    "test-token",
    "yourpetpass_behavior",
    "process.env",
    "import.meta.env",
    "${",
)


def allowed(value: str, line: str) -> bool:
    # Allowlisting is based on the matched value itself, not arbitrary words
    # elsewhere on the same source line. This prevents a real credential from
    # being suppressed merely because a comment also says "example" or "test".
    del line
    lowered = value.lower()
    if any(marker in lowered for marker in ALLOWLIST_MARKERS):
        return True

    # Unquoted assignments such as accessToken: parsed.access_token are
    # variable/property references, not literal credentials. Provider-specific
    # token detectors and the JWT detector still inspect actual literal values.
    if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+", value):
        return True

    return False


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()[:12]


def jwt_role(value: str) -> str | None:
    try:
        payload = value.split(".", 2)[1]
        payload += "=" * (-len(payload) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload.encode()).decode("utf-8"))
    except Exception:
        return None
    role = decoded.get("role")
    return role if isinstance(role, str) else None


def findings_for_line(line: str):
    for detector, pattern in PATTERNS:
        for match in pattern.finditer(line):
            value = match.group(0)
            if not allowed(value, line):
                yield detector, value

    for match in GENERIC_ASSIGNMENT.finditer(line):
        value = match.group(1) or match.group(2)
        if value and not allowed(value, line):
            yield "generic-secret-assignment", value

    for match in JWT.finditer(line):
        value = match.group(0)
        if jwt_role(value) == "service_role" and not allowed(value, line):
            yield "supabase-service-role-jwt", value


def main() -> int:
    command = [
        "git", "log", "--all", "--full-history", "--no-ext-diff",
        "--format=__YPP_COMMIT__%H", "--patch", "--", ".",
    ]
    process = subprocess.Popen(
        command,
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )

    commit = "unknown"
    path = "unknown"
    findings = set()

    assert process.stdout is not None
    for raw in process.stdout:
        line = raw.rstrip("\n")
        if line.startswith("__YPP_COMMIT__"):
            commit = line.removeprefix("__YPP_COMMIT__")
            path = "unknown"
            continue
        if line.startswith("+++ b/"):
            path = line[6:]
            continue
        if not line.startswith("+") or line.startswith("+++"):
            continue

        added = line[1:]
        for detector, value in findings_for_line(added):
            findings.add((detector, commit, path, fingerprint(value)))

    stderr = process.stderr.read() if process.stderr else ""
    return_code = process.wait()
    if return_code:
        print(f"FAIL: Git history could not be scanned (exit {return_code}).", file=sys.stderr)
        if stderr:
            print(stderr[:500], file=sys.stderr)
        return 2

    if findings:
        print("FAIL: potential historical secrets require review.")
        print("Values are intentionally redacted.")
        for detector, found_commit, found_path, found_fingerprint in sorted(findings):
            print(
                f"- {detector} commit={found_commit[:12]} "
                f"path={found_path} fingerprint={found_fingerprint}"
            )
        return 1

    print("PASS: full Git history contains no high-confidence secret matches.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
