# FX + UTSUSHI (dept FX)

Files: `src/fx.js` (API, pools, film defaults), `src/fx_mats.js` (drawn FX shaders), `src/fx_kaleido.js` (s31 kaleidoscope), `src/giant.js` (UTSUSHI).
All FX are bold drawn cels (shape drawn in the fragment shader, hard tones, white cores, coloured edges, bloom through the
emissive alpha), never soft particles. Effects redraw ON THREES (`A.onThrees`): every 1/8 s a new drawing.

## How to call FX (immediate mode)
`fx.update(st)` clears last frame's requests and, while `fx.auto` is true, adds the film defaults (table below). Any
department (direction runs last) can add more by calling the API in its update / ACT for that frame. Requests are evaluated
right before the frame renders, so anchors (ronin blades, feet, giant parts) are read after direction posed everything.
Positions may be `Vector3`, `[x, y, z]` or a function returning a `Vector3` (evaluated at render time). `t0`/`t1` are film
seconds; an effect exists only while `0 <= t - t0 < life`.

| call | what |
|---|---|
| `rain(set, amount = 1, {box, len, dir, splashes, n, tint})` | rain streaks around the camera on threes + crown splashes/rings on the street. amount 0 = none |
| `snow(amount = 1, {box, size, wind:[x,z], n})` | snow flakes around the camera (box scales with camera height) |
| `breath(at, t0, {dir, size, life})` | vapour puffs from a point (cheek vents) |
| `puff(at, t0, {dir, size, life, n, spread, kind:'spray'})` | drawn cloud puffs (snow burst, steam, mist) that dissolve |
| `drop(from, t0, t1, {size, hang})` | the raindrop: a round cel drop (highlight, gold crescent, dark rim) that hangs, then falls on twos with a short motion streak to y=0 at t1; ring + crown at t1 |
| `ring(at, t0, {speed, life, width, r0, y})` | drawn ring on the water (pair with `lake.ripple` for the reflection wobble) |
| `splash(at, t0, size, {tint, n, life})` | crown splash + droplets + ring (puddles: `tint:'#ff4fa3'` catches the neon) |
| `kick(at, t0, dir, size)` | running-foot splash: crown curtain of water (open toward the run), spiky rim with beads + white lip, drips, ring. On threes |
| `wall(path[], t0, {height, life})` | wall of water along a ground path: 4 layered TRANSPARENT sheets (far / main / mist veil / near, near = camera side), glass shards glinting inside, droplets, soft spray-mist puffs |
| `slash(kind, from, to, t0, {color, outer, width, life, bulge, side, bright})` | slash arc: white core, coloured edge, dark outer; breaks into dashes as it ages. `kind` 'arc' or 'line' |
| `xcut(k, {centre, size, extend, normal, width})` | the X (red + cyan strokes). k 0..1 (draws in during the first 0.12). `extend` 0..1 grows it kilometres into the sky |
| `sparks(at, t0, {dir, n, speed, life, spread, flash, width})` | spark streaks + star flash |
| `aura(on, k, {from, to, height, n})` | red-gold flame tongues along a blade (default Sumi bladeBase -> bladeTip) |
| `embers(k, {from, to, n, size})` | embers rising off the scarf (default Sumi chest -> scarfTip) |
| `pour(k, {anchors, width, n})` | water curtains off the giant (shoulders, arms, crest, sword) + falling glass |
| `shardSnow(k, {centre, radius, height, n, size, t0})` | millions-of-shards snow: instanced mirror shards + flickering star glints |
| `sparkles(at, t0, {n, radius, size, life})` | sheathe sparkles: a few small crisp 4-point stars mixed with tiny dots |
| `kaleido(k, {centre, yaw})` | s31: ~26 floating mirror shards in a corridor (default centre (0, 64, 150), along +x), each showing Sumi LIVE from one of 4 orbit cameras (render-to-texture) |
| `kaleidoCam(lt, dur, {centre, yaw})` | the gliding camera through that corridor -> `{pos, look, fov, roll}` (use it as `CAMS.s31`) |
| `glint(at, t0, {size, life, layer:2})` | one 4-point glint; `layer:2` = reflection only (omen eyes) |
| `speedLines(k, {centre:[u,v], mode:'radial'|'parallel', dir:[x,y], color})` | sets `st.look.speed` (call from update before post) |
| `impact(1 \| 2)` | sets `st.look.impact` for this frame |
| `mute(name)` / `unmute(name)` / `auto` | switch film defaults off one by one or all |

