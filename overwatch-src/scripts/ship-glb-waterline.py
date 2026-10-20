#!/usr/bin/env python3
"""Re-root public/models/ship.glb so the model origin sits on the waterline.

The Sketchfab export has its origin at the centre of the bounding box (keel at
y = -655, main deck at ~y = -131 glTF units), so CLAMP_TO_GROUND put the deck
under the sea. This adds a parent node translated +WATERLINE_UP so that
y = -380 (≈ 10 m draft on a 150 m hull, full beam reached just below) becomes
y = 0. Idempotent: does nothing if the waterline node already exists.
"""
import json, struct, sys
WATERLINE_UP = 380.0
NODE = "overwatch_waterline"
path = sys.argv[1] if len(sys.argv) > 1 else "public/models/ship.glb"
b = bytearray(open(path, "rb").read())
magic, ver, _ = struct.unpack_from("<4sII", b, 0)
assert magic == b"glTF" and ver == 2
jlen, jtype = struct.unpack_from("<I4s", b, 12)
assert jtype == b"JSON"
j = json.loads(b[20:20 + jlen])
rest = bytes(b[20 + jlen:])
if any(n.get("name") == NODE for n in j["nodes"]):
    print("already re-rooted"); sys.exit(0)
scene = j["scenes"][j.get("scene", 0)]
j["nodes"].append({"name": NODE, "translation": [0.0, WATERLINE_UP, 0.0], "children": scene["nodes"]})
scene["nodes"] = [len(j["nodes"]) - 1]
js = json.dumps(j, separators=(",", ":")).encode()
js += b" " * ((4 - len(js) % 4) % 4)
out = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + len(rest)) + struct.pack("<I4s", len(js), b"JSON") + js + rest
open(path, "wb").write(out)
print("re-rooted", path, len(out), "bytes")
