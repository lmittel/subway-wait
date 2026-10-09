# Longer Than Average: design plan

Subject: the inspection paradox (size-biased sampling, residual waiting time) on real NYC subway arrivals.
Audience: undergrads; must survive a stochastic-processes professor.

## Tokens
- tile #EEF0EC (page, cool subway-tile white)   dark: tunnel #101215
- ink #1B1E21, ink-2 #4A5258, muted #7E868C
- enamel #151617 (station sign bands, white text)
- edge #F2B705 (platform-edge yellow)  -> RIDERS' view (size-biased), drawn with the tactile-dot texture
- led #FF7A1A (countdown amber)        -> YOUR WAIT, drawn with an LED dot texture
- steel #56616B / route colour         -> TRAINS' view (plain gaps)
- route colours from MTA GTFS routes.txt (data only)

## Type
Archivo variable (width 62-125, weight 100-900): condensed heavy for station signs, normal for body.
STIX Two Math (embedded subset) for formulas via the TeX->MathML converter.

## Layout
- Page = a subway line. Left rail (desktop) is a strip map: express stops = white circles (core path),
  local stops = black dots (detours). Current stop lights up. "Express / Local" switch hides detours.
- Sticky destination sign at top: [bullet] direction · station · time window -> opens the line picker.
- Hero: dark tunnel band, Marey train graph of every train that morning, yellow line = your platform,
  guess-then-reveal.
- Each stop: black station-sign band, one sentence, one big interactive, a live note.

## Principles
1. Real data unless labelled toy. 2. Three textures = three distributions, everywhere.
3. One global line selection rides along. 4. Motion answers actions (hero draw-in is the one exception).
