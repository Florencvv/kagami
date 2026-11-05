"""score.py - the KAGAMI cue sheet: what plays when, on which bus, how loud.

Timing is picture-locked: shot cuts, the set per shot and CUES come from src/shots.js, the animated events (steps,
splashes, hits...) from tools/sound/events.json (exported by the direction departments). Every hit is placed so its
attack peaks one picture frame (1/24 s) after the event frame.
"""
import json, os, re
from instruments import *

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

# musical material (MIDI). Act 1 uses the in-scale on D (D Eb G A Bb), the resolution the yo scale (D E G A B).
SUMI = [(57, 0.0, 0.95), (62, 0.9, 0.75), (63, 1.6, 0.4), (62, 1.95, 1.2)]                 # low, slow (shakuhachi)
YUKI = [(81, 0.0), (82, 0.11), (86, 0.22), (82, 0.48), (81, 0.59), (79, 0.70), (81, 0.92)]  # high, quick (koto)
PENTA_MAJ = [86, 88, 90, 93, 95, 98, 100, 102, 105]                                         # D major pentatonic sparkles


def load_timeline():
    js = open(os.path.join(REPO, 'src', 'shots.js'), encoding='utf-8').read()
    shots = [dict(id=a, name=b, t0=float(c), t1=float(d), set=e)
             for a, b, c, d, e in re.findall(r"S\('(s\d+)', '([^']*)', ([\d.]+), ([\d.]+), '(\w+)'\)", js)]
    blk = js[js.index('export const CUES'):]; blk = blk[:blk.index('};')]
    cues = {k: float(v) for k, v in re.findall(r'(\w+): ([\d.]+)', blk)}
    fps = int(re.search(r'FPS = (\d+)', js).group(1)); dur = float(re.search(r'DURATION = ([\d.]+)', js).group(1))
    events = json.load(open(os.path.join(HERE, 'events.json'), encoding='utf-8'))
    assert fps == FPS, 'score assumes 24 fps'
    return dict(shots=shots, cues=cues, fps=fps, duration=dur, events=events)


