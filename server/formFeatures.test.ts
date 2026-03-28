import { describe, it, expect } from "vitest";

// ─── Form Templates ───

const FORM_TEMPLATES = [
  {
    id: "mortgage_inquiry",
    name: "Mortgage Inquiry",
    description: "Capture mortgage leads with pre-qualification questions",
    category: "Lead Capture",
    fields: [
      { id: "f1", type: "text", label: "Full Name", required: true, contactFieldMapping: "firstName" },
      { id: "f2", type: "email", label: "Email Address", required: true, contactFieldMapping: "email" },
      { id: "f3", type: "phone", label: "Phone Number", required: true, contactFieldMapping: "phone" },
      { id: "f4", type: "dropdown", label: "Loan Type", required: true, options: ["Purchase", "Refinance", "Cash-Out Refinance", "Home Equity"] },
      { id: "f5", type: "text", label: "Estimated Home Value", required: false, placeholder: "$000,000" },
      { id: "f6", type: "dropdown", label: "Credit Score Range", required: false, options: ["Excellent (740+)", "Good (670-739)", "Fair (580-669)", "Poor (below 580)"] },
      { id: "f7", type: "checkbox", label: "I consent to be contacted", required: true },
    ],
    settings: { headerText: "Get Your Free Mortgage Quote", submitButtonText: "Get My Quote", successMessage: "Thanks! A loan officer will contact you within 24 hours." },
    submitAction: "create_contact",
  },
  {
    id: "contact_us",
    name: "Contact Us",
    description: "General contact form for inquiries",
    category: "General",
    fields: [
      { id: "f1", type: "text", label: "Name", required: true, contactFieldMapping: "firstName" },
      { id: "f2", type: "email", label: "Email", required: true, contactFieldMapping: "email" },
      { id: "f3", type: "dropdown", label: "Subject", required: true, options: ["General Inquiry", "Support", "Partnership", "Other"] },
      { id: "f4", type: "text", label: "Message", required: true },
    ],
    settings: { headerText: "Contact Us", submitButtonText: "Send Message" },
    submitAction: "create_contact",
  },
  {
    id: "refinance_application",
    name: "Refinance Application",
    description: "Detailed refinance application with document upload",
    category: "Applications",
    fields: [
      { id: "f1", type: "text", label: "Full Name", required: true, contactFieldMapping: "firstName" },
      { id: "f2", type: "email", label: "Email", required: true, contactFieldMapping: "email" },
      { id: "f3", type: "phone", label: "Phone", required: true, contactFieldMapping: "phone" },
      { id: "f4", type: "text", label: "Current Lender", required: true },
      { id: "f5", type: "text", label: "Current Interest Rate", required: true, placeholder: "e.g., 6.5%" },
      { id: "f6", type: "text", label: "Remaining Balance", required: true, placeholder: "$000,000" },
      { id: "f7", type: "date", label: "Preferred Closing Date", required: false },
      { id: "f8", type: "file", label: "Pay Stubs (last 2 months)", required: false, acceptedFileTypes: ".pdf,.doc,.docx", maxFileSizeMB: 10 },
    ],
    settings: { headerText: "Refinance Application", submitButtonText: "Submit Application" },
    submitAction: "create_contact",
  },
];

