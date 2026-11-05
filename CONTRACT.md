# KAGAMI · 鏡 — production contract

An 84-second, 24 fps, 1920×1040 anime short rendered in the browser with three.js (WebGL2), captured frame by frame
headless and encoded with ffmpeg. Original story and designs. Every frame must pass as a still from a finished
theatrical 2D anime film (painted backgrounds, cel characters, confident ink), while it is 3D code underneath.

Look bible (read it): the studio's anime look guide (a separate document, not included in this repository). Engine API:
`src/anime/README.md` (`src/anime/post.js` is the shared AnimePost module). Differences for this film:
frame 1920×1040; Japanese signage is allowed as world dressing in the CITY (real, simple words only, see CITY) — no
Latin text, no logos, no titles, no end card anywhere.

## Story (one line)
Two rival mecha ronin cross their own worlds — a neon city in the rain and a snowy mountain pass at dawn — to duel on
an endless mirror lake at sunset. At the moment of the draw the reflection shows a third: a colossal giant of mirror
shards living under their feet. They pass each other and strike the mirror together, the giant breaks into the real
sky, and the rivals defeat it with one cross-shaped cut. The lake heals; they bow and walk away.

Tone: tense silence → explosive action → quiet respect. Colour: neon violet night / pink-blue snowy dawn / golden
sunset. Never murky, never black: night is deep blue-violet with readable shapes.

## Characters
**SUMI 墨** — heavy black ronin, 18 m. Broad, deliberate, slow.
- Kabuto-style helmet: low rounded bowl, wide flared neck guard of 4 lamellar rows (shikoro), a thin golden crescent
  crest (maedate) wider than the head. Dark faceplate (menpō shape: brow ridge, nose bridge, jaw plates) with ONE
  horizontal eye slit glowing red FF3B2E.
- Huge layered shoulder guards (sode): 5 rows of lacquered lamellar plates laced with deep-red cord, each row a
  separate swinging plate group. Chest (dō): layered horizontal bands with a vertical keel. Waist: 6 hanging tasset
  plates (kusazuri) that swing with follow-through. Arms/legs: armoured plates over a dark inner frame with visible
  pistons at elbows and knees; broad armoured feet with toe plates.
- A tattered deep-red cloth scarf/cape (8E1E26) from the neck, 10 m long, bone chain, flutters on twos.
- Weapon: NODACHI (blade 12 m): black lacquer scabbard with a red cord on the LEFT hip, gold round tsuba, hilt wrap in a
  diamond pattern; drawn with the right hand.
- Colours: lacquer plates 2C3150 lit / 1A1C33 shade; lacing A3242C; gold trims C9A24A; inner frame 3A3A40; eye FF3B2E.

**YUKI 雪** — slim white ronin, 15 m. Fast, light, precise.
- Sleek rounded helmet with two swept-back blade crests and a long white plume (horsehair tassel, 8 m, bone chain).
- Smooth white faceplate with two narrow cyan eyes 5CF2FF (emissive) and small cheek vents (breath vapour in the cold).
- Slim waist, long legs, layered thigh plates, narrow shoulder plates with vermilion edges.
- Weapons: TWO short blades (kodachi, 5 m) in vermilion scabbards crossed at the lower back; drawn in reverse grip.
- Colours: plates EEEDF2 lit / A9ABD0 shade (lavender); vermilion trims D2402F; gold pins C9A24A; inner frame 8D8F9A.

**UTSUSHI 写し** (the mirror giant) — 200 m humanoid made of hundreds of mirror shards (flat irregular polygons, thin dark
gaps, ink edges). Its helmet merges both ronin (a crescent crest + swept blades): it is their joined reflection. Each
shard shows the sky: facet colour = sky gradient sampled by the facet normal, sunset-facing facets blaze gold, every
shard carries one or two drawn white diagonal glints. Eyes: two white suns. Weapon: a 150 m shard great-sword. Moves
slow, heavy, on twos with long holds; water and glass pour off it in sheets.

Design rules for all: nothing boxy, every surface has seams, bevels, lacing, bolts or wear. Rigid plates on joint pivots
(no skinning needed for mecha), cloth and plume on bone chains. Keep them on-model from every angle.

## Sets (meters; ground/water at y = 0)
Only one set is visible at a time (`st.set`).
- **CITY** — night, rain. A 30 m wide canyon street between dense towers (60–150 m): old Japanese shops at street level
  (tiled eaves, noren, paper lanterns), dark towers above with lit windows, overhead cable tangles, steam vents.
  Vertical neon signs on panels in pink FF4FA3, cyan 49E6FF, amber FFB347, violet A178FF with real single kanji or short
  words only: 酒, 宿, 薬, 湯, 夜, 雨, 本, 茶, 喫茶, 居酒屋. Wet street = mirror (y=0, strength ~0.5, rain-broken), puddles =
  strong mirror patches. A long empty causeway leading out of the city at dusk (s11) with a golden glow on the horizon.
  Scale props (human-size bikes, vending machines, lanterns) make the 18 m ronin read huge.
