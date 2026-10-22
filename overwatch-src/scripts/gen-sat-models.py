#!/usr/bin/env python3
"""
Generate the low-poly satellite models in public/models/sats/ (Evenfall's own work, CC0).
Same writer as the ships (scripts/gen-ship-models.py). Conventions:
  * glTF Y-up; +X = direction of flight, +Y = away from Earth (radial), Z = across track
  * real-world metres (the map's minimumPixelSize keeps them visible from afar)
  * origin at the centre of the bus
Run:  python3 scripts/gen-sat-models.py
"""
import importlib.util, os
spec = importlib.util.spec_from_file_location("gsm", os.path.join(os.path.dirname(__file__), "gen-ship-models.py"))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
box, write = g.box, g.write
g.MATS.update({"panel": (0.55, 0.6, 0.75, 1), "gold": (0.95, 0.85, 0.55, 1)})

def B(cx, cy, cz, sx, sy, sz):
    return box(cx - sx/2, cx + sx/2, cy - sy/2, cy + sy/2, cz - sz/2, cz + sz/2)

# Comms / generic bus: box bus, two long solar wings across track, Earth-facing dish
write("comms", [
  ("gold", B(0, 0, 0, 3, 3, 3)),
  ("panel", B(0, 0, 9.5, 2.4, 0.1, 15)), ("panel", B(0, 0, -9.5, 2.4, 0.1, 15)),
  ("dark", B(0, 0, 2.2, 0.3, 0.3, 1.4)), ("dark", B(0, 0, -2.2, 0.3, 0.3, 1.4)),
  ("super", B(0, -2.0, 0, 2.2, 0.4, 2.2)), ("dark", B(0, -2.6, 0, 0.3, 0.8, 0.3)),
], "sats")
# Space station: long truss across track, eight big arrays, pressurised modules along track
parts = [("dark", B(0, 0, 0, 2, 2, 100))]
for z in (-44, -30, 30, 44):
    parts.append(("panel", B(0, 0, z, 34, 0.2, 12)))
parts += [("super", B(0, 0, 0, 50, 4.5, 4.5)), ("super", B(-30, 0, 0, 10, 4, 4)), ("super", B(0, -6, 0, 4, 8, 4)),
          ("deck", B(8, 0, 8, 6, 4, 6)), ("gold", B(0, 4, 18, 8, 1, 8))]
write("station", parts, "sats")
# CubeSat (3U): small box, two deployable panels
write("cubesat", [
  ("gold", B(0, 0, 0, 0.34, 0.1, 0.1)),
  ("panel", B(0, 0, 0.2, 0.34, 0.01, 0.3)), ("panel", B(0, 0, -0.2, 0.34, 0.01, 0.3)),
  ("dark", B(0.2, 0, 0, 0.06, 0.02, 0.02)),
], "sats")
# GPS / navigation: tall bus, two wings, Earth-facing antenna array (flat square panel of elements)
parts = [("gold", B(0, 0, 0, 2, 2.4, 2)), ("panel", B(0, 0, 6, 1.8, 0.1, 9)), ("panel", B(0, 0, -6, 1.8, 0.1, 9)),
         ("dark", B(0, 0, 1.4, 0.2, 0.2, 0.8)), ("dark", B(0, 0, -1.4, 0.2, 0.2, 0.8)), ("super", B(0, -1.35, 0, 1.6, 0.3, 1.6))]
for x in (-0.5, 0, 0.5):
    for z in (-0.5, 0, 0.5):
        parts.append(("dark", B(x, -1.75, z, 0.18, 0.5, 0.18)))
write("gps", parts, "sats")
