import json
import unittest
from dependency_audit_result import parse_audit_result


class AuditResultTests(unittest.TestCase):
    def test_clean_inventory(self):
        data = {"metadata": {"vulnerabilities": {"total": 0}}, "vulnerabilities": {}}
        self.assertEqual(parse_audit_result(json.dumps(data), 0), data)

    def test_advisories_remain_available_for_policy(self):
        data = {"metadata": {"vulnerabilities": {"total": 2}}, "vulnerabilities": {
            "dependency": {"via": [{"url": "https://github.com/advisories/example"}]},
            "parent": {"via": ["dependency"]}}}
        self.assertEqual(parse_audit_result(json.dumps(data), 1), data)

    def test_fail_closed_on_network_errors_and_incomplete_results(self):
        cases = [('', 1), ('not json', 1), ('{}', 0),
                 (json.dumps({"error": {"code": "ENOTFOUND"}}), 1)]
        for total, inventory, code in [(0, {}, 1), (0, {}, 2), (1, {}, 1),
                (-1, {}, 0), (True, {}, 0), (1, {"pkg": {}}, 1),
                (1, {"pkg": {"via": ["missing"]}}, 1)]:
            cases.append((json.dumps({"metadata": {"vulnerabilities": {"total": total}},
                                      "vulnerabilities": inventory}), code))
        for raw, code in cases:
            with self.subTest(raw=raw, code=code), self.assertRaises((ValueError, TypeError)):
                parse_audit_result(raw, code)


if __name__ == "__main__":
    unittest.main()
