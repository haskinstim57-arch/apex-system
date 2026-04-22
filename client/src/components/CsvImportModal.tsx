import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  X,
  FileUp,
} from "lucide-react";

const CONTACT_FIELDS = [
  { value: "skip", label: "— Skip this column —" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "state", label: "State" },
  { value: "city", label: "City" },
  { value: "zip", label: "ZIP" },
  { value: "address", label: "Address" },
  { value: "tags", label: "Tags" },
  { value: "notes", label: "Notes" },
] as const;

const FIELD_ALIASES: Record<string, string> = {
  "first name": "firstName",
  "firstname": "firstName",
  "first_name": "firstName",
  "last name": "lastName",
  "lastname": "lastName",
  "last_name": "lastName",
  "email": "email",
  "email address": "email",
  "phone": "phone",
  "phone number": "phone",
  "phonenumber": "phone",
  "mobile": "phone",
  "cell": "phone",
  "tags": "tags",
  "tag": "tags",
  "notes": "notes",
  "note": "notes",
  "comments": "notes",
  "state": "state",
  "st": "state",
  "province": "state",
  "city": "city",
  "town": "city",
  "zip": "zip",
  "zipcode": "zip",
  "zip code": "zip",
  "zip_code": "zip",
  "postal code": "zip",
  "postal_code": "zip",
  "postalcode": "zip",
  "address": "address",
  "street": "address",
  "street address": "address",
  "street_address": "address",
};

const CSV_TEMPLATE = `First Name,Last Name,Email,Phone,Tags,Notes
John,Doe,john@example.com,+15551234567,"lead,facebook",Interested in refinancing
Jane,Smith,jane@example.com,+15559876543,"referral,2026",Follow up next week`;

type Step = "upload" | "map" | "review" | "complete";

interface CsvImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
}

