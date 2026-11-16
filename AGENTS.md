# Agent instructions: Beta Version Silhouette Studio

You are an AI coding agent. The user may be a complete beginner who has installed nothing and does not know what a terminal
is. They gave you this repo and one sentence. You do everything yourself: download, install, set up, test, then make films.
Speak plain words, short lines, no jargon. Never ask the user to open a terminal or edit a file.

Repo: https://github.com/BetaVersionHQ/beta-version-silhouette-studio (MIT). If the repo is not on disk yet, run
`git clone https://github.com/BetaVersionHQ/beta-version-silhouette-studio` (no git? download the zip from the same page, or
install git with the steps below) and work inside the folder. Run every command from the repo root.

## Know your limits first
- You need to run commands on the user's own computer. In a local CLI or desktop app (Claude Code, Codex CLI, Gemini CLI,
  Antigravity, Cursor agent mode) you can. In a cloud or sandboxed agent (Codex cloud, a chat website, a web-only agent) you
  usually cannot install software, use a GPU or hand the user the mp4. If that is your case, say so in one plain line:
  "I am running in a sandbox, so I cannot install things on your computer. Please open this folder in the local version of
  me (the CLI or desktop app) and paste the same message." Then stop.
- If a command is refused by your permission system, ask the user to allow it; do not look for a way around it.
- Never read, print or ask for passwords, keys or .env files. Nothing here needs them.

## First-time setup (follow in order; skip steps already done)
Tell the user one short line per step ("Checking your computer...", "Installing Node...").

### 1. Detect the OS
- Windows: use PowerShell; `$env:OS` is `Windows_NT`.
- macOS: `uname` prints `Darwin`. Linux: `uname` prints `Linux`.

### 2. Check the three tools
Run each and note present or missing:
```
python --version      (need 3.10 or newer; on Windows also try: py -3 --version)
node --version        (need v18 or newer)
ffmpeg -version
```
Windows: `python3` is a Microsoft Store stub that opens the Store, so never use it; use `python` or `py -3`. If `python`
opens the Store or prints nothing, treat Python as missing. macOS/Linux: if `python` is absent but `python3` works, use
`python3` everywhere this file says `python`.
If all three are present, jump to step 5.

### 3. Install what is missing
Before the first Windows install, tell the user in plain words: "Windows may show a box asking to allow changes to your
device. Please click Yes. If it asks for a password, that is your normal Windows password; I never see it." On Mac/Linux:
"It may ask for your computer password. Type it in; nothing shows as you type; press Enter."

Windows (PowerShell; winget ships with Windows 10/11. If `winget` is missing, tell the user to install "App Installer" from
the Microsoft Store):
```
winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
```
(Only the missing ones; git only if you need to clone and it is absent.)

macOS: if `brew` is missing, install Homebrew (it asks for the password and takes a few minutes):
`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`, then follow its
"Next steps" lines to put brew on PATH (Apple silicon: `eval "$(/opt/homebrew/bin/brew shellenv)"`). Then
`brew install python@3.12 node ffmpeg` (only the missing ones).

Linux (Debian/Ubuntu): `sudo apt update && sudo apt install -y python3 python3-pip python3-venv nodejs npm ffmpeg`.
If node is older than 18, install a current LTS (nodesource setup script, then `sudo apt install -y nodejs`).
Fedora: `dnf`; Arch: `pacman`.

### 4. Make the new tools visible in your current shell
A shell opened before the install does not see the new programs. Do one of these, then re-run the step 2 checks:
- Windows PowerShell: rebuild PATH from the registry:
  `$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`
  Still not found? Call them by full path: Python `$env:LOCALAPPDATA\Programs\Python\Python312\python.exe`, Node
  `C:\Program Files\nodejs\node.exe` (and `npm.cmd`, `npx.cmd` in the same folder), ffmpeg under
  `$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin` (add that folder to `$env:Path` for this session).
- macOS/Linux: run `hash -r`; on Mac also the brew `shellenv` line from step 3.
If a tool is still missing, tell the user: "I installed it but this window cannot see it yet. Please close and reopen me,
then paste the same message again." Setup resumes where it left off.

### 5. Run the kit setup (a few minutes; the first run downloads 1-2 GB: browser, torch, voice libraries)
Windows traps, set once per shell before any Python: `$env:PYTHONUTF8 = "1"` (the default cp1252 console breaks on the
kit's symbols). Keep the repo in a short path such as `C:\silhouette-studio` or the user's Documents folder; paths over
260 characters break `npm install`. On a long-path error, move the repo somewhere shorter.
```
python kit/setup.py
```
- `--no-voice` skips Kokoro and torch (smaller, faster, but no real voices); use it only if the torch install fails or
  disk has under about 5 GB free. Tell the user voices are missing if you do.
- Playwright "Executable doesn't exist" or a browser revision mismatch: `cd kit/engine`, run
  `npx playwright install chromium-headless-shell`, return to the root and run `python kit/setup.py --tier-only`.
- pip says "externally-managed-environment" (newer Linux/Mac Pythons): `python -m venv .venv`, activate it
  (`source .venv/bin/activate`; Windows `.venv\Scripts\Activate.ps1`) and run setup again inside it.
- Report the detected tier in plain words (GPU = fast, CPU = slower, same picture).

### 6. Make the 10-second test film
```
python kit/new_film.py test --format short
python kit/make.py films/test all --seconds 10
```
This is a heavy job: on Windows start it at lower priority if you can (`cmd /c start /low /wait python kit/make.py ...`)
and keep the user informed; a slow CPU can take several minutes. The mp4 is `films/test/out/test_10s.mp4` (a full render without --seconds makes `test.mp4`). If a step says
REFUSED or BLOCKED, read the message or `films/test/qa/report.md`, fix, run again.

### 7. Show the result and tell them what to type
Open the mp4: Windows `Start-Process films\test\out\test_10s.mp4`, Mac `open films/test/out/test_10s.mp4`, Linux
`xdg-open films/test/out/test_10s.mp4`. If you cannot open it, give the full path.
Then say one plain line: "That is your 10-second test film. Now just type the film you want, for example: Make a
60-second vertical short about two brothers fixing an old radio." More prompts for them: docs/START_HERE.md.

## From then on: making films
Read `skill/SKILL.md` and follow it for every film request (story, build, voice, staging, sound, QA, render). Setup is done
once: if `kit/tier.json` exists and the step 2 checks pass, do not repeat it. Show the user only final results, and run one
render at a time on machines with 8 GB of RAM or less.
Reference docs: `kit/references/` (rules.md first). Troubleshooting: SETUP.md.
