"""check.py - verify the master by numbers: format, exact length, loudness, true peak, clipping, the two silences,
the fade, and (when built in the same run) that every named hit peaks one frame after its picture event.

    python tools/sound/check.py [out/audio/mix.wav]
"""
import os, sys, wave
import numpy as np
from dsp import SR, LAT, ns, db, read_wav
from master import measure
from score import load_timeline


def check(path, hits=None):
    tl = load_timeline(); C = tl['cues']; N = ns(tl['duration']); ok = True
    w = wave.open(str(path)); fmt = (w.getframerate(), w.getnchannels(), w.getsampwidth() * 8); n = w.getnframes(); w.close()
    x = read_wav(path); m = measure(path, framelog=True)
    res = dict(len_s=n / SR, samples=n, I=m['I'], TP=m['TP'], LRA=m['LRA'], sample_peak=round(float(db(np.abs(x).max())), 2))
    def say(label, good, text):
        nonlocal ok; ok &= bool(good); print(f'  [{"OK" if good else "FAIL"}] {label}: {text}')
    say('format', fmt == (48000, 2, 24), f'{fmt[0]} Hz, {fmt[1]} ch, {fmt[2]} bit')
    say('length', n == N, f'{n / SR:.4f} s = {n} samples (want {N})')
    say('loudness', abs(m['I'] + 14) <= 0.2, f'{m["I"]} LUFS integrated (want -14), LRA {m["LRA"]} LU')
    say('true peak', m['TP'] <= -2.0, f'{m["TP"]} dBTP (want <= -2), sample peak {res["sample_peak"]} dBFS')
    say('clean', np.isfinite(x).all() and (np.abs(x) >= 0.999).sum() == 0, f'NaN {int((~np.isfinite(x)).sum())}, samples at full scale {int((np.abs(x) >= 0.999).sum())}')
    for nm, a, z in (('s24 silence', C['silence'], C['crack']), ('s34 silence', C['still'], C['split'])):
        seg = x[ns(a):ns(z) - ns(0.005)]; nz = int((seg != 0).sum())
        say(nm, nz == 0, f'{a:.2f}-{z:.2f} s: nonzero samples {nz}; 50 ms before it peaks {db(np.abs(x[ns(a - 0.05):ns(a)]).max()):.1f} dBFS')
        res[nm.replace(' ', '_')] = nz
    tail = x[ns(C['end'] - 0.01):]; say('fade', np.abs(tail).max() == 0, f'last 10 ms silent, last 0.5 s peak {db(np.abs(x[ns(C["end"] - 0.5):]).max()):.1f} dBFS')
    M = m['M']; print('  momentary LUFS per second:', ' '.join(f'{t}:{M.get(round(t + 0.4, 1), -99):.0f}' for t in range(0, int(tl['duration']))))
    if hits:
        # each named hit on its own (neighbours' tails overlap in the mix): attack = where its 0.5 ms envelope first reaches
        # 90 % of its 60 ms maximum; measured against the picture event time
        off = []
        for t, nm, t0, head in hits:
            sm = np.convolve(np.abs(head), np.ones(24) / 24, 'same')[:ns(0.06)]
            off.append(((t0 + int(np.argmax(sm >= 0.9 * sm.max())) / SR - t) * 1000, nm, t))
        o = np.array([q[0] for q in off]); bad = [(q[1], q[2], round(q[0], 1)) for q in off if abs(q[0] - LAT * 1000) > 4]
        say('hit sync', len(bad) == 0, f'{len(o)} hits, attack after the picture frame median {np.median(o):.1f} ms, min {o.min():.1f}, max {o.max():.1f} (want {LAT * 1000:.1f}); outliers {bad}')
        res['hits'] = len(o); res['hit_ms'] = (round(float(np.median(o)), 1), round(float(o.min()), 1), round(float(o.max()), 1))
    print('  ALL OK' if ok else '  SOME CHECKS FAILED')
    return ok, res


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    check(sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', '..', 'out', 'audio', 'mix.wav'))
