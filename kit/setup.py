#!/usr/bin/env python
"""Beta Version Silhouette Studio - one-time setup. Pure Python, works on Windows, macOS and Linux.

    python kit/setup.py              everything: node packages, browser, Python packages, voice (Kokoro), tier test
    python kit/setup.py --no-voice   skip Kokoro and torch (placeholder voices still work)
    python kit/setup.py --tier-only  only re-detect the render tier and rewrite kit/tier.json

Needs on PATH first: Node.js 18+ (with npm), ffmpeg, Python 3.10+.
Tier (kit/tier.json): GPU = NVIDIA card, ANYGPU = any other GPU or Apple silicon (both render through the installed
Chrome or Edge with GPU flags), CPU = no usable GPU (Playwright's headless shell with the SwiftShader software renderer).
The tier is proven, not guessed: the browser is launched and its WebGL renderer name is read back.
"""
import json, os, platform, shutil, subprocess, sys

KIT = os.path.dirname(os.path.abspath(__file__)); ENGINE = os.path.join(KIT, 'engine')
PY = sys.executable; WIN = os.name == 'nt'
args = sys.argv[1:]


def sh(cmd, cwd=None, check=True):
    print('>', ' '.join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=cwd, shell=WIN and cmd[0] in ('npm', 'npx'))
    if check and r.returncode: raise SystemExit(f'setup stopped: "{" ".join(cmd)}" failed (exit {r.returncode})')
    return r.returncode


def out(cmd):
    try: return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120,
                               shell=WIN and cmd[0] in ('npm', 'npx')).stdout.strip()
    except Exception: return ''


def need(tool, hint):
    if not shutil.which(tool): raise SystemExit(f'missing: {tool}. {hint}')


def nvidia():
    if not shutil.which('nvidia-smi'): return ''
    names = out(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader']).splitlines()
    return names[0].strip() if names else ''


def other_gpu():
    if sys.platform == 'darwin': return platform.machine() == 'arm64' and 'Apple silicon' or 'Mac GPU'
    if WIN:
        names = out(['powershell', '-NoProfile', '-Command', '(Get-CimInstance Win32_VideoController).Name']).splitlines()
    else:
        names = [l for l in out(['sh', '-c', 'lspci 2>/dev/null | grep -Ei "vga|3d|display"']).splitlines()]
    names = [n.strip() for n in names if n.strip() and not any(b in n for b in ('Basic', 'Remote', 'Virtual', 'llvmpipe', 'VMware SVGA'))]
    return names[0] if names else ''


def probe(t):
    s = out(['node', os.path.join(ENGINE, 'serve.js'), '--probe', t])
    return s.splitlines()[-1] if s else 'probe failed'


def detect():
    card = nvidia(); t = 'GPU' if card else ''
    if not t:
        card = other_gpu(); t = 'ANYGPU' if card else 'CPU'
    got = probe(t) if t != 'CPU' else ''
    soft = not got or 'failed' in got or any(k in got for k in ('SwiftShader', 'llvmpipe', 'Software', 'CPU swiftshader'))
    if t != 'CPU' and soft:
        print(f'GPU test gave "{got}": using the CPU tier'); t = 'CPU'
    if t == 'CPU': got = probe('CPU')
    j = {'tier': t, 'gpu': card or None, 'renderer': got, 'os': f'{platform.system()} {platform.machine()}'}
    with open(os.path.join(KIT, 'tier.json'), 'w', encoding='utf-8') as f: json.dump(j, f, indent=1)
    print(f'tier: {t}  ({got})  -> kit/tier.json')
    return t


def main():
    if sys.version_info < (3, 10): raise SystemExit('Python 3.10 or newer is needed')
    need('node', 'Install Node.js 18+ from https://nodejs.org')
    need('ffmpeg', 'Install ffmpeg (winget install Gyan.FFmpeg / brew install ffmpeg / apt install ffmpeg)')
    if '--tier-only' in args: detect(); return
    need('npm', 'npm comes with Node.js')
    sh(['npm', 'install', '--no-audit', '--no-fund'], cwd=ENGINE)
    # the headless shell is the CPU-tier browser; it must match the installed playwright version, so always ask npx
    sh(['npx', 'playwright', 'install', 'chromium-headless-shell'], cwd=ENGINE)
    sh([PY, '-m', 'pip', 'install', '--upgrade', 'numpy', 'scipy', 'soundfile', 'pillow'])
    if '--no-voice' not in args:
        has_torch = out([PY, '-c', 'import torch; print(torch.__version__)'])
        if not has_torch:
            if nvidia() and sys.platform != 'darwin':
                sh([PY, '-m', 'pip', 'install', 'torch', '--index-url', 'https://download.pytorch.org/whl/cu128'], check=False)
            if not out([PY, '-c', 'import torch; print(1)']):
                idx = [] if sys.platform == 'darwin' else ['--index-url', 'https://download.pytorch.org/whl/cpu']
                sh([PY, '-m', 'pip', 'install', 'torch'] + idx)
        sh([PY, '-m', 'pip', 'install', 'kokoro>=0.9', 'soundfile'])
        if not shutil.which('espeak-ng') and not shutil.which('espeak'):
            print('note: espeak-ng is not installed. Kokoro works without it, but install it for unusual words '
                  '(winget install eSpeak-NG.eSpeak-NG / brew install espeak-ng / apt install espeak-ng).')
    t = detect()
    print(f'\nSetup done (tier {t}). Next:\n  python kit/new_film.py myfilm --format short\n  python kit/make.py films/myfilm all')


if __name__ == '__main__':
    main()
