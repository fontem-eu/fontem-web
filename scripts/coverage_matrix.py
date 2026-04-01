#!/usr/bin/env python3
"""
Coverage Matrix Generator
==========================
Reads requirements.yml and coverage-map.yml, cross-references with
actual test names from e2e spec files, and generates a JSON matrix.

Usage:
    python scripts/coverage_matrix.py > public/coverage-matrix.json
"""
import json
import re
import sys
from pathlib import Path

import yaml


def extract_test_names(spec_dir: Path) -> dict[str, list[str]]:
    """Extract test names from Playwright spec files."""
    tests: dict[str, list[str]] = {}
    for f in sorted(spec_dir.glob("*.spec.js")):
        names = []
        for line in f.read_text().splitlines():
            m = re.search(r"test\(['\"](.+?)['\"]", line)
            if m:
                names.append(m.group(1))
        tests[f.name] = names
    return tests


def main():
    root = Path(__file__).resolve().parent.parent
    req_path = root / "requirements.yml"
    map_path = root / "coverage-map.yml"
    spec_dir = root / "tests" / "e2e"

    # Load requirements
    with open(req_path) as f:
        requirements = yaml.safe_load(f)

    # Load coverage map
    with open(map_path) as f:
        coverage_map = yaml.safe_load(f)

    # Extract actual test names from spec files
    actual_tests = extract_test_names(spec_dir)
    all_test_keys = set()
    for filename, names in actual_tests.items():
        for name in names:
            all_test_keys.add(f"{filename}::{name}")

    # Build the matrix
    req_coverage: dict[str, dict] = {}
    for req in requirements:
        rid = req["id"]
        req_coverage[rid] = {
            "id": rid,
            "title": req["title"],
            "category": req["category"],
            "tests": [],
            "covered": False,
        }

    # Map tests to requirements
    mapped_tests = set()
    for test_key, req_ids in (coverage_map or {}).items():
        for rid in req_ids:
            if rid in req_coverage:
                req_coverage[rid]["tests"].append(test_key)
                req_coverage[rid]["covered"] = True
                mapped_tests.add(test_key)

    # Find unmapped tests
    unmapped = sorted(all_test_keys - mapped_tests)

    # Summary stats
    total_reqs = len(requirements)
    covered_reqs = sum(1 for r in req_coverage.values() if r["covered"])
    total_tests = sum(len(names) for names in actual_tests.values())
    mapped_count = len(mapped_tests)

    matrix = {
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "summary": {
            "total_requirements": total_reqs,
            "covered_requirements": covered_reqs,
            "uncovered_requirements": total_reqs - covered_reqs,
            "coverage_pct": round(covered_reqs / total_reqs * 100, 1)
            if total_reqs
            else 0,
            "total_e2e_tests": total_tests,
            "mapped_tests": mapped_count,
            "unmapped_tests": len(unmapped),
        },
        "requirements": list(req_coverage.values()),
        "unmapped_tests": unmapped,
    }

    json.dump(matrix, sys.stdout, indent=2)
    print()  # trailing newline


if __name__ == "__main__":
    main()
