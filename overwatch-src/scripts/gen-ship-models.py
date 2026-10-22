#!/usr/bin/env python3
"""
Generate the low-poly vessel models in public/models/ships/ (Evenfall's own work, CC0).

Each model is a handful of boxes and tapered hull blocks with flat normals and
light grey materials (the map tints them per category at runtime). Conventions,
shared by every file so one scale and heading rule fits all:
  * glTF Y-up, bow toward +X, starboard toward +Z
  * 4000 units long (shipModelScale() scales to the AIS length)
  * origin at the waterline (y = 0); the hull reaches a little below it so the
    map's waterline clipping plane trims it cleanly
Run:  python3 scripts/gen-ship-models.py
"""
import json, struct, os

L = 4000.0

def box(x0, x1, y0, y1, z0, z1, taper_bow=0.0, bow_w=None):
    """Axis box; with taper_bow > 0 the last `taper_bow` of length narrows to a point (bow)."""
    if taper_bow <= 0:
        p = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
        quads = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]
        return [[p[i] for i in q] for q in quads]
    # hull: rectangular midbody + pointed bow (prism)
    xm = x1 - taper_bow
    zc = (z0 + z1) / 2
    bw = 0 if bow_w is None else bow_w
    faces = box(x0, xm, y0, y1, z0, z1)
    faces = [f for f in faces if not all(abs(v[0]-xm) < 1e-6 for v in f)]  # drop the inner bow-side face
    a, b, c, d = (xm,y0,z0), (xm,y1,z0), (xm,y1,z1), (xm,y0,z1)
    e, f = (x1,y0,zc-bw/2), (x1,y1,zc-bw/2)
    g, h = (x1,y0,zc+bw/2), (x1,y1,zc+bw/2)
    faces += [[a,e,f,b],[d,c,h,g],[b,f,h,c],[a,d,g,e]]
    if bw > 0: faces.append([e,g,h,f])
    return faces

def tri(a,b,c):
    return [[a,b,c]]

def normal(f):
    (ax,ay,az),(bx,by,bz),(cx,cy,cz) = f[0],f[1],f[2]
    ux,uy,uz = bx-ax,by-ay,bz-az; vx,vy,vz = cx-ax,cy-ay,cz-az
    nx,ny,nz = uy*vz-uz*vy, uz*vx-ux*vz, ux*vy-uy*vx
    n = (nx*nx+ny*ny+nz*nz) ** 0.5 or 1
    return (nx/n, ny/n, nz/n)

MATS = {"hull": (0.82,0.82,0.82,1), "deck": (0.95,0.95,0.95,1), "super": (1,1,1,1), "dark": (0.45,0.45,0.48,1), "sail": (1,1,1,1)}

def write(name, parts, subdir="ships"):
    """parts: list of (material, faces)."""
    bin_ = bytearray(); bviews=[]; accs=[]; prims=[]; mats=list(MATS); 
    by_mat = {}
    for m, faces in parts:
        # Wind every face outward from its part's centre (flat normals then light correctly).
        pts = [v for f in faces for v in f]
        cx, cy, cz = (sum(v[i] for v in pts) / len(pts) for i in range(3))
        fixed = []
        for f in faces:
            n = normal(f)
            fx, fy, fz = (sum(v[i] for v in f) / len(f) for i in range(3))
            if n[0]*(fx-cx) + n[1]*(fy-cy) + n[2]*(fz-cz) < 0: f = list(reversed(f))
            fixed.append(f)
        by_mat.setdefault(m, []).extend(fixed)
    for m, faces in by_mat.items():
        pos=[]; nor=[]
        for f in faces:
            n = normal(f)
            # double-sided not needed: faces are wound outward; fan-triangulate
            for i in range(1, len(f)-1):
                for v in (f[0], f[i], f[i+1]): pos.append(v); nor.append(n)
        for arr, kind in ((pos,"P"),(nor,"N")):
            off=len(bin_)
            for v in arr: bin_ += struct.pack("<3f", *v)
            bviews.append({"buffer":0,"byteOffset":off,"byteLength":len(arr)*12,"target":34962})
            acc={"bufferView":len(bviews)-1,"componentType":5126,"count":len(arr),"type":"VEC3"}
            if kind=="P":
                acc["min"]=[min(v[i] for v in arr) for i in range(3)]; acc["max"]=[max(v[i] for v in arr) for i in range(3)]
            accs.append(acc)
        prims.append({"attributes":{"POSITION":len(accs)-2,"NORMAL":len(accs)-1},"material":mats.index(m)})
    while len(bin_)%4: bin_ += b"\0"
    gltf={"asset":{"version":"2.0","generator":"Evenfall gen-ship-models.py","copyright":"Evenfall Advantage LLC, CC0 1.0"},
          "scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0,"name":name}],"meshes":[{"primitives":prims}],
          "materials":[{"name":k,"pbrMetallicRoughness":{"baseColorFactor":list(v),"metallicFactor":0,"roughnessFactor":0.9},"doubleSided":True} for k,v in MATS.items()],
          "accessors":accs,"bufferViews":bviews,"buffers":[{"byteLength":len(bin_)}]}
    j=json.dumps(gltf,separators=(",",":")).encode()
    while len(j)%4: j+=b" "
    out=struct.pack("<III",0x46546C67,2,12+8+len(j)+8+len(bin_))+struct.pack("<II",len(j),0x4E4F534A)+j+struct.pack("<II",len(bin_),0x004E4942)+bin_
    p=os.path.join(os.path.dirname(__file__),"..","public","models",subdir,name+".glb")
    open(p,"wb").write(out); print(name, len(out), "bytes")

