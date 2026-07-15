#!/usr/bin/env python3
"""
po.wor — build log.json from Obsidian markdown.

How it works:
  Point OBSIDIAN_LOG_DIR at a folder in your vault where each daily entry
  is one markdown file (or one file with dated headers — see below).

  Simplest setup: one file per entry, named "2026-07-15.md" (or any name),
  with frontmatter like:

    ---
    date: 2026-07-15
    tag: build
    link: https://example.com   # optional
    image: assets/thing.jpg     # optional
    ---
    Shipped the RPG game.

  The line(s) after the frontmatter become the entry text (first line used).

Usage:
  python3 scripts/build_log.py /path/to/vault/Log
  # writes ../log.json (relative to this script), merging with existing entries
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG_JSON = ROOT / "log.json"

FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)


def parse_frontmatter(raw: str):
    m = FRONTMATTER_RE.match(raw)
    if not m:
        return {}, raw.strip()
    fm_block, body = m.groups()
    fm = {}
    for line in fm_block.splitlines():
        if ":" in line:
            key, val = line.split(":", 1)
            fm[key.strip()] = val.strip()
    return fm, body.strip()


def load_existing():
    if LOG_JSON.exists():
        return json.loads(LOG_JSON.read_text(encoding="utf-8"))
    return []


def build(vault_dir: Path):
    entries_by_date = {e["date"]: e for e in load_existing()}

    for md_file in sorted(vault_dir.glob("*.md")):
        raw = md_file.read_text(encoding="utf-8")
        fm, body = parse_frontmatter(raw)

        date = fm.get("date")
        if not date:
            print(f"skip {md_file.name}: no 'date' in frontmatter")
            continue

        text = body.split("\n\n")[0].strip() if body else fm.get("text", "")
        if not text:
            print(f"skip {md_file.name}: no entry text found")
            continue

        entry = {"date": date, "text": text}
        for optional in ("tag", "link", "image", "video"):
            if fm.get(optional):
                entry[optional] = fm[optional]

        entries_by_date[date] = entry  # last write wins per date

    entries = sorted(entries_by_date.values(), key=lambda e: e["date"], reverse=True)
    LOG_JSON.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(entries)} entries to {LOG_JSON}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: python3 build_log.py /path/to/obsidian/Log/folder")
        sys.exit(1)

    vault_dir = Path(sys.argv[1]).expanduser()
    if not vault_dir.is_dir():
        print(f"not a directory: {vault_dir}")
        sys.exit(1)

    build(vault_dir)
