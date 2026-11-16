# Voice step (Kokoro-82M)

Turns `<film_dir>/vo/lines.json` into `<film_dir>/vo/line_NNN.wav` (mono, 24 kHz, 16-bit, peak -3 dBFS) plus `vo/voice_report.json`.
Kokoro-82M is Apache-2.0 (hexgrad/Kokoro-82M).

## Install
`python kit/setup.py` installs Kokoro and torch into the Python you run it with (CUDA torch on NVIDIA, CPU torch elsewhere), and
`python kit/make.py <film> voice` runs this step. To keep the voice packages in their own venv instead:
```
python -m venv venv-voice && venv-voice/Scripts/activate      # Windows; use bin/activate elsewhere
pip install -r kit/voice/requirements.txt
set VOICE_PYTHON=<path to venv-voice python>                   # make.py then uses it for the voice step
```
First run downloads the weights (~330 MB) and small voice files from Hugging Face, and misaki may fetch the `en_core_web_sm` spaCy model once.
If a word is mispronounced or you get a G2P error, install espeak-ng (`winget install eSpeak-NG.eSpeak-NG`, `brew install espeak-ng`, `apt install espeak-ng`); it is only used for out-of-vocabulary words.

## Options
`--device auto|cpu|cuda|mps` (auto picks cuda, then mps, then cpu), `--force` (redo existing wavs), `--only 0,2` (redo those line numbers).

## Choosing voices
Full list: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md (`af_`/`am_` American, `bf_`/`bm_` British).
By default each character gets a distinct voice picked from its CHARS description (woman/girl -> female, man/boy -> male, "British" -> UK, children get a lighter voice and speed 1.05). To choose yourself, set in `story.py`:
```python
KOKORO = {"ana": "af_heart", "ben": ["am_michael", 0.95]}   # voice, or [voice, speed multiplier]
```
build.py writes it into lines.json as `"kokoro"`.

Emotion words map to speed only (tired/sad/quiet/small/soft 0.9, angry/excited/rushed 1.08, else 1.0). Sentence ends, "..." and long-sentence commas get real silences (0.35 / 0.6 / 0.2 s).

## Speed
82M parameters, so CPU is fine: about 1 to 2 s of compute per short line on a modern desktop CPU after a few seconds of model load. GPU only helps for long scripts.