class Score:
    def __init__(s, tl):
        s.tl = tl; s.C = tl['cues']; s.E = tl['events']; s.dur = tl['duration']; s.N = ns(s.dur); s.T = tv(s.N)
        s.bus = {k: Bus(s.N) for k in ('amb', 'fol', 'fx', 'mus', 'glass', 'low')}
        s.hits = []                                    # (event time, name, placed clip start, mono clip head)

    # ------------------------------------------------------------ helpers
    def ev(s, kind, a=0.0, b=1e9, who=None):
        return [e['t'] for e in s.E if e['kind'] == kind and a <= e['t'] < b and (who is None or who in e['note'])]

    def set_at(s, t):
        for sh in s.tl['shots']:
            if sh['t0'] <= t < sh['t1']: return sh['set']
        return s.tl['shots'][-1]['set']

    def curve(s, keys):
        """piecewise-linear control over the whole film from [(t, v), ...]"""
        k = np.array(keys, float); return np.interp(s.T, k[:, 0], k[:, 1])

    def set_mask(s, names, ramp=0.012, pre=None):
        """1 while the picture shows one of `names` sets, with short ramps at the cuts"""
        m = np.zeros(s.N)
        for sh in s.tl['shots']:
            if sh['set'] in names: m[ns(sh['t0']):ns(sh['t1'])] = 1
        k = ns(ramp); m = np.convolve(m, np.ones(k) / k, 'same')
        if pre: a, b = pre; m = np.maximum(m, sstep(a, b, s.T) * (s.T < b + 0.01))
        return m

    def add(s, bus, sig, t, g=1.0, p=0.0, edge=(0.0003, 0.005)): s.bus[bus].add(sig, t, g, p, edge)

    def hit(s, bus, sig, t, g=1.0, p=0.0, name=None):
        """place `sig` so its attack lands one frame after picture time t"""
        sig = np.asarray(sig, float); t0 = t + LAT - onset(sig); s.bus[bus].add(sig, t0, g, p)
        if name: s.hits.append((round(t, 4), name, t0, (sig if sig.ndim == 1 else sig.mean(1))[:ns(0.2)]))

    # ------------------------------------------------------------ the film
    def compose(s):
        s.ambience(); s.act1(); s.standoff(); s.duel(); s.battle(); s.climax(); s.resolution()
        return s

    def ambience(s):
        C, T = s.C, s.T
        city = s.set_mask({'CITY'}, pre=(3.0, 3.5))                     # rain pre-laps the first city cut by half a second
        bed = np.zeros((s.N, 2)); L = ns(23.0)
        bed[:L] = rain(23.0, 11) * 0.07 + neon(23.0, 12) * 0.018 + traffic(23.0, 13) * 0.03
        s.bus['amb'].b += bed * city[:, None]
        pas = s.set_mask({'PASS'})
        w = np.zeros((s.N, 2)); w[:L] = wind(23.0, 21, cold=1.3, gust=1.2) * 0.05
        w[ns(18.75):ns(20.75)] *= 1.6                                     # the cliff edge: stronger gusts
        s.bus['amb'].b += w * pas[:, None]
        for t, g in ((7.8, 0.10), (13.55, 0.06), (17.05, 0.07)):          # far temple bell (gated with the pass shots)
            b = bell(146.8, 6.0, int(t * 10)); k = min(len(b), s.N - ns(t)); seg = np.zeros((s.N, 2))
            seg[ns(t):ns(t) + k] = pan2(b[:k], 0.35); seg += reverb(seg, 5.0, 31, 2400) * 1.6
            s.bus['amb'].b += seg * g * pas[:, None]
        lake = s.set_mask({'LAKE', 'SKY'})
        lv = s.curve([(0, 0.6), (3.5, 0.6), (22.5, 0.5), (35.9, 0.5), (36.4, 0.08), (45, 0.08), (47.6, 0.12), (66, 0.3), (70.75, 0.5),
                      (76, 0.15), (79.4, 0.25), (80.5, 0.5), (84, 0.45)])
        lw = wind(s.dur, 41, cold=0.35, gust=0.6)
        lw = filt(lw, 'lowpass', 2500) * 0.05
        s.bus['amb'].b += lw * (lake * lv)[:, None]

    def act1(s):
        C = s.C
        # ---- music: a sparse motif for each ronin
        s.add('mus', shakuhachi(57, 2.6, scoop=1, seed=1), 0.35, 0.10, -0.3)                  # s01: the two far silhouettes
        s.add('mus', koto(86, 2.5, seed=2), 1.9, 0.07, 0.35)
        s.add('mus', strings([38, 45, 50], 3.6, 0.01, 0.35, seed=3), 0.0, 0.10)
        def sumi_phrase(t0, notes=SUMI, g=0.12, p=-0.15, stretch=1.0, seed=10):
            for i, (m, o, d) in enumerate(notes): s.add('mus', shakuhachi(m, d * stretch + 0.25, scoop=1.0 if i else 1.5, seed=seed + i), t0 + o * stretch, g, p)
        def yuki_phrase(t0, notes=YUKI, g=0.09, p=0.2, rate=1.0, seed=20):
            for i, (m, o) in enumerate(notes): s.add('mus', koto(m, 1.6, bend=1.0 if i == len(notes) - 1 else 0.0, seed=seed + i), t0 + o / rate, g * (0.8 if i % 2 else 1.0), p)
        sumi_phrase(5.35)                                                                         # s03 street
        yuki_phrase(9.62); yuki_phrase(10.95, [(79, 0), (81, 0.1), (82, 0.2), (81, 0.45)], g=0.07, seed=30)   # s05 steps
        sumi_phrase(12.08, [(62, 0.0, 0.55), (63, 0.55, 0.35), (62, 0.9, 0.5)], seed=40)               # s06 eye
        yuki_phrase(13.62, [(81, 0), (82, 0.09), (86, 0.18), (87, 0.42), (86, 0.55)], seed=50)           # s07 eye
        s.add('mus', shakuhachi(58, 1.6, scoop=-1.0, air=1.6, seed=60), 15.05, 0.09, -0.1)               # s08 uneasy Bb
        s.add('mus', koto(75, 1.7, bend=-1.0, bend_at=0.3, seed=61), 17.08, 0.06, 0.25)               # s09
        for i, m in enumerate((79, 81, 82, 86, 87, 91, 93)):                                         # s10 the leap: a quick run up
            s.add('mus', koto(m, 1.2, seed=70 + i), C['yukiLeap'] - 0.3 + 0.05 * i, 0.06 + 0.005 * i, 0.3)
        sumi_phrase(20.85, [(57, 0.0, 0.7), (62, 0.65, 1.1)], g=0.11, stretch=1.0, seed=80)               # s11 causeway
        st = strings([38, 45, 50, 57], 1.9, 0.6, 0.02, seed=81); s.add('mus', st, 20.62, 0.12, edge=None)
        # ---- CITY foley: Sumi's heavy steps on the wet street, splashes
        for t in s.ev('step', 0, 22.5, 'Sumi') + s.ev('step', 0, 22.5, 'reflection'):
            surf = 'wet'; g = 0.42
            if t < 3.5: g = 0.22                                                                        # pre-lap from s01
            if 'reflection' in str([e['note'] for e in s.E if e['t'] == t]): g = 0.18
            s.hit('fol', sumi_step(int(t * 100), surf), t, g, -0.1, 'sumi_step')
        s.hit('fol', sumi_step(390, 'splash', 1.2), C['sumiStep'], 0.55, 0.0, 'sumiStep')
        s.hit('fol', splash(1.0, 391), C['sumiStep'], 0.22, 0.1)
        # ---- PASS foley: Yuki's light quick steps in snow, breath puffs, the brush
        for t in s.ev('step', 0, 22.5, 'Yuki'): s.hit('fol', yuki_step(int(t * 100), 'snow'), t, 0.20, 0.15, 'yuki_step')
        for t in s.ev('breath', 0, 13.5): s.add('fol', breath(int(t * 100), 0.4), t, 0.05, 0.1)
        for t in s.ev('breath', 13.5, 15.0):                                                              # s07 cheek vents, both sides
            for k, p in ((0, -0.6), (1, 0.6)): s.add('fol', breath(int(t * 100) + k, 0.9, 0.45), t + 0.02 * k, 0.04, p)
        s.add('fol', whoosh(0.3, 500, 1800, 801, 1.5), 8.05, 0.03, 0.2)
        s.hit('fol', snow_brush(802), C['yukiBrush'], 0.10, 0.1)
        # ---- eyes, creaks, omens
        s.add('fol', nrm(creak(1245, 85, 0.5)), 12.45, 0.07, 0.0)
        s.add('fx', glow('red', 0.9, 1260), 12.6, 0.045, 0.0)
        s.add('fx', glow('cyan', 0.9, 1390), 13.9, 0.03, 0.0)
        s.add('fol', nrm(creak(1562, 70, 0.35)), 15.62, 0.06, -0.2)
        for t, f, sd in ((s.ev('omen')[0], 1174.7, 1587), (C['omenIce'], 1318.5, 1760)):
            sh = rev_shimmer(1.3, sd, notes=[f, f * 1.06, f * 1.5, f * 2.0, f * 2.76, f * 3.2]); s.add('glass', sh, t + LAT - 1.3, 0.13, edge=(0.01, 0.002))
            s.hit('glass', glass_ping(f * 2, 1.5, sd + 1), t, 0.06, 0.0, 'omen')
        s.hit('fx', crack(1761, 0.4) * 0.5 + 0.5 * pad(sparks(0.36, 1762), ns(0.36)), C['omenIce'], 0.06, 0.3)
        # ---- the leap off the cliff
        s.hit('fx', whoosh(1.4, 1800, 260, 1940, 1.6, lambda u: sstep(0, 0.12, u) * (1 - u) ** 1.2), C['yukiLeap'], 0.22, 0.1)
        s.hit('fol', snow_brush(1941, 0.5), C['yukiLeap'], 0.12, 0.2)
        # ---- s12 touchdown: rain is gone on the cut, one pure ripple tone
        s.hit('fol', sumi_step(2290, 'mirror'), C['touchdown'], 0.30, 0.0, 'touchdown')
        s.hit('glass', bowl(587.3, 5.5, 2291), C['touchdown'], 0.16, 0.0)
        s.hit('glass', drop_bloop(2292), C['touchdown'], 0.05, 0.0)

    def standoff(s):
        C = s.C
        # ---- s12-s13 approach: steps on the mirror, both motifs answer each other over a low drone
        for t in s.ev('step', 23.0, 28.0, 'Sumi'): s.hit('fol', sumi_step(int(t * 100), 'mirror'), t, 0.30, -0.35, 'sumi_step')
        for t in s.ev('step', 23.0, 28.0, 'Yuki'): s.hit('fol', yuki_step(int(t * 100), 'mirror'), t, 0.16, 0.35, 'yuki_step')
        s.add('mus', strings([38, 45], 3.8, 1.5, 0.15, seed=240), 24.3, 0.11, edge=None)
        for i, (m, o, d) in enumerate(SUMI): s.add('mus', shakuhachi(m, d + 0.25, seed=250 + i), 24.7 + o, 0.10, -0.35)
        for i, (m, o) in enumerate(YUKI): s.add('mus', koto(m, 1.5, seed=260 + i), 26.55 + o, 0.07, 0.35)
        # ---- s14 the stop: one low pluck + a soft drum, then wind only
        s.hit('fol', sumi_step(2800, 'mirror'), C['standoff'], 0.22, -0.4); s.hit('fol', yuki_step(2801, 'mirror'), C['standoff'], 0.12, 0.4)
        s.hit('mus', koto(38, 3.0, seed=2802), C['standoff'], 0.16, 0.0, 'standoff')
        s.hit('mus', taiko(1.2, 2803), C['standoff'], 0.10, 0.0)
        # ---- s15-s16: the grip, the guard click, a sliver of steel; Yuki draws two blades
        s.add('fol', nrm(creak(3100, 120, 0.45, rate=(30, 50), form=(500, 3000))), 31.0, 0.05, -0.1)
        s.hit('fol', click(3180) * 0.8, C['guardClick'], 0.22, 0.0, 'guardClick')
        s.hit('fx', shing(3190, 0.55), 31.9, 0.06, 0.0)
        s.hit('fol', clank(3300), 33.0, 0.07, 0.1)
        for k, p in ((0, -0.45), (1, 0.45)):
            s.hit('fx', whoosh(0.22, 3000, 900, 3330 + k, 1.4), C['drawYuki'] + 0.05 * k, 0.07, p)
            s.hit('fx', shing(3340 + k, 0.7), C['drawYuki'] + 0.05 * k, 0.09, p, 'drawYuki' if k == 0 else None)
        s.hit('fol', yuki_step(3367, 'mirror'), 33.67, 0.16, 0.0); s.hit('fol', rattle(6, 0.2, 3368), 33.67, 0.08, 0.0)
        # ---- s17 the eyes: two heartbeat taiko hits
        for i, (t, kind) in enumerate(zip(s.ev('glow', 34.0, 36.0), ('red', 'cyan'))):
            s.hit('mus', taiko(1.5, 3460 + i), t, 0.42, 0.0, 'heartbeat')
            s.hit('fx', glow(kind, 0.7, 3470 + i), t, 0.05, 0.0)
        # ---- s18-s19: stillness, the drop, the ring, the eyes under the lake
        s.hit('glass', glass_ping(2793.8, 0.25, 3720) * 0.4, C['dropFall'], 0.03, 0.0)
        tt = tv(ns(1.35)); slide = np.sin(2 * np.pi * np.cumsum(2349 * 2 ** (0.5 * tt / 1.35 / 12)) / SR) * sstep(0, 0.4, tt) * (1 - sstep(1.1, 1.35, tt))
        s.add('glass', slide, C['dropFall'] + 0.05, 0.006)
        s.hit('glass', drop_bloop(3860), C['dropHit'], 0.10, 0.0, 'dropHit')
        s.hit('glass', glass_ping(2349.3, 5.0, 3861), C['dropHit'], 0.16, 0.0)
        s.hit('glass', bowl(1174.7, 6.0, 3862), C['dropHit'], 0.08, 0.0)
        sw = whoosh(1.1, 80, 300, 3880, 1.5, lambda u: sstep(0, 1, u) ** 2); s.add('low', sw, 38.8, 0.06)
        dur = 48.5 - C['eyesOpen']; dr = glass_drone(dur, 3990)
        e = s.curve([(0, 0), (C['eyesOpen'], 0), (C['eyesOpen'] + 0.08, 0.35), (43.0, 0.55), (45.0, 0.8), (47.6, 1.0), (84, 1.0)])[ns(C['eyesOpen']):ns(C['eyesOpen']) + len(dr)]
        s.add('low', dr * e[:, None], C['eyesOpen'], 0.30, edge=(0.005, 0.01))
        s.hit('low', boom(3.0, 55, 30, 3991), C['eyesOpen'], 0.30, 0.0, 'eyesOpen')
        s.hit('glass', rev_shimmer(0.01 + 1.0, 3992)[::-1] * 0.5, C['eyesOpen'], 0.06)
        for k, p in ((0, -0.4), (1, 0.4)): s.hit('fol', clank(4120 + k), C['lookDown'] + 0.02 * k, 0.13, p, 'lookDown' if k == 0 else None)
        rum = rmsn(filt(noise(ns(4.6), 4300), 'bandpass', [30, 140])) * sstep(0, 4.6, tv(ns(4.6))) ** 1.5
        s.add('low', rum, 43.0, 0.10)
        s.add('fol', nrm(creak(4430, 100, 0.6)), 44.3, 0.05, -0.2)

    def duel(s):
        C = s.C
        # ---- s22 the charge: dash whooshes, kicked water sheets on threes, a riser into the pass
        s.hit('fx', whoosh(1.0, 300, 2400, 4500, 1.3, lambda u: sstep(0, 0.2, u) * (1 - u) ** 0.7), C['charge'], 0.16, 0.0)
        for i, t in enumerate(s.ev('splash', 45.0, 47.5)):
            u = (t - 45.0) / 2.5; s.hit('fol', sumi_step(int(t * 100), 'splash'), t, 0.30, -0.6 + 0.4 * u)
            s.hit('fol', splash(0.6, int(t * 100) + 1), t + 0.06, 0.10, 0.6 - 0.4 * u)
        n = ns(2.6); u = np.linspace(0, 1, n)
        rise = vfilt(noise(n, 4560), 400 * 12 ** u, 'bandpass', 1.0) * u ** 2.5; s.add('fx', nrm(rise), C['pass'] + LAT - 2.6, 0.12, edge=(0.01, 0.003))
        st = strings([50, 51, 57, 62], 2.6, 2.3, 0.01, seed=4570); s.add('mus', st * (0.4 + 0.6 * u)[:, None], C['pass'] + LAT - 2.6, 0.18, edge=None)
        # ---- s23 the pass: iai draw, one huge steel shing + impact crack on the impact frames, blades into the mirror
        s.hit('fx', whoosh(0.18, 4000, 1200, 4745, 1.2), 47.45, 0.12, -0.2)
        s.hit('fx', shing(4760, 2.0), C['pass'], 0.45, 0.0, 'pass')
        s.hit('fx', crack(4761, 1.4), C['pass'], 0.40, 0.0)
        s.hit('fx', white_flash(2 / 24, 4762), C['pass'], 0.18)
        s.hit('low', boom(1.2, 70, 35, 4763), C['pass'], 0.26)
        s.hit('fx', crack(4790, 0.6), 47.9, 0.25, 0.0, 'stab')
        s.hit('glass', glass_ping(440, 1.5, 4791), 47.9, 0.12, 0.0)
        s.hit('fol', splash(0.7, 4792), 47.9, 0.18, 0.0)
        # ---- s24: real silence (gated in the mix). s25 the cracks race outward across the stereo field
        gt = glass_tear(C['emerge'] - C['crack'] + 0.2, 4975)
        s.add('fx', gt, C['crack'] + 0.005, 0.30, edge=(0.003, 0.05))
        s.hit('fx', crack(4976, 0.8), C['crack'], 0.30, 0.0, 'crack')
        s.hit('glass', glass_ping(880, 2.0, 4977), C['crack'], 0.10, 0.0)
        s.add('fol', nrm(creak(5140, 150, 0.5, form=(800, 4000))), 51.4, 0.06, -0.3)
        s.add('fol', nrm(creak(5141, 180, 0.5, form=(800, 4000))), 51.45, 0.05, 0.3)

    def battle(s):
        C = s.C; T0 = 55.5; BEAT = 0.5
        # ---- s26 emerge: colossal sub boom, roar, pouring water and glass cascades, choir + brass
        s.hit('low', boom(4.5, 58, 24, 5230), C['emerge'], 0.48, 0.0, 'emerge')
        s.hit('fx', crack(5231, 2.0), C['emerge'], 0.35, 0.0)
        s.add('fx', nrm(roar(3.4, 5232)), C['emerge'] + 0.1, 0.30, 0.0)
        pr = water_pour(5.4, 5250); e = sstep(0, 0.4, tv(len(pr))) * (1 - sstep(4.6, 5.4, tv(len(pr))))
        s.add('amb', pr * e[:, None], 52.4, 0.085)
        gc = tinkles(5.2, 5260, 70, (1500, 7000), dec=(0.08, 0.5), env=lambda u: (1 - u) ** 0.6); s.add('glass', gc, 52.4, 0.11)
        s.add('mus', choir([50, 53, 57, 62], 3.4, 'a', 0.6, 0.3, seed=5270), C['emerge'], 0.20, edge=None)
        s.hit('mus', section([38, 50, 57, 62, 65], 0.9, 1.2, 5280), C['emerge'], 0.22)
        # ---- taiko ostinato s27-s31 (120 bpm from 55.5), chords every bar, brass stabs on the downbeats
        PAT = [1.0, 0, 0.45, 0.35, 0.8, 0, 0.5, 0.3]                         # eighths: odaiko accents
        for bar, (chord, bass) in enumerate((([50, 53, 57, 62], 38), ([50, 53, 58, 62], 34), ([52, 55, 60, 64], 36), ([50, 53, 57, 62], 38))):
            t0 = T0 + bar * 4 * BEAT
            for k, a in enumerate(PAT):
                tk = t0 + k * BEAT / 2
                if a: s.add('mus', taiko(1.1 if a > 0.7 else 0.8, int(tk * 100)), tk - 0.001, 0.26 * a, 0.0)
                s.add('mus', shime(int(tk * 100) + 1), tk, 0.05 * (1.0 if k % 2 == 0 else 0.6), 0.25)
            s.add('mus', choir(chord, 2.1, 'a', 0.15, 0.2, seed=5500 + bar), t0, 0.16, edge=None)
            s.add('mus', strings([bass, bass + 12], 2.05, 0.05, 0.1, seed=5510 + bar, lp=1800), t0, 0.22, edge=None)
            for o, d in ((0, 0.35), (1.25, 0.2), (1.5, 0.3)):
                s.add('mus', section([c + 12 if c < 55 else c for c in chord[:3]], d, 1.0, 5520 + bar * 3 + int(o * 4)), t0 + o, 0.13)
        # ---- s27 the swing: wind-up, slam, glass wall, leaps and landings
        s.add('fx', whoosh(0.65, 120, 900, 5575, 1.5, lambda u: sstep(0, 0.7, u) * (1 - sstep(0.9, 1, u))), 55.75 + LAT - 0.62, 0.30, -0.2, edge=None)
        tS = s.ev('hit', 56.0, 57.0)[0]
        s.hit('fx', crack(5632, 1.8), tS, 0.40, 0.0, 'swing')
        s.hit('low', boom(2.0, 65, 30, 5633), tS, 0.36)
        s.hit('fol', splash(2.0, 5634), tS, 0.35, 0.0)
        s.hit('fx', white_flash(1 / 24, 5635), tS, 0.10)
        s.add('glass', tinkles(0.9, 5636, 400, (1200, 6500), dec=(0.05, 0.3), env=lambda u: (1 - u) ** 1.5), tS + LAT, 0.16)
        for t, p in zip(s.ev('whoosh', 56.0, 57.0), (0.6, -0.6)): s.hit('fx', whoosh(0.45, 600, 3000, int(t * 100), 1.2), t + 0.05, 0.10, p)
        s.hit('fol', sumi_step(5717, 'splash'), 57.17, 0.30, 0.5); s.hit('fol', yuki_step(5727, 'mirror'), 57.27, 0.18, -0.5)
        # ---- s28 Yuki runs up the forearm: glass footfalls with sparks, rushing air
        for t in s.ev('step', 58.0, 60.25): s.hit('fol', yuki_step(int(t * 100), 'glass'), t, 0.20, 0.0, 'arm_step')
        ra = whoosh(2.3, 500, 1400, 5800, 2.5, lambda u: sstep(0, 0.15, u) * (1 - sstep(0.8, 1, u))); s.add('fx', ra, 58.0, 0.06)
        # ---- s29 the aura: Sumi sinks, a roaring flame ignites along the blade, the scarf burns into embers
        s.add('fol', nrm(creak(6042, 80, 0.4)), 60.42, 0.06, 0.0)
        s.hit('low', boom(1.2, 90, 40, 6050), C['aura'], 0.30, 0.0, 'aura')
        fl = flame(68.4 - C['aura'], 6051); u = np.linspace(0, 1, len(fl))
        fe = sstep(0, 0.03, u) * (1.0 - 0.55 * sstep(0.2, 0.35, u)) * (1 - sstep(0.97, 1.0, u)); s.add('fx', fl * fe[:, None], C['aura'], 0.08)
        s.add('fx', embers(1.4, 6080, 60), 60.8, 0.12)
        # ---- s30 the face cuts
        s.hit('fx', whoosh(0.2, 1500, 5000, 6273, 1.2), 62.73, 0.12, 0.3)
        for i, t in enumerate(s.ev('hit', 62.5, 63.5)):
            s.hit('fx', shing(6290 + i, 0.8), t, 0.20, (-0.3, 0.3)[i], 'faceCut')
            s.hit('fx', crack(6295 + i, 1.0), t, 0.32, (-0.2, 0.2)[i])
            s.hit('glass', glass_ping(1760 * (1, 1.19)[i], 1.4, 6297 + i), t, 0.09)
            s.hit('fx', white_flash(1 / 24, 6299 + i), t, 0.06)
        s.add('fx', nrm(roar(2.0, 6300)), 63.0, 0.22)
        # ---- s31 kaleidoscope: glass hum in the shards, Sumi charging, a taiko roll rising to the leap
        for k, f in enumerate((1174.7, 1760.0, 2349.3, 2637.0)):
            s.add('glass', bowl(f, 2.4, 6400 + k) * sstep(0, 0.3, tv(ns(2.4))), 64.0 + 0.1 * k, 0.03, (k - 1.5) * 0.4)
        for t in s.ev('step', 64.0, 66.0): s.hit('fol', sumi_step(int(t * 100), 'mirror'), t, 0.26, 0.0, 'sumi_step')
        nroll = 34
        for k in range(nroll):
            u = k / nroll; tk = 64.0 + (C['leap'] - 64.0) * (1 - (1 - u) ** 1.35)
            s.add('mus', taiko(0.9, 6450 + k), tk, 0.08 + 0.22 * u ** 1.5, 0.3 * (-1) ** k)
        s.add('mus', choir([45, 52, 57, 61], 2.2, 'a', 1.6, 0.05, seed=6460), 64.0, 0.18, edge=None)
        s.add('mus', strings([33, 45], 2.2, 1.8, 0.05, seed=6461), 64.0, 0.25, edge=None)

    def climax(s):
        C = s.C
        # ---- s32 the leap: a big drum, everything rising to the strike
        s.hit('mus', taiko(1.6, 6620), C['leap'], 0.55, 0.0, 'leap')
        s.hit('fx', whoosh(1.2, 250, 2600, 6600, 1.4, lambda u: sstep(0, 0.15, u) * (1 - u) ** 1.2), 66.0, 0.22, 0.0)
        d = C['cross'] + LAT - C['leap']; n = ns(d); u = np.linspace(0, 1, n)
        s.add('mus', choir([50, 57, 62, 65], d, 'a', d * 0.9, 0.01, seed=6630) * (0.3 + 0.7 * u)[:, None], C['leap'], 0.26, edge=None)
        s.add('mus', strings([62, 65, 69, 74], d, d * 0.8, 0.01, seed=6631, lp=6000) * (0.2 + 0.8 * u ** 2)[:, None], C['leap'], 0.25, edge=None)
        s.add('mus', section([38, 50], d, 0.6, 6632, att=1.0) * (0.3 + 0.7 * u ** 2), C['leap'], 0.10, edge=None)
        rise = vfilt(noise(n, 6633), 300 * 20 ** u, 'bandpass', 1.0) * u ** 2.2; s.add('fx', nrm(rise), C['leap'], 0.12, edge=(0.01, 0.003))
        s.hit('fx', whoosh(0.4, 400, 4000, 6800, 1.2, lambda u: u ** 1.5 * (1 - sstep(0.9, 1, u))), 68.0, 0.20, 0.0)
        # ---- s33 the X strike: two crossing shings + a massive crack + white
        for k, (a, b) in enumerate(((-1, 1), (1, -1))):
            sh = shing(6840 + k, 2.2); L = len(sh); pv = a + (b - a) * sstep(0, 0.35, tv(L))
            s.hit('fx', pan2(sh, pv), C['cross'] + 0.04 * k, 0.40, name='cross' if k == 0 else None)
        s.hit('fx', crack(6842, 2.4), C['cross'], 0.45, 0.0)
        s.hit('low', boom(1.6, 70, 28, 6843), C['cross'], 0.42)
        s.hit('fx', white_flash(3 / 24, 6844), C['cross'], 0.22)
        # ---- s34: silence (gated). s35 the sky split: a huge airy whoosh, a bright major chord
        sp = whoosh(3.2, 300, 7000, 7075, 2.6, lambda u: sstep(0, 0.08, u) * (1 - u) ** 1.1)
        s.hit('fx', np.stack([sp, whoosh(3.2, 320, 6800, 7076, 2.6, lambda u: sstep(0, 0.08, u) * (1 - u) ** 1.1)], 1), C['split'], 0.40)
        s.hit('low', boom(3.5, 50, 26, 7077), C['split'], 0.36, 0.0, 'split')
        D = [50, 54, 57, 62]
        s.add('mus', section([38, 50, 54, 57, 62, 66], 5.6, 1.2, 7080, att=0.03), C['split'] + LAT, 0.24, edge=(0.001, 0.4))
        s.add('mus', choir([62, 66, 69, 74], 6.5, 'a', 0.05, 2.5, seed=7081), C['split'] + LAT, 0.30, edge=None)
        s.add('mus', strings([74, 78, 81, 86], 6.5, 0.08, 2.5, seed=7082, lp=7000), C['split'] + LAT, 0.25, edge=None)
        s.add('mus', strings([26, 38], 6.0, 0.02, 2.0, seed=7083, lp=900), C['split'] + LAT, 0.40, edge=None)
        for k, m in enumerate((86, 90, 93, 98)): s.hit('glass', glass_ping(NOTE(m), 3.0, 7120 + k), 71.2 + 0.06 * k, 0.05, (k - 1.5) * 0.4)
        # ---- s36 shatter: a glass burst, then shards falling like glittering snow (D major pentatonic)
        s.hit('fx', crack(7300, 1.6), C['shatter'], 0.34, 0.0, 'shatter')
        s.hit('fx', white_flash(0.25, 7301, 2500) * np.exp(-tv(ns(0.25)) / 0.08)[:, None], C['shatter'], 0.15)
        s.add('glass', tinkles(0.8, 7302, 500, (1500, 9000), dec=(0.05, 0.25), env=lambda u: (1 - u) ** 2), C['shatter'] + LAT, 0.22)
        sn = tinkles(6.6, 7303, 45, notes=PENTA_MAJ, dec=(0.15, 0.6), env=lambda u: 0.15 + 0.85 * (1 - u) ** 1.5); s.add('glass', sn, 73.15, 0.14, edge=(0.01, 0.4))
        s.add('mus', choir([50, 57, 62, 66, 69], 11.0, 'o', 1.5, 1.5, seed=7330, bright=0.6), 73.0, 0.12, edge=None)

    def resolution(s):
        C = s.C
        # ---- s37 heal: a long reverse shimmer closing the cracks, the landing, rising
        sh = rev_shimmer(2.3, 7620, notes=[NOTE(m) for m in (74, 78, 81, 86, 90, 93)]); s.add('glass', sh, 78.5 - 2.3, 0.14, edge=(0.3, 0.01))
        s.hit('glass', glass_ping(NOTE(86), 2.5, 7621), 78.45, 0.04)
        s.hit('fol', sumi_step(7630, 'splash'), 76.3, 0.30, -0.25, 'land'); s.hit('fol', yuki_step(7631, 'mirror'), 76.32, 0.16, 0.25)
        s.add('fol', nrm(creak(7750, 90, 0.6)), 77.5, 0.05, -0.2); s.add('fol', rustle(0.6, 7751), 77.5, 0.04, 0.2)
        # ---- s38 the sheathe: the slide, then a crisp centred click with the sparkle burst
        s.add('fol', sheath_slide(C['click'] + LAT - 78.75, 7875) / 3, 78.75, 0.10, 0.0, edge=(0.01, 0.003))
        s.hit('fol', click(7940), C['click'], 0.50, 0.0, 'click')
        s.add('glass', tinkles(1.4, 7941, 120, notes=PENTA_MAJ[2:], dec=(0.1, 0.5), env=lambda u: (1 - u) ** 2.5), C['click'] + LAT, 0.16)
        # ---- s39 the bow in quiet wind
        for t in s.ev('rustle', 80.0, 82.0): s.add('fol', rustle(0.7, int(t * 100)), t, 0.05, -0.3); s.add('fol', rustle(0.6, int(t * 100) + 1), t + 0.04, 0.04, 0.3)
        s.add('fol', nrm(creak(8215, 100, 0.5)), 82.15, 0.04, 0.0)
        for t in s.ev('step', 82.0, 84.0):
            s.hit('fol', sumi_step(int(t * 100), 'mirror'), t, 0.14, -0.5); s.hit('fol', yuki_step(int(t * 100) + 1, 'mirror'), t + 0.03, 0.09, 0.5)
        # ---- both motifs together as they part (yo scale, resolving to D)
        for i, (m, o, d) in enumerate([(57, 0.0, 0.8), (62, 0.75, 0.6), (64, 1.3, 0.3), (62, 1.6, 1.5)]):
            s.add('mus', shakuhachi(m, d + 0.3, seed=8100 + i), 81.4 + o, 0.10, -0.3)
        for i, (m, o) in enumerate([(81, 0.0), (83, 0.11), (86, 0.22), (83, 0.85), (81, 0.96), (86, 1.4)]):
            s.add('mus', koto(m, 1.8, seed=8150 + i), 81.75 + o, 0.07, 0.3)
        s.add('mus', koto(38, 2.6, seed=8170), 82.0, 0.10, 0.0)

    # ------------------------------------------------------------ mix
    def mix(s, diag=False):
        C, T, b = s.C, s.T, s.bus
        mus = b['mus'].b + reverb(b['mus'].b, 2.8, 91, 5500) * 0.32
        kn = np.percentile(np.abs(mus), 99.8) * 1.8 + 1e-9; mus = kn * np.tanh(mus / kn)
        fx = b['fx'].b + reverb(b['fx'].b, 1.6, 92, 5000) * 0.22
        fol = b['fol'].b + reverb(b['fol'].b, 0.9, 93, 6000) * 0.15
        gl = b['glass'].b + reverb(b['glass'].b, 5.0, 94, 8000) * 0.55
        low = filt(b['low'].b, 'lowpass', 2000)
        amb = b['amb'].b
        parts = dict(mus=mus, fx=fx, fol=fol, glass=gl, low=low, amb=amb)
        mix = sum(parts.values())
        kf = np.percentile(np.abs(mix), 99.95) * 2.0 + 1e-9; mix = kf * np.tanh(mix / kf)
        sil = [(C['silence'], C['crack']), (C['still'], C['split'])]          # real silence: s24 and s34
        for a, z in sil:
            g = 1 - sstep(a - 0.03, a, T) * (1 - sstep(z - 0.004, z, T)); mix *= g[:, None]; mix[ns(a):ns(z) - ns(0.004)] = 0
        tail = 1 - sstep(C['end'] - 0.5, C['end'] - 0.01, T); mix *= tail[:, None]; mix[ns(C['end'] - 0.01):] = 0
        mix[:ns(0.002)] *= np.linspace(0, 1, ns(0.002))[:, None]
        if diag:
            r = lambda z, a, c: round(float(db(np.sqrt(np.mean(z[ns(a):ns(c)] ** 2)))), 1)
            for nm, a, c in (('s01', 0, 3.5), ('city', 3.5, 7.75), ('pass', 7.75, 12), ('omen', 15, 19), ('touch', 22.5, 24.5), ('approach', 24.5, 28),
                             ('standoff', 28, 34.5), ('eyes', 34.5, 36), ('still', 36, 39.9), ('drone', 40, 45), ('charge', 45, 48.5), ('crack', 49.75, 52),
                             ('emerge', 52, 55.5), ('ostinato', 55.5, 64), ('rise', 64, 68.4), ('cross', 68.4, 69.5), ('split', 70.75, 73), ('shatter', 73, 76),
                             ('heal', 76, 79.4), ('end', 79.4, 84)):
                print(f'{nm:9s}', ' '.join(f'{k} {r(v, a, c):6}' for k, v in parts.items()), '| mix', r(mix, a, c))
        return mix
