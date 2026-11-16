#!/usr/bin/env python
"""make.py <film_dir> [steps...] : the one entry point. Steps run in the order given.

  build   story.py -> timeline.json, calendar.json, vo/lines.json (+ env.json)      common/build.py, engine/envgen.py
  voice   vo/lines.json -> vo/line_NNN.wav with Kokoro, then build again on the real takes    voice/kokoro_voice.py
  sound   footsteps from the animation, then the film's audio/sound.py -> audio/final_audio.wav
  qa      the QA gate + contact sheets in qa/sheets (render refuses without a fresh PASS)    engine/qa/run_qa.py
  render  out/<film>.mp4                                                                      render.py
  all     build voice sound qa render

Options: --seconds N (render only the first N s)  --scenes a,b (build only those scenes)  --tier GPU|ANYGPU|CPU
         --placeholder (voice step writes hummed test takes instead of Kokoro; never ship them)
Env VOICE_PYTHON = the Python that has Kokoro installed, if it is not this one.
"""
import os, subprocess, sys

KIT = os.path.dirname(os.path.abspath(__file__)); PY = sys.executable
STEPS = ['build', 'voice', 'sound', 'qa', 'render']


def run(cmd, env=None):
    print('\n>', ' '.join('python' if c == PY else os.path.basename(c) if os.path.isabs(c) else c for c in cmd), flush=True)
    r = subprocess.run(cmd, env=env)
    if r.returncode: raise SystemExit(f'make: step failed ({os.path.basename(cmd[1])}), exit {r.returncode}')


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'): print(__doc__); return
    fd = os.path.abspath(a[0]); opts = {}
    rest = a[1:]; steps = []
    i = 0
    while i < len(rest):
        x = rest[i]
        if x in ('--seconds', '--scenes', '--tier'): opts[x] = rest[i + 1]; i += 2; continue
        if x.startswith('--'): opts[x] = True
        elif x == 'all': steps += STEPS
        elif x in STEPS: steps.append(x)
        else: raise SystemExit(f'unknown step "{x}" (steps: {", ".join(STEPS)}, all)')
        i += 1
    if not os.path.exists(os.path.join(fd, 'story.py')): raise SystemExit(f'no story.py in {fd} (make one: python kit/new_film.py <name>)')
    env = dict(os.environ, SS_KIT=KIT)
    if '--tier' in opts: env['TIER'] = opts['--tier'].upper()
    scenes = ['--scenes', opts['--scenes']] if '--scenes' in opts else []

    def build():
        run([PY, os.path.join(KIT, 'common', 'build.py'), fd] + scenes)
        run([PY, os.path.join(KIT, 'engine', 'envgen.py'), fd])

    for s in steps or STEPS:
        if s == 'build': build()
        elif s == 'voice':
            if not os.path.exists(os.path.join(fd, 'vo', 'lines.json')): build()
            vpy = env.get('VOICE_PYTHON', PY); script = os.path.join(KIT, 'voice', 'kokoro_voice.py')
            ok = os.path.exists(script) and subprocess.run([vpy, '-c', 'import kokoro'], capture_output=True).returncode == 0
            if opts.get('--placeholder'):
                run([PY, os.path.join(KIT, 'common', 'placeholder_voices.py'), fd])
            elif ok:
                run([vpy, script, fd], env=env)
            else:
                print('\nvoice: Kokoro is not installed here, skipping (python kit/setup.py installs it; '
                      'or set VOICE_PYTHON; or use --placeholder for test takes). QA will report missing takes.')
                continue
            build()
        elif s == 'sound':
            run(['node', os.path.join(KIT, 'engine', 'audio', 'probe_events.js'), fd], env=env)
            run([PY, os.path.join(fd, 'audio', 'sound.py')], env=env)
        elif s == 'qa':
            run([PY, os.path.join(KIT, 'engine', 'qa', 'run_qa.py'), fd, '--sheets'], env=env)
        elif s == 'render':
            run([PY, os.path.join(KIT, 'render.py'), fd] + (['--seconds', opts['--seconds']] if '--seconds' in opts else []), env=env)


if __name__ == '__main__':
    main()
