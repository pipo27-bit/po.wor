#!/usr/bin/env python3
"""
po.wor — add an entry to log.json from a small window.

Run it from the project folder:
    python3 scripts/add_entry.py

Fill in the form and click "Save entry". The entry goes into log.json
(newest first). If you attach an image, audio or video file, it is copied
into the assets/ folder and linked from the entry. Then commit and push
in VS Code to publish.

Two rules come from the website itself (script.js):
  - it shows ONE entry per date, so saving a second entry for the same
    day asks whether to replace the first;
  - it shows ONE media file per entry, so the window lets you attach one
    file (images, then video, then audio are what the page looks for).
"""

import filecmp
import json
import re
import shutil
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ImportError:  # some Python installs don't include tkinter
    tk = None

# The project root is one folder above this script.
ROOT = Path(__file__).resolve().parent.parent
LOG_JSON = ROOT / "log.json"
ASSETS = ROOT / "assets"

# File types the site can show, grouped by the field name log.json uses.
MEDIA_TYPES = {
    "image": {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"},
    "audio": {".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac"},
    "video": {".mp4", ".mov", ".webm", ".m4v"},
}
WARN_MB = 50   # GitHub warns about files bigger than this
MAX_MB = 100   # GitHub refuses files bigger than this


# ---------- the data side (no window needed) ----------

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


def media_kind(path):
    """Return 'image', 'audio' or 'video' for a file, or None if unsupported."""
    ext = Path(path).suffix.lower()
    for kind, extensions in MEDIA_TYPES.items():
        if ext in extensions:
            return kind
    return None


def validate(entry_date, text, link):
    """Return an error message, or None if the form is fine."""
    try:
        datetime.strptime(entry_date, "%Y-%m-%d")
    except ValueError:
        return "The date must look like 2026-10-19 (YYYY-MM-DD)."
    if not text:
        return "Write the one-line summary first."
    if link and not link.startswith(("http://", "https://")):
        return "The link should start with https://"
    return None


def copy_to_assets(source):
    """Copy a file into assets/ and return the path the site should use."""
    ASSETS.mkdir(exist_ok=True)
    # Clean the name so it works in a web address: "My Photo (1).JPG" -> "My-Photo-1.jpg"
    stem = re.sub(r"[^\w\-]+", "-", source.stem).strip("-") or "file"
    ext = source.suffix.lower()
    dest = ASSETS / f"{stem}{ext}"
    n = 1
    # Same name but different content? Add -1, -2, ... instead of overwriting.
    while dest.exists() and not filecmp.cmp(source, dest, shallow=False):
        dest = ASSETS / f"{stem}-{n}{ext}"
        n += 1
    if not dest.exists():
        shutil.copy2(source, dest)
    return f"assets/{dest.name}"


def build_entry(entry_date, text, tag, detail, link, media_path):
    """Make one entry dictionary. Optional fields are only added if filled in."""
    entry = {"date": entry_date}
    if tag:
        entry["tag"] = tag
    entry["text"] = text
    if detail:
        entry["detail"] = detail
    if media_path:
        kind = media_kind(media_path)
        if kind is None:
            raise ValueError(f"{media_path.name} isn't an image, audio or video file.")
        entry[kind] = copy_to_assets(media_path)
    if link:
        entry["link"] = link
    return entry


# ---------- the window ----------

class App:
    def __init__(self, root):
        self.root = root
        self.media_path = None
        entries = load_entries()
        tags = sorted({e["tag"] for e in entries if e.get("tag")})

        root.title("po.wor — new entry")
        root.resizable(False, False)
        frame = ttk.Frame(root, padding=16)
        frame.grid()

        # Variables that hold what you type.
        self.date_var = tk.StringVar(value=date.today().isoformat())
        self.tag_var = tk.StringVar()
        self.text_var = tk.StringVar()
        self.link_var = tk.StringVar()
        self.media_var = tk.StringVar(value="no file attached")
        self.status_var = tk.StringVar()

        def label(row, text):
            ttk.Label(frame, text=text).grid(row=row, column=0, sticky="ne", padx=(0, 10), pady=4)

        label(0, "Date")
        ttk.Entry(frame, textvariable=self.date_var, width=14).grid(row=0, column=1, sticky="w", pady=4)

        label(1, "Tag")
        ttk.Combobox(frame, textvariable=self.tag_var, values=tags, width=14).grid(row=1, column=1, sticky="w", pady=4)

        label(2, "One line")
        self.text_entry = ttk.Entry(frame, textvariable=self.text_var, width=52)
        self.text_entry.grid(row=2, column=1, columnspan=2, sticky="we", pady=4)

        label(3, "Detail")
        self.detail_box = tk.Text(frame, width=52, height=5, wrap="word")
        self.detail_box.grid(row=3, column=1, columnspan=2, pady=4)

        label(4, "Link")
        ttk.Entry(frame, textvariable=self.link_var, width=52).grid(row=4, column=1, columnspan=2, sticky="we", pady=4)

        label(5, "Media")
        media_row = ttk.Frame(frame)
        media_row.grid(row=5, column=1, columnspan=2, sticky="w", pady=4)
        ttk.Button(media_row, text="Choose file…", command=self.choose_media).pack(side="left")
        ttk.Button(media_row, text="Clear", command=self.clear_media).pack(side="left", padx=6)
        ttk.Label(media_row, textvariable=self.media_var).pack(side="left", padx=6)

        ttk.Label(frame, textvariable=self.status_var, wraplength=420).grid(
            row=6, column=0, columnspan=3, sticky="w", pady=(8, 0))

        buttons = ttk.Frame(frame)
        buttons.grid(row=7, column=0, columnspan=3, sticky="e", pady=(12, 0))
        ttk.Button(buttons, text="Close", command=root.destroy).pack(side="right")
        ttk.Button(buttons, text="Save entry", command=self.save).pack(side="right", padx=8)

        # Ctrl+Enter (or Cmd+Enter on a Mac) saves too.
        root.bind("<Control-Return>", lambda event: self.save())
        try:
            root.bind("<Command-Return>", lambda event: self.save())
        except tk.TclError:
            pass

        # On a Mac the window can open behind the terminal, so bring it to the front.
        root.lift()
        root.attributes("-topmost", True)
        root.after(300, lambda: root.attributes("-topmost", False))
        self.text_entry.focus_set()

    def choose_media(self):
        extensions = sorted(ext for group in MEDIA_TYPES.values() for ext in group)
        chosen = filedialog.askopenfilename(
            title="Choose an image, audio or video file",
            filetypes=[("Images, audio, video", " ".join(extensions)), ("All files", "*.*")],
        )
        if not chosen:
            return
        path = Path(chosen)
        kind = media_kind(path)
        if kind is None:
            messagebox.showerror(
                "Unsupported file",
                f"{path.suffix or 'That file'} isn't an image, audio or video type the site can show.",
            )
            return
        size_mb = path.stat().st_size / 1024 / 1024
        self.media_path = path
        self.media_var.set(f"{kind}: {path.name} ({size_mb:.1f} MB)")

    def clear_media(self):
        self.media_path = None
        self.media_var.set("no file attached")

    def clear_form(self):
        self.date_var.set(date.today().isoformat())
        self.tag_var.set("")
        self.text_var.set("")
        self.link_var.set("")
        self.detail_box.delete("1.0", "end")
        self.clear_media()
        self.text_entry.focus_set()

    def save(self):
        entry_date = self.date_var.get().strip()
        text = self.text_var.get().strip()
        tag = self.tag_var.get().strip()
        detail = self.detail_box.get("1.0", "end").strip()
        link = self.link_var.get().strip()

        error = validate(entry_date, text, link)
        if error:
            messagebox.showerror("Can't save yet", error)
            return

        entries = load_entries()
        existing = next((e for e in entries if e["date"] == entry_date), None)
        if existing and not messagebox.askyesno(
            "Replace entry?",
            f'{entry_date} already has an entry:\n\n"{existing["text"]}"\n\nReplace it?',
        ):
            return

        if self.media_path:
            size_mb = self.media_path.stat().st_size / 1024 / 1024
            if size_mb > MAX_MB:
                messagebox.showerror(
                    "File too big",
                    f"{size_mb:.0f} MB is over GitHub's {MAX_MB} MB limit. "
                    "Compress it, or host it somewhere else and paste the link instead.",
                )
                return
            if size_mb > WARN_MB and not messagebox.askokcancel(
                "Big file",
                f"{size_mb:.0f} MB will make pushing slow, and GitHub warns about files over {WARN_MB} MB. Add it anyway?",
            ):
                return

        try:
            entry = build_entry(entry_date, text, tag, detail, link, self.media_path)
        except (OSError, ValueError) as err:
            messagebox.showerror("Couldn't save", str(err))
            return

        if existing:
            entries.remove(existing)
        entries.append(entry)
        save_entries(entries)

        self.status_var.set(
            f"Saved ✓  {len(entries)} entries, streak {current_streak(entries)} day(s). "
            "Now commit and push in VS Code."
        )
        self.clear_form()


def main():
    if tk is None:
        print("This script needs tkinter, and your Python install doesn't include it.")
        print("If you installed Python with Homebrew, install the matching package,")
        print("for example:  brew install python-tk@3.13")
        print("Or install Python from https://www.python.org/downloads/ (it includes tkinter).")
        sys.exit(1)
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
