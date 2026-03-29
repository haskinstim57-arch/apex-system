/**
 * Evaluates visibility rules for custom fields.
 * A field is visible when ALL its rules pass (AND logic).
 * If a field has no rules, it is always visible.
 */

export interface VisibilityRule {
  dependsOnSlug: string;
  operator: "equals" | "not_equals" | "contains" | "not_empty" | "is_empty" | "in";
  value?: string | number | boolean | string[];
}

export interface FieldDefWithRules {
  slug: string;
  visibilityRules: string | null; // JSON string of VisibilityRule[]
}

/**
 * Parse visibility rules from JSON string
 */
export function parseVisibilityRules(raw: string | null): VisibilityRule[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Evaluate a single visibility rule against the current custom field values
 */
function evaluateRule(
  rule: VisibilityRule,
  customFieldValues: Record<string, unknown>
): boolean {
  const actualValue = customFieldValues[rule.dependsOnSlug];

  switch (rule.operator) {
    case "is_empty":
      return (
        actualValue === undefined ||
        actualValue === null ||
        actualValue === "" ||
        actualValue === false
      );

    case "not_empty":
      return (
        actualValue !== undefined &&
        actualValue !== null &&
        actualValue !== "" &&
        actualValue !== false
      );

    case "equals":
      if (typeof actualValue === "boolean") {
        return actualValue === (rule.value === true || rule.value === "true");
      }
      return String(actualValue ?? "") === String(rule.value ?? "");

    case "not_equals":
      if (typeof actualValue === "boolean") {
        return actualValue !== (rule.value === true || rule.value === "true");
      }
      return String(actualValue ?? "") !== String(rule.value ?? "");

    case "contains":
      return String(actualValue ?? "")
        .toLowerCase()
        .includes(String(rule.value ?? "").toLowerCase());

    case "in":
      if (Array.isArray(rule.value)) {
        return rule.value.includes(String(actualValue ?? ""));
      }
      return false;

    default:
      return true; // Unknown operator = visible
  }
}

/**
 * Evaluate all visibility rules for a field.
 * Returns true if the field should be visible.
 */
export function isFieldVisible(
  fieldDef: FieldDefWithRules,
  customFieldValues: Record<string, unknown>
): boolean {
  const rules = parseVisibilityRules(fieldDef.visibilityRules);
  if (rules.length === 0) return true; // No rules = always visible

  return rules.every((rule) => evaluateRule(rule, customFieldValues));
}

/**
 * Filter a list of field definitions to only those that are visible
 * given the current custom field values.
 */
export function getVisibleFields<T extends FieldDefWithRules>(
  fieldDefs: T[],
  customFieldValues: Record<string, unknown>
): T[] {
  return fieldDefs.filter((def) => isFieldVisible(def, customFieldValues));
}
