// @ts-nocheck
import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { erpStore, SystemUser } from "@/shared/services/erpStore";
import {
  getDefaultPermissionsForRole,
  notifyPermissionsUpdated,
} from "@/shared/services/userAuthorization";
import {
  DEFAULT_NEW_USER_PASSWORD,
  normalizeManagedUsername,
  userValidationErrorMessage,
  validateManagedUserForm,
} from "@/features/auth/services/managedUserValidation";
import { queueUserChange } from "@/features/auth/services/userDirectorySync";
import { postAiEndpoint, chunkArray } from "@/shared/services/aiClient";
import {
  BatchEmployeeDraftRow,
  buildBatchEmployeeDrafts,
  fileToBase64Payload,
  isSpreadsheetFile,
  parseSpreadsheetFile,
} from "@/shared/services/aiImportUtils";

interface BulkHrAiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  toast: any;
}

const ROLE_OPTIONS = [
  { value: "cashier", label: "كاشير" },
  { value: "captain", label: "كابتن صالة" },
  { value: "kitchen", label: "شيف / مطبخ" },
  { value: "delivery", label: "توصيل" },
  { value: "accountant", label: "محاسب" },
  { value: "inventory", label: "أمين مخزن" },
  { value: "hr", label: "موارد بشرية" },
  { value: "manager", label: "مدير فرع" },
  { value: "admin", label: "مسؤول نظام" },
];