## Film defaults (`fx.auto`, names for `mute`)
rain (all CITY, s11 lighter; small crowns, `o.crown` scales them) · snow (PASS) · sumiStep (s02 puddle splash at Sumi's lower foot) · breath (s04/s05/s07, Yuki
eye anchor) · yukiLeap (s10 snow burst) · touchdown (s12 ring + splash) · guardClick (s15 steel glint) · drop (s18/s19
from Sumi scarfTip, dropFall -> dropHit) · charge (s22 kick sheets at both ronin's feet every 0.25 s + radial speed lines)
· pass (s23 red + cyan slashes, sparks, impact 1 then 2) · pour (s26-s27) · swing (s27 wall along an arc in front of the
giant + speed lines) · runArm (s28 sparks at Yuki's feet + parallel speed lines) · aura (60.5 -> 69.6) + embers (to 66.5) ·
faceCut (s30 two cyan slashes at the giant's head, sparks, impact) · leap (s32 speed lines) · xcut (cross 68.4, extend from
split 70.75, impact 1,1,2) · shardSnow (shatter 73 -> click 79.4) · click (s38 sparkles at scabbard + chest) · calmLake (52.3 -> 76.2: scales LANDS' crack uniform w down to 0.15 so the mirror stays calm and the giant's reflection reads; back to full for the heal) · giantRipples (rings + `lake.ripple` at the giant's feet every 0.9 s while it stands) · kaleido + kaleidoCam (s31; the camera only when `DIRECTION.CAMS.s31` is not defined).
LANDS owns the lake cracks + mercury heal (`lake.crack/heal`), the omen eye crack on the ice (`pass.ice.eye`) and the sky
split (`sky.split`); FX adds glints/sparks on top where asked.

## UTSUSHI (`ctx.api.giant`, src/giant.js)
Irregular mirror plates (grid cells merged into big plates on chest / shoulders / thighs, small shards at the joints;
CPU-skinned, one draw call, fan per shard) over dark cores, 200 m: faceted kabuto with a hard brow, crescent maedate (Sumi)
+ two swept blades (Yuki), fukigaeshi, dark visor holding two white-sun eyes, heavy pauldrons + 3-row sode, 6 kusazuri,
175 m saw-toothed shard great-sword. Shard colour = a designed sunset sky picked by the reflected ray (gold / peach / pink /
lilac / pale blue), sun-catchers blaze white-gold, only down / edge / screen-right facets cool violet, crisp white glint
strokes on big plates, thin dark gaps, warm haze over the upper body (`haze(k)`). Reflect mode: scale 1.35 (pose.scale),
saturated, eyes brightest, soft dark aura behind it in the reflected sky (`aura(k)`); never breaks the surface. `pose(name | {rise, x, z, yaw, lie, head, chest, armL, armR, wristR, sword, reel})`, `reflectOnly(bool)`
(layer 2, the geometry is mirrored above the lake so the reflection shows it under the surface; lying face-up by
default), `eyes(k)`, `crackFace(k)`, `xCut(k)`, `shatter(k)`, `anchor(name)` (eyeL eyeR head headC chest chestC swordTip
swordBase handR handL shoulderL/R elbowL/R forearmL/R footL/R crest), `auto` (film choreography from CUES, on twos),
`sun(dir)`. Poses: stand emerge push windup swing follow reach reel lie.
Test: `q:test=1&set=LAKE&giant=1&gpose=windup&grise=1&gcrack=0.5&gx=0.4&gshatter=0&geyes=1&greflect=1&glie=1&gz=0&gscale=1.35&gaura=.75&ghaze=.42`;
`&gauto=1` runs the film choreography in a test view (any camera). FX demos: `fxdemo=kick|wall|drop|sparkles|kaleido(&kcam=1&lt=1)`.

## Notes for direction
- s19-s21 (giant in the mirror): auto puts the face under (0, -70), body toward +z, rise .86 by s19, then s21 rises to .97
  and grows to scale 1.9 (fills the lake). Tested framings: s19 cam (0, 62, 32) -> (0, 0, -10) fov 50 with the ronin at
  (+-14, 0) (face beyond them, chest under their feet); s21 cam (0, 280, 120) -> (0, 0, 40) fov 60. Keep fog low there.
- s31: pose Sumi in a charge (`dash`) during 64-66; the shards show him live. Use `fx.kaleidoCam` for CAMS.s31 or let FX auto set it.
- s08 omen: the white eyes are the ronin reflection twin (`twin.eyes(2, '#ffffff')`) + `fx.glint(eyePos, t0, {layer: 2})`.
- Real-mode giant defaults to root (0, -, -90) facing +z; move it with `giant.pose({x, z, yaw})` and the pour / wall FX follow.
- Budget: stills at ?s=2 measured 45-420 ms (first use of each set compiles shaders; steady state < 100 ms for FX).
