#!/usr/bin/env python
"""calcheck.py <film_dir> : the story-calendar check (step 1 of engine/qa/run_qa.py).

Reads story.py and checks every on-screen date/time chip and the spoken dates against each other:
  FAIL  a chip's weekday does not match its date in the story YEAR (year rolls over when the month goes backwards)
  FAIL  time goes backwards between two dated scenes (unless a "... LATER" / flashback chip resets the clock)
  FAIL  "N YEARS LATER · <MONTH> <YEAR>" disagrees with the previous chip's year
  FAIL  a chip after midnight (12:xx AM - 4:59 AM) carries the same day as the evening before it
  WARN  a line says "today is <weekday>" / "it's <weekday>" / "tomorrow" + weekday that does not fit the scene chip
  WARN  the same day label repeats after a time jump chip ("A DAY LATER", "WEEKS LATER")
  WARN  a dated scene follows a "... LATER" chip that has no date (label the next scene with a date)
Accepted chip shapes: "SATURDAY · AUG 29 · 5:40 PM", "MONDAY · 7:42 AM", "NOVEMBER 2009", "FOURTEEN YEARS LATER · SEPTEMBER 2040",
"THREE WEEKS LATER", "TUE, OCT 28". Prints FAIL/WARN lines, then "calcheck: X fail, Y warn" as the last line.
"""
import datetime as dt, importlib.util, os, re, sys

FD = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
spec = importlib.util.spec_from_file_location('story', os.path.join(FD, 'story.py'))
st = importlib.util.module_from_spec(spec); spec.loader.exec_module(st)
DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
MON = {m: i + 1 for i, m in enumerate(['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'])}
NUM = {w: i for i, w in enumerate('ZERO ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT NINE TEN ELEVEN TWELVE THIRTEEN FOURTEEN '
                                   'FIFTEEN SIXTEEN SEVENTEEN EIGHTEEN NINETEEN TWENTY'.split())}
NUM.update({'THIRTY': 30, 'FORTY': 40, 'FIFTY': 50, 'SIXTY': 60})
fails, warns = [], []


def num(s):
    s = s.upper().replace('-', ' ').split()
    try: return int(s[0]) if s[0].isdigit() else sum(NUM[w] for w in s)
    except KeyError: return None


def parse(chip):
    """-> dict(day, date, minutes, year, later, years_later) with whatever the chip carries."""
    c = chip.upper().replace(',', ' ·').replace('  ', ' ')
    r = {'raw': chip}
    m = re.search(r'\b(' + '|'.join(DAYS) + r'|MON|TUE|WED|THU|FRI|SAT|SUN)\b', c)
    if m: r['day'] = next(x for x in DAYS if x.startswith(m.group(1)[:3]))
    m = re.search(r'\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.? (\d{1,2})\b(?! ?\d{3})', c)
    if m: r['md'] = (MON[m.group(1)], int(m.group(2)))
    m = re.search(r'\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]* (\d{4})\b', c)
    if m: r['month'] = MON[m.group(1)]; r['year'] = int(m.group(2))
    m = re.search(r'\b(\d{1,2}):(\d{2}) ?(AM|PM)\b', c)
    if m:
        h = int(m.group(1)) % 12 + (12 if m.group(3) == 'PM' else 0); r['min'] = h * 60 + int(m.group(2))
    m = re.search(r'\b([A-Z\- ]+?|\d+) (DAYS?|WEEKS?|MONTHS?|YEARS?) LATER\b', c)
    if m: r['later'] = (num(m.group(1).strip().split(' · ')[-1]) or 1, m.group(2).rstrip('S'))
    elif re.search(r'\b(A|ONE) (DAY|WEEK|MONTH|YEAR) LATER\b|\bLATER\b', c): r['later'] = (1, 'DAY')
    return r