- **PASS** — dawn, snow. Long human-scale stone steps down a snowy ridge (the ronin walks beside them: scale), an old
  broken wooden gate, snow-laden pines (painted cards), moss stone lanterns with snow caps, a sea of clouds below with
  far peaks, a cliff edge (s10), a frozen pond with ice (mirror, cracked). Sky pink F6B8C8 → blue 8AB4F0.
- **LAKE** — sunset. Endless salt flat under 3 cm of water = perfect mirror (engine mirror pass, y=0). Low horizon,
  towering cumulus lit gold-pink, a big low sun FFD08A, deep blue zenith 2A3C8C, far hazy mountains. The mirror reads
  slightly darker and cooler than the sky, with faint painted horizontal strokes and hexagonal salt-crust lines where
  the camera looks steeply down. Footstep ripple rings.
- **SKY** — the LAKE sky without the ground, for shots looking up/sideways at the leap and the X-cut.

## Shots (times in seconds; `src/shots.js` holds SHOTS and CUES)
| id | name | time | set | what happens |
|---|---|---|---|---|
| s01 | open | 0–3.5 | LAKE | HOOK, frame 0 already beautiful: extreme wide sunset mirror, the sky doubled, two tiny silhouettes far apart on the mirror. Slow push in. |
| s02 | puddle | 3.5–5.25 | CITY | low macro: Sumi's armoured foot splashes into a neon puddle reflecting pink/cyan signs; rain on threes. |
| s03 | street | 5.25–7.75 | CITY | low front dolly-back: Sumi walks down the neon canyon street, rain streaks, scarf whipping, steam. |
| s04 | snow hand | 7.75–9.5 | PASS | macro: Yuki's white hand brushes snow off a mossy stone lantern; flakes in dawn light. |
| s05 | steps | 9.5–12.0 | PASS | wide: Yuki walks down beside the long stone steps through the broken gate, sea of clouds below, plume trailing. |
| s06 | sumi eye | 12.0–13.5 | CITY | CU helmet: crescent crest, the red slit glows, rain runs down the faceplate. Slow push. |
| s07 | yuki eye | 13.5–15.0 | PASS | CU faceplate: cyan eyes, breath vapour puffs from the cheek vents. |
| s08 | omen puddle | 15.0–17.0 | CITY | a puddle in the foreground reflects Sumi walking past behind; the REFLECTION stops and turns its head to camera with WHITE eyes for 3 frames while the real Sumi walks on. |
| s09 | omen ice | 17.0–18.75 | PASS | frozen pond: Yuki's reflection in the ice; a white crack flickers across it like an eye opening. |
| s10 | leap | 18.75–20.75 | PASS | side wide: Yuki leaps off the cliff edge into the clouds, snow burst. |
| s11 | causeway | 20.75–22.5 | CITY | Sumi walks out of the last street onto the empty causeway at dusk, city lights behind, golden glow ahead. |
| s12 | touchdown | 22.5–24.5 | LAKE | match cut on the foot: Sumi's foot lands on the mirror, a perfect ripple ring across the reflected sunset. |
| s13 | approach | 24.5–28.0 | LAKE | high aerial: the two ronin walk toward each other from opposite edges, reflections under them, clouds doubled. |
| s14 | duel frame | 28.0–31.0 | LAKE | side wide at mirror level: they stop ~60 m apart, the setting sun exactly between them. Slow push. ICONIC. |
| s15 | hilt | 31.0–32.75 | LAKE | CU Sumi's hand on the nodachi hilt; the thumb pushes the guard; a sliver of steel flashes. |
| s16 | stance | 32.75–34.5 | LAKE | Yuki sinks into a low stance, drawing both blades reverse-grip; the plume settles. |
| s17 | eyes | 34.5–36.0 | LAKE | extreme CUs cross-cut: red slit (0.75 s) / cyan eyes (0.75 s). |
| s18 | drop | 36.0–38.5 | LAKE | macro at mirror level, total stillness: one leftover raindrop from the city slides off Sumi's scarf and falls. |
| s19 | ring | 38.5–41.0 | LAKE | the drop hits the mirror, a ring spreads; camera tilts DOWN into the reflection: under their feet the reflected sky holds a colossal face of mirror shards; its white eyes open. |
| s20 | look down | 41.0–43.0 | LAKE | 3/4 two-shot: both ronin look down at the same moment. |
| s21 | rise | 43.0–45.0 | LAKE | top-down: in the mirror the giant rises toward the surface, filling the lake; the ronin tiny on it. |
| s22 | charge | 45.0–47.0 | LAKE | low wide: they charge at each other, water sheets on threes, smears. |
| s23 | pass | 47.0–48.5 | LAKE | they meet in the centre: 2 impact frames; they pass each other and both stab their blades DOWN into the mirror at the giant's eye. |
| s24 | silence | 48.5–49.75 | LAKE | hold: two blades in the mirror, the wind gone. Near silence. |
| s25 | crack | 49.75–52.0 | LAKE | aerial: white cracks race outward from the blades to the horizon; the mirror breaks into plates. |
| s26 | emerge | 52.0–55.5 | LAKE | low wide: the giant pushes up through the shattered lake into the real sunset sky, glass and water pouring off it; ronin tiny at its feet. |
| s27 | swing | 55.5–58.0 | LAKE | the giant swings the shard sword; the ronin leap apart (smears); the blade carves the lake, a wall of glass and spray. |
| s28 | run arm | 58.0–60.25 | LAKE | Yuki runs up the giant's forearm, sparks at her feet, speed lines, camera tracking alongside. |
| s29 | aura | 60.25–62.25 | LAKE | Sumi plants and raises the nodachi; a red-gold aura ignites along the blade; the scarf burns into embers. |
| s30 | face cut | 62.25–64.0 | LAKE | Yuki at the giant's head: two quick slashes crack its face, white light in the cracks; it reels. |
| s31 | shards | 64.0–66.0 | LAKE | the camera glides between floating shards, each reflects Sumi charging from a different angle (kaleidoscope). |
| s32 | leap | 66.0–68.0 | SKY | Sumi and Yuki leap from opposite sides high above the giant, sun behind them (silhouettes with rims). |
| s33 | cross | 68.0–69.5 | SKY | the cross strike: vertical + horizontal cuts form a giant X through the giant's chest; impact frames. |
| s34 | still | 69.5–70.75 | SKY | 1 s near silence: the X glows on the giant, nothing moves. |
| s35 | sky split | 70.75–73.0 | SKY | wide: the X extends into the sky, clouds behind split along an X for kilometres, the sun flares through. |
| s36 | shatter | 73.0–76.0 | LAKE | the giant bursts into millions of shards drifting down like glittering snow in the sunset. |
| s37 | heal | 76.0–78.5 | LAKE | the two land back to back; the lake heals, cracks flowing closed like mercury; the reflection returns. |
| s38 | sheathe | 78.5–80.25 | LAKE | CU Sumi sheathes the nodachi; on the click the last shards around burst into sparkles. |
| s39 | bow | 80.25–82.0 | LAKE | side two-shot, the sun between them (rhyme of s14): they bow to each other. |
| s40 | part | 82.0–84.0 | LAKE | crane up high: they walk away in opposite directions, two lines of ripples on the endless mirror; soft fade to gold in the last 0.5 s. |

