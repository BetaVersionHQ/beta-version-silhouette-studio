# Setup

## 1. Install the basics
| Tool | Version | Windows | macOS | Linux |
|---|---|---|---|---|
| Python | 3.10-3.12 | python.org or `winget install Python.Python.3.12` | `brew install python@3.12` | package manager |
| Node.js | 18+ | `winget install OpenJS.NodeJS.LTS` | `brew install node` | package manager / nodesource |
| ffmpeg | any recent | `winget install Gyan.FFmpeg` | `brew install ffmpeg` | `apt install ffmpeg` |
| Chrome or Edge | any | for the GPU tiers (the CPU tier does not need it) | | |

Optional: espeak-ng for unusual words in Kokoro (`winget install eSpeak-NG.eSpeak-NG`, `brew install espeak-ng`,
`apt install espeak-ng`).

## 2. Run setup
```bash
python kit/setup.py              # everything
python kit/setup.py --no-voice   # skip Kokoro and torch (placeholder voices still work)
python kit/setup.py --tier-only  # only re-detect the render tier
```
It checks node and ffmpeg, runs `npm install` and installs the Playwright Chromium headless shell in `kit/engine`, installs
numpy, scipy, soundfile and Pillow, then torch (CUDA build on NVIDIA, CPU build elsewhere) and Kokoro. It finishes by
detecting your tier: it looks for a GPU, opens a WebGL page and reads the renderer name, and drops to `CPU` if WebGL is
software. The result goes to `kit/tier.json`. A virtual environment is a good idea: `python -m venv .venv` and activate
it before running setup.

The first voice run downloads the Kokoro weights (~330 MB) from Hugging Face.

## 3. Make a film
```bash
python kit/new_film.py myfilm --format short     # or --format long; a path works too
python kit/make.py films/myfilm build voice      # story -> timeline -> voice takes (rebuilds on the real takes)
python kit/make.py films/myfilm sound qa         # sound mix, QA gate + contact sheets in films/myfilm/qa/sheets
python kit/make.py films/myfilm render --seconds 10   # quick look
python kit/make.py films/myfilm render           # the film: films/myfilm/out/myfilm.mp4
```
`all` runs build, voice, sound, qa and render in one go. `python kit/snap.py films/myfilm 12.5,30` saves stills of chosen
times (good for checking a camera). `--scenes door` builds only that scene for fast tests.

## Choosing a tier by hand
`--tier GPU|ANYGPU|CPU` on `make.py` or `render.py`, or the `TIER` environment variable. `GPU` and `ANYGPU` look for
installed Chrome, then Edge; `CPU` uses Playwright's headless shell with SwiftShader.

## Troubleshooting
- **`REFUSED: this story runs ... s`**: shorts are 2 minutes at most, long films 5. Trim beats or lines.
- **`REFUSED: no QA report yet` / `QA is BLOCKED` / `changed after the last QA run`**: fix what `qa/report.md` lists and run
  `make.py <film> qa` again after any edit.
- **Black frames or very slow GPU render**: run `python kit/setup.py --tier-only`; laptops may need Chrome set to the
  high-performance GPU in the OS graphics settings.
- **CPU tier cannot start the browser**: `cd kit/engine && npx playwright install chromium-headless-shell`.
- **Kokoro missing**: the voice step says so and skips; install it (`pip install -r kit/voice/requirements.txt`), set
  `VOICE_PYTHON` to a Python that has it, or use `--placeholder` for hummed test takes.
- **Windows console errors on `·` or `→`**: the kit opens every file as UTF-8; if your own scripts print them, run
  `set PYTHONUTF8=1`.
- **Memory**: a render uses one browser and one ffmpeg; run one render at a time on machines with 8 GB of RAM.