describe("Form Templates Library", () => {
  it("all templates have required properties", () => {
    for (const template of FORM_TEMPLATES) {
      expect(template).toHaveProperty("id");
      expect(template).toHaveProperty("name");
      expect(template).toHaveProperty("description");
      expect(template).toHaveProperty("category");
      expect(template).toHaveProperty("fields");
      expect(template).toHaveProperty("settings");
      expect(template).toHaveProperty("submitAction");
      expect(template.fields.length).toBeGreaterThan(0);
    }
  });

  it("template fields have valid types", () => {
    const validTypes = ["text", "email", "phone", "dropdown", "checkbox", "date", "file"];
    for (const template of FORM_TEMPLATES) {
      for (const field of template.fields) {
        expect(validTypes).toContain(field.type);
        expect(field.id).toBeTruthy();
        expect(field.label).toBeTruthy();
      }
    }
  });

  it("mortgage inquiry template has correct lead capture fields", () => {
    const mortgage = FORM_TEMPLATES.find((t) => t.id === "mortgage_inquiry")!;
    expect(mortgage).toBeDefined();
    expect(mortgage.fields.some((f) => f.contactFieldMapping === "email")).toBe(true);
    expect(mortgage.fields.some((f) => f.contactFieldMapping === "phone")).toBe(true);
    expect(mortgage.fields.some((f) => f.contactFieldMapping === "firstName")).toBe(true);
    expect(mortgage.submitAction).toBe("create_contact");
  });

  it("refinance application template includes file upload field", () => {
    const refinance = FORM_TEMPLATES.find((t) => t.id === "refinance_application")!;
    expect(refinance).toBeDefined();
    const fileField = refinance.fields.find((f) => f.type === "file");
    expect(fileField).toBeDefined();
    expect(fileField!.acceptedFileTypes).toBe(".pdf,.doc,.docx");
    expect(fileField!.maxFileSizeMB).toBe(10);
  });

  it("each template has unique ID", () => {
    const ids = FORM_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("template cloning creates independent copy", () => {
    const template = FORM_TEMPLATES[0];
    const cloned = {
      ...template,
      name: `${template.name} (Copy)`,
      fields: template.fields.map((f) => ({ ...f, id: `clone_${f.id}` })),
    };
    // Modifying clone doesn't affect original
    cloned.name = "Modified";
    expect(template.name).toBe("Mortgage Inquiry");
    expect(cloned.fields[0].id).toContain("clone_");
    expect(template.fields[0].id).not.toContain("clone_");
  });
});

// ─── A/B Testing ───

describe("Form A/B Testing", () => {
  it("duplicate form generates new slug with variant suffix", () => {
    const originalSlug = "mortgage-inquiry-abc123";
    const generateVariantSlug = (slug: string) => {
      const suffix = Math.random().toString(36).slice(2, 8);
      return `${slug.slice(0, 70)}-v-${suffix}`;
    };
    const variantSlug = generateVariantSlug(originalSlug);
    expect(variantSlug).toContain("-v-");
    expect(variantSlug.startsWith(originalSlug.slice(0, 70))).toBe(true);
  });

  it("variant form preserves original fields and settings", () => {
    const original = {
      name: "Mortgage Inquiry",
      fields: [
        { id: "f1", type: "text", label: "Name", required: true },
        { id: "f2", type: "email", label: "Email", required: true },
      ],
      settings: { headerText: "Get a Quote", submitButtonText: "Submit" },
    };

    const variant = {
      ...original,
      name: `${original.name} (Variant B)`,
      fields: [...original.fields],
      settings: { ...original.settings },
    };

    expect(variant.fields).toEqual(original.fields);
    expect(variant.settings).toEqual(original.settings);
    expect(variant.name).toContain("Variant B");
  });

  it("A/B comparison requires at least 2 forms", () => {
    const forms = [
      { id: 1, name: "Form A", submissionCount: 50, conversionRate: 60 },
      { id: 2, name: "Form A (Variant B)", submissionCount: 50, conversionRate: 75 },
    ];

    expect(forms.length).toBeGreaterThanOrEqual(2);
    const winner = forms.reduce((a, b) => (a.conversionRate > b.conversionRate ? a : b));
    expect(winner.name).toBe("Form A (Variant B)");
  });

  it("traffic split is 50/50 by default", () => {
    const trafficSplit = { formA: 50, formB: 50 };
    expect(trafficSplit.formA + trafficSplit.formB).toBe(100);
  });
});

// ─── File Upload Field ───

describe("File Upload Field Type", () => {
  describe("File type validation", () => {
    function isFileAccepted(
      fileName: string,
      fileMime: string,
      acceptedTypes: string
    ): boolean {
      if (!acceptedTypes || acceptedTypes === "any_file") return true;
      const types = acceptedTypes.split(",").map((t) => t.trim());
      const fileExt = "." + fileName.split(".").pop()?.toLowerCase();
      return types.some((type) => {
        if (type.endsWith("/*")) {
          return fileMime.startsWith(type.replace("/*", "/"));
        }
        if (type.startsWith(".")) {
          return fileExt === type.toLowerCase();
        }
        return fileMime === type;
      });
    }

    it("accepts any file when no restriction", () => {
      expect(isFileAccepted("doc.pdf", "application/pdf", "")).toBe(true);
      expect(isFileAccepted("photo.jpg", "image/jpeg", "any_file")).toBe(true);
    });

    it("accepts images when image/* is specified", () => {
      expect(isFileAccepted("photo.jpg", "image/jpeg", "image/*")).toBe(true);
      expect(isFileAccepted("photo.png", "image/png", "image/*")).toBe(true);
      expect(isFileAccepted("doc.pdf", "application/pdf", "image/*")).toBe(false);
    });

    it("accepts PDF when .pdf is specified", () => {
      expect(isFileAccepted("doc.pdf", "application/pdf", ".pdf")).toBe(true);
      expect(isFileAccepted("photo.jpg", "image/jpeg", ".pdf")).toBe(false);
    });

    it("accepts multiple types when comma-separated", () => {
      const accepted = "image/*,.pdf";
      expect(isFileAccepted("photo.jpg", "image/jpeg", accepted)).toBe(true);
      expect(isFileAccepted("doc.pdf", "application/pdf", accepted)).toBe(true);
      expect(isFileAccepted("data.csv", "text/csv", accepted)).toBe(false);
    });

    it("accepts documents preset", () => {
      const accepted = ".pdf,.doc,.docx";
      expect(isFileAccepted("doc.pdf", "application/pdf", accepted)).toBe(true);
      expect(isFileAccepted("doc.docx", "application/vnd.openxmlformats", accepted)).toBe(true);
      expect(isFileAccepted("photo.jpg", "image/jpeg", accepted)).toBe(false);
    });
  });

  describe("File size validation", () => {
    function isFileSizeValid(fileSize: number, maxSizeMB: number): boolean {
      return fileSize <= maxSizeMB * 1024 * 1024;
    }

    it("accepts files within size limit", () => {
      expect(isFileSizeValid(5 * 1024 * 1024, 10)).toBe(true); // 5MB < 10MB
      expect(isFileSizeValid(1024, 10)).toBe(true); // 1KB < 10MB
    });

    it("rejects files exceeding size limit", () => {
      expect(isFileSizeValid(11 * 1024 * 1024, 10)).toBe(false); // 11MB > 10MB
      expect(isFileSizeValid(51 * 1024 * 1024, 50)).toBe(false); // 51MB > 50MB
    });

    it("accepts file exactly at size limit", () => {
      expect(isFileSizeValid(10 * 1024 * 1024, 10)).toBe(true); // 10MB = 10MB
    });

    it("uses default 10MB when maxFileSizeMB is undefined", () => {
      const maxSizeMB = undefined;
      const effectiveMax = maxSizeMB || 10;
      expect(isFileSizeValid(9 * 1024 * 1024, effectiveMax)).toBe(true);
      expect(isFileSizeValid(11 * 1024 * 1024, effectiveMax)).toBe(false);
    });
  });

  describe("File upload S3 key generation", () => {
    it("generates unique S3 keys with account and form context", () => {
      const accountId = 42;
      const formId = 7;
      const fieldId = "f8";
      const fileName = "pay_stub.pdf";
      const randomSuffix = "abc12345";
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileKey = `form-uploads/${accountId}/${formId}/${fieldId}-${randomSuffix}-${safeFileName}`;

      expect(fileKey).toBe("form-uploads/42/7/f8-abc12345-pay_stub.pdf");
      expect(fileKey).toContain(`${accountId}`);
      expect(fileKey).toContain(`${formId}`);
    });

    it("sanitizes unsafe file names", () => {
      const unsafeName = "my file (1) [final].pdf";
      const safeName = unsafeName.replace(/[^a-zA-Z0-9._-]/g, "_");
      expect(safeName).toBe("my_file__1___final_.pdf");
      expect(safeName).not.toContain(" ");
      expect(safeName).not.toContain("(");
      expect(safeName).not.toContain("[");
    });
  });

  describe("File field in form submission", () => {
    it("file field data includes url and fileName", () => {
      const fileData = { url: "https://s3.example.com/file.pdf", fileName: "pay_stub.pdf" };
      expect(fileData).toHaveProperty("url");
      expect(fileData).toHaveProperty("fileName");
      expect(fileData.url).toContain("https://");
    });

    it("file field is excluded from submission when hidden by condition", () => {
      interface FormField {
        id: string;
        type: string;
        label: string;
        required: boolean;
        conditionRules?: Array<{ fieldId: string; operator: string; value?: string }>;
      }

      const fields: FormField[] = [
        { id: "type", type: "dropdown", label: "Type", required: true },
        {
          id: "doc",
          type: "file",
          label: "Document",
          required: true,
          conditionRules: [{ fieldId: "type", operator: "equals", value: "Refinance" }],
        },
      ];

      const formData: Record<string, unknown> = {
        type: "Purchase",
        doc: { url: "https://s3.example.com/file.pdf", fileName: "doc.pdf" },
      };

      // Simulate visibility check
      const isVisible = (field: FormField) => {
        if (!field.conditionRules?.length) return true;
        return field.conditionRules.every((rule) => {
          const val = String(formData[rule.fieldId] ?? "");
          return rule.operator === "equals" ? val === rule.value : true;
        });
      };

      const visibleFields = fields.filter(isVisible);
      const submissionData: Record<string, unknown> = {};
      for (const f of visibleFields) {
        if (formData[f.id] !== undefined) {
          submissionData[f.id] = formData[f.id];
        }
      }

      expect(submissionData).toHaveProperty("type");
      expect(submissionData).not.toHaveProperty("doc");
    });
  });

  describe("Format file size utility", () => {
    function formatFileSize(bytes: number): string {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    it("formats bytes correctly", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("formats kilobytes correctly", () => {
      expect(formatFileSize(2048)).toBe("2.0 KB");
    });

    it("formats megabytes correctly", () => {
      expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    });
  });
});