CUES (sound + FX key off these): sumiStep 3.9, yukiBrush 8.2, omenFlash 15.9, omenIce 17.6, yukiLeap 19.4,
touchdown 22.9, standoff 28.0, guardClick 31.8, drawYuki 33.3, dropFall 37.2, dropHit 38.6, eyesOpen 39.9, lookDown
41.2, charge 45.0, pass 47.6, silence 48.5, crack 49.75, emerge 52.3, swing 56.2, aura 60.5, faceCut 62.9, leap 66.2,
cross 68.4, still 69.5, split 70.75, shatter 73.0, heal 76.2, click 79.4, bow 80.8, end 84.0.

## Repository layout (this folder is the public repo; QA stills, chunks and logs live outside it)
```
index.html            workbench: scrub, play, shot label; ?headless=1 for capture; ?s=2 render scale
src/main.js           boot: renderer, AnimePost, scene, camera, sets, departments, window.FILM
src/shots.js          SHOTS, CUES, FPS, DURATION, evalFrame(frame) -> st
src/anime/            post.js (AnimePost + materials), README.md
src/look.js           colour script presets per set (LOOKS merge on top)
src/ronin*.js         SUMI, YUKI, blades, poses                   (dept RONIN)
src/city*.js          CITY set                                     (dept CITY)
src/lands*.js         PASS, LAKE, SKY sets                         (dept LANDS)
src/fx*.js, src/giant*.js   all FX + UTSUSHI                       (dept FX)
src/direction/act1.js s01–s20 cameras, looks, choreography         (dept DIRECTION A)
src/direction/act2.js s21–s40                                      (dept DIRECTION B)
tools/                serve.py, snap.py (stills), render.py + chunks.sh + finalize.sh, sheet.py, sound/ (later)
vendor/               three.module.js (+ addons if needed)
docs/                 stills for the README (later)
```

