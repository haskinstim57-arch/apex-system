// client/src/lib/contactStatus.ts
// Single source of truth for contact status taxonomy.
// MUST stay in sync with `drizzle/schema.ts` contacts.status enum.

export const CONTACT_STATUSES = [
  "new",
  "uncontacted",
  "contacted",
  "engaged",
  "application_taken",
  "application_in_progress",
  "credit_repair",
  "callback_scheduled",
  "app_link_pending",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "nurture",
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "New",
  uncontacted: "Uncontacted",
  contacted: "Contacted",
  engaged: "Engaged",
  application_taken: "Application Taken",
  application_in_progress: "Application In Progress",
  credit_repair: "Credit Repair",
  callback_scheduled: "Callback Scheduled",
  app_link_pending: "App Link Pending",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  nurture: "Nurture",
};

export const STATUS_COLORS: Record<ContactStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  uncontacted: "bg-gray-50 text-gray-700 border-gray-200",
  contacted: "bg-cyan-50 text-cyan-700 border-cyan-200",
  engaged: "bg-teal-50 text-teal-700 border-teal-200",
  application_taken: "bg-indigo-50 text-indigo-700 border-indigo-200",
  application_in_progress: "bg-violet-50 text-violet-700 border-violet-200",
  credit_repair: "bg-amber-50 text-amber-700 border-amber-200",
  callback_scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  app_link_pending: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  qualified: "bg-lime-50 text-lime-700 border-lime-200",
  proposal: "bg-purple-50 text-purple-700 border-purple-200",
  negotiation: "bg-orange-50 text-orange-700 border-orange-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-rose-50 text-rose-700 border-rose-200",
  nurture: "bg-yellow-50 text-yellow-700 border-yellow-200",
};
