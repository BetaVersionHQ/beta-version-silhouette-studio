# Top 12 rules

1. **story.py is the single source of truth.** Lines, marks, chips and scene order live there; staging hangs on marks and line
   times, never on hard-coded seconds.
2. **Run build twice:** once to get `vo/lines.json`, again after the voice takes so every line uses its real length.
3. **Walks come from distance, not from the next line.** ~1.2 m/s; under 0.6 creeps, over 2.2 slides. Finish a walk before the
   line whose speaker it frames.
4. **The speaker is on screen when they talk.** Let `dialogueCuts` make the speaker cuts; wides are for narration and silences.
5. **Snapshot every hand-made shot in both formats you support.** The camera search checks automatic shots; you check yours.
6. **No over-the-shoulder heads filling the frame.** Two people in the open: `whoFrame` singles or a side two-shot.
7. **Real geometry only.** Doors open before anyone passes; wall objects have depth; nobody walks through furniture.
8. **Silhouettes need light behind them.** Stage talkers against a window, a doorway, a lamp or a lit sign.
9. **Captions and the watermark never cover a face.** Move the camera or the actor, never the brand (the user may turn the corner mark off: film.json `"watermark": false`).
10. **QA must PASS before a render**, and the report must be newer than every edit. Read the contact sheets too.
11. **Test small first:** `--scenes` one scene, `--seconds 10` renders, then the full film once.
12. **Keep the brand in the world:** at least one readable Beta Version piece (poster, sign, mug, box, phone screen) per set.
