"""Reject unavailable/incomplete npm advisory results before applying exceptions."""
import json


def parse_audit_result(stdout, returncode):
    data = json.loads(stdout)
    if returncode not in (0, 1) or not isinstance(data, dict) or data.get("error"):
        raise ValueError("npm audit failed")
    counts = data.get("metadata", {}).get("vulnerabilities", {})
    total = counts.get("total")
    vulnerabilities = data.get("vulnerabilities")
    if type(total) is not int or total < 0 or not isinstance(vulnerabilities, dict):
        raise ValueError("npm audit omitted a valid vulnerability inventory")
    if total != len(vulnerabilities) or (total == 0 and returncode != 0):
        raise ValueError("npm audit returned an inconsistent vulnerability inventory")
    for entry in vulnerabilities.values():
        if not isinstance(entry, dict) or not isinstance(entry.get("via"), list) or not entry["via"]:
            raise ValueError("npm audit omitted vulnerability causes")
        for cause in entry["via"]:
            if isinstance(cause, str) and cause in vulnerabilities:
                continue
            if isinstance(cause, dict) and isinstance(cause.get("url"), str):
                continue
            raise ValueError("npm audit returned an incomplete vulnerability cause")
    return data