## Department API (what everyone can rely on)
Each department module exports `create(ctx)` (may be async) returning `{ update(st) }`. Update order each frame:
lands, city, ronin, giant, fx, direction (direction runs last and may override anything for its shot).
- `ctx` = `{ THREE, A /* everything exported by src/anime/post.js */, scene, camera, renderer, post, sets /* {CITY,
  PASS, LAKE, SKY}: THREE.Group, main toggles .visible by st.set */, rng(seed) /* seeded, never Math.random */, FPS,
  CUES, SHOTS, api /* departments publish here */, LAYER /* {MAIN_ONLY: 1, REFLECT_ONLY: 2} */ }`.
- `st` = `{ frame, t, sid, shot, set, lt, dur, cues, look, cam, q /* URLSearchParams in test mode */ }`.
- Everything is a pure function of `st.t`: frames render in any order. Characters pose at `A.onTwos(t)`, FX at
  `A.onThrees(t)`, cameras on ones.
- `ctx.api.ronin`: `{ sumi, yuki }` each `{ root, pose(name | {joint: [x,y,z]...}, blend?), walk(phase), run(phase),
  anchor(name, vec3) /* head, eye, chest, handR, handL, bladeTip, bladeBase, scabbard, footL, footR, scarfTip|plumeTip */,
  blade: { draw(k 0..1), sheathe(k) }, eyes(intensity, colorOverride?), setLayer(layer), reflectionTwin() /* clone on
  REFLECT_ONLY layer for the omen */ }`. Named poses at least: idle, walk cycle, stride stop, guard (hand on hilt),
  stance (Yuki low), dash, pass-stab (blade down), leap, slash-vertical (Sumi), slash-horizontal (Yuki), land kneel,
  sheathe, bow, look-down. Scarf/plume: `cloth(t, wind)` follows the root.
- `ctx.api.giant`: `{ root, show(bool), pose(p) /* {rise 0..1, head, armL, armR, sword, reel} */, reflectOnly(bool),
  crackFace(k), xCut(k), shatter(k), anchor(name) /* eyeL, eyeR, head, chest, swordTip, handR */ }`.
- `ctx.api.lake`: `{ ripple(x, z, t0, speed?) , crack(k, centre), heal(k) }`; `ctx.api.city`/`pass`: puddle and
  ice mirror patches, lights.
- `ctx.api.fx`: rain(set, amount), snow(amount), breath(at, t0), drop(start, t0, t1), splash(at, t0, size),
  sheets(path...), sparks(at, t0), aura(on, k), embers(k), slash(kind, from, to, t0), xcut(k), shardSnow(k),
  speedLines(k) etc. — FX decides the exact signature and documents it in `src/fx/README.md`.

## Engine facts (src/anime/post.js — scaffold owns it first, then ONLY dept FX edits it)
- Pass chain from the bible + a MIRROR pass: `look.mirror = { on, y, strength, distort, ripples: [[x, z, t0, speed]...],
  rough }`: a reflected camera renders layers 0 + 2 into a half-res target; any material with `mirror: true` (ids 120–124)
  samples it in screen space with ripple distortion. The main camera renders layers 0 + 1. Objects on layer 2 exist only
  in reflections (the giant before s25, the omen twin), layer 1 only in the direct view.
- `look.impact = 0 | 1 | 2` (1 = inverted ink frame: white paper + black ink shapes, 2 = pure white flash), used for 1–2
  frames at hits. `look.speed = { amount, centre:[u, v] }` drawn speed lines. `look.fade/fadeColor`.
- Material ids: 0 sky, 1–89 inked cel (keep neighbours different so lines fall at plate boundaries), 90–99 FX no ink,
  100+ painted. Budget: under 0.4 s per frame at `?s=2`.

## Checking your work
Serve: `python tools/serve.py <port>` from this folder. Stills: `python tools/snap.py --port P --out <dir> s:s14 t:30.2
f:700 "q:test=1&set=LAKE&cam=0,2,40&at=0,8,0&fov=35&t=29=name:mytest" [--scale 2] [--sheet name]`. Open the JPGs with the
Read tool and judge them critically against this contract and the bible. Save your best stills to the production QA
folder (`qa/<dept>/latest/`, outside the repo). Write progress to the production STATUS file (append one line per
milestone, never rewrite others' lines).