year = st.YEAR; prev = None; prev_dt = None; jump_pending = False; seen_days = []
for sc in st.S:
    name, setn, chip, stretch, items = sc
    cur_dt = None
    if chip:
        p = parse(chip)
        if 'later' in p:
            jump_pending = True
            n, unit = p['later']
            if unit == 'YEAR' and 'year' in p and prev and prev.get('year'):
                if p['year'] - prev['year'] != n:
                    fails.append(f"{name}: '{chip}' says {n} years later, but the previous year is {prev['year']}")
            if 'year' in p: year = p['year']
        if 'year' in p and 'later' not in p and 'md' not in p and p['year'] < st.YEAR:
            continue  # a flashback card ("NOVEMBER 2009") before the story year: it does not move the story clock
        if 'year' in p and 'later' not in p: year = p['year']
        if 'md' in p:
            mo, da = p['md']
            if prev_dt and prev_dt.month >= 10 and mo <= 3 and prev_dt.year == year: year += 1  # Dec -> Jan rolls the year
            try: cur_dt = dt.datetime(year, mo, da) + dt.timedelta(minutes=p.get('min', 0))
            except ValueError: fails.append(f"{name}: '{chip}' is not a real date in {year}"); cur_dt = None
            if cur_dt and 'day' in p and DAYS[cur_dt.weekday()] != p['day']:
                fails.append(f"{name}: '{chip}': {cur_dt:%b %d %Y} is a {DAYS[cur_dt.weekday()].title()}, not {p['day'].title()}")
        elif 'day' in p and prev_dt is not None and 'min' in p:
            # weekday + time only: advance from the previous dated scene to that weekday
            k = (DAYS.index(p['day']) - prev_dt.weekday()) % 7
            cur_dt = dt.datetime(prev_dt.year, prev_dt.month, prev_dt.day) + dt.timedelta(days=k, minutes=p['min'])
            if cur_dt < prev_dt and not jump_pending: cur_dt += dt.timedelta(days=7)
        if cur_dt and prev_dt:
            if cur_dt < prev_dt:
                fails.append(f"{name}: '{chip}' is earlier than the scene before it ('{prev['raw']}')")
            if 'min' in p and p['min'] < 5 * 60 and cur_dt.date() == prev_dt.date() and prev_dt.hour >= 18:
                fails.append(f"{name}: '{chip}' is after midnight, so it belongs to the NEXT day")
        if 'day' in p:
            if jump_pending and seen_days and p['day'] == seen_days[-1] and 'md' not in p:
                warns.append(f"{name}: '{chip}' repeats {p['day'].title()} after a time jump; add the date")
            seen_days.append(p['day'])
        if 'later' not in p and jump_pending and 'md' not in p and 'year' not in p:
            warns.append(f"{name}: the scene after a '... LATER' card should carry a date")
        if 'later' not in p and ('md' in p or 'year' in p): jump_pending = False
        if cur_dt: prev_dt = cur_dt
        prev = {**p, 'year': p.get('year', year)}
    # spoken weekdays against the scene's day
    if cur_dt or prev_dt:
        today = DAYS[(cur_dt or prev_dt).weekday()]
        for it in items:
            if it[0] != 'line': continue
            t = it[2]
            for m in re.finditer(r"\b(today is|it's|it is|happy|this) (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b", t, re.I):
                if m.group(2).upper() != today and m.group(1).lower() != 'this':
                    warns.append(f"{name}: line '{t[:60]}' says {m.group(2)}, the scene is {today.title()}")
            m = re.search(r"\btomorrow(?: is|'s)? (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b", t, re.I)
            if m and m.group(1).upper() != DAYS[(DAYS.index(today) + 1) % 7]:
                warns.append(f"{name}: line '{t[:60]}' says tomorrow is {m.group(1)}, but the scene is {today.title()}")

for f in fails: print('FAIL:', f)
for w in warns: print('WARN:', w)
print(f'calcheck: {len(fails)} fail, {len(warns)} warn')