def main():
    h = L/2  # x from -h (stern) to +h (bow)
    # Tanker: long low hull, flat deck with pipe run, aft accommodation block
    write("tanker", [
      ("hull", box(-h, h, -180, 160, -300, 300, taper_bow=500, bow_w=120)),
      ("dark", box(-h+700, h-700, 160, 200, -40, 40)),
      ("super", box(-h+80, -h+520, 160, 620, -230, 230)),
      ("dark", box(-h+200, -h+320, 620, 780, -50, 50)),
    ])
    # Passenger / cruise / ferry: tall stacked decks
    write("passenger", [
      ("hull", box(-h, h, -150, 260, -280, 280, taper_bow=700, bow_w=60)),
      ("super", box(-h+150, h-650, 260, 520, -250, 250)),
      ("super", box(-h+250, h-900, 520, 760, -230, 230)),
      ("deck", box(-h+400, h-1200, 760, 960, -200, 200)),
      ("dark", box(-h+900, -h+1250, 960, 1200, -90, 90)),
    ])
    # Fishing: short hull, forward wheelhouse, gantry and mast aft
    write("fishing", [
      ("hull", box(-h, h, -200, 320, -500, 500, taper_bow=900, bow_w=100)),
      ("super", box(h-1900, h-1100, 320, 900, -380, 380)),
      ("dark", box(-h+200, -h+320, 320, 1300, -480, -380)), ("dark", box(-h+200, -h+320, 320, 1300, 380, 480)),
      ("dark", box(-h+200, -h+320, 1200, 1300, -480, 480)),
      ("dark", box(h-1600, h-1500, 900, 1900, -40, 40)),
    ])
    # Tug / pilot / SAR: stubby wide hull, tall bridge forward of midships
    write("tug", [
      ("hull", box(-h, h, -250, 380, -800, 800, taper_bow=1200, bow_w=300)),
      ("super", box(-600, 600, 380, 900, -550, 550)),
      ("deck", box(-450, 450, 900, 1300, -450, 450)),
      ("dark", box(-200, 0, 1300, 1700, -100, 100)),
    ])
    # Pleasure / sailing: slim hull, mast and triangular sail
    write("sailing", [
      ("hull", box(-h, h, -150, 220, -500, 500, taper_bow=1400, bow_w=0)),
      ("deck", box(-h+600, 200, 220, 450, -300, 300)),
      ("dark", box(300, 420, 220, 5200, -40, 40)),
      ("sail", tri((420,350,0),(420,5100,0),(-h+500,350,0)) + tri((420,350,0),(-h+500,350,0),(420,5100,0))),
      ("sail", tri((300,350,0),(h-150,300,0),(300,4600,0)) + tri((300,350,0),(300,4600,0),(h-150,300,0))),
    ])
    # High-speed craft: twin slim hulls (catamaran) and a low sleek cabin
    write("highspeed", [
      ("hull", box(-h, h, -120, 220, -650, -350, taper_bow=900, bow_w=0)),
      ("hull", box(-h, h, -120, 220, 350, 650, taper_bow=900, bow_w=0)),
      ("deck", box(-h+150, h-700, 220, 330, -650, 650)),
      ("super", box(-h+600, h-1300, 330, 640, -520, 520)),
    ])
    # Military / law enforcement: angular hull, stepped mid superstructure, mast, forward gun
    write("military", [
      ("hull", box(-h, h, -200, 260, -330, 330, taper_bow=1200, bow_w=0)),
      ("dark", box(-900, 500, 260, 700, -260, 260)),
      ("dark", box(-600, 200, 700, 1000, -200, 200)),
      ("dark", box(-300, -150, 1000, 1700, -40, 40)),
      ("dark", box(900, 1100, 260, 380, -80, 80)), ("dark", box(1100, 1500, 300, 340, -20, 20)),
    ])
    # Other / unknown: generic small hull with a cabin
    write("generic", [
      ("hull", box(-h, h, -200, 300, -550, 550, taper_bow=1100, bow_w=150)),
      ("super", box(-h+700, 200, 300, 800, -400, 400)),
    ])


if __name__ == "__main__":
    main()
