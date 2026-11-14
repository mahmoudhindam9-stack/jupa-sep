import React, { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  CheckCircle2,
  Edit,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  Hash,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Store,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  detectMallShopLocationFromNumber,
  erpStore,
  MALL_SHOP_CONSTRUCTION_LABELS,
  MALL_SHOP_LOCATION_LABELS,
  resolveMallShopLocation,
  type MallCustomFieldDefinition,
  type MallCustomFieldType,
  type MallShop,
  type MallShopConstructionStatus,
  type MallShopLocationZone,
  type MallShopsSyncReport,
} from "@/shared/services/erpStore";

export const CUSTOM_FIELD_TYPE_LABELS: Record<MallCustomFieldType, string> = {
  text: "نص (Text)",
  number: "رقم (Number)",
  date: "تاريخ (Date)",
  dropdown: "قائمة منسدلة (Dropdown)",
  multiple_choice: "اختيار متعدد (Multiple Choice)",
  checkbox: "مربع اختيار نعم/لا (Checkbox)",
};

export function formatCustomFieldValue(
  field: MallCustomFieldDefinition,
  rawValue: any,
): string {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return "-";
  }
  if (field.type === "checkbox") {
    return rawValue === true || rawValue === "true" || rawValue === 1 ? "نعم" : "لا";
  }
  if (Array.isArray(rawValue)) {
    return rawValue.length > 0 ? rawValue.join(" ، ") : "-";
  }
  return String(rawValue);
}

export function getShopCustomFieldsDisplayList(
  shop: Partial<MallShop> | null | undefined,
  fields: MallCustomFieldDefinition[],
): Array<{ field: MallCustomFieldDefinition; label: string; value: string; hasValue: boolean }> {
  if (!shop) return [];
  const activeFields = fields.filter((f) => f.enabled && !f.archived);
  const customBag = shop.custom_fields || {};
  return activeFields.map((field) => {
    const raw = customBag[field.key];
    const formatted = formatCustomFieldValue(field, raw);
    const hasValue =
      field.type === "checkbox"
        ? raw !== undefined && raw !== null
        : formatted !== "-" && formatted.trim() !== "";
    return {
      field,
      label: field.name_ar,
      value: formatted,
      hasValue,
    };
  });
}