export function BulkHrAiModal({ open, onOpenChange, onSaved, toast }: BulkHrAiModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<"file" | "text">("file");
  const [rawText, setRawText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rows, setRows] = useState<BatchEmployeeDraftRow[]>([]);

  const applyParsedEmployees = (parsedList: any[]) => {
    const state = erpStore.getState();
    const existingUsers = state.users || [];
    const nextCodeNum = Number(erpStore.getNextEmployeeCode()) || 1001;
    const drafts = buildBatchEmployeeDrafts(parsedList, existingUsers, nextCodeNum);
    setRows(drafts);
  };

  const handleAnalyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    try {
      if (isSpreadsheetFile(file)) {
        const { rows: sheetRows, text } = await parseSpreadsheetFile(file);
        if (sheetRows.length > 0) {
          const chunks = chunkArray(sheetRows, 40);
          const allParsed: any[] = [];
          for (const chunk of chunks) {
            const res = await postAiEndpoint<{ employees: any[] }>("/api/ai/parse-employees", {
              textData: JSON.stringify(chunk),
            });
            allParsed.push(...(res.employees || []));
          }
          applyParsedEmployees(allParsed);
        } else {
          const res = await postAiEndpoint<{ employees: any[] }>("/api/ai/parse-employees", {
            textData: text,
          });
          applyParsedEmployees(res.employees || []);
        }
      } else {
        const { base64, mimeType } = await fileToBase64Payload(file);
        const res = await postAiEndpoint<{ employees: any[] }>("/api/ai/parse-employees", {
          base64,
          mimeType,
        });
        applyParsedEmployees(res.employees || []);
      }
    } catch (err: any) {
      toast({
        title: "تعذر قراءة قائمة الموظفين",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeText = async () => {
    if (!rawText.trim()) return;
    setIsAnalyzing(true);
    try {
      const lines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const chunks = chunkArray(lines, 40);
      const allParsed: any[] = [];
      for (const chunk of chunks) {
        const res = await postAiEndpoint<{ employees: any[] }>("/api/ai/parse-employees", {
          textData: chunk.join("\n"),
        });
        allParsed.push(...(res.employees || []));
      }
      applyParsedEmployees(allParsed);
    } catch (err: any) {
      toast({
        title: "تعذر تحليل القائمة",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const allUsersChecked = rows.length > 0 && rows.every((r) => r.createUser);

  const toggleAllUsers = (checked: boolean) => {
    setRows((prev) => prev.map((r) => ({ ...r, createUser: checked })));
  };

  const handleSaveAll = async () => {
    const validRows = rows.filter((r) => r.name.trim());
    if (validRows.length === 0) return;

    setIsSaving(true);
    try {
      let existingUsers = [...(erpStore.getState().users || [])];

      // Pre-validate all checked user accounts before writing
      const simulatedUsers = [...existingUsers];
      for (const row of validRows) {
        if (!row.createUser) continue;
        const username = normalizeManagedUsername(row.username);
        const email =
          row.email.trim().toLowerCase() || `${username}@restocash.com`;
        const validated = validateManagedUserForm({
          fullName: row.name,
          username,
          email,
          phone: row.phone,
          password: DEFAULT_NEW_USER_PASSWORD,
          passwordConfirmation: DEFAULT_NEW_USER_PASSWORD,
          role: row.role || "cashier",
          hosted: true,
          requireEmail: true,
          requirePassword: true,
          requirePasswordConfirmation: true,
          existingUsers: simulatedUsers,
          editingUserId: null,
        });
        simulatedUsers.push({
          id: `sim-${validated.username}`,
          username: validated.username,
          email: validated.email,
          full_name: validated.fullName,
          phone: validated.phone,
          role: validated.role as any,
          permissions: {},
        });
      }

      let createdUsersCount = 0;
      for (const row of validRows) {
        const createdEmp = erpStore.addEmployee({
          name: row.name.trim(),
          job_title: row.job_title.trim() || "موظف",
          department: row.department.trim() || "الصالة والتوصيل",
          salary: Number(row.salary) || 0,
          currency: row.currency || "EGP",
          phone: row.phone.trim(),
          email: row.email.trim().toLowerCase(),
          status: "active",
          hire_date: new Date().toISOString().split("T")[0],
        });

        if (row.createUser) {
          const username = normalizeManagedUsername(row.username);
          const email =
            row.email.trim().toLowerCase() || `${username}@restocash.com`;
          const permissions = getDefaultPermissionsForRole(row.role || "cashier");
          const newUser: SystemUser = {
            id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            employee_code: createdEmp.employee_code,
            full_name: createdEmp.name,
            username,
            email,
            phone: createdEmp.phone,
            role: (row.role || "cashier") as any,
            password: DEFAULT_NEW_USER_PASSWORD,
            must_change_password: true,
            permissions,
            created_at: new Date().toISOString(),
          };

          if (typeof window !== "undefined") {
            localStorage.removeItem(`restocash_pwd_changed_${newUser.username}`);
          }

          erpStore.upsertUser(newUser);
          erpStore.updateUserPermission(newUser.username, permissions);
          existingUsers.push(newUser);
          createdUsersCount += 1;

          await queueUserChange({
            kind: "create",
            localUserId: newUser.id,
            username: newUser.username,
            email: newUser.email,
            password: DEFAULT_NEW_USER_PASSWORD,
            profile: {
              employee_code: createdEmp.employee_code,
              username: newUser.username,
              email: newUser.email,
              full_name: newUser.full_name,
              phone: newUser.phone,
              role: newUser.role,
              permissions,
            },
          }).catch(() => {});
        }
      }

      if (createdUsersCount > 0) {
        notifyPermissionsUpdated();
      }

      toast({
        title: `تم حفظ ${validRows.length} موظف وإنشاء ${createdUsersCount} يوزر بنجاح`,
      });
      setRows([]);
      setRawText("");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "تعذر إتمام الإضافة الجماعية",
        description: userValidationErrorMessage(err) || err?.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col font-['Tajawal']" dir="rtl">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <Sparkles className="text-primary" size={20} />
            <span>رفع الموظفين والرواتب واليوزرات بالـ AI</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={inputMode === "file" ? "default" : "outline"}
              size="sm"
              onClick={() => setInputMode("file")}
              className="rounded-xl font-bold text-xs"
            >
              <Upload size={14} className="ml-1.5" />
              رفع ملف Excel / صورة كشف
            </Button>
            <Button
              type="button"
              variant={inputMode === "text" ? "default" : "outline"}
              size="sm"
              onClick={() => setInputMode("text")}
              className="rounded-xl font-bold text-xs"
            >
              لصق قائمة نصية
            </Button>
          </div>

          {inputMode === "file" ? (
            <div
              onClick={() => !isAnalyzing && fileInputRef.current?.click()}
              className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-muted/20 rounded-2xl p-6 text-center cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt,image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAnalyzeFile(f);
                  e.target.value = "";
                }}
              />
              {isAnalyzing ? (
                <div className="flex items-center justify-center gap-2 text-primary font-bold text-sm">
                  <Loader2 className="animate-spin" size={20} />
                  <span>جاري القراءة...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-foreground font-bold text-sm">
                  <Upload size={20} className="text-primary" />
                  <span>اختر ملف Excel أو CSV أو صورة كشف الموظفين</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={4}
                placeholder="أحمد علي - كاشير - 6500 - 01012345678&#10;محمود حسن - شيف مشويات - 9000 - 01122334455"
                className="w-full rounded-xl border border-input bg-background p-3 text-xs font-bold resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button
                type="button"
                disabled={isAnalyzing || !rawText.trim()}
                onClick={handleAnalyzeText}
                className="rounded-xl font-bold text-xs gap-1.5"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                <span>تجهيز القائمة</span>
              </Button>
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted text-muted-foreground font-black">
                  <tr className="border-b border-border">
                    <th className="p-2.5 text-center">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allUsersChecked}
                          onChange={(e) => toggleAllUsers(e.target.checked)}
                          className="accent-primary w-4 h-4"
                        />
                        <span>يوزر</span>
                      </label>
                    </th>
                    <th className="p-2.5">الاسم</th>
                    <th className="p-2.5">الوظيفة</th>
                    <th className="p-2.5">الراتب</th>
                    <th className="p-2.5">الهاتف</th>
                    <th className="p-2.5">اليوزر نيم</th>
                    <th className="p-2.5">الصلاحية</th>
                    <th className="p-2.5 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.tempId} className="hover:bg-muted/20">
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.createUser}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId
                                  ? { ...r, createUser: e.target.checked }
                                  : r,
                              ),
                            )
                          }
                          className="accent-primary w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="p-2 min-w-[140px]">
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId ? { ...r, name: e.target.value } : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-bold rounded-lg"
                        />
                      </td>
                      <td className="p-2 min-w-[110px]">
                        <Input
                          value={row.job_title}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId
                                  ? { ...r, job_title: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-bold rounded-lg"
                        />
                      </td>
                      <td className="p-2 w-28">
                        <Input
                          type="number"
                          min="0"
                          value={row.salary}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId
                                  ? { ...r, salary: Number(e.target.value) || 0 }
                                  : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-mono font-bold text-center rounded-lg tabular-nums"
                        />
                      </td>
                      <td className="p-2 w-32">
                        <Input
                          value={row.phone}
                          dir="ltr"
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId ? { ...r, phone: e.target.value } : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-mono rounded-lg"
                        />
                      </td>
                      <td className="p-2 min-w-[130px]">
                        <Input
                          value={row.username}
                          dir="ltr"
                          disabled={!row.createUser}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId
                                  ? {
                                      ...r,
                                      username: e.target.value,
                                      email: `${normalizeManagedUsername(e.target.value)}@restocash.com`,
                                    }
                                  : r,
                              ),
                            )
                          }
                          className="h-8 text-xs font-mono font-bold rounded-lg disabled:opacity-40"
                        />
                      </td>
                      <td className="p-2 min-w-[110px]">
                        <select
                          value={row.role}
                          disabled={!row.createUser}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.tempId === row.tempId ? { ...r, role: e.target.value } : r,
                              ),
                            )
                          }
                          className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs font-bold disabled:opacity-40"
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setRows((prev) => prev.filter((r) => r.tempId !== row.tempId))
                          }
                          className="btn-uniform-delete p-1.5 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="border-t border-border pt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-black text-foreground tabular-nums">
              {rows.length} موظف — {rows.filter((r) => r.createUser).length} يوزر
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl font-bold text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                onClick={handleSaveAll}
                className="btn-uniform-save rounded-xl font-black text-xs px-5 gap-1.5"
              >
                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                <span>حفظ الموظفين واليوزرات</span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
