import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { clockInFlag } from "@/lib/supabase/db-timesheets";
import { cleanSpeakerName, renameSpeaker, speakerLabel, toCanonicalLabels, turnsToNamedText } from "@/lib/speech/speaker-names";
import { parseInlineTranscript } from "@/lib/speech/diarize-align";
import { normalizeMutes, MUTE_OPTIONS } from "@/lib/supabase/db-notification-mutes";
import { MUTABLE_CATEGORIES, muteCategory, parseNotifyRequest, systemChannels, unmutedRecipientIds } from "../../../supabase/functions/notify-send/rules";

const CO = "0f03bc15-0000-4000-8000-000000000001";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const MIG = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20261021150000_alert_delivery_mutes_escalation.sql"), "utf8");
const RB = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/rollback/20261021150000_alert_delivery_mutes_escalation.rollback.sql"), "utf8");

describe("#142 late/early clock-in flag", () => {
  it("flags notes written by the clock-in modal", () => {
    expect(clockInFlag("Late clock-in: shift ended yesterday 10:00 PM")).toBe("late");
    expect(clockInFlag("Early clock-in: shift starts tomorrow 6:00 AM")).toBe("early");
    expect(clockInFlag("Working on payroll")).toBeNull();
    expect(clockInFlag(null)).toBeNull();
  });
});

describe("#144 alert mutes", () => {
  it("maps dispatch types to mutable categories; safety alerts are never muted", () => {
    expect(muteCategory("dm")).toBe("dm");
    expect(muteCategory("shift_swap")).toBe("swap");
    expect(muteCategory(undefined, "swap")).toBe("swap");
    expect(muteCategory("task")).toBe("task");
    expect(muteCategory("shift_reminder")).toBe("schedule");
    expect(muteCategory("guard_card")).toBe("guard_card");
    expect(muteCategory("panic_alert")).toBeNull();
    expect(muteCategory("patrol_overdue")).toBeNull();
    expect(muteCategory("patrol_overdue_escalation")).toBeNull();
  });
  it("drops only recipients who muted the category", () => {
    expect(unmutedRecipientIds([U1, U2], "dm", { [U1]: ["dm"] })).toEqual([U2]);
    expect(unmutedRecipientIds([U1, U2], null, { [U1]: ["dm"] })).toEqual([U1, U2]);
  });
  it("parses an optional type", () => {
    expect(parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["push"], user_ids: [U1], title: "t", type: "dm" })).toMatchObject({ type: "dm" });
    expect(parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["push"], user_ids: [U1], title: "t", type: "DROP TABLE" })).toMatch(/type/);
  });
  it("client options, server categories and the DB CHECK agree", () => {
    expect(MUTE_OPTIONS.map((o) => o.key).sort()).toEqual([...MUTABLE_CATEGORIES].sort());
    for (const c of MUTABLE_CATEGORIES) expect(MIG).toContain(`'${c}'`);
    expect(normalizeMutes(["dm", "bogus", "dm", 3])).toEqual(["dm"]);
  });
});

describe("#143/#145 system delivery channels", () => {
  it("guard cards go by push + email; patrol alerts by push", () => {
    expect(systemChannels("guard_card")).toEqual(["push", "email"]);
    expect(systemChannels("patrol_overdue")).toEqual(["push"]);
    expect(systemChannels("patrol_overdue_escalation")).toEqual(["push"]);
    expect(systemChannels("dm")).toEqual([]);
  });
});

describe("migration 20261021150000", () => {
  it("follows the grant rule for the new table", () => {
    expect(MIG).toMatch(/ALTER TABLE public\.notification_mutes ENABLE ROW LEVEL SECURITY/);
    expect(MIG).toMatch(/GRANT SELECT ON TABLE public\.notification_mutes TO anon;/);
    expect(MIG).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.notification_mutes TO authenticated, service_role;/);
    expect(MIG).toMatch(/REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public\.notification_mutes FROM anon, authenticated;/);
  });
  it("keeps the 10-minute grace and escalates after 5 more minutes", () => {
    expect(MIG).toMatch(/frequency_min \+ 10/);
    expect(MIG).toMatch(/interval '5 minutes'/);
    expect(MIG).toMatch(/'\*\/5 \* \* \* \*'/);
  });
  it("service-role-only functions", () => {
    for (const f of ["claim_system_notifications(integer)", "kick_notify_system()", "guard_card_expiry_reminders()", "patrol_overdue_alerts()"]) {
      expect(MIG).toContain(`REVOKE ALL ON FUNCTION public.${f} FROM PUBLIC, anon, authenticated;`);
    }
  });
  it("rollback restores the old schedule and drops new objects", () => {
    expect(RB).toMatch(/'\*\/10 \* \* \* \*'/);
    expect(RB).toMatch(/DROP TABLE IF EXISTS public\.notification_mutes/);
    expect(RB).toMatch(/DROP COLUMN IF EXISTS delivered_at/);
    expect(RB).toMatch(/'compliance'/);
  });
});

describe("dictation speaker names", () => {
  const turns = [{ speaker: "0", text: "Hello", start: 0, end: 1 }, { speaker: "1", text: "Hi", start: 1, end: 2 }, { speaker: "0", text: "Bye", start: 2, end: 3 }];
  it("defaults to Speaker 1 / Speaker 2", () => {
    expect(turnsToNamedText(turns, {})).toBe("[Speaker 1] Hello\n[Speaker 2] Hi\n[Speaker 1] Bye");
  });
  it("a rename applies across the transcript and round-trips to turns", () => {
    const names = renameSpeaker({}, "0", "Officer Lee");
    const text = turnsToNamedText(turns, names);
    expect(text).toBe("[Officer Lee] Hello\n[Speaker 2] Hi\n[Officer Lee] Bye");
    const back = parseInlineTranscript(toCanonicalLabels(text, names));
    expect(back.map((t) => t.speaker)).toEqual(["0", "1", "0"]);
    expect(speakerLabel("1", names)).toBe("Speaker 2");
  });
  it("cleans names and resets on empty", () => {
    expect(cleanSpeakerName(" [Wit]ness\n ")).toBe("Wit ness");
    expect(renameSpeaker({ "0": "Lee" }, "0", "  ")).toEqual({});
  });
});
