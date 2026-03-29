import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";

export interface VisibilityRule {
  dependsOnSlug: string;
  operator: "equals" | "not_equals" | "contains" | "not_empty" | "is_empty" | "in";
  value?: string | number | boolean | string[];
}

interface FieldDef {
  slug: string;
  name: string;
  type: string;
  options?: string | null;
}

interface VisibilityRulesEditorProps {
  rules: VisibilityRule[];
  onChange: (rules: VisibilityRule[]) => void;
  /** All field defs in the account (to pick from) */
  allFieldDefs: FieldDef[];
  /** The current field's slug (to exclude from the list) */
  currentSlug?: string;
}

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "not_empty", label: "Is Not Empty" },
  { value: "is_empty", label: "Is Empty" },
  { value: "in", label: "Is One Of" },
] as const;

export function VisibilityRulesEditor({
  rules,
  onChange,
  allFieldDefs,
  currentSlug,
}: VisibilityRulesEditorProps) {
  // Exclude the current field from the dependency list
  const availableFields = allFieldDefs.filter((f) => f.slug !== currentSlug);

  function addRule() {
    onChange([
      ...rules,
      { dependsOnSlug: "", operator: "equals", value: "" },
    ]);
  }

  function removeRule(index: number) {
    onChange(rules.filter((_, i) => i !== index));
  }

  function updateRule(index: number, patch: Partial<VisibilityRule>) {
    onChange(rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const needsValue = (op: string) => op !== "is_empty" && op !== "not_empty";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          {rules.length > 0 ? (
            <Eye className="h-3.5 w-3.5 text-primary" />
          ) : (
            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          Visibility Rules
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={addRule}
        >
          <Plus className="h-3 w-3" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No rules — field is always visible.
        </p>
      )}

      {rules.map((rule, i) => {
        const depField = allFieldDefs.find((f) => f.slug === rule.dependsOnSlug);
        const depOptions: string[] = depField?.options
          ? typeof depField.options === "string"
            ? JSON.parse(depField.options)
            : depField.options
          : [];

        return (
          <div
            key={i}
            className="flex flex-wrap items-end gap-2 p-2.5 rounded-md border border-border/50 bg-muted/30"
          >
            <div className="flex-1 min-w-[120px] space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                When
              </span>
              <Select
                value={rule.dependsOnSlug || "pick"}
                onValueChange={(v) =>
                  updateRule(i, {
                    dependsOnSlug: v === "pick" ? "" : v,
                    value: "",
                  })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pick" disabled>
                    Select field...
                  </SelectItem>
                  {availableFields.map((f) => (
                    <SelectItem key={f.slug} value={f.slug}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[130px] space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Operator
              </span>
              <Select
                value={rule.operator}
                onValueChange={(v) =>
                  updateRule(i, { operator: v as VisibilityRule["operator"] })
                }
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsValue(rule.operator) && (
              <div className="flex-1 min-w-[120px] space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Value
                </span>
                {depField?.type === "dropdown" && depOptions.length > 0 ? (
                  rule.operator === "in" ? (
                    <div className="flex flex-wrap gap-1">
                      {depOptions.map((opt) => {
                        const selected = Array.isArray(rule.value)
                          ? rule.value.includes(opt)
                          : false;
                        return (
                          <Badge
                            key={opt}
                            variant={selected ? "default" : "outline"}
                            className="cursor-pointer text-[10px] h-6"
                            onClick={() => {
                              const current = Array.isArray(rule.value)
                                ? rule.value
                                : [];
                              const next = selected
                                ? current.filter((v) => v !== opt)
                                : [...current, opt];
                              updateRule(i, { value: next });
                            }}
                          >
                            {opt}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <Select
                      value={String(rule.value ?? "")}
                      onValueChange={(v) => updateRule(i, { value: v })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {depOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                ) : depField?.type === "checkbox" ? (
                  <Select
                    value={String(rule.value ?? "")}
                    onValueChange={(v) =>
                      updateRule(i, { value: v === "true" })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes (checked)</SelectItem>
                      <SelectItem value="false">No (unchecked)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={String(rule.value ?? "")}
                    onChange={(e) => updateRule(i, { value: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="Value"
                  />
                )}
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRule(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      {rules.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Field is visible only when <strong>all</strong> rules pass (AND logic).
        </p>
      )}
    </div>
  );
}

/**
 * Evaluate visibility rules on the client side.
 * Used in ContactDetail to show/hide fields dynamically.
 */
export function isFieldVisibleClient(
  rules: VisibilityRule[] | null | undefined,
  customFieldValues: Record<string, unknown>
): boolean {
  if (!rules || rules.length === 0) return true;

  return rules.every((rule) => {
    const actual = customFieldValues[rule.dependsOnSlug];

    switch (rule.operator) {
      case "is_empty":
        return (
          actual === undefined ||
          actual === null ||
          actual === "" ||
          actual === false
        );
      case "not_empty":
        return (
          actual !== undefined &&
          actual !== null &&
          actual !== "" &&
          actual !== false
        );
      case "equals":
        if (typeof actual === "boolean") {
          return actual === (rule.value === true || rule.value === "true");
        }
        return String(actual ?? "") === String(rule.value ?? "");
      case "not_equals":
        if (typeof actual === "boolean") {
          return actual !== (rule.value === true || rule.value === "true");
        }
        return String(actual ?? "") !== String(rule.value ?? "");
      case "contains":
        return String(actual ?? "")
          .toLowerCase()
          .includes(String(rule.value ?? "").toLowerCase());
      case "in":
        if (Array.isArray(rule.value)) {
          return rule.value.includes(String(actual ?? ""));
        }
        return false;
      default:
        return true;
    }
  });
}