export function CsvImportModal({ open, onOpenChange, accountId }: CsvImportModalProps) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<Step>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<number, string>>({});
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Import results
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    errorRows: Array<{ row: number; data: Record<string, string>; reason: string }>;
  } | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  const importMutation = trpc.contacts.importContacts.useMutation();

  const reset = useCallback(() => {
    setStep("upload");
    setCsvHeaders([]);
    setCsvRows([]);
    setFieldMapping({});
    setFileName("");
    setImportResult(null);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(reset, 300);
  }, [onOpenChange, reset]);

  const handleFile = useCallback((file: File) => {
    // Validate file extension
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".txt")) {
      toast.error("Please upload a CSV file (.csv or .txt)");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size must be under 50MB");
      return;
    }
    if (file.size === 0) {
      toast.error("The file is empty. Please select a valid CSV file.");
      return;
    }
    setFileName(file.name);

    try {
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (result) => {
          if (result.errors && result.errors.length > 0) {
            console.error("[CSV Import] Parse errors:", result.errors);
            toast.error(`CSV parsing error: ${result.errors[0]?.message || "Unknown error"}`);
            return;
          }
          const rows = result.data as string[][];
          if (!rows || rows.length < 2) {
            toast.error("CSV must have at least a header row and one data row");
            return;
          }
          const headers = rows[0];
          // Filter out completely empty rows
          const dataRows = rows.slice(1).filter(row => row.some(cell => cell && cell.trim()));
          if (dataRows.length === 0) {
            toast.error("CSV has headers but no data rows");
            return;
          }
          setCsvHeaders(headers);
          setCsvRows(dataRows);

          // Auto-map columns
          const mapping: Record<number, string> = {};
          headers.forEach((header, idx) => {
            const normalized = header.trim().toLowerCase();
            if (FIELD_ALIASES[normalized]) {
              mapping[idx] = FIELD_ALIASES[normalized];
            } else {
              mapping[idx] = "skip";
            }
          });
          setFieldMapping(mapping);
          setStep("map");
        },
        error: (err: Error) => {
          console.error("[CSV Import] Parse error:", err);
          toast.error(`Failed to parse CSV: ${err.message || "Unknown error"}`);
        },
      });
    } catch (err) {
      console.error("[CSV Import] Unexpected error:", err);
      toast.error(`Failed to read file: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const downloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Build mapped contacts for review/import
  const getMappedContacts = useCallback(() => {
    return csvRows.map((row) => {
      const contact: Record<string, string> = {
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        tags: "",
        notes: "",
      };
      Object.entries(fieldMapping).forEach(([colIdx, field]) => {
        if (field !== "skip") {
          const val = row[parseInt(colIdx)]?.trim() || "";
          // If the field is already set, append (for multiple columns mapped to same field)
          if (contact[field] && val) {
            contact[field] += ", " + val;
          } else if (val) {
            contact[field] = val;
          }
        }
      });
      return contact;
    });
  }, [csvRows, fieldMapping]);

  const getReviewStats = useCallback(() => {
    const mapped = getMappedContacts();
    let ready = 0;
    let errors = 0;
    const errorList: Array<{ row: number; reason: string; data: Record<string, string> }> = [];

    mapped.forEach((c, i) => {
      if (!c.firstName && !c.lastName && !c.phone) {
        errors++;
        errorList.push({
          row: i + 1,
          reason: "Missing required field (need at least First Name, Last Name, or Phone)",
          data: c,
        });
      } else {
        ready++;
      }
    });

    return { total: mapped.length, ready, errors, errorList };
  }, [getMappedContacts]);

  const handleImport = useCallback(async () => {
    const mapped = getMappedContacts();
    if (!mapped || mapped.length === 0) {
      toast.error("No contacts to import");
      return;
    }
    if (!accountId || accountId <= 0) {
      toast.error("No account selected. Please select a sub-account first.");
      return;
    }
    const validContacts = mapped.filter(c => c.firstName || c.lastName || c.phone || c.email);
    if (validContacts.length === 0) {
      toast.error("No valid contacts found. Each row needs at least a name, phone, or email.");
      return;
    }

    // Batch contacts into chunks of 1000 to avoid payload/timeout issues
    const CHUNK_SIZE = 1000;
    const totalChunks = Math.ceil(validContacts.length / CHUNK_SIZE);
    let totalImported = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    const allErrors: Array<{ row: number; data: Record<string, string>; reason: string }> = [];

    setImportProgress({ current: 0, total: validContacts.length });

    try {
      for (let i = 0; i < totalChunks; i++) {
        const chunk = validContacts.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const result = await importMutation.mutateAsync({
          accountId,
          contacts: chunk,
        });
        totalImported += result.imported;
        totalSkipped += result.skipped;
        totalFailed += result.failed;
        if (result.errorRows) allErrors.push(...result.errorRows);
        setImportProgress({ current: Math.min((i + 1) * CHUNK_SIZE, validContacts.length), total: validContacts.length });
      }

      setImportResult({
        imported: totalImported,
        skipped: totalSkipped,
        failed: totalFailed,
        errorRows: allErrors.slice(0, 100),
      });
      setStep("complete");
      setImportProgress(null);
      utils.contacts.list.invalidate();
      utils.contacts.stats.invalidate();
      if (totalImported > 0) {
        toast.success(`${totalImported} contacts imported successfully`);
      }
    } catch (err: any) {
      console.error("[CSV Import] Batch error:", err);
      // If we already imported some, show partial results
      if (totalImported > 0) {
        setImportResult({
          imported: totalImported,
          skipped: totalSkipped,
          failed: totalFailed + (validContacts.length - totalImported - totalSkipped - totalFailed),
          errorRows: allErrors.slice(0, 100),
        });
        setStep("complete");
        toast.warning(`Partial import: ${totalImported} imported, but an error occurred during processing.`);
      } else {
        toast.error(`Import failed: ${err.message || "Unknown error"}`);
      }
      setImportProgress(null);
    }
  }, [getMappedContacts, accountId, importMutation, utils]);

  const hasMappedFields = Object.values(fieldMapping).some((v) => v !== "skip");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-amber-600" />
            Import Contacts from CSV
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-4">
          {(["upload", "map", "review", "complete"] as Step[]).map((s, i) => {
            const labels = ["Upload", "Map Fields", "Review", "Complete"];
            const isActive = s === step;
            const isPast =
              (["upload", "map", "review", "complete"] as Step[]).indexOf(step) > i;
            return (
              <div key={s} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold shrink-0 ${
                    isActive
                      ? "bg-amber-500 text-white"
                      : isPast
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isPast ? "✓" : i + 1}
                </div>
                <span
                  className={`text-xs hidden sm:inline ${
                    isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {labels[i]}
                </span>
                {i < 3 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 ${
                      isPast ? "bg-emerald-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                dragOver
                  ? "border-amber-500 bg-amber-50"
                  : "border-border hover:border-amber-400 hover:bg-amber-50/30"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    Drag & drop your CSV file here
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to browse files (max 50MB)
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="h-4 w-4 mr-1.5" />
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </div>

            <div className="flex items-center justify-center">
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-1.5 text-sm text-amber-600 hover:text-amber-700 font-medium"
              >
                <Download className="h-4 w-4" />
                Download CSV Template
              </button>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Template columns:</p>
              <p>First Name, Last Name, Email, Phone, Tags, Notes</p>
              <p>Tags can be comma-separated (e.g. "lead,facebook,2026")</p>
              <p>At least one of First Name, Last Name, or Phone is required per row</p>
            </div>
          </div>
        )}

        {/* Step 2: Map Fields */}
        {step === "map" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{fileName}</span> —{" "}
                {csvRows.length} rows found
              </p>
              <Badge variant="secondary" className="text-xs">
                {Object.values(fieldMapping).filter((v) => v !== "skip").length} fields
                mapped
              </Badge>
            </div>

            {/* Preview table with mapping dropdowns */}
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {csvHeaders.map((header, idx) => (
                      <TableHead key={idx} className="min-w-[160px]">
                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-muted-foreground">
                            {header}
                          </span>
                          <Select
                            value={fieldMapping[idx] || "skip"}
                            onValueChange={(v) =>
                              setFieldMapping((prev) => ({ ...prev, [idx]: v }))
                            }
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONTACT_FIELDS.map((f) => (
                                <SelectItem key={f.value} value={f.value}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvRows.slice(0, 3).map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {row.map((cell, cellIdx) => (
                        <TableCell
                          key={cellIdx}
                          className={`text-xs ${
                            fieldMapping[cellIdx] === "skip"
                              ? "text-muted-foreground/50"
                              : "text-foreground"
                          }`}
                        >
                          {cell || "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {csvRows.length > 3 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing first 3 of {csvRows.length} rows
              </p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button
                size="sm"
                disabled={!hasMappedFields}
                onClick={() => setStep("review")}
              >
                Review Import
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Import */}
        {step === "review" && (
          <div className="space-y-4">
            {(() => {
              const stats = getReviewStats();
              return (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">Total Rows</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-700">{stats.ready}</p>
                      <p className="text-xs text-emerald-600">Ready to Import</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-red-700">{stats.errors}</p>
                      <p className="text-xs text-red-600">Rows with Errors</p>
                    </div>
                  </div>

                  {stats.errorList.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-red-700 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4" />
                        Rows with errors (will be skipped)
                      </p>
                      <div className="border border-red-200 rounded-lg overflow-x-auto max-h-40">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-red-50">
                              <TableHead className="text-xs w-16">Row</TableHead>
                              <TableHead className="text-xs">Data</TableHead>
                              <TableHead className="text-xs">Error</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.errorList.slice(0, 10).map((err) => (
                              <TableRow key={err.row}>
                                <TableCell className="text-xs font-mono">
                                  {err.row}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {Object.values(err.data).filter(Boolean).join(", ") ||
                                    "Empty row"}
                                </TableCell>
                                <TableCell className="text-xs text-red-600">
                                  {err.reason}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {stats.errorList.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          +{stats.errorList.length - 10} more errors
                        </p>
                      )}
                    </div>
                  )}

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    <p className="font-medium">Before importing:</p>
                    <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                      <li>Duplicate contacts (same email or phone) will be skipped</li>
                      <li>Tags will be auto-created from comma-separated values</li>
                      <li>All contacts will be added with "New" status</li>
                    </ul>
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep("map")}
                      disabled={importMutation.isPending || !!importProgress}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleImport}
                      disabled={stats.ready === 0 || importMutation.isPending || !!importProgress}
                    >
                      {(importMutation.isPending || importProgress) ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          {importProgress ? `Importing ${importProgress.current} / ${importProgress.total}...` : "Importing..."}  
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1.5" />
                          Import {stats.ready} Contact{stats.ready !== 1 ? "s" : ""}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && importResult && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Import Complete</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your contacts have been processed
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">
                  {importResult.imported}
                </p>
                <p className="text-xs text-emerald-600">Imported</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">
                  {importResult.skipped}
                </p>
                <p className="text-xs text-amber-600">Duplicates Skipped</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">
                  {importResult.failed}
                </p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </div>

            {importResult.errorRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  Failed rows
                </p>
                <div className="border border-red-200 rounded-lg overflow-x-auto max-h-40">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-red-50">
                        <TableHead className="text-xs w-16">Row</TableHead>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errorRows.slice(0, 10).map((err) => (
                        <TableRow key={err.row}>
                          <TableCell className="text-xs font-mono">{err.row}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {Object.values(err.data).filter(Boolean).join(", ") ||
                              "Empty row"}
                          </TableCell>
                          <TableCell className="text-xs text-red-600">
                            {err.reason}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <Button size="sm" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
