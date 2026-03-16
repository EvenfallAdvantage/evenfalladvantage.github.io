// ─── Integration Services Barrel Export ───────────────────
export { sendEmail, buildWelcomeEmail, buildShiftReminderEmail, buildTimeChangeNotificationEmail } from "./email-service";
export { sendWhatsAppMessage, sendWhatsAppWelcome, sendWhatsAppShiftReminder, getWhatsAppCommunityLink } from "./whatsapp-service";
export { sendSMS, sendShiftReminderSMS, sendAlertSMS } from "./sms-service";
export { sendPushNotification, sendBroadcastPush } from "./push-service";
export { triggerBackgroundCheck, parseCheckrWebhook } from "./checkr-service";
export { sendEnvelopeForSigning, sendOnboardingDocuments } from "./docusign-service";
export { syncTimesheetsToGusto, verifyGustoConnection } from "./gusto-service";
export { onApplicantHired } from "./hiring-orchestrator";
export type { HireContext, HireResult } from "./hiring-orchestrator";
export { dispatch, dispatchToMany } from "./notification-dispatcher";
export type { DispatchParams, DispatchResult } from "./notification-dispatcher";
export {
  getEmailConfig, getWhatsAppConfig, getTwilioConfig, getOneSignalConfig,
  getCheckrConfig, getDocuSignConfig, getGustoConfig,
  isIntegrationActive, clearConfigCache,
} from "./integrations";
export type { ProviderKey } from "./integrations";
