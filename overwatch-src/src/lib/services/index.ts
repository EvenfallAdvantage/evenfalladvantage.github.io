// ─── Integration Services Barrel Export ───────────────────
// NOTE: These services are stubs/scaffolding for future server-side integration.
// They orchestrate calls to external APIs (Twilio, SendGrid, DocuSign, etc.)
// which require server-side execution. Since the app uses `output: "export"`
// (static site), these cannot run in the browser. They are designed to be used
// from Supabase Edge Functions or a future server-side API layer.
export { sendEmail, buildWelcomeEmail, buildShiftReminderEmail, buildTimeChangeNotificationEmail } from "./email-service";
export { sendWhatsAppMessage, sendWhatsAppWelcome, sendWhatsAppShiftReminder, getWhatsAppCommunityLink } from "./whatsapp-service";
export { sendSMS, sendShiftReminderSMS, sendAlertSMS } from "./sms-service";
export { sendPushNotification, sendBroadcastPush } from "./push-service";
export { triggerBackgroundCheck, parseCheckrWebhook } from "./checkr-service";
export { sendTemplateEnvelope, sendHtmlEnvelope, sendOnboardingDocuments } from "./docusign-service";
export { syncTimesheetsToGusto, verifyGustoConnection } from "./gusto-service";
export { syncTimesheetsToQuickBooks, verifyQuickBooksConnection } from "./quickbooks-service";
export { syncTimesheetsToADP, verifyADPConnection } from "./adp-service";
export { syncTimesheetsToPaychex, verifyPaychexConnection } from "./paychex-service";
export { listRecords, createRecords, updateRecords, deleteRecords, syncApplicantToAirtable, pullNewApplicantsFromAirtable, verifyAirtableConnection } from "./airtable-service";
export { getSignalGroupLink, verifySignalConnection } from "./signal-service";
export { validateFilloutWebhook, parseFilloutApplicant, verifyFilloutConnection } from "./fillout-service";
export { onApplicantHired } from "./hiring-orchestrator";
export type { HireContext, HireResult } from "./hiring-orchestrator";
export { dispatch, dispatchToMany } from "./notification-dispatcher";
export type { DispatchParams, DispatchResult } from "./notification-dispatcher";
export {
  getActiveConfig, getEmailConfig, getWhatsAppConfig, getTwilioConfig, getOneSignalConfig,
  getCheckrConfig, getDocuSignConfig, getGustoConfig, getQuickBooksConfig, getADPConfig, getPaychexConfig,
  isIntegrationActive, clearConfigCache,
} from "./integrations";
export type { ProviderKey } from "./integrations";
