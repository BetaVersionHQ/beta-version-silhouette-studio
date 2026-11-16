#!/usr/bin/env python
"""snap.py <film_dir> <t1,t2,...> [out_dir] : quick stills at those times (default <film>/snaps) for checking a shot.
Env DBG='{"pos":[x,y,z],"look":[x,y,z],"fov":30}' tries a candidate camera instead of the shot's own.
"""
import os, subprocess, sys

KIT = os.path.dirname(os.path.abspath(__file__))
a = sys.argv[1:]
if len(a) < 2: raise SystemExit(__doc__)
fd = os.path.abspath(a[0]); out = os.path.abspath(a[2]) if len(a) > 2 else os.path.join(fd, 'snaps')
sys.exit(subprocess.run(['node', os.path.join(KIT, 'engine', 'render_frames.js'), fd, out, a[1]]).returncode)
