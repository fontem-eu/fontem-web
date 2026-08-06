#!/usr/bin/env python3
"""Merge flat dotted-key translations into a locale file.

Locale files mirror en.json's nesting and key order. Hand-editing 23 of
them drifts, so translations are supplied flat ("help.title": "...") and
this reorders the result against en.json on the way out. Keys absent from
en.json are rejected rather than written: a typo in a key name otherwise
lands a dead entry that no lookup will ever reach.

Usage:  merge_locale.py <locale> <<< '{"help.title": "Aide", ...}'
"""
import collections
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "src" / "locales"


def flatten(d, prefix=""):
    out = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def _subtree(flat, template, prefix):
    """Rebuild nesting and key order from the English template."""
    out = collections.OrderedDict()
    for k, v in template.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            child = _subtree(flat, v, key)
            if child:
                out[k] = child
        elif key in flat:
            out[k] = flat[key]
    return out


def main():
    locale = sys.argv[1]
    incoming = json.load(sys.stdin)

    en = json.load(open(ROOT / "en.json"), object_pairs_hook=collections.OrderedDict)
    en_flat = flatten(en)

    unknown = sorted(k for k in incoming if k not in en_flat)
    if unknown:
        sys.exit(f"{locale}: {len(unknown)} key(s) not in en.json: {unknown[:5]}")

    path = ROOT / f"{locale}.json"
    current = flatten(json.load(open(path)))
    current.update(incoming)

    merged = _subtree(current, en, "")
    with open(path, "w") as fh:
        json.dump(merged, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    missing = [k for k in en_flat if k not in flatten(merged)]
    print(f"  {locale}: +{len(incoming)} written, {len(missing)} still missing")


if __name__ == "__main__":
    main()
