import { useState, useMemo, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, Upload, X, FileText } from "lucide-react";
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
import { toast } from "sonner";

interface ConditionRule {
  fieldId: string;
  operator: "equals" | "not_equals" | "contains" | "is_empty" | "is_not_empty";
  value?: string;
}

interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "dropdown" | "checkbox" | "date" | "file";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  conditionRules?: ConditionRule[];
  acceptedFileTypes?: string;
  maxFileSizeMB?: number;
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

/** Evaluate whether a single condition rule passes */
function evaluateRule(
  rule: ConditionRule,
  formData: Record<string, unknown>
): boolean {
  const rawVal = formData[rule.fieldId];
  const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : "";

  switch (rule.operator) {
    case "equals":
      return val === (rule.value ?? "");
    case "not_equals":
      return val !== (rule.value ?? "");
    case "contains":
      return val.toLowerCase().includes((rule.value ?? "").toLowerCase());
    case "is_empty":
      return val === "" || val === "false";
    case "is_not_empty":
      return val !== "" && val !== "false";
    default:
      return true;
  }
}

/** Check if a field should be visible based on its conditionRules (AND logic) */
function isFieldVisible(
  field: FormField,
  formData: Record<string, unknown>
): boolean {
  if (!field.conditionRules || field.conditionRules.length === 0) return true;
  return field.conditionRules.every((rule) => evaluateRule(rule, formData));
}

/** Format file size for display */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadedFile {
  url: string;
  fileName: string;
  size: number;
}

export default function PublicForm({ slug }: { slug: string }) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const uploadFileMutation = trpc.forms.uploadFormFile.useMutation();

  const fields = useMemo(() => (form?.fields ?? []) as FormField[], [form]);
  const settings = useMemo(() => (form?.settings ?? {}) as FormSettings, [form]);

  const primaryColor = settings.styling?.primaryColor || "#2563eb";
  const bgColor = settings.styling?.backgroundColor || "#ffffff";

  /** Compute which fields are currently visible */
  const visibleFields = useMemo(
    () => fields.filter((f) => isFieldVisible(f, formData)),
    [fields, formData]
  );

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    // Only validate visible fields
    for (const field of visibleFields) {
      const val = formData[field.id];
      if (field.type === "file") {
        // For file fields, check if an uploaded file URL exists
        if (field.required && (!val || !(val as UploadedFile).url)) {
          newErrors[field.id] = `${field.label} is required`;
        }
      } else if (field.required && (val === undefined || val === "" || val === null)) {
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
  }, [visibleFields, formData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadingFields.size > 0) {
      toast.error("Please wait for file uploads to complete");
      return;
    }
    if (!validate()) return;
    // Only submit data for visible fields
    const visibleData: Record<string, unknown> = {};
    for (const field of visibleFields) {
      if (formData[field.id] !== undefined) {
        if (field.type === "file") {
          // For file fields, submit the URL and fileName
          const fileData = formData[field.id] as UploadedFile;
          if (fileData?.url) {
            visibleData[field.id] = { url: fileData.url, fileName: fileData.fileName };
          }
        } else {
          visibleData[field.id] = formData[field.id];
        }
      }
    }
    submitMutation.mutate({ slug, data: visibleData });
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

  const handleFileSelect = async (field: FormField, file: File) => {
    const maxSizeMB = field.maxFileSizeMB || 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        [field.id]: `File exceeds maximum size of ${maxSizeMB}MB`,
      }));
      return;
    }

    // Check accepted file types
    if (field.acceptedFileTypes && field.acceptedFileTypes !== "any_file") {
      const acceptedTypes = field.acceptedFileTypes.split(",").map((t) => t.trim());
      const fileExt = "." + file.name.split(".").pop()?.toLowerCase();
      const fileMime = file.type;
      const isAccepted = acceptedTypes.some((type) => {
        if (type.endsWith("/*")) {
          return fileMime.startsWith(type.replace("/*", "/"));
        }
        if (type.startsWith(".")) {
          return fileExt === type.toLowerCase();
        }
        return fileMime === type;
      });
      if (!isAccepted) {
        setErrors((prev) => ({
          ...prev,
          [field.id]: `File type not accepted. Accepted: ${field.acceptedFileTypes}`,
        }));
        return;
      }
    }

    // Upload the file
    setUploadingFields((prev) => new Set(prev).add(field.id));
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data:...;base64, prefix
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await uploadFileMutation.mutateAsync({
        slug,
        fieldId: field.id,
        fileName: file.name,
        fileBase64: base64,
        contentType: file.type || "application/octet-stream",
      });

      updateField(field.id, {
        url: result.url,
        fileName: result.fileName,
        size: file.size,
      } as UploadedFile);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setErrors((prev) => ({ ...prev, [field.id]: message }));
    } finally {
      setUploadingFields((prev) => {
        const next = new Set(prev);
        next.delete(field.id);
        return next;
      });
    }
  };

  const removeFile = (fieldId: string) => {
    updateField(fieldId, undefined);
    // Reset the file input
    if (fileInputRefs.current[fieldId]) {
      fileInputRefs.current[fieldId]!.value = "";
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
            {fields.map((field) => {
              const visible = isFieldVisible(field, formData);
              if (!visible) return null;

              return (
                <div
                  key={field.id}
                  className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200"
                >
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

                  {field.type === "file" && (
                    <div>
                      {formData[field.id] && (formData[field.id] as UploadedFile).url ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <FileText className="h-5 w-5 text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-800 truncate">
                              {(formData[field.id] as UploadedFile).fileName}
                            </p>
                            <p className="text-xs text-green-600">
                              {formatFileSize((formData[field.id] as UploadedFile).size)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(field.id)}
                            className="p-1 hover:bg-green-100 rounded"
                          >
                            <X className="h-4 w-4 text-green-600" />
                          </button>
                        </div>
                      ) : uploadingFields.has(field.id) ? (
                        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          <p className="text-sm text-blue-700">Uploading...</p>
                        </div>
                      ) : (
                        <div
                          className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors ${
                            errors[field.id] ? "border-red-300 bg-red-50" : "border-gray-300"
                          }`}
                          onClick={() => fileInputRefs.current[field.id]?.click()}
                        >
                          <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Max {field.maxFileSizeMB || 10}MB
                            {field.acceptedFileTypes && field.acceptedFileTypes !== "any_file"
                              ? ` · ${field.acceptedFileTypes}`
                              : ""}
                          </p>
                          <input
                            ref={(el) => { fileInputRefs.current[field.id] = el; }}
                            type="file"
                            className="hidden"
                            accept={
                              field.acceptedFileTypes && field.acceptedFileTypes !== "any_file"
                                ? field.acceptedFileTypes
                                : undefined
                            }
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(field, file);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {errors[field.id] && (
                    <p className="text-xs text-red-500">{errors[field.id]}</p>
                  )}
                </div>
              );
            })}

            <Button
              type="submit"
              className="w-full mt-4"
              style={{ backgroundColor: primaryColor }}
              disabled={submitMutation.isPending || uploadingFields.size > 0}
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
              Powered by Sterling Marketing
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
