import { describe, it, expect } from "vitest";
import { readdirSync } from "fs";
import { join } from "path";

const dir = join(__dirname, "../../supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));

describe("migration file names", () => {
  it("are <14-digit version>_<name>.sql with unique versions and names", () => {
    const versions = new Set<string>(); const names = new Set<string>();
    for (const f of files) {
      const m = /^(\d{14})_([a-z0-9_]+)\.sql$/.exec(f);
      expect(m, f).not.toBeNull();
      expect(versions.has(m![1]), `duplicate version ${m![1]}`).toBe(false);
      expect(names.has(m![2]), `duplicate name ${m![2]}`).toBe(false);
      versions.add(m![1]); names.add(m![2]);
    }
  });
  it("every rollback file matches a migration", () => {
    const eadb = readdirSync(join(dir, "eadb")).filter((f) => f.endsWith(".sql"));
    const rb = readdirSync(join(dir, "rollback")).filter((f) => f.endsWith(".rollback.sql"));
    for (const f of rb) expect([...files, ...eadb], f).toContain(f.replace(".rollback.sql", ".sql"));
  });
});
