#!/usr/bin/env python
"""new_film.py <name or path> [--format short|long] : starts a film from a starter.

A bare name goes to films/<name> next to kit/. short = 9:16 720x1280 (up to 2 min), long = 16:9 1280x720 (up to 5 min).
The starter has two characters, three sets (room, motel lot at night, laundromat) and a staged demo scene for each.
"""
import json, os, shutil, sys

KIT = os.path.dirname(os.path.abspath(__file__))
a = sys.argv[1:]
if not a or a[0].startswith('-'): raise SystemExit(__doc__)
fmt = a[a.index('--format') + 1] if '--format' in a else 'short'
if fmt not in ('short', 'long'): raise SystemExit('--format is short or long')
dst = a[0] if os.sep in a[0] or '/' in a[0] else os.path.join(os.path.dirname(KIT), 'films', a[0])
dst = os.path.abspath(dst)
if os.path.exists(dst): raise SystemExit(f'{dst} already exists')
shutil.copytree(os.path.join(KIT, 'starters', fmt), dst, ignore=shutil.ignore_patterns('__pycache__'))
p = os.path.join(dst, 'film.json')
with open(p, encoding='utf-8') as f: film = json.load(f)
film['format'] = fmt
with open(p, 'w', encoding='utf-8') as f: json.dump(film, f, indent=1, ensure_ascii=False)
print(f'new {fmt} film: {dst}\nnext: edit story.py, then  python kit/make.py "{dst}" all')
