import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "dropdown" | "checkbox" | "date";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormSettings {
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
  headerText?: string;
  description?: string;
  styling?: {
    primaryColor?: string;
    backgroundColor?: string;
    fontFamily?: string;
  };
}

export default function PublicForm({ slug }: { slug: string }) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: form, isLoading, error } = trpc.forms.getPublicForm.useQuery(
    { slug },
    { enabled: !!slug }
  );

  const submitMutation = trpc.forms.submitPublicForm.useMutation({
    onSuccess: (result) => {
      setSubmitted(true);
      if (result.redirectUrl) {
        setTimeout(() => {
          window.location.href = result.redirectUrl!;
        }, 1500);
      }
    },
  });

  const fields = useMemo(() => (form?.fields ?? []) as FormField[], [form]);
  const settings = useMemo(() => (form?.settings ?? {}) as FormSettings, [form]);

  const primaryColor = settings.styling?.primaryColor || "#2563eb";
  const bgColor = settings.styling?.backgroundColor || "#ffffff";

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      const val = formData[field.id];
      if (field.required && (val === undefined || val === "" || val === null)) {
        newErrors[field.id] = `${field.label} is required`;
      }
      if (field.type === "email" && val && typeof val === "string") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          newErrors[field.id] = "Please enter a valid email";
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    submitMutation.mutate({ slug, data: formData });
  };

  const updateField = (fieldId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Form Not Found</h1>
          <p className="text-gray-500">This form may have been deactivated or removed.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: bgColor }}>
        <div className="text-center max-w-md px-6">
          <CheckCircle2
            className="h-16 w-16 mx-auto mb-4"
            style={{ color: primaryColor }}
          />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {settings.successMessage || "Thank you!"}
          </h2>
          <p className="text-gray-500">
            {settings.successMessage
              ? ""
              : "Your submission has been received. We'll be in touch soon."}
          </p>
          {settings.redirectUrl && (
            <p className="text-sm text-gray-400 mt-4">Redirecting...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: bgColor }}>
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          {(settings.headerText || settings.description) && (
            <div className="px-6 py-5 border-b" style={{ borderColor: `${primaryColor}20` }}>
              {settings.headerText && (
                <h1 className="text-xl font-bold text-gray-900">
                  {settings.headerText}
                </h1>
              )}
              {settings.description && (
                <p className="text-sm text-gray-500 mt-1">
                  {settings.description}
                </p>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-0.5">*</span>
                  )}
                </Label>

                {field.type === "text" && (
                  <Input
                    placeholder={field.placeholder || ""}
                    value={(formData[field.id] as string) || ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                    className={errors[field.id] ? "border-red-500" : ""}
                  />
                )}

                {field.type === "email" && (
                  <Input
                    type="email"
                    placeholder={field.placeholder || "you@example.com"}
                    value={(formData[field.id] as string) || ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                    className={errors[field.id] ? "border-red-500" : ""}
                  />
                )}

                {field.type === "phone" && (
                  <Input
                    type="tel"
                    placeholder={field.placeholder || "(555) 123-4567"}
                    value={(formData[field.id] as string) || ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                    className={errors[field.id] ? "border-red-500" : ""}
                  />
                )}

                {field.type === "date" && (
                  <Input
                    type="date"
                    value={(formData[field.id] as string) || ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                    className={errors[field.id] ? "border-red-500" : ""}
                  />
                )}

                {field.type === "dropdown" && (
                  <Select
                    value={(formData[field.id] as string) || ""}
                    onValueChange={(v) => updateField(field.id, v)}
                  >
                    <SelectTrigger
                      className={errors[field.id] ? "border-red-500" : ""}
                    >
                      <SelectValue
                        placeholder={field.placeholder || "Select an option"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options || []).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {field.type === "checkbox" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      checked={!!formData[field.id]}
                      onCheckedChange={(checked) =>
                        updateField(field.id, !!checked)
                      }
                    />
                    <span className="text-sm text-gray-600">
                      {field.placeholder || field.label}
                    </span>
                  </div>
                )}

                {errors[field.id] && (
                  <p className="text-xs text-red-500">{errors[field.id]}</p>
                )}
              </div>
            ))}

            <Button
              type="submit"
              className="w-full mt-4"
              style={{ backgroundColor: primaryColor }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {settings.submitButtonText || "Submit"}
            </Button>

            {submitMutation.error && (
              <p className="text-sm text-red-500 text-center mt-2">
                {submitMutation.error.message}
              </p>
            )}
          </form>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t text-center">
            <p className="text-[10px] text-gray-400">
              Powered by Apex System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
