#!/usr/bin/env python3
"""
po.wor — add one entry to log.json from the terminal.

Run it from the project folder:
    python3 scripts/add_entry.py

It asks a few questions, saves the entry to log.json, and prints your
current streak. Then commit and push in VS Code to publish.

The site shows ONE entry per date (script.js keys entries by date),
so if you add a second entry for the same day, this script asks
whether to replace the first.
"""

import json
from datetime import date, datetime, timedelta
from pathlib import Path

# log.json lives one folder above this script (the project root).
LOG_JSON = Path(__file__).resolve().parent.parent / "log.json"


def load_entries():
    """Read log.json and return a list of entries (empty list if no file yet)."""
    if LOG_JSON.exists():
        return json.loads(LOG_JSON.read_text(encoding="utf-8"))
    return []


def save_entries(entries):
    """Write entries to log.json, newest date first."""
    entries.sort(key=lambda e: e["date"], reverse=True)
    text = json.dumps(entries, indent=2, ensure_ascii=False) + "\n"
    LOG_JSON.write_text(text, encoding="utf-8")


def ask(prompt, required=False):
    """Ask a question. Keep asking if it is required and the answer is empty."""
    while True:
        answer = input(prompt).strip()
        if answer or not required:
            return answer
        print("  this one can't be empty")


def ask_date():
    """Ask for a date in YYYY-MM-DD form. Pressing Enter means today."""
    today = date.today().isoformat()
    while True:
        answer = input(f"Date [{today}]: ").strip() or today
        try:
            datetime.strptime(answer, "%Y-%m-%d")  # raises ValueError if wrong
            return answer
        except ValueError:
            print("  use the format YYYY-MM-DD, for example 2026-10-19")


def current_streak(entries):
    """Count how many days in a row (ending today or yesterday) have an entry."""
    days = {e["date"] for e in entries}
    day = date.today()
    # If nothing today, the streak can still be alive from yesterday.
    if day.isoformat() not in days:
        day -= timedelta(days=1)
    streak = 0
    while day.isoformat() in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


def main():
    entries = load_entries()
    known_tags = sorted({e["tag"] for e in entries if e.get("tag")})

    print("\nnew po.wor entry\n")
    entry_date = ask_date()

    existing = next((e for e in entries if e["date"] == entry_date), None)
    if existing:
        print(f'\nThere is already an entry for {entry_date}: "{existing["text"]}"')
        if input("Replace it? [y/N]: ").strip().lower() != "y":
            print("Nothing changed.")
            return
        entries.remove(existing)

    if known_tags:
        print("Tags you've used: " + ", ".join(known_tags))
    entry = {"date": entry_date}
    entry["text"] = ask("One line (what did you do?): ", required=True)

    # Optional fields: only saved if you type something.
    for field, prompt in [
        ("tag", "Tag (optional): "),
        ("detail", "Longer description shown on click (optional): "),
        ("link", "Link (optional): "),
        ("image", "Image path, e.g. assets/hanger.png (optional): "),
    ]:
        value = ask(prompt)
        if value:
            entry[field] = value

    entries.append(entry)
    save_entries(entries)

    print(f"\nSaved. {len(entries)} entries in log.json.")
    print(f"Current streak: {current_streak(entries)} day(s).")
    print("Next: commit and push in VS Code to publish.")


if __name__ == "__main__":
    main()
