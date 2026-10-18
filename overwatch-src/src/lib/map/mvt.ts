/**
 * Minimal Mapbox Vector Tile (MVT 2.x) decoder: just enough to read one
 * layer's polygons and properties (used for the OSM 3D buildings layer).
 * Spec: https://github.com/mapbox/vector-tile-spec/tree/master/2.1
 * No dependencies; works in the browser and in Node/vitest.
 */

export type MvtValue = string | number | boolean;

export interface MvtFeature {
  id?: number;
  /** 1 point, 2 line, 3 polygon. */
  type: number;
  properties: Record<string, MvtValue>;
  /** Rings (polygons) or lines, in tile coordinates [x, y] (0..extent, y down). */
  geometry: Array<Array<[number, number]>>;
}

export interface MvtLayer {
  name: string;
  extent: number;
  features: MvtFeature[];
}

class Reader {
  pos = 0;
  constructor(readonly buf: Uint8Array) {}
  get eof() { return this.pos >= this.buf.length; }
  varint(): number {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (this.pos >= this.buf.length) throw new Error("MVT: truncated varint");
      b = this.buf[this.pos++];
      // Avoid 32-bit overflow of << for large varints (ids can exceed 2^31).
      result += (b & 0x7f) * Math.pow(2, shift);
      shift += 7;
    } while (b & 0x80 && shift < 70);
    return result;
  }
  svarint(): number {
    const n = this.varint();
    return n % 2 === 1 ? (n + 1) / -2 : n / 2;
  }
  bytes(): Uint8Array {
    const len = this.varint();
    const end = this.pos + len;
    if (end > this.buf.length) throw new Error("MVT: truncated field");
    const out = this.buf.subarray(this.pos, end);
    this.pos = end;
    return out;
  }
  skip(wire: number) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) this.pos += this.varint();
    else if (wire === 5) this.pos += 4;
    else throw new Error(`MVT: unsupported wire type ${wire}`);
  }
}

const utf8 = new TextDecoder();

function readValue(buf: Uint8Array): MvtValue | undefined {
  const r = new Reader(buf);
  let v: MvtValue | undefined;
  while (!r.eof) {
    const tag = r.varint();
    const field = tag >> 3;
    const wire = tag & 7;
    if (field === 1 && wire === 2) v = utf8.decode(r.bytes());
    else if (field === 2 && wire === 5) { v = new DataView(buf.buffer, buf.byteOffset + r.pos, 4).getFloat32(0, true); r.pos += 4; }
    else if (field === 3 && wire === 1) { v = new DataView(buf.buffer, buf.byteOffset + r.pos, 8).getFloat64(0, true); r.pos += 8; }
    else if ((field === 4 || field === 5) && wire === 0) v = r.varint();
    else if (field === 6 && wire === 0) v = r.svarint();
    else if (field === 7 && wire === 0) v = r.varint() !== 0;
    else r.skip(wire);
  }
  return v;
}

function packed(buf: Uint8Array): number[] {
  const r = new Reader(buf);
  const out: number[] = [];
  while (!r.eof) out.push(r.varint());
  return out;
}

/** Decode geometry commands into rings/lines (polygon rings closed implicitly, not repeated). */
export function decodeGeometry(cmds: number[]): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = [];
  let x = 0;
  let y = 0;
  let i = 0;
  let ring: Array<[number, number]> | null = null;
  while (i < cmds.length) {
    const c = cmds[i++];
    const id = c & 7;
    const count = c >> 3;
    if (id === 1 || id === 2) {
      for (let k = 0; k < count && i + 1 < cmds.length; k++) {
        const dx = cmds[i++];
        const dy = cmds[i++];
        x += (dx >> 1) ^ -(dx & 1);
        y += (dy >> 1) ^ -(dy & 1);
        if (id === 1) {
          ring = [];
          out.push(ring);
        }
        ring?.push([x, y]);
      }
    } else if (id === 7) {
      // ClosePath: rings are treated as closed; nothing to add.
    } else {
      throw new Error(`MVT: bad geometry command ${id}`);
    }
  }
  return out;
}

interface RawFeature { id?: number; type: number; tags: number[]; geom: number[] }

/**
 * Decode one named layer. Returns null if the tile doesn't contain it.
 * `filter` lets callers drop features by properties before geometry decoding.
 */
export function decodeMvtLayer(
  data: Uint8Array,
  layerName: string,
  filter?: (props: Record<string, MvtValue>, type: number) => boolean,
): MvtLayer | null {
  const tile = new Reader(data);
  while (!tile.eof) {
    const tag = tile.varint();
    if (tag >> 3 !== 3 || (tag & 7) !== 2) { tile.skip(tag & 7); continue; }
    const layerBuf = tile.bytes();
    const lr = new Reader(layerBuf);
    let name = "";
    let extent = 4096;
    const keys: string[] = [];
    const values: Array<MvtValue | undefined> = [];
    const raw: RawFeature[] = [];
    while (!lr.eof) {
      const t = lr.varint();
      const field = t >> 3;
      const wire = t & 7;
      if (field === 1 && wire === 2) {
        name = utf8.decode(lr.bytes());
        if (name !== layerName) break;
      } else if (field === 2 && wire === 2) {
        const fr = new Reader(lr.bytes());
        const f: RawFeature = { type: 0, tags: [], geom: [] };
        while (!fr.eof) {
          const ft = fr.varint();
          const ff = ft >> 3;
          const fw = ft & 7;
          if (ff === 1 && fw === 0) f.id = fr.varint();
          else if (ff === 2 && fw === 2) f.tags = packed(fr.bytes());
          else if (ff === 3 && fw === 0) f.type = fr.varint();
          else if (ff === 4 && fw === 2) f.geom = packed(fr.bytes());
          else fr.skip(fw);
        }
        raw.push(f);
      } else if (field === 3 && wire === 2) keys.push(utf8.decode(lr.bytes()));
      else if (field === 4 && wire === 2) values.push(readValue(lr.bytes()));
      else if (field === 5 && wire === 0) extent = lr.varint();
      else lr.skip(wire);
    }
    if (name !== layerName) continue;
    const features: MvtFeature[] = [];
    for (const f of raw) {
      const properties: Record<string, MvtValue> = {};
      for (let i = 0; i + 1 < f.tags.length; i += 2) {
        const k = keys[f.tags[i]];
        const v = values[f.tags[i + 1]];
        if (k !== undefined && v !== undefined) properties[k] = v;
      }
      if (filter && !filter(properties, f.type)) continue;
      features.push({ id: f.id, type: f.type, properties, geometry: decodeGeometry(f.geom) });
    }
    return { name, extent, features };
  }
  return null;
}
