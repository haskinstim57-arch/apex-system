/**
 * Appointment SMS Number Resolution
 *
 * Resolves the from-number and provider for appointment-related SMS
 * (reminders, confirmations). Falls back to the account's default
 * Twilio from-number if no dedicated appointment number is configured.
 */
import { getAccountMessagingSettings } from "../db";

export interface AppointmentSmsConfig {
  from?: string;
  provider: "twilio" | "blooio";
}

/**
 * Resolve the SMS config for appointment notifications.
 *
 * Priority:
 * 1. appointmentFromNumber + appointmentSmsProvider (if set)
 * 2. twilioFromNumber with appointmentSmsProvider (if appointmentFromNumber is null)
 * 3. Default to blooio with no explicit from-number
 */
export async function resolveAppointmentSmsConfig(
  accountId: number
): Promise<AppointmentSmsConfig> {
  const settings = await getAccountMessagingSettings(accountId);

  if (!settings) {
    return { provider: "blooio" };
  }

  const provider = (settings.appointmentSmsProvider as "twilio" | "blooio") || "blooio";
  const from =
    settings.appointmentFromNumber ?? settings.twilioFromNumber ?? undefined;

  return { from: from ?? undefined, provider };
}
