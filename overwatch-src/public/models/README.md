# 3D contact models — attribution

These model files are third-party visual assets. They are **not** covered by
the repository's code licence; each remains under the licence listed below
(all [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), which permits
commercial use with credit, a licence link, and a note of changes).

They were taken from the gods-eye-view project
(https://github.com/bilawalsidhu/gods-eye-view, `public/models/`), which had
already modified the originals as described in the "Modifications" column.

**Overwatch modifications:** none to the files themselves (byte-identical to
gods-eye-view's copies). At runtime Overwatch rotates them by 180° to match
Cesium headings, tints them (colour blend 35 %) and adds a thin cyan outline.
The map's footer credit links to this attribution.

Shown only on desktop, for aircraft and ships near the camera and the tracked aircraft.
Loaded lazily on first use; never on phones.

| File | Used for | Original work and creator | Source | Licence | Modifications (by gods-eye-view) |
|---|---|---|---|---|---|
| `airplane.glb` | Airliners, wide-bodies, four-engine jets, gliders without a better match | “boeing 747” by [zairiq-123](https://sketchfab.com/zairiq-123) | [Sketchfab model](https://sketchfab.com/3d-models/boeing-747-9b16672038ba48f98e6d80a159044ed9) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Substantially modified and optimized for God's Eye View, including geometry/material simplification and coordinate/orientation preparation. The former 24× runtime calibration is baked into the mesh; location, rotation, and scale are applied; the bounding-box centre is at the origin; and the model uses glTF +Y-up with its nose toward local −X. Geometry remains uncompressed so the aircraft asset does not compete with photogrammetry for Draco worker capacity. |
| `jet.glb` | Fast jets and UAVs | “Private Jet” by [Nick the Name](https://sketchfab.com/Nick_The_Name) | [Sketchfab model](https://sketchfab.com/3d-models/private-jet-cbdd1de6ced9461e950eafaa302cc82b) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Repackaged as a glTF binary for the project's military-flight visualization. Imported hierarchy transforms are baked into the meshes; location, rotation, and scale are applied; the bounding-box centre is at the origin; and the model uses meter scale, glTF +Y-up, and the shared nose −X convention. Existing materials are preserved. |
| `bell206.glb` | Helicopters | “Bell 206 JetRanger” by [terran4627](https://sketchfab.com/terran4627) | [Sketchfab model](https://sketchfab.com/3d-models/bell-206-jetranger-d2f7ba1d671549d4b26aaf834139a1dd) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Optimized for God's Eye View: geometry/material simplification, textures resized to 256 px WebP, orientation/scale vertex-baked to real-world meters (Y-up, nose −X), origin centered. |
| `c172.glb` | Light aircraft and gliders | “Cessna 172” by [e737](https://sketchfab.com/e0057537) | [Sketchfab model](https://sketchfab.com/3d-models/cessna-172-64cddaee5aff470682659a8c08525046) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Optimized for God's Eye View: geometry/material simplification, textures resized to 256 px WebP, orientation/scale vertex-baked to real-world meters (Y-up, nose −X), origin centered. |
| `citation2.glb` | Business jets | “1990 Cessna Citation, Texture Detailed, Exterior” by [BlenderCommunityHead](https://sketchfab.com/aboodgoudagad) | [Sketchfab model](https://sketchfab.com/3d-models/1990-cessna-citation-texture-detailed-exterior-a78839624fe64900a8352cb23462350a) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Optimized for God's Eye View: geometry/material simplification, textures resized to 256 px WebP, orientation/scale vertex-baked to real-world meters (Y-up, nose −X), origin centered. |
| `atr72.glb` | Turboprops | “ATR 72 - 600” by [Oyan3D](https://sketchfab.com/oyan3D) | [Sketchfab model](https://sketchfab.com/3d-models/atr-72-600-1e1a7186f7444d288675262fcee44744) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Optimized for God's Eye View: geometry/material simplification, textures removed with dominant material colors baked into PBR factors (flat “abstracted” style), orientation/scale vertex-baked to real-world meters (Y-up, nose −X), origin centered. |
| `ship.glb` | Cargo vessels (desktop, near the camera) | “Low Poly Cargo Ship” by [Javier_Fernandez](https://sketchfab.com/Javier.Fernandez) | [Sketchfab model](https://sketchfab.com/3d-models/low-poly-cargo-ship-4c22cbaf01c1427f8ab60b3a07b1b32c) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Optimized and repackaged as a glTF binary for gods-eye-view's vessel visualization. **Modified by Evenfall (2026-10-20):** added a root node translated +380 units so the origin is the waterline (`scripts/ship-glb-waterline.py`); geometry unchanged. |

These credits do not imply endorsement by the original creators.

## Evenfall's own vessel models (`ships/`)

`ships/tanker.glb`, `passenger.glb`, `fishing.glb`, `tug.glb`, `sailing.glb`,
`highspeed.glb`, `military.glb` and `generic.glb` are low-poly shapes generated by
`scripts/gen-ship-models.py` (Evenfall Advantage LLC, released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/); no third-party
content, no credit required). 4–8 KB each; bow +X, 4000 units long, origin at the
waterline. The map tints every model (aircraft and vessels) with its category colour.
