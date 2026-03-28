import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Filter } from "lucide-react";

export interface WebhookCondition {
  field: string;
  operator: string;
  value: string;
}

const OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Not Contains" },
  { value: "greater_than", label: "Greater Than" },
  { value: "less_than", label: "Less Than" },
  { value: "in", label: "In (comma-separated)" },
  { value: "not_in", label: "Not In (comma-separated)" },
  { value: "is_empty", label: "Is Empty" },
  { value: "is_not_empty", label: "Is Not Empty" },
] as const;

const COMMON_FIELDS = [
  { value: "contact.firstName", label: "Contact First Name" },
  { value: "contact.lastName", label: "Contact Last Name" },
  { value: "contact.email", label: "Contact Email" },
  { value: "contact.phone", label: "Contact Phone" },
  { value: "contact.leadSource", label: "Contact Lead Source" },
  { value: "contact.status", label: "Contact Status" },
  { value: "contact.company", label: "Contact Company" },
  { value: "tag", label: "Tag Name" },
  { value: "stage.name", label: "Pipeline Stage Name" },
  { value: "review.rating", label: "Review Rating" },
  { value: "review.platform", label: "Review Platform" },
  { value: "form.name", label: "Form Name" },
  { value: "message.channel", label: "Message Channel" },
] as const;

interface WebhookConditionsEditorProps {
  conditions: WebhookCondition[];
  onChange: (conditions: WebhookCondition[]) => void;
  compact?: boolean;
}

export function WebhookConditionsEditor({
  conditions,
  onChange,
  compact = false,
}: WebhookConditionsEditorProps) {
  const [customField, setCustomField] = useState("");

  function addCondition() {
    onChange([...conditions, { field: "", operator: "equals", value: "" }]);
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updates: Partial<WebhookCondition>) {
    onChange(
      conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  }

  const needsValue = (op: string) => !["is_empty", "is_not_empty"].includes(op);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs flex items-center gap-1.5">
          <Filter className="h-3 w-3 text-muted-foreground" />
          Conditions {conditions.length > 0 && (
            <Badge variant="outline" className="text-[10px] ml-1">
              {conditions.length} rule{conditions.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </Label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 text-xs"
          onClick={addCondition}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Rule
        </Button>
      </div>

      {conditions.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          No conditions — webhook fires on every matching event.
        </p>
      )}

      {conditions.map((cond, idx) => (
        <div
          key={idx}
          className={`flex items-start gap-2 p-2 border rounded-lg bg-muted/20 ${
            compact ? "flex-wrap" : ""
          }`}
        >
          {/* Field selector */}
          <div className="flex-1 min-w-[140px]">
            <Select
              value={COMMON_FIELDS.some((f) => f.value === cond.field) ? cond.field : "__custom"}
              onValueChange={(v) => {
                if (v === "__custom") {
                  updateCondition(idx, { field: customField || "" });
                } else {
                  updateCondition(idx, { field: v });
                }
              }}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="Select field..." />
              </SelectTrigger>
              <SelectContent>
                {COMMON_FIELDS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
                <SelectItem value="__custom">Custom field...</SelectItem>
              </SelectContent>
            </Select>
            {!COMMON_FIELDS.some((f) => f.value === cond.field) && cond.field !== "" && (
              <Input
                value={cond.field}
                onChange={(e) => updateCondition(idx, { field: e.target.value })}
                placeholder="e.g. data.customField"
                className="h-7 text-xs mt-1"
              />
            )}
            {cond.field === "" && (
              <Input
                value={cond.field}
                onChange={(e) => updateCondition(idx, { field: e.target.value })}
                placeholder="e.g. contact.leadSource"
                className="h-7 text-xs mt-1"
              />
            )}
          </div>

          {/* Operator */}
          <div className="w-[160px]">
            <Select
              value={cond.operator}
              onValueChange={(v) => updateCondition(idx, { operator: v })}
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

          {/* Value */}
          {needsValue(cond.operator) && (
            <div className="flex-1 min-w-[120px]">
              <Input
                value={cond.value}
                onChange={(e) => updateCondition(idx, { value: e.target.value })}
                placeholder={
                  cond.operator === "in" || cond.operator === "not_in"
                    ? "val1, val2, val3"
                    : "Value..."
                }
                className="h-7 text-xs"
              />
            </div>
          )}

          {/* Remove */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 shrink-0 text-red-500 hover:text-red-600"
            onClick={() => removeCondition(idx)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {conditions.length > 1 && (
        <p className="text-[10px] text-muted-foreground">
          All conditions must pass (AND logic) for the webhook to fire.
        </p>
      )}
    </div>
  );
}

/** Read-only display of conditions */
export function WebhookConditionsBadges({
  conditions,
}: {
  conditions: WebhookCondition[] | null | undefined;
}) {
  if (!conditions || conditions.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
      {conditions.map((c, i) => (
        <Badge
          key={i}
          variant="outline"
          className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20"
        >
          {c.field} {c.operator.replace(/_/g, " ")}{" "}
          {!["is_empty", "is_not_empty"].includes(c.operator) && `"${c.value}"`}
        </Badge>
      ))}
    </div>
  );
}
