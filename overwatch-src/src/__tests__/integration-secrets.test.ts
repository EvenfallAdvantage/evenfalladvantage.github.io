import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import * as app from "@/lib/integration-secrets";
import * as shared from "../../../supabase/functions/_shared/integration-secret-keys";

const root = path.resolve(__dirname, "../../..");

describe("integration secret rules", () => {
  it("app copy matches the Edge Function module", () => {
    expect(app.SECRET_KEYS).toEqual(shared.SECRET_KEYS);
  });
  it("SQL migrations use the same key list", () => {
    const list = `ARRAY[${shared.SECRET_KEYS.map((k) => `'${k}'`).join(",")}]`;
    for (const f of ["20261007190000_integrations_config_secrets_to_vault.sql", "20261007190500_integrations_config_lockdown.sql"]) {
      const sql = readFileSync(path.join(root, "overwatch-src/supabase/migrations", f), "utf8");
      expect(sql).toContain(list);
    }
  });
  it("splits and redacts", () => {
    const { publicConfig, secrets } = app.splitConfig({ api_key: " pat123 ", base_id: "app1", table_name: "Staff", access_token: "", secret_keys_set: ["x"] as unknown as string });
    expect(secrets).toEqual({ api_key: "pat123" });
    expect(publicConfig).toEqual({ base_id: "app1", table_name: "Staff" });
    expect(app.redactConfig({ api_key: "x", base_id: "y" })).toEqual({ base_id: "y" });
  });
});
