import { useState } from "react";
import { logger } from "@/lib/logger";
import { sendDM } from "@/lib/supabase/db-messages";

export function useDirectMessage(companyId: string) {
  const [dmTarget, setDmTarget] = useState<{ userId: string; name: string } | null>(null);
  const [dmText, setDmText] = useState("");
  const [dmSending, setDmSending] = useState(false);

  const sendMessage = async () => {
    if (!dmTarget || !dmText.trim() || dmSending) return;
    setDmSending(true);
    try {
      await sendDM(companyId, dmTarget.userId, dmText.trim());
      setDmTarget(null);
      setDmText("");
    } catch (e) { logger.swallow("map-dm:send", e, "warn"); }
    setDmSending(false);
  };

  return { dmTarget, setDmTarget, dmText, setDmText, dmSending, sendMessage };
}
