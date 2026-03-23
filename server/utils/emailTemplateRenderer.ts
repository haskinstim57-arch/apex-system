// ─────────────────────────────────────────────
// Email Template Renderer
// Shared utility for merge tag substitution
// Supports {{contact.firstName}}, {{contact.lastName}},
// {{contact.email}}, {{contact.phone}}, {{contact.company}}
// ─────────────────────────────────────────────

export interface ContactMergeData {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
}

/**
 * Replace merge tags in template HTML/text with real contact data.
 * Supports both {{contact.field}} and {{field}} formats for backward compatibility.
 */
export function renderEmailTemplate(
  template: string,
  contact: ContactMergeData
): string {
  if (!template) return "";

  return template
    // {{contact.firstName}} format
    .replace(/\{\{contact\.firstName\}\}/g, contact.firstName || "")
    .replace(/\{\{contact\.lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{contact\.email\}\}/g, contact.email || "")
    .replace(/\{\{contact\.phone\}\}/g, contact.phone || "")
    .replace(/\{\{contact\.company\}\}/g, contact.company || "")
    .replace(
      /\{\{contact\.fullName\}\}/g,
      `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
    )
    // {{firstName}} shorthand format (backward compat with campaigns/automations)
    .replace(/\{\{firstName\}\}/g, contact.firstName || "")
    .replace(/\{\{lastName\}\}/g, contact.lastName || "")
    .replace(/\{\{email\}\}/g, contact.email || "")
    .replace(/\{\{phone\}\}/g, contact.phone || "")
    .replace(/\{\{company\}\}/g, contact.company || "")
    .replace(
      /\{\{fullName\}\}/g,
      `${contact.firstName || ""} ${contact.lastName || ""}`.trim()
    );
}

/**
 * Available merge tags for the template editor UI.
 */
export const MERGE_TAGS = [
  { tag: "{{contact.firstName}}", label: "First Name" },
  { tag: "{{contact.lastName}}", label: "Last Name" },
  { tag: "{{contact.fullName}}", label: "Full Name" },
  { tag: "{{contact.email}}", label: "Email" },
  { tag: "{{contact.phone}}", label: "Phone" },
  { tag: "{{contact.company}}", label: "Company" },
] as const;