export const MallShopCustomFieldsInputs: React.FC<{
  fields: MallCustomFieldDefinition[];
  values: Record<string, any>;
  onChange: (nextValues: Record<string, any>) => void;
}> = ({ fields, values, onChange }) => {
  const activeFields = useMemo(
    () => fields.filter((f) => f.enabled && !f.archived).sort((a, b) => a.order - b.order),
    [fields],
  );

  if (activeFields.length === 0) {
    return null;
  }

  const updateKey = (key: string, val: any) => {
    onChange({
      ...(values || {}),
      [key]: val,
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5">
      <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
        <span className="flex items-center gap-1.5 text-xs font-black text-indigo-900">
          <Sliders className="h-3.5 w-3.5 text-indigo-600" />
          الحقول المخصصة الإضافية للمحل ({activeFields.length})
        </span>
        <span className="text-[11px] font-semibold text-indigo-600">
          تظهر تلقائياً في العقود والتقارير
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {activeFields.map((field) => {
          const val = values?.[field.key];
          return (
            <div key={field.id} className="space-y-1.5">
              <Label className="flex items-center gap-1 text-xs font-bold text-slate-700">
                <span>{field.name_ar}</span>
                {field.required && <span className="text-rose-600">*</span>}
              </Label>

              {field.type === "text" && (
                <Input
                  value={val ?? ""}
                  onChange={(e) => updateKey(field.key, e.target.value)}
                  placeholder={`أدخل ${field.name_ar}...`}
                  className="h-9 bg-white text-xs font-bold"
                />
              )}

              {field.type === "number" && (
                <Input
                  type="number"
                  value={val ?? ""}
                  onChange={(e) =>
                    updateKey(field.key, e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="0"
                  className="h-9 bg-white font-mono text-xs font-bold"
                />
              )}

              {field.type === "date" && (
                <Input
                  type="date"
                  value={val ?? ""}
                  onChange={(e) => updateKey(field.key, e.target.value)}
                  className="h-9 bg-white font-mono text-xs font-bold"
                />
              )}

              {field.type === "dropdown" && (
                <select
                  value={val ?? ""}
                  onChange={(e) => updateKey(field.key, e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- اختر {field.name_ar} --</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {field.type === "multiple_choice" && (
                <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-white p-2">
                  {(field.options || []).length === 0 ? (
                    <span className="text-[11px] text-slate-400">لا توجد خيارات معرفة</span>
                  ) : (
                    (field.options || []).map((opt) => {
                      const selectedList: string[] = Array.isArray(val) ? val : [];
                      const isChecked = selectedList.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            const next = isChecked
                              ? selectedList.filter((item) => item !== opt)
                              : [...selectedList, opt];
                            updateKey(field.key, next);
                          }}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-all ${
                            isChecked
                              ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3" />}
                          {opt}
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {field.type === "checkbox" && (
                <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) => updateKey(field.key, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{Boolean(val) ? "نعم (مفعل / متوفر)" : "لا (غير مفعل)"}</span>
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface EditShopDataAdminPanelProps {
  shops: MallShop[];
  customFields: MallCustomFieldDefinition[];
  onRefresh: () => void;
  onOpenAddShopModal?: () => void;
}

export const EditShopDataAdminPanel: React.FC<EditShopDataAdminPanelProps> = ({
  shops,
  customFields,
  onRefresh,
  onOpenAddShopModal,
}) => {
  const [subTab, setSubTab] = useState<"shops_editor" | "custom_fields_builder" | "sync_audit">(
    "shops_editor",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [constructionFilter, setConstructionFilter] = useState<string>("all");

  // Shop Edit Modal state
  const [editingShop, setEditingShop] = useState<MallShop | null>(null);
  const [editForm, setEditForm] = useState<{
    shop_number: string;
    name_ar: string;
    account_number: string;
    tenant_name: string;
    phone: string;
    space_sqm: number;
    monthly_rent: number;
    status: "rented" | "vacant" | "maintenance";
    construction_status: MallShopConstructionStatus;
    location_override: boolean;
    location_zone: MallShopLocationZone;
    notes: string;
    custom_fields: Record<string, any>;
  } | null>(null);

  // Custom Field Builder Modal / Form state
  const [showArchivedFields, setShowArchivedFields] = useState(false);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldForm, setFieldForm] = useState<{
    name_ar: string;
    name_en: string;
    type: MallCustomFieldType;
    optionsText: string;
    required: boolean;
    enabled: boolean;
  }>({
    name_ar: "",
    name_en: "",
    type: "text",
    optionsText: "",
    required: false,
    enabled: true,
  });

  // Sync Report state
  const [syncReport, setSyncReport] = useState<MallShopsSyncReport | undefined>(
    () => erpStore.getState().lastMallSyncReport,
  );

  const allCustomFieldsIncludingArchived = useMemo(
    () => erpStore.getMallCustomFields(true),
    [customFields, showArchivedFields],
  );

  const visibleBuilderFields = useMemo(
    () =>
      allCustomFieldsIncludingArchived.filter((f) =>
        showArchivedFields ? true : !f.archived,
      ),
    [allCustomFieldsIncludingArchived, showArchivedFields],
  );

  const activeCustomFields = useMemo(
    () => customFields.filter((f) => f.enabled && !f.archived).sort((a, b) => a.order - b.order),
    [customFields],
  );

  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(shop.shop_number || "")
          .toLowerCase()
          .includes(q) ||
        String(shop.serial_number || "")
          .toLowerCase()
          .includes(q) ||
        String(shop.name_ar || "")
          .toLowerCase()
          .includes(q) ||
        String(shop.tenant_name || "")
          .toLowerCase()
          .includes(q) ||
        String(shop.account_number || "")
          .toLowerCase()
          .includes(q);

      const resolvedZone = resolveMallShopLocation(shop);
      const matchesZone = zoneFilter === "all" || resolvedZone === zoneFilter;

      const cStatus = shop.construction_status || "finished";
      const matchesConstruction =
        constructionFilter === "all" || cStatus === constructionFilter;

      return matchesSearch && matchesZone && matchesConstruction;
    });
  }, [shops, searchTerm, zoneFilter, constructionFilter]);

  const zoneCounts = useMemo(() => {
    const counts: Record<MallShopLocationZone, number> = {
      central: 0,
      park: 0,
      ground_floor: 0,
      first_floor: 0,
      roof: 0,
      other: 0,
    };
    shops.forEach((s) => {
      const z = resolveMallShopLocation(s);
      counts[z] = (counts[z] || 0) + 1;
    });
    return counts;
  }, [shops]);

  const openShopEditor = (shop: MallShop) => {
    const resolvedZone = resolveMallShopLocation(shop);
    setEditingShop(shop);
    setEditForm({
      shop_number: shop.shop_number || "",
      name_ar: shop.name_ar || "",
      account_number: shop.account_number || "",
      tenant_name: shop.tenant_name || "",
      phone: shop.phone || "",
      space_sqm: Number(shop.space_sqm || 0),
      monthly_rent: Number(shop.monthly_rent || 0),
      status: shop.status || "vacant",
      construction_status: shop.construction_status || "finished",
      location_override: Boolean(shop.location_override),
      location_zone: resolvedZone,
      notes: shop.notes || "",
      custom_fields: { ...(shop.custom_fields || {}) },
    });
  };

  const handleSaveShopEdit = () => {
    if (!editingShop || !editForm) return;
    if (!editForm.shop_number.trim()) {
      toast.error("يرجى إدخال رقم المحل");
      return;
    }

    // Validate required custom fields
    for (const field of activeCustomFields) {
      if (field.required) {
        const v = editForm.custom_fields?.[field.key];
        const isEmpty =
          v === undefined ||
          v === null ||
          v === "" ||
          (Array.isArray(v) && v.length === 0);
        if (isEmpty && field.type !== "checkbox") {
          toast.error(`يرجى تعبئة الحقل الإلزامي: ${field.name_ar}`);
          return;
        }
      }
    }

    const finalLocationZone = editForm.location_override
      ? editForm.location_zone
      : detectMallShopLocationFromNumber(editForm.shop_number);

    erpStore.updateMallShop(editingShop.id, {
      shop_number: editForm.shop_number.trim(),
      name_ar: editForm.name_ar.trim(),
      account_number: editForm.account_number.trim(),
      tenant_name: editForm.tenant_name.trim(),
      phone: editForm.phone.trim(),
      space_sqm: Number(editForm.space_sqm || 0),
      monthly_rent: Number(editForm.monthly_rent || 0),
      status: editForm.status,
      construction_status: editForm.construction_status,
      location_override: editForm.location_override,
      location_zone: finalLocationZone,
      notes: editForm.notes,
      custom_fields: editForm.custom_fields,
    });

    onRefresh();
    setEditingShop(null);
    setEditForm(null);
    toast.success(`تم حفظ تعديلات المحل (${editForm.shop_number}) بنجاح`);
  };

  const handleInlineConstructionChange = (
    shop: MallShop,
    nextStatus: MallShopConstructionStatus,
  ) => {
    erpStore.updateMallShop(shop.id, {
      construction_status: nextStatus,
    });
    onRefresh();
    toast.success(
      `تم تحديث حالة الإنشاء للمحل ${shop.shop_number} إلى (${MALL_SHOP_CONSTRUCTION_LABELS[nextStatus].ar})`,
    );
  };

  const handleInlineLocationChange = (
    shop: MallShop,
    nextZone: MallShopLocationZone | "AUTO",
  ) => {
    if (nextZone === "AUTO") {
      const detected = detectMallShopLocationFromNumber(shop.shop_number);
      erpStore.updateMallShop(shop.id, {
        location_override: false,
        location_zone: detected,
      });
      onRefresh();
      toast.success(
        `تم تفعيل التحديد التلقائي لموقع المحل ${shop.shop_number}: ${MALL_SHOP_LOCATION_LABELS[detected].ar}`,
      );
    } else {
      erpStore.updateMallShop(shop.id, {
        location_override: true,
        location_zone: nextZone,
      });
      onRefresh();
      toast.success(
        `تم تخصيص موقع المحل ${shop.shop_number} يدوياً إلى: ${MALL_SHOP_LOCATION_LABELS[nextZone].ar}`,
      );
    }
  };

  const handleRunSafeSync = () => {
    const report = erpStore.syncMallShops(true);
    setSyncReport(report);
    onRefresh();
    toast.success(
      `تمت المزامنة الآمنة بنجاح: إجمالي المحلات المعتمدة ${report.finalCount} محل دون المساس بأي عقود أو مدفوعات`,
    );
  };

  const openNewFieldModal = () => {
    setEditingFieldId(null);
    setFieldForm({
      name_ar: "",
      name_en: "",
      type: "text",
      optionsText: "",
      required: false,
      enabled: true,
    });
    setIsFieldModalOpen(true);
  };

  const openEditFieldModal = (field: MallCustomFieldDefinition) => {
    setEditingFieldId(field.id);
    setFieldForm({
      name_ar: field.name_ar,
      name_en: field.name_en || "",
      type: field.type,
      optionsText: (field.options || []).join("\n"),
      required: Boolean(field.required),
      enabled: field.enabled,
    });
    setIsFieldModalOpen(true);
  };

  const handleSaveCustomField = () => {
    if (!fieldForm.name_ar.trim()) {
      toast.error("يرجى إدخال اسم الحقل بالعربية");
      return;
    }
    const parsedOptions =
      fieldForm.type === "dropdown" || fieldForm.type === "multiple_choice"
        ? fieldForm.optionsText
            .split(/\r?\n|,|،/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    if (
      (fieldForm.type === "dropdown" || fieldForm.type === "multiple_choice") &&
      (!parsedOptions || parsedOptions.length === 0)
    ) {
      toast.error("يرجى إدخال خيار واحد على الأقل للقائمة المنسدلة / الاختيار المتعدد");
      return;
    }

    if (editingFieldId) {
      erpStore.updateMallCustomField(editingFieldId, {
        name_ar: fieldForm.name_ar.trim(),
        name_en: fieldForm.name_en.trim() || undefined,
        type: fieldForm.type,
        options: parsedOptions,
        required: fieldForm.required,
        enabled: fieldForm.enabled,
      });
      toast.success("تم تحديث إعدادات الحقل المخصص بنجاح");
    } else {
      erpStore.addMallCustomField({
        name_ar: fieldForm.name_ar.trim(),
        name_en: fieldForm.name_en.trim() || undefined,
        type: fieldForm.type,
        options: parsedOptions,
        required: fieldForm.required,
        enabled: fieldForm.enabled,
      });
      toast.success("تم إضافة الحقل المخصص الجديد بنجاح");
    }

    setIsFieldModalOpen(false);
    onRefresh();
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Summary & Action Bar */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-4 text-white shadow-lg">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-black text-indigo-300 ring-1 ring-indigo-400/30">
                <Settings2 className="h-3.5 w-3.5" />
                إدارة تعريفات المحلات المتقدمة
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-300 ring-1 ring-emerald-400/30">
                <ShieldCheck className="h-3.5 w-3.5" />
                إجمالي المحلات المزامنة: {shops.length} محل
              </span>
            </div>
            <h2 className="text-lg font-black text-white sm:text-xl">
              تعديل بيانات المحلات، حالات الإنشاء، المواقع التلقائية، والحقول المخصصة
            </h2>
            <p className="text-xs text-slate-300">
              الأرقام التسلسلية الدائمة (SHP-XXXX) مستقلة عن رقم المحل، مع اكتشاف تلقائي للموقع حسب البادئة (D, B, G, F, R) وإمكانية التخصيص اليدوي وبناء حقول ديناميكية تظهر في العقود والتقارير.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenAddShopModal && (
              <Button
                onClick={onOpenAddShopModal}
                className="gap-1.5 bg-emerald-600 font-bold text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                إضافة محل جديد
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleRunSafeSync}
              className="gap-1.5 border-indigo-400/40 bg-white/10 font-bold text-white hover:bg-white/20"
            >
              <RefreshCw className="h-4 w-4 text-amber-300" />
              مزامنة آمنة للمحلات ({shops.length})
            </Button>
          </div>
        </div>

        {/* Location Zone Quick Badges */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(Object.keys(MALL_SHOP_LOCATION_LABELS) as MallShopLocationZone[]).map((zoneKey) => {
            const info = MALL_SHOP_LOCATION_LABELS[zoneKey];
            const count = zoneCounts[zoneKey] || 0;
            const isSelected = zoneFilter === zoneKey;
            return (
              <button
                key={zoneKey}
                type="button"
                onClick={() => {
                  setSubTab("shops_editor");
                  setZoneFilter(isSelected ? "all" : zoneKey);
                }}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-right transition-all ${
                  isSelected
                    ? "border-amber-400 bg-white/20 text-white shadow-md"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                }`}
              >
                <div>
                  <div className="text-[10px] font-bold text-slate-300">
                    بادئة ({info.prefix})
                  </div>
                  <div className="text-xs font-black">{info.ar}</div>
                </div>
                <span className="rounded-lg bg-white/15 px-2 py-0.5 font-mono text-sm font-black text-amber-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-navigation Tabs inside Edit Shop Data page */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab("shops_editor")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black transition-all ${
              subTab === "shops_editor"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Store className="h-4 w-4" />
            جدول تعديل بيانات المحلات ({shops.length})
          </button>

          <button
            type="button"
            onClick={() => setSubTab("custom_fields_builder")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black transition-all ${
              subTab === "custom_fields_builder"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <Sliders className="h-4 w-4" />
            منشئ الحقول المخصصة الديناميكية ({activeCustomFields.length} نشط)
          </button>

          <button
            type="button"
            onClick={() => setSubTab("sync_audit")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-black transition-all ${
              subTab === "sync_audit"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            تقرير مطابقة ومزامنة المحلات (42 ← {shops.length})
          </button>
        </div>

        {subTab === "custom_fields_builder" && (
          <Button
            onClick={openNewFieldModal}
            size="sm"
            className="gap-1.5 bg-indigo-600 font-bold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            إضافة حقل مخصص جديد
          </Button>
        )}
      </div>

      {/* TAB 1: SHOPS DATA EDITOR */}
      {subTab === "shops_editor" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3 pt-3">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ابحث برقم المحل (D1, F1...)، الرقم التسلسلي (SHP-0001)، اسم النشاط، أو المستأجر..."
                  className="h-9 bg-white pr-9 text-xs font-bold"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                >
                  <option value="all">كل المواقع ({shops.length})</option>
                  {(Object.keys(MALL_SHOP_LOCATION_LABELS) as MallShopLocationZone[]).map(
                    (zKey) => (
                      <option key={zKey} value={zKey}>
                        {MALL_SHOP_LOCATION_LABELS[zKey].ar} ({zoneCounts[zKey] || 0})
                      </option>
                    ),
                  )}
                </select>

                <select
                  value={constructionFilter}
                  onChange={(e) => setConstructionFilter(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
                >
                  <option value="all">كل حالات الإنشاء والتجهيز</option>
                  {(
                    Object.keys(MALL_SHOP_CONSTRUCTION_LABELS) as MallShopConstructionStatus[]
                  ).map((cKey) => (
                    <option key={cKey} value={cKey}>
                      {MALL_SHOP_CONSTRUCTION_LABELS[cKey].ar}
                    </option>
                  ))}
                </select>

                {(searchTerm || zoneFilter !== "all" || constructionFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("");
                      setZoneFilter("all");
                      setConstructionFilter("all");
                    }}
                    className="h-9 text-xs font-bold text-rose-600"
                  >
                    إعادة تعيين الفلتر
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100/80">
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      المسلسل الدائم
                    </TableHead>
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      رقم المحل
                    </TableHead>
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      اسم النشاط / المستأجر
                    </TableHead>
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      الموقع (تلقائي / يدوي)
                    </TableHead>
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      حالة الإنشاء والتجهيز
                    </TableHead>
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      حالة الإشغال
                    </TableHead>
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      الحقول المخصصة
                    </TableHead>
                    <TableHead className="text-center text-xs font-black text-slate-700">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShops.map((shop) => {
                    const resolvedZone = resolveMallShopLocation(shop);
                    const zoneInfo = MALL_SHOP_LOCATION_LABELS[resolvedZone];
                    const detectedZone = detectMallShopLocationFromNumber(shop.shop_number);
                    const cStatus: MallShopConstructionStatus =
                      shop.construction_status || "finished";
                    const customSummary = getShopCustomFieldsDisplayList(
                      shop,
                      activeCustomFields,
                    );

                    return (
                      <TableRow key={shop.id} className="hover:bg-indigo-50/30">
                        <TableCell className="font-mono text-xs font-black text-indigo-700">
                          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5">
                            <Hash className="h-3 w-3 text-indigo-500" />
                            {shop.serial_number || "SHP-0000"}
                          </span>
                        </TableCell>

                        <TableCell className="font-mono text-sm font-black text-slate-900">
                          {shop.shop_number}
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-black text-slate-900">{shop.name_ar}</div>
                          <div className="text-[11px] font-semibold text-slate-500">
                            المستأجر: {shop.tenant_name || "-"} | المساحة:{" "}
                            {shop.space_sqm || "-"} م²
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${zoneInfo.badgeClass}`}
                              >
                                <MapPin className="h-3 w-3" />
                                {zoneInfo.ar}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  shop.location_override
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {shop.location_override ? "يدوي" : "تلقائي"}
                              </span>
                            </div>
                            <select
                              value={shop.location_override ? resolvedZone : "AUTO"}
                              onChange={(e) =>
                                handleInlineLocationChange(
                                  shop,
                                  e.target.value as MallShopLocationZone | "AUTO",
                                )
                              }
                              className="h-7 w-44 rounded border border-slate-200 bg-white px-1.5 text-[11px] font-bold text-slate-700"
                            >
                              <option value="AUTO">
                                تلقائي ({MALL_SHOP_LOCATION_LABELS[detectedZone].ar})
                              </option>
                              {(
                                Object.keys(MALL_SHOP_LOCATION_LABELS) as MallShopLocationZone[]
                              ).map((zKey) => (
                                <option key={zKey} value={zKey}>
                                  تخصيص يدوي: {MALL_SHOP_LOCATION_LABELS[zKey].ar}
                                </option>
                              ))}
                            </select>
                          </div>
                        </TableCell>

                        <TableCell>
                          <select
                            value={cStatus}
                            onChange={(e) =>
                              handleInlineConstructionChange(
                                shop,
                                e.target.value as MallShopConstructionStatus,
                              )
                            }
                            className={`h-8 rounded-lg border px-2.5 text-xs font-bold ${MALL_SHOP_CONSTRUCTION_LABELS[cStatus].badgeClass}`}
                          >
                            {(
                              Object.keys(
                                MALL_SHOP_CONSTRUCTION_LABELS,
                              ) as MallShopConstructionStatus[]
                            ).map((cKey) => (
                              <option
                                key={cKey}
                                value={cKey}
                                className="bg-white text-slate-900"
                              >
                                {MALL_SHOP_CONSTRUCTION_LABELS[cKey].ar}
                              </option>
                            ))}
                          </select>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              shop.status === "rented"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : shop.status === "vacant"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-rose-200 bg-rose-50 text-rose-700"
                            }
                          >
                            {shop.status === "rented"
                              ? "مؤجر"
                              : shop.status === "vacant"
                                ? "شاغر"
                                : "صيانة"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex max-w-[230px] flex-wrap gap-1">
                            {customSummary.length === 0 ? (
                              <span className="text-[11px] text-slate-400">لا توجد حقول نشطة</span>
                            ) : (
                              customSummary.map(({ field, label, value, hasValue }) => (
                                <span
                                  key={field.id}
                                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                                    hasValue
                                      ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                                      : "border-slate-200 bg-slate-50 text-slate-400"
                                  }`}
                                >
                                  <span>{label}:</span>
                                  <span className="font-black">{value}</span>
                                </span>
                              ))
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openShopEditor(shop)}
                            className="h-8 gap-1 border-indigo-200 bg-indigo-50/60 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            تعديل شامل
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {filteredShops.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-400">
                        لا توجد محلات مطابقة لمعايير البحث الحالية.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: DYNAMIC CUSTOM FIELDS BUILDER */}
      {subTab === "custom_fields_builder" && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-black text-slate-900">
                  منشئ الحقول المخصصة الديناميكية للمحلات
                </CardTitle>
                <p className="text-xs text-slate-500">
                  أضف أو عدل أو رتب أو أرشف أي حقل مخصص للمحلات. الحقول المفعلة تظهر فوراً في بطاقة المحل، العقود، التقارير، وملفات التصدير.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showArchivedFields}
                    onChange={(e) => setShowArchivedFields(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                  />
                  إظهار الحقول المؤرشفة
                </label>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100/80">
                    <TableHead className="w-20 text-center text-xs font-black text-slate-700">
                      الترتيب
                    </TableHead>
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      اسم الحقل (عربي / إنجليزي)
                    </TableHead>
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      نوع الحقل
                    </TableHead>
                    <TableHead className="text-right text-xs font-black text-slate-700">
                      الخيارات المتاحة
                    </TableHead>
                    <TableHead className="text-center text-xs font-black text-slate-700">
                      الحالة
                    </TableHead>
                    <TableHead className="text-center text-xs font-black text-slate-700">
                      التحكم والترتيب
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleBuilderFields.map((field, idx) => (
                    <TableRow
                      key={field.id}
                      className={field.archived ? "bg-slate-50 opacity-60" : ""}
                    >
                      <TableCell className="text-center font-mono text-xs font-black text-slate-600">
                        #{idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                          <span>{field.name_ar}</span>
                          {field.required && (
                            <Badge className="bg-rose-100 text-[10px] text-rose-700">
                              إلزامي
                            </Badge>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {field.name_en || field.key}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700"
                        >
                          {CUSTOM_FIELD_TYPE_LABELS[field.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {field.options && field.options.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {field.options.map((opt) => (
                              <span
                                key={opt}
                                className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700"
                              >
                                {opt}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {field.archived ? (
                          <Badge
                            variant="outline"
                            className="border-slate-300 bg-slate-100 text-slate-600"
                          >
                            مؤرشف
                          </Badge>
                        ) : field.enabled ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            مفعل ونشط
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700"
                          >
                            معطل مؤقتاً
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={idx === 0}
                            onClick={() => {
                              erpStore.moveMallCustomField(field.id, "up");
                              onRefresh();
                            }}
                            title="تحريك لأعلى"
                            className="h-7 w-7 p-0"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={idx === visibleBuilderFields.length - 1}
                            onClick={() => {
                              erpStore.moveMallCustomField(field.id, "down");
                              onRefresh();
                            }}
                            title="تحريك لأسفل"
                            className="h-7 w-7 p-0"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditFieldModal(field)}
                            className="h-7 gap-1 px-2 text-[11px] font-bold"
                          >
                            <Edit className="h-3 w-3" />
                            تعديل
                          </Button>
                          {!field.archived && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                erpStore.toggleMallCustomFieldEnabled(field.id);
                                onRefresh();
                              }}
                              className="h-7 gap-1 px-2 text-[11px] font-bold"
                            >
                              {field.enabled ? (
                                <>
                                  <EyeOff className="h-3 w-3 text-amber-600" />
                                  تعطيل
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3 text-emerald-600" />
                                  تفعيل
                                </>
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              erpStore.archiveMallCustomField(field.id, !field.archived);
                              onRefresh();
                              toast.success(
                                field.archived
                                  ? `تمت استعادة الحقل (${field.name_ar}) من الأرشيف`
                                  : `تمت أرشفة الحقل (${field.name_ar}) مع الاحتفاظ ببياناته التاريخية`,
                              );
                            }}
                            className="h-7 gap-1 px-2 text-[11px] font-bold text-slate-600"
                          >
                            {field.archived ? (
                              <>
                                <ArchiveRestore className="h-3 w-3 text-emerald-600" />
                                استعادة
                              </>
                            ) : (
                              <>
                                <Archive className="h-3 w-3 text-rose-600" />
                                أرشفة
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: SYNCHRONIZATION & 42 vs 51 RECONCILIATION AUDIT */}
      {subTab === "sync_audit" && (
        <div className="space-y-4">
          <Card className="border-emerald-200 bg-emerald-50/30 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base font-black text-emerald-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ملخص توحيد ومزامنة محلات المول (حل مشكلة 42 مقابل 51 محل)
                </CardTitle>
                <Button
                  size="sm"
                  onClick={handleRunSafeSync}
                  className="gap-1.5 bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  تشغيل فحص ومزامنة فورية
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-emerald-200 bg-white p-3">
                  <div className="text-[11px] font-bold text-slate-500">
                    العدد النهائي الموحد للمحلات
                  </div>
                  <div className="mt-1 font-mono text-2xl font-black text-emerald-700">
                    {shops.length} محل
                  </div>
                </div>
                <div className="rounded-xl border border-indigo-200 bg-white p-3">
                  <div className="text-[11px] font-bold text-slate-500">
                    وحدات مسترجعة من شجرة أوراكل (F1-F8, R1)
                  </div>
                  <div className="mt-1 font-mono text-2xl font-black text-indigo-700">
                    9 وحدات
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-white p-3">
                  <div className="text-[11px] font-bold text-slate-500">
                    العقود النشطة المحفوظة بالكامل
                  </div>
                  <div className="mt-1 font-mono text-2xl font-black text-amber-700">
                    {shops.filter((s) => Boolean(s.contract)).length} عقد
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-white p-3">
                  <div className="text-[11px] font-bold text-slate-500">
                    تعارضات أو تكرارات تم حلها
                  </div>
                  <div className="mt-1 font-mono text-2xl font-black text-blue-700">
                    {syncReport?.duplicatesResolved?.length || 0}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <h4 className="mb-2 font-black text-slate-900">
                  توزيع الـ {shops.length} محل المعتمدة حسب الموقع والبادئة:
                </h4>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <li className="rounded-lg bg-slate-50 p-2 font-bold">
                    • السنتر (D1–D21, D30–D32):{" "}
                    <span className="font-mono text-indigo-700">{zoneCounts.central} محل</span>
                  </li>
                  <li className="rounded-lg bg-slate-50 p-2 font-bold">
                    • المنتزه / الحديقة (B1–B10):{" "}
                    <span className="font-mono text-emerald-700">{zoneCounts.park} محلات</span>
                  </li>
                  <li className="rounded-lg bg-slate-50 p-2 font-bold">
                    • الدور الأرضي (G2–G9):{" "}
                    <span className="font-mono text-sky-700">{zoneCounts.ground_floor} محلات</span>
                  </li>
                  <li className="rounded-lg bg-slate-50 p-2 font-bold">
                    • الدور الأول (F1–F8):{" "}
                    <span className="font-mono text-amber-700">{zoneCounts.first_floor} محلات</span>
                  </li>
                  <li className="rounded-lg bg-slate-50 p-2 font-bold">
                    • الروف / السطح (R1):{" "}
                    <span className="font-mono text-purple-700">{zoneCounts.roof} وحدة</span>
                  </li>
                  <li className="rounded-lg bg-slate-50 p-2 font-bold">
                    • مواقع أخرى / مخصصة:{" "}
                    <span className="font-mono text-slate-700">{zoneCounts.other} وحدة</span>
                  </li>
                </ul>
              </div>

              {syncReport?.discrepancies && syncReport.discrepancies.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                  <h4 className="mb-1.5 font-black text-amber-900">
                    حسابات أوراكل المركبة / المتداخلة التي تم رصدها دون إنشاء أرقام محلات وهمية ({syncReport.discrepancies.length}):
                  </h4>
                  <div className="space-y-1.5">
                    {syncReport.discrepancies.map((d) => (
                      <div
                        key={d.account_number}
                        className="flex flex-col justify-between gap-1 rounded-lg border border-amber-200/80 bg-white px-3 py-2 sm:flex-row sm:items-center"
                      >
                        <div className="font-bold text-slate-900">
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-900">
                            {d.account_number}
                          </span>
                          {d.oracle_name}
                        </div>
                        <div className="text-[11px] font-semibold text-amber-800">{d.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SHOP FULL EDIT DIALOG */}
      <Dialog
        open={Boolean(editingShop && editForm)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingShop(null);
            setEditForm(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-right text-base font-black">
              <span>
                تعديل بيانات المحل الشامل ({editingShop?.shop_number})
              </span>
              <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-mono text-xs font-black text-indigo-700">
                المسلسل الدائم: {editingShop?.serial_number}
              </span>
            </DialogTitle>
          </DialogHeader>

          {editForm && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">الرقم التسلسلي الدائم (تلقائي ثابت)</Label>
                  <Input
                    value={editingShop?.serial_number || ""}
                    disabled
                    className="h-9 bg-slate-100 font-mono text-xs font-black text-indigo-700"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">رقم المحل (Shop No.)</Label>
                  <Input
                    value={editForm.shop_number}
                    onChange={(e) => {
                      const nextNum = e.target.value;
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              shop_number: nextNum,
                              location_zone: prev.location_override
                                ? prev.location_zone
                                : detectMallShopLocationFromNumber(nextNum),
                            }
                          : prev,
                      );
                    }}
                    className="h-9 font-mono text-xs font-black"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">رقم الحساب المالي</Label>
                  <Input
                    value={editForm.account_number}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, account_number: e.target.value } : prev,
                      )
                    }
                    className="h-9 font-mono text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">اسم المحل / النشاط التجاري</Label>
                  <Input
                    value={editForm.name_ar}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, name_ar: e.target.value } : prev))
                    }
                    className="h-9 text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">اسم المستأجر الحالي</Label>
                  <Input
                    value={editForm.tenant_name}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, tenant_name: e.target.value } : prev,
                      )
                    }
                    className="h-9 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Location Auto-Detection & Override Box */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-black text-slate-900">
                      موقع المحل (اكتشاف تلقائي من رقم المحل: D=السنتر، B=المنتزه، G=الأرضي، F=الأول، R=الروف)
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      الموقع المكتشف تلقائياً للرقم ({editForm.shop_number || "-"}):{" "}
                      <span className="font-black text-indigo-700">
                        {
                          MALL_SHOP_LOCATION_LABELS[
                            detectMallShopLocationFromNumber(editForm.shop_number)
                          ].ar
                        }
                      </span>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900">
                    <input
                      type="checkbox"
                      checked={editForm.location_override}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEditForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                location_override: checked,
                                location_zone: checked
                                  ? prev.location_zone
                                  : detectMallShopLocationFromNumber(prev.shop_number),
                              }
                            : prev,
                        );
                      }}
                      className="h-3.5 w-3.5 rounded"
                    />
                    تعديل يدوي للموقع (Override)
                  </label>
                </div>

                <div className="mt-2">
                  <select
                    disabled={!editForm.location_override}
                    value={
                      editForm.location_override
                        ? editForm.location_zone
                        : detectMallShopLocationFromNumber(editForm.shop_number)
                    }
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              location_zone: e.target.value as MallShopLocationZone,
                            }
                          : prev,
                      )
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    {(Object.keys(MALL_SHOP_LOCATION_LABELS) as MallShopLocationZone[]).map(
                      (zKey) => (
                        <option key={zKey} value={zKey}>
                          {MALL_SHOP_LOCATION_LABELS[zKey].ar}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              {/* Construction Condition vs Occupancy Status */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-indigo-900">
                    حالة الإنشاء والتشطيب (مستقلة عن الإيجار)
                  </Label>
                  <select
                    value={editForm.construction_status}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              construction_status: e.target
                                .value as MallShopConstructionStatus,
                            }
                          : prev,
                      )
                    }
                    className="h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-xs font-bold text-slate-800"
                  >
                    {(
                      Object.keys(
                        MALL_SHOP_CONSTRUCTION_LABELS,
                      ) as MallShopConstructionStatus[]
                    ).map((cKey) => (
                      <option key={cKey} value={cKey}>
                        {MALL_SHOP_CONSTRUCTION_LABELS[cKey].ar}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">
                    حالة الإشغال والتأجير
                  </Label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              status: e.target.value as "rented" | "vacant" | "maintenance",
                            }
                          : prev,
                      )
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
                  >
                    <option value="rented">مؤجر (Rented)</option>
                    <option value="vacant">شاغر (Vacant)</option>
                    <option value="maintenance">صيانة (Maintenance)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">المساحة (م²)</Label>
                  <Input
                    type="number"
                    value={editForm.space_sqm}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, space_sqm: Number(e.target.value) } : prev,
                      )
                    }
                    className="h-9 font-mono text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">الإيجار الشهري ($)</Label>
                  <Input
                    type="number"
                    value={editForm.monthly_rent}
                    onChange={(e) =>
                      setEditForm((prev) =>
                        prev ? { ...prev, monthly_rent: Number(e.target.value) } : prev,
                      )
                    }
                    className="h-9 font-mono text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold">رقم الهاتف</Label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((prev) => (prev ? { ...prev, phone: e.target.value } : prev))
                    }
                    className="h-9 font-mono text-xs font-bold"
                  />
                </div>
              </div>

              {/* Dynamic Custom Fields Inputs */}
              <MallShopCustomFieldsInputs
                fields={customFields}
                values={editForm.custom_fields}
                onChange={(nextValues) =>
                  setEditForm((prev) =>
                    prev ? { ...prev, custom_fields: nextValues } : prev,
                  )
                }
              />

              <div className="space-y-1">
                <Label className="text-xs font-bold">ملاحظات الوحدة</Label>
                <Input
                  value={editForm.notes}
                  onChange={(e) =>
                    setEditForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                  }
                  className="h-9 text-xs font-bold"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              onClick={handleSaveShopEdit}
              className="gap-1.5 bg-indigo-600 font-bold text-white hover:bg-indigo-700"
            >
              <Save className="h-4 w-4" />
              حفظ تعديلات المحل
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditingShop(null);
                setEditForm(null);
              }}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD / EDIT CUSTOM FIELD DEFINITION DIALOG */}
      <Dialog open={isFieldModalOpen} onOpenChange={setIsFieldModalOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-base font-black">
              {editingFieldId ? "تعديل إعدادات الحقل المخصص" : "إضافة حقل مخصص جديد للمحلات"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-bold">اسم الحقل (بالعربية) *</Label>
              <Input
                value={fieldForm.name_ar}
                onChange={(e) => setFieldForm((p) => ({ ...p, name_ar: e.target.value }))}
                placeholder="مثال: رقم عداد المياه، نوع النشاط الفرعي..."
                className="h-9 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">الاسم بالإنجليزية (اختياري)</Label>
              <Input
                value={fieldForm.name_en}
                onChange={(e) => setFieldForm((p) => ({ ...p, name_en: e.target.value }))}
                placeholder="e.g. Water Meter No."
                className="h-9 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold">نوع الحقل *</Label>
              <select
                value={fieldForm.type}
                onChange={(e) =>
                  setFieldForm((p) => ({
                    ...p,
                    type: e.target.value as MallCustomFieldType,
                  }))
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800"
              >
                {(Object.keys(CUSTOM_FIELD_TYPE_LABELS) as MallCustomFieldType[]).map((t) => (
                  <option key={t} value={t}>
                    {CUSTOM_FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {(fieldForm.type === "dropdown" || fieldForm.type === "multiple_choice") && (
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  خيارات القائمة (اكتب كل خيار في سطر أو افصل بينها بفاصلة) *
                </Label>
                <textarea
                  rows={4}
                  value={fieldForm.optionsText}
                  onChange={(e) =>
                    setFieldForm((p) => ({ ...p, optionsText: e.target.value }))
                  }
                  placeholder={"خيار 1\nخيار 2\nخيار 3"}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={fieldForm.enabled}
                  onChange={(e) => setFieldForm((p) => ({ ...p, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                مفعل ونشط
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={fieldForm.required}
                  onChange={(e) => setFieldForm((p) => ({ ...p, required: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                حقل إلزامي عند التعديل
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button
              onClick={handleSaveCustomField}
              className="gap-1.5 bg-indigo-600 font-bold text-white hover:bg-indigo-700"
            >
              <Save className="h-4 w-4" />
              حفظ الحقل
            </Button>
            <Button variant="outline" onClick={() => setIsFieldModalOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
