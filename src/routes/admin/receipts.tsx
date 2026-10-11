import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Printer,
  Save,
  RotateCcw,
  CheckCircle2,
  FileText,
  QrCode,
  Store,
  Palette,
  Layout,
  Receipt,
  FileCheck,
  ShieldCheck,
  Sparkles,
  Info,
  Eye,
  Sliders,
  FileSpreadsheet,
  Building,
  Calculator,
  Percent,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getReceiptDesignSettings,
  saveReceiptDesignSettings,
  resetReceiptDesignSettings,
  ReceiptDesignSettings,
  DEFAULT_RECEIPT_SETTINGS,
} from "@/shared/services/receiptSettings";
import { printerService } from "@/shared/services/printerService";

export const Route = createFileRoute("/admin/receipts")({
  head: () => ({
    meta: [{ title: "تصميم وإدارة الإيصالات والمستندات المالية" }],
  }),
  component: ReceiptDesignerPage,
});

function ReceiptDesignerPage() {
  const [settings, setSettings] = useState<ReceiptDesignSettings>(DEFAULT_RECEIPT_SETTINGS);
  const [previewDocType, setPreviewDocType] = useState<
    "sales" | "collection" | "payment" | "invoice" | "return" | "mall_contract" | "mall_termination"
  >("sales");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("sales");
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);

  useEffect(() => {
    setSettings(getReceiptDesignSettings());
    setIsPrinterConnected(printerService.isPrinterConnected());

    const handleUpdate = (e: any) => {
      if (e?.detail) setSettings(e.detail);
    };
    const handlePrinterStatus = (e: any) => {
      if (e?.detail) setIsPrinterConnected(!!e.detail.isConnected);
    };
    window.addEventListener("receipt_settings_updated", handleUpdate);
    window.addEventListener("thermal_printer_status_changed", handlePrinterStatus);
    return () => {
      window.removeEventListener("receipt_settings_updated", handleUpdate);
      window.removeEventListener("thermal_printer_status_changed", handlePrinterStatus);
    };
  }, []);

  const handleSave = () => {
    saveReceiptDesignSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleReset = () => {
    if (
      window.confirm(
        "هل أنت تأكد من إعادة جميع إعدادات تصميم الإيصالات والسندات إلى الوضع الافتراضي؟",
      )
    ) {
      const def = resetReceiptDesignSettings();
      setSettings(def);
    }
  };

  const handleConnectPrinter = async () => {
    if (isPrinterConnected) {
      await printerService.disconnectPrinter();
    } else {
      await printerService.connectThermalPrinter();
    }
  };

  const handlePrintPreview = async () => {
    await printerService.printReceipt({
      storeName: settings.storeName,
      storeSubtitle: settings.storeSubtitle,
      taxNumber: settings.taxNumber,
      orderNumber: "107",
      orderType: "تيك أواي",
      paymentMethod: "نقدي",
      date: new Date().toLocaleString("ar-EG"),
      items: [{ name: "وجبة بيتزا سوبريم", quantity: 1, price: 24000 }],
      subtotal: 24000,
      tax: 3360,
      total: 27360,
      thankYouMessage: settings.thankYouMessage,
      footerNotes: settings.footerNotesText,
    });
  };

  const updateSetting = <K extends keyof ReceiptDesignSettings>(
    key: K,
    value: ReceiptDesignSettings[K],
  ) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      saveReceiptDesignSettings(updated);
      return updated;
    });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-emerald-500/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1 rounded-lg text-xs font-bold">
                <Sparkles size={13} className="ml-1 inline" /> نظام القوالب والطباعة الذكية الموحدة
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 px-2.5 py-0.5 rounded-lg text-[11px] font-mono">
                ZATCA Compliant 2026
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <Receipt className="text-emerald-400 w-8 h-8" />
              إدارة وتصميم الإيصالات والسندات المالية
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              تحكم كامل في مظهر ومحتوى إيصالات الكاشير الحرارية، سندات القبض والصرف، الفواتير
              الضريبية الرسمية A4، وأذون المرتجعات والمخازن مع معاينة حية ومباشرة.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              onClick={handleConnectPrinter}
              variant="outline"
              className={`rounded-xl font-bold gap-2 text-xs transition-colors ${
                isPrinterConnected
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800"
              }`}
            >
              <Printer size={15} />
              {isPrinterConnected ? "الطابعة الحرارية متصلة 🟢" : "ربط طابعة حرارية (USB/Serial)"}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="bg-slate-800/80 hover:bg-slate-800 text-slate-200 border-slate-700 rounded-xl font-bold gap-2 text-xs"
            >
              <RotateCcw size={15} />
              افتراضي
            </Button>
            <Button
              onClick={handlePrintPreview}
              variant="outline"
              className="bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-200 border-emerald-600/40 rounded-xl font-bold gap-2 text-xs"
            >
              <Printer size={15} />
              طباعة تجريبية
            </Button>
            <Button
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold gap-2 px-6 shadow-lg shadow-emerald-900/30 text-sm"
            >
              <Save size={16} />
              تطبيق وحفظ التصميم فوراً
            </Button>
          </div>
        </div>

        {savedSuccess && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 size={16} className="text-emerald-400" />
            تم حفظ إعدادات التصميم بنجاح وتحديث كافة إيصالات وسندات النظام المباشرة!
          </div>
        )}
      </div>

      {/* Main Grid Layout: Form Controls (Left/Center) & Live Preview Sticky (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side Controls - 7 Cols */}
        <div className="lg:col-span-7 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 bg-muted/80 p-1.5 rounded-2xl border border-border gap-1 h-auto mb-6">
              <TabsTrigger
                value="sales"
                className="rounded-xl py-2.5 font-bold text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <Receipt size={14} />
                إيصال الكاشير
              </TabsTrigger>
              <TabsTrigger
                value="vouchers"
                className="rounded-xl py-2.5 font-bold text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <FileCheck size={14} />
                سندات القبض والصرف
              </TabsTrigger>
              <TabsTrigger
                value="invoices"
                className="rounded-xl py-2.5 font-bold text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <FileSpreadsheet size={14} />
                الفواتير الضريبية A4
              </TabsTrigger>
              <TabsTrigger
                value="returns"
                className="rounded-xl py-2.5 font-bold text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <ShieldCheck size={14} />
                المرتجعات والمخزن
              </TabsTrigger>
              <TabsTrigger
                value="mall"
                className="rounded-xl py-2.5 font-bold text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
              >
                <Building size={14} />
                عقود وفسخ محلات المول
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Sales Receipt Settings */}
            <TabsContent value="sales" className="space-y-6 m-0">
              {/* Header Info Section */}
              <Card className="rounded-3xl border-border/70 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/40 border-b border-border/60 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Store className="text-emerald-600 w-5 h-5" />
                    بيانات الهوية والترويسة (Header Info)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">اسم المنشأة / المطعم</Label>
                      <Input
                        value={settings.storeName}
                        onChange={(e) => updateSetting("storeName", e.target.value)}
                        className="rounded-xl text-xs font-semibold"
                        placeholder="مثال: مطعم ومقهى ريستوكاش"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">الوصف الفرعي / شعار المنشأة</Label>
                      <Input
                        value={settings.storeSubtitle}
                        onChange={(e) => updateSetting("storeSubtitle", e.target.value)}
                        className="rounded-xl text-xs font-semibold"
                        placeholder="مثال: الفرع الرئيسي - المبيعات المباشرة"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">الرقم الضريبي (VAT / Tax ID)</Label>
                      <Input
                        value={settings.taxNumber}
                        onChange={(e) => updateSetting("taxNumber", e.target.value)}
                        className="rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">رقم السجل التجاري (CR Number)</Label>
                      <Input
                        value={settings.commercialRegister}
                        onChange={(e) => updateSetting("commercialRegister", e.target.value)}
                        className="rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">رقم الهاتف / التواجد</Label>
                      <Input
                        value={settings.phone}
                        onChange={(e) => updateSetting("phone", e.target.value)}
                        className="rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">العنوان التفصيلي</Label>
                      <Input
                        value={settings.address}
                        onChange={(e) => updateSetting("address", e.target.value)}
                        className="rounded-xl text-xs font-semibold"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Layout & Paper Width */}
              <Card className="rounded-3xl border-border/70 shadow-sm">
                <CardHeader className="bg-muted/40 border-b border-border/60 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Layout className="text-blue-600 w-5 h-5" />
                    نوع الورق والأبعاد والتنسيق (Layout & Print Options)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">عرض ورقة الطابعة الحرارية</Label>
                      <select
                        value={settings.receiptPaperWidth}
                        onChange={(e) => updateSetting("receiptPaperWidth", e.target.value as any)}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                      >
                        <option value="80mm">طابعة حرارية 80mm (قياسي كاشير)</option>
                        <option value="58mm">طابعة حرارية صغيرة 58mm</option>
                        <option value="A4">ورق قياسي A4 (كامل)</option>
                        <option value="A5">ورق متوسط A5</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">خط الخط والنصوص</Label>
                      <select
                        value={settings.fontFamily}
                        onChange={(e) => updateSetting("fontFamily", e.target.value as any)}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                      >
                        <option value="Tajawal">Tajawal (تجوال العريض)</option>
                        <option value="Cairo">Cairo (القاهرة الحديث)</option>
                        <option value="Courier">Monospace / Courier (طابعات نقطية)</option>
                        <option value="Inter">Inter Sans</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold">حجم خط الإيصال</Label>
                      <select
                        value={settings.fontSize}
                        onChange={(e) => updateSetting("fontSize", e.target.value as any)}
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                      >
                        <option value="sm">صغير (مدمج جداً)</option>
                        <option value="base">متوسط (افتراضي ممتاز)</option>
                        <option value="lg">كبير (واضح جداً للزبائن)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-bold block">
                        لون التمييز واللمسة البصرية (Accent Color)
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        اللون المستخدم للخطوط الفاصلة والعناوين الرئيسية
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {["#10b981", "#3b82f6", "#6366f1", "#f59e0b", "#ef4444", "#1e293b"].map(
                        (c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateSetting("accentColor", c)}
                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                              settings.accentColor === c
                                ? "scale-125 border-foreground shadow-md"
                                : "border-transparent hover:scale-110"
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ),
                      )}
                      <input
                        type="color"
                        value={settings.accentColor}
                        onChange={(e) => updateSetting("accentColor", e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Elements Visibility Toggles */}
              <Card className="rounded-3xl border-border/70 shadow-sm">
                <CardHeader className="bg-muted/40 border-b border-border/60 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Sliders className="text-indigo-600 w-5 h-5" />
                    عناصر وحقول الإيصال (Elements Visibility)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">
                      إظهار اللوجو والشعار
                    </Label>
                    <Switch
                      checked={settings.showLogo}
                      onCheckedChange={(v) => updateSetting("showLogo", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">إظهار اسم الفرع</Label>
                    <Switch
                      checked={settings.showBranchName}
                      onCheckedChange={(v) => updateSetting("showBranchName", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">
                      إظهار الرقم الضريبي والسجل
                    </Label>
                    <Switch
                      checked={settings.showTaxNumber}
                      onCheckedChange={(v) => updateSetting("showTaxNumber", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">
                      إظهار اسم الكاشير المسؤول
                    </Label>
                    <Switch
                      checked={settings.showCashierName}
                      onCheckedChange={(v) => updateSetting("showCashierName", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">
                      إظهار نوع الطلب (طاولة/تيك أواي/توصيل)
                    </Label>
                    <Switch
                      checked={settings.showOrderType}
                      onCheckedChange={(v) => updateSetting("showOrderType", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">
                      إظهار تفاصيل العميل والهاتف
                    </Label>
                    <Switch
                      checked={settings.showCustomerDetails}
                      onCheckedChange={(v) => updateSetting("showCustomerDetails", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">
                      إظهار تفكيك الضريبة المضافة (Tax Breakdown)
                    </Label>
                    <Switch
                      checked={settings.showTaxBreakdown}
                      onCheckedChange={(v) => updateSetting("showTaxBreakdown", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">
                      إظهار ملاحظات العناصر والتعديلات
                    </Label>
                    <Switch
                      checked={settings.showItemNotes}
                      onCheckedChange={(v) => updateSetting("showItemNotes", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">
                      رمز الاستجابة السريع (QR Code ZATCA)
                    </Label>
                    <Switch
                      checked={settings.showQRCode}
                      onCheckedChange={(v) => updateSetting("showQRCode", v)}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                    <Label className="text-xs font-semibold cursor-pointer">
                      الباركود الشريطي للطلب (Barcode)
                    </Label>
                    <Switch
                      checked={settings.showBarcode}
                      onCheckedChange={(v) => updateSetting("showBarcode", v)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Financial Rates, Tax, Discounts & Services Settings */}
              <Card className="rounded-3xl border-border/70 shadow-sm border-emerald-500/30 bg-emerald-500/5">
                <CardHeader className="bg-emerald-500/10 border-b border-emerald-500/20 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <Calculator className="w-5 h-5 text-emerald-600" />
                    تعديل نسب الضريبة، الخصومات، وخدمات الصالة والتوصيل
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  {/* Tax Rate & Switch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-background p-3.5 rounded-2xl border border-border/60">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-emerald-600" />
                        نسبة ضريبة القيمة المضافة (VAT %)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={settings.defaultTaxRate}
                        onChange={(e) =>
                          updateSetting("defaultTaxRate", parseFloat(e.target.value) || 0)
                        }
                        className="rounded-xl text-xs font-bold font-mono"
                        placeholder="14"
                      />
                    </div>
                    <div className="flex items-center justify-between sm:pt-6">
                      <span className="text-xs font-semibold">تفعيل احتساب الضريبة</span>
                      <Switch
                        checked={settings.enableTax}
                        onCheckedChange={(v) => updateSetting("enableTax", v)}
                      />
                    </div>
                  </div>

                  {/* Discount Settings */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center bg-background p-3.5 rounded-2xl border border-border/60">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">نوع الخصم الافتراضي</Label>
                      <select
                        value={settings.defaultDiscountType}
                        onChange={(e) =>
                          updateSetting("defaultDiscountType", e.target.value as any)
                        }
                        className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs font-bold"
                      >
                        <option value="percent">نسبة مئوية (%)</option>
                        <option value="fixed">مبلغ نقدي ثابت</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">قيمة الخصم الافتراضية</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={settings.defaultDiscountValue}
                        onChange={(e) =>
                          updateSetting("defaultDiscountValue", parseFloat(e.target.value) || 0)
                        }
                        className="rounded-xl text-xs font-bold font-mono"
                      />
                    </div>
                    <div className="flex items-center justify-between sm:pt-6">
                      <span className="text-xs font-semibold">إتاحة الخصم</span>
                      <Switch
                        checked={settings.enableDiscount}
                        onCheckedChange={(v) => updateSetting("enableDiscount", v)}
                      />
                    </div>
                  </div>

                  {/* Dine-in Service Charge */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-background p-3.5 rounded-2xl border border-border/60">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">
                        نسبة خدمة الصالة (Dine-in Service %)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={settings.dineInServiceRate}
                        onChange={(e) =>
                          updateSetting("dineInServiceRate", parseFloat(e.target.value) || 0)
                        }
                        className="rounded-xl text-xs font-bold font-mono"
                        placeholder="12"
                      />
                    </div>
                    <div className="flex items-center justify-between sm:pt-6">
                      <span className="text-xs font-semibold">تفعيل خدمة الصالة تلقائياً</span>
                      <Switch
                        checked={settings.enableDineInService}
                        onCheckedChange={(v) => updateSetting("enableDineInService", v)}
                      />
                    </div>
                  </div>

                  {/* Delivery Fee */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-background p-3.5 rounded-2xl border border-border/60">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                        رسوم خدمة التوصيل (Delivery Fee)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={settings.deliveryFee}
                        onChange={(e) =>
                          updateSetting("deliveryFee", parseFloat(e.target.value) || 0)
                        }
                        className="rounded-xl text-xs font-bold font-mono"
                        placeholder="20"
                      />
                    </div>
                    <div className="flex items-center justify-between sm:pt-6">
                      <span className="text-xs font-semibold">تفعيل رسوم التوصيل تلقائياً</span>
                      <Switch
                        checked={settings.enableDeliveryFee}
                        onCheckedChange={(v) => updateSetting("enableDeliveryFee", v)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Custom Footers and Disclaimers */}
              <Card className="rounded-3xl border-border/70 shadow-sm">
                <CardHeader className="bg-muted/40 border-b border-border/60 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="text-amber-600 w-5 h-5" />
                    الملاحظات والتذييل والتنبيهات (Footer & Custom Texts)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">
                      رسالة الترحيب والشكر في أسفل الإيصال
                    </Label>
                    <Input
                      value={settings.thankYouMessage}
                      onChange={(e) => updateSetting("thankYouMessage", e.target.value)}
                      className="rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">
                      تنبيهات الملاحظات القانونية والضريبية
                    </Label>
                    <Input
                      value={settings.footerNotesText}
                      onChange={(e) => updateSetting("footerNotesText", e.target.value)}
                      className="rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">
                      معلومات الواي فاي بالفرع (Wi-Fi Details)
                    </Label>
                    <Input
                      value={settings.wifiPasswordText}
                      onChange={(e) => updateSetting("wifiPasswordText", e.target.value)}
                      className="rounded-xl text-xs font-semibold"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: Vouchers Settings (سندات القبض والصرف) */}
            <TabsContent value="vouchers" className="space-y-6 m-0">
              <Card className="rounded-3xl border-border/70 shadow-sm">
                <CardHeader className="bg-muted/40 border-b border-border/60 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileCheck className="text-emerald-600 w-5 h-5" />
                    تخصيص سندات القبض والصرف الخزينة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">عنوان سند القبض / المقبوضات</Label>
                      <Input
                        value={settings.voucherTitleCollection}
                        onChange={(e) => updateSetting("voucherTitleCollection", e.target.value)}
                        className="rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">عنوان سند الصرف / المسحوبات</Label>
                      <Input
                        value={settings.voucherTitlePayment}
                        onChange={(e) => updateSetting("voucherTitlePayment", e.target.value)}
                        className="rounded-xl text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        تفعيل التفقيط (كتابة المبلغ بالحروف)
                      </Label>
                      <Switch
                        checked={settings.voucherShowAmountInWords}
                        onCheckedChange={(v) => updateSetting("voucherShowAmountInWords", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        إظهار مربعات التوقيعات والاعتماد
                      </Label>
                      <Switch
                        checked={settings.voucherShowSignatures}
                        onCheckedChange={(v) => updateSetting("voucherShowSignatures", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        إظهار اسم وعاء الخزينة المستهدفة
                      </Label>
                      <Switch
                        checked={settings.voucherShowTreasuryName}
                        onCheckedChange={(v) => updateSetting("voucherShowTreasuryName", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        إظهار الهيدر الرسمي للمنشأة بالسندات
                      </Label>
                      <Switch
                        checked={settings.voucherShowBranchHeader}
                        onCheckedChange={(v) => updateSetting("voucherShowBranchHeader", v)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-bold">
                      الشروط والأحكام المالية المدونة بالسندات
                    </Label>
                    <Textarea
                      rows={2}
                      value={settings.voucherTermsText}
                      onChange={(e) => updateSetting("voucherTermsText", e.target.value)}
                      className="rounded-xl text-xs font-semibold resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: Tax Invoices (A4) */}
            <TabsContent value="invoices" className="space-y-6 m-0">
              <Card className="rounded-3xl border-border/70 shadow-sm">
                <CardHeader className="bg-muted/40 border-b border-border/60 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Building className="text-purple-600 w-5 h-5" />
                    إعدادات الفاتورة الضريبية الرسمية (A4 / A5 Invoices)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">عنوان الفاتورة الضريبية الرسمية</Label>
                    <Input
                      value={settings.invoiceTitle}
                      onChange={(e) => updateSetting("invoiceTitle", e.target.value)}
                      className="rounded-xl text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        إظهار ميزة الختم المعتمد
                      </Label>
                      <Switch
                        checked={settings.invoiceShowCompanyStamp}
                        onCheckedChange={(v) => updateSetting("invoiceShowCompanyStamp", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        إظهار الرقم الضريبي للعميل
                      </Label>
                      <Switch
                        checked={settings.invoiceShowCustomerTaxId}
                        onCheckedChange={(v) => updateSetting("invoiceShowCustomerTaxId", v)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold">
                      بيانات الحساب البنكي والتحويل السريع (Bank IBAN)
                    </Label>
                    <Input
                      value={settings.invoiceBankDetails}
                      onChange={(e) => updateSetting("invoiceBankDetails", e.target.value)}
                      className="rounded-xl text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold">شروط وأحكام البيع والاستبدال</Label>
                    <Textarea
                      rows={2}
                      value={settings.invoiceTermsAndConditions}
                      onChange={(e) => updateSetting("invoiceTermsAndConditions", e.target.value)}
                      className="rounded-xl text-xs font-semibold resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: Returns & Inventory Notes */}
            <TabsContent value="returns" className="space-y-6 m-0">
              <Card className="rounded-3xl border-border/70 shadow-sm">
                <CardHeader className="bg-muted/40 border-b border-border/60 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ShieldCheck className="text-rose-600 w-5 h-5" />
                    أذون المرتجعات والمخازن (Return Notes & Inventory Vouchers)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">عنوان إذن المرتجع الرسمي</Label>
                    <Input
                      value={settings.returnNoteTitle}
                      onChange={(e) => updateSetting("returnNoteTitle", e.target.value)}
                      className="rounded-xl text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        توقيع أمين المخزن / المستلم
                      </Label>
                      <Switch
                        checked={settings.showWarehouseSignature}
                        onCheckedChange={(v) => updateSetting("showWarehouseSignature", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        إظهار سياسة المرتجعات المباشرة
                      </Label>
                      <Switch
                        checked={settings.showReturnPolicyText}
                        onCheckedChange={(v) => updateSetting("showReturnPolicyText", v)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold">
                      نص سياسة المرتجعات المطبوعة مع المستند
                    </Label>
                    <Textarea
                      rows={2}
                      value={settings.returnPolicyText}
                      onChange={(e) => updateSetting("returnPolicyText", e.target.value)}
                      className="rounded-xl text-xs font-semibold resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 5: Mall Contracts & Terminations */}
            <TabsContent value="mall" className="space-y-6 m-0">
              <Card className="rounded-3xl border-border/70 shadow-sm">
                <CardHeader className="bg-muted/40 border-b border-border/60 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Building className="text-emerald-600 w-5 h-5" />
                    إعدادات قوالب عقود إيجار وفسخ محلات المول (Mall Contracts & Terminations)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-6">
                  {/* Contract Settings */}
                  <div className="space-y-4 border-b border-border pb-5">
                    <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                      <FileText size={16} className="text-emerald-600" />
                      1. قالب عقد إيجار محل تجاري جديد
                    </h4>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">عنوان العقد الرسمي (عربي)</Label>
                      <Input
                        value={settings.mallContractTitle}
                        onChange={(e) => updateSetting("mallContractTitle", e.target.value)}
                        className="rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">
                        عنوان العقد بالإنجليزية (English Title)
                      </Label>
                      <Input
                        value={settings.mallContractTitleEn}
                        onChange={(e) => updateSetting("mallContractTitleEn", e.target.value)}
                        className="rounded-xl text-xs font-mono font-semibold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">ملاحظات الترويسة الافتتاحية</Label>
                      <Textarea
                        value={settings.mallContractHeaderNotes}
                        onChange={(e) => updateSetting("mallContractHeaderNotes", e.target.value)}
                        className="rounded-xl text-xs resize-none"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">بنود وشروط العقد الأساسية</Label>
                      <Textarea
                        value={settings.mallContractTermsText}
                        onChange={(e) => updateSetting("mallContractTermsText", e.target.value)}
                        className="rounded-xl text-xs resize-none"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        إظهار التوقيعات (إدارة المول والمستأجر)
                      </Label>
                      <Switch
                        checked={settings.mallContractShowSignatures}
                        onCheckedChange={(v) => updateSetting("mallContractShowSignatures", v)}
                      />
                    </div>
                  </div>

                  {/* Termination Settings */}
                  <div className="space-y-4 pt-1">
                    <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                      <ShieldCheck size={16} className="text-rose-600" />
                      2. قالب محضر فسخ التعاقد وتسليم المحل
                    </h4>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">عنوان محضر الفسخ (عربي)</Label>
                      <Input
                        value={settings.mallTerminationTitle}
                        onChange={(e) => updateSetting("mallTerminationTitle", e.target.value)}
                        className="rounded-xl text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">
                        عنوان محضر الفسخ بالإنجليزية (English Title)
                      </Label>
                      <Input
                        value={settings.mallTerminationTitleEn}
                        onChange={(e) => updateSetting("mallTerminationTitleEn", e.target.value)}
                        className="rounded-xl text-xs font-mono font-semibold"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold">نص الإقرار وتصفية التأمين</Label>
                      <Textarea
                        value={settings.mallTerminationTermsText}
                        onChange={(e) => updateSetting("mallTerminationTermsText", e.target.value)}
                        className="rounded-xl text-xs resize-none"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/50">
                      <Label className="text-xs font-semibold cursor-pointer">
                        إظهار توقيعات إبراء الذمة والتسليم
                      </Label>
                      <Switch
                        checked={settings.mallTerminationShowSignatures}
                        onCheckedChange={(v) => updateSetting("mallTerminationShowSignatures", v)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Side: Live Sticky Preview - 5 Cols */}
        <div className="lg:col-span-5 lg:sticky lg:top-20 space-y-4">
          <div className="flex items-center justify-between bg-card border border-border p-3 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2">
              <Eye className="text-emerald-500 w-5 h-5" />
              <span className="font-bold text-xs">عرض الإيصال المباشر (Live Preview)</span>
            </div>
            <select
              value={previewDocType}
              onChange={(e) => setPreviewDocType(e.target.value as any)}
              className="h-8 rounded-xl border border-input bg-background px-2 text.xs font-bold"
            >
              <option value="sales">إيصال مبيعات (Thermal 80mm)</option>
              <option value="collection">سند قبض (Collection)</option>
              <option value="payment">سند صرف (Payment)</option>
              <option value="invoice">فاتورة ضريبية (A4 Invoice)</option>
              <option value="return">إذن مرتجع (Return Note)</option>
              <option value="mall_contract">عقد إيجار محل مول (Mall Contract)</option>
              <option value="mall_termination">محضر فسخ وتسليم محل (Mall Termination)</option>
            </select>
          </div>

          {/* Printable Preview Container */}
          <div
            id="receipt-print-container"
            className="bg-white text-slate-900 rounded-2xl p-5 shadow-xl border border-slate-300 font-sans mx-auto transition-all duration-200"
            style={{
              maxWidth:
                previewDocType === "sales"
                  ? settings.receiptPaperWidth === "58mm"
                    ? "280px"
                    : "380px"
                  : "100%",
              fontFamily:
                settings.fontFamily === "Courier"
                  ? "monospace"
                  : settings.fontFamily === "Cairo"
                    ? "Cairo, sans-serif"
                    : "Tajawal, sans-serif",
            }}
          >
            {/* 1. SALES RECEIPT PREVIEW */}
            {previewDocType === "sales" && (
              <div className="space-y-3 text-center text-xs">
                {/* Header */}
                <div className="border-b border-dashed border-slate-300 pb-3 space-y-1">
                  {settings.showLogo && (
                    <div className="flex justify-center mb-1">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-base"
                        style={{ backgroundColor: settings.accentColor }}
                      >
                        RC
                      </div>
                    </div>
                  )}
                  <h2 className="font-black text-base text-slate-900">{settings.storeName}</h2>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    {settings.storeSubtitle}
                  </p>
                  {settings.showBranchName && (
                    <p className="text-[11px] font-bold text-emerald-700">
                      فرع: {settings.branchName}
                    </p>
                  )}
                  {settings.showTaxNumber && (
                    <div className="text-[10px] text-slate-600 font-mono space-y-0.5">
                      <p>الرقم الضريبي: {settings.taxNumber}</p>
                      <p>سجل تجاري: {settings.commercialRegister}</p>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-600">
                    {settings.address} | هاتف: {settings.phone}
                  </p>
                </div>

                {/* Receipt Meta */}
                <div className="text-[11px] text-right space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono">
                  <div className="flex justify-between font-bold">
                    <span>رقم الفاتورة: #INV-1029</span>
                    <span>التاريخ: {new Date().toLocaleDateString("ar-EG")}</span>
                  </div>
                  {settings.showCashierName && (
                    <div className="flex justify-between text-slate-600">
                      <span>الكاشير: أحمد المصطفى</span>
                      <span>الوقت: 02:45 م</span>
                    </div>
                  )}
                  {settings.showOrderType && (
                    <div className="flex justify-between text-slate-800 font-bold border-t border-slate-200 pt-1 mt-1">
                      <span>نوع الطلب: صالة (Takeaway)</span>
                      <span>طاولة رقم: 04</span>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <table className="w-full text-right text-[11px] my-2">
                  <thead>
                    <tr
                      className="border-b border-slate-300 text-slate-700 font-bold"
                      style={{ color: settings.accentColor }}
                    >
                      <th className="py-1">الصنف</th>
                      <th className="py-1 text-center">الكمية</th>
                      <th className="py-1 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-1 font-semibold">
                        وجبة برجر سبيشل ريستو
                        {settings.showItemNotes && (
                          <span className="block text-[9px] text-slate-500">
                            - بدون بصل + جبنة إضافية
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-center font-bold">2</td>
                      <td className="py-1 text-left font-mono font-bold">240.00</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold">بطاطس مقرمشة كبير</td>
                      <td className="py-1 text-center font-bold">1</td>
                      <td className="py-1 text-left font-mono font-bold">50.00</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold">عصير برتقال طبيعي</td>
                      <td className="py-1 text-center font-bold">2</td>
                      <td className="py-1 text-left font-mono font-bold">80.00</td>
                    </tr>
                  </tbody>
                </table>

                {/* Totals */}
                {(() => {
                  const baseSubtotal = 370.0;
                  let discountVal = 0;
                  if (settings.enableDiscount && settings.defaultDiscountValue > 0) {
                    discountVal =
                      settings.defaultDiscountType === "percent"
                        ? (baseSubtotal * settings.defaultDiscountValue) / 100
                        : settings.defaultDiscountValue;
                  }
                  const afterDiscount = Math.max(0, baseSubtotal - discountVal);
                  const serviceVal = settings.enableDineInService
                    ? (afterDiscount * settings.dineInServiceRate) / 100
                    : 0;
                  const taxable = afterDiscount + serviceVal;
                  const taxVal = settings.enableTax ? (taxable * settings.defaultTaxRate) / 100 : 0;
                  const finalVal = taxable + taxVal;

                  return (
                    <div className="border-t border-dashed border-slate-300 pt-2 text-right text-[11px] space-y-1 font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span>المجموع الفرعي:</span>
                        <span>{baseSubtotal.toFixed(2)} ج.م</span>
                      </div>
                      {discountVal > 0 && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>
                            الخصم (
                            {settings.defaultDiscountType === "percent"
                              ? `${settings.defaultDiscountValue}%`
                              : "نقدي"}
                            ):
                          </span>
                          <span>-{discountVal.toFixed(2)} ج.م</span>
                        </div>
                      )}
                      {serviceVal > 0 && (
                        <div className="flex justify-between text-slate-600">
                          <span>خدمة الصالة ({settings.dineInServiceRate}%):</span>
                          <span>+{serviceVal.toFixed(2)} ج.م</span>
                        </div>
                      )}
                      {settings.showTaxBreakdown && settings.enableTax && (
                        <div className="flex justify-between text-slate-600">
                          <span>ضريبة القيمة المضافة ({settings.defaultTaxRate}%):</span>
                          <span>{taxVal.toFixed(2)} ج.م</span>
                        </div>
                      )}
                      <div
                        className="flex justify-between font-black text-sm p-1.5 rounded-lg text-white"
                        style={{ backgroundColor: settings.accentColor }}
                      >
                        <span>الإجمالي النهائي:</span>
                        <span>{finalVal.toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                        <span>طريقة الدفع: نقدي (Cash)</span>
                        <span>
                          المدفوع: {Math.ceil(finalVal / 50) * 50} | الباقي:{" "}
                          {(Math.ceil(finalVal / 50) * 50 - finalVal).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* QR Code & Barcode */}
                <div className="pt-2 border-t border-dashed border-slate-300 space-y-2">
                  {settings.showQRCode && (
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 bg-slate-900 rounded-lg p-1.5 flex items-center justify-center text-white font-mono text-[8px] text-center">
                        <QrCode size={60} className="text-white" />
                      </div>
                      <span className="text-[9px] text-slate-400 mt-0.5">
                        ZATCA QR Code Verified
                      </span>
                    </div>
                  )}
                  {settings.showBarcode && (
                    <div className="text-center">
                      <div className="h-8 bg-slate-900/10 rounded flex items-center justify-center font-mono text-[10px] tracking-widest font-black">
                        ||| | |||| ||||| ||| |||| |
                      </div>
                      <span className="text-[8px] font-mono text-slate-500">INV-1029-2026</span>
                    </div>
                  )}
                </div>

                {/* Footer Disclaimers */}
                <div className="pt-2 border-t border-slate-200 text-[10px] space-y-1 text-slate-600">
                  {settings.showFooterNotes && (
                    <p className="font-semibold">{settings.footerNotesText}</p>
                  )}
                  {settings.showThankYouMsg && (
                    <p className="font-bold text-slate-900">{settings.thankYouMessage}</p>
                  )}
                  {settings.showWifiPass && (
                    <p className="text-[9px] text-slate-500">{settings.wifiPasswordText}</p>
                  )}
                </div>
              </div>
            )}

            {/* 2. COLLECTION VOUCHER PREVIEW */}
            {previewDocType === "collection" && (
              <div className="space-y-4 text-right text-xs">
                <div
                  className="flex items-center justify-between border-b pb-3"
                  style={{ borderColor: settings.accentColor }}
                >
                  <div>
                    <h3 className="font-black text-sm text-slate-900">{settings.storeName}</h3>
                    <p className="text-[10px] text-slate-500">{settings.voucherTitleCollection}</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-mono font-bold">
                    سند قبض #REC-884
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border">
                  <div>
                    <span className="text-slate-500 font-semibold">المبلغ المقبوض: </span>
                    <span className="font-black font-mono text-emerald-600 text-sm">
                      12,500.00 ج.م
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">التاريخ: </span>
                    <span className="font-mono font-bold">
                      {new Date().toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-800">
                  <p>
                    <strong>استلمنا من السيد/الشركة:</strong> شركة النيل المتقدمة للتوريدات
                  </p>
                  <p>
                    <strong>مبلغ وقدره:</strong> اثنا عشر ألف وخمسمائة جنيه مصري لا غير
                  </p>
                  <p>
                    <strong>وذلك عن:</strong> دفعة من حساب تسوية فواتير المبيعات الآجلة
                  </p>
                  {settings.voucherShowTreasuryName && (
                    <p>
                      <strong>طريقة الإيداع:</strong> خزينة الكاشير الرئيسية (نقدي)
                    </p>
                  )}
                </div>

                {settings.voucherShowSignatures && (
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-6 border-t border-slate-200 mt-4">
                    <div>
                      <span className="font-bold block text-slate-700">المستلم</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-1"></div>
                    </div>
                    <div>
                      <span className="font-bold block text-slate-700">المحاسب المسؤول</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-1"></div>
                    </div>
                    <div>
                      <span className="font-bold block text-slate-700">اعتماد المدير</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-1"></div>
                    </div>
                  </div>
                )}
                <p className="text-[9px] text-slate-400 text-center pt-2">
                  {settings.voucherTermsText}
                </p>
              </div>
            )}

            {/* 3. PAYMENT VOUCHER PREVIEW */}
            {previewDocType === "payment" && (
              <div className="space-y-4 text-right text-xs">
                <div
                  className="flex items-center justify-between border-b pb-3"
                  style={{ borderColor: "#ef4444" }}
                >
                  <div>
                    <h3 className="font-black text-sm text-slate-900">{settings.storeName}</h3>
                    <p className="text-[10px] text-slate-500">{settings.voucherTitlePayment}</p>
                  </div>
                  <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-mono font-bold">
                    سند صرف #PAY-412
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border">
                  <div>
                    <span className="text-slate-500 font-semibold">المبلغ المصروف: </span>
                    <span className="font-black font-mono text-rose-600 text-sm">3,400.00 ج.م</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">التاريخ: </span>
                    <span className="font-mono font-bold">
                      {new Date().toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-800">
                  <p>
                    <strong>صرفنا إلى السيد/المورد:</strong> مصنع القاهرة للمستلزمات
                  </p>
                  <p>
                    <strong>مبلغ وقدره:</strong> ثلاثة آلاف وأربعمائة جنيه مصري لا غير
                  </p>
                  <p>
                    <strong>وذلك مقابل:</strong> سداد فاتورة خضروات ومستلزمات مطبخ رقم #PUR-88
                  </p>
                  {settings.voucherShowTreasuryName && (
                    <p>
                      <strong>خصماً من:</strong> خزينة الكاشير النقدية
                    </p>
                  )}
                </div>

                {settings.voucherShowSignatures && (
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-6 border-t border-slate-200 mt-4">
                    <div>
                      <span className="font-bold block text-slate-700">توقيع المستلم</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-1"></div>
                    </div>
                    <div>
                      <span className="font-bold block text-slate-700">المحاسب</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-1"></div>
                    </div>
                    <div>
                      <span className="font-bold block text-slate-700">المدير العام</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-1"></div>
                    </div>
                  </div>
                )}
                <p className="text-[9px] text-slate-400 text-center pt-2">
                  {settings.voucherTermsText}
                </p>
              </div>
            )}

            {/* 4. A4 TAX INVOICE PREVIEW */}
            {previewDocType === "invoice" && (
              <div className="space-y-4 text-right text-xs">
                <div
                  className="flex justify-between items-start border-b-2 pb-4"
                  style={{ borderColor: settings.accentColor }}
                >
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{settings.storeName}</h2>
                    <p className="text-xs text-slate-600 font-semibold">{settings.invoiceTitle}</p>
                    <p className="text-[10px] text-slate-500">
                      {settings.address} | هاتف: {settings.phone}
                    </p>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-xs font-black text-slate-800 block">TAX INVOICE</span>
                    <span className="text-[10px] text-slate-500">
                      الرقم الضريبي: {settings.taxNumber}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] bg-slate-50 p-3 rounded-xl border">
                  <div>
                    <p>
                      <strong>العميل:</strong> شركة الأهرام للتجارة
                    </p>
                    {settings.invoiceShowCustomerTaxId && (
                      <p>
                        <strong>الرقم الضريبي للعميل:</strong> 310998877600003
                      </p>
                    )}
                  </div>
                  <div className="text-left">
                    <p>
                      <strong>رقم الفاتورة:</strong> INV-2026-904
                    </p>
                    <p>
                      <strong>التاريخ:</strong> {new Date().toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                </div>

                <table className="w-full text-right text-[11px] border">
                  <thead className="bg-slate-100 font-bold border-b">
                    <tr>
                      <th className="p-2">الصنف والبيان</th>
                      <th className="p-2 text-center">الكمية</th>
                      <th className="p-2 text-center">السعر</th>
                      <th className="p-2 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="p-2">وجبات جماعية ممتازة للفعاليات</td>
                      <td className="p-2 text-center font-bold">10</td>
                      <td className="p-2 text-center font-mono">150.00</td>
                      <td className="p-2 text-left font-mono font-bold">1,500.00</td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-between items-end pt-2">
                  <div className="space-y-1 text-[10px] text-slate-600 max-w-xs">
                    <p className="font-bold">بيانات التحويل البنكي:</p>
                    <p className="font-mono text-[9px] bg-slate-100 p-1.5 rounded border">
                      {settings.invoiceBankDetails}
                    </p>
                  </div>
                  <div className="text-left font-mono text-[11px] space-y-1">
                    <p>المجموع: 1,500.00 ج.م</p>
                    <p>الضريبة (14%): 210.00 ج.م</p>
                    <p className="font-black text-sm text-emerald-700">الإجمالي: 1,710.00 ج.م</p>
                  </div>
                </div>

                {settings.invoiceShowCompanyStamp && (
                  <div className="flex justify-end pt-4">
                    <div className="w-24 h-24 border-2 border-emerald-600 border-dashed rounded-full flex flex-col items-center justify-center text-emerald-700 text-[10px] font-black rotate-12 bg-emerald-50/50">
                      <span>ختم المنشأة</span>
                      <span>معتمد 2026</span>
                    </div>
                  </div>
                )}
                <p className="text-[9px] text-slate-400 text-center border-t pt-2">
                  {settings.invoiceTermsAndConditions}
                </p>
              </div>
            )}

            {/* 5. RETURN NOTE PREVIEW */}
            {previewDocType === "return" && (
              <div className="space-y-3 text-right text-xs">
                <div className="flex items-center justify-between border-b pb-2 border-rose-300">
                  <h3 className="font-black text-sm text-slate-900">{settings.returnNoteTitle}</h3>
                  <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-mono font-bold">
                    #SRT-106
                  </Badge>
                </div>
                <div className="text-[11px] space-y-1 bg-slate-50 p-2 rounded-lg border">
                  <p>
                    <strong>مرتجع للطلب الأصلي:</strong> #INV-1029
                  </p>
                  <p>
                    <strong>العميل:</strong> زبون طاولة #04
                  </p>
                  <p>
                    <strong>سبب المرتجع:</strong> تعديل بالطلب بناءً على رغبة العميل
                  </p>
                </div>
                <div className="p-2 border rounded-lg bg-rose-50/50 space-y-1 text-slate-800 font-mono">
                  <p className="font-bold text-rose-700">قيمة المرتجع المستردة: 120.00 ج.م</p>
                  <p className="text-[10px] text-slate-600">
                    تم حسم المبلغ فوراً من خزينة الكاشير الرئيسية
                  </p>
                </div>
                {settings.showWarehouseSignature && (
                  <div className="grid grid-cols-2 gap-2 text-center text-[10px] pt-4 border-t">
                    <div>
                      <span className="font-bold">توقيع المستلم</span>
                      <div className="h-6 border-b border-dashed border-slate-400 mt-1"></div>
                    </div>
                    <div>
                      <span className="font-bold">أمين المخزن</span>
                      <div className="h-6 border-b border-dashed border-slate-400 mt-1"></div>
                    </div>
                  </div>
                )}
                {settings.showReturnPolicyText && (
                  <p className="text-[9px] text-slate-500 text-center pt-1">
                    {settings.returnPolicyText}
                  </p>
                )}
              </div>
            )}

            {/* 6. MALL CONTRACT PREVIEW */}
            {previewDocType === "mall_contract" && (
              <div className="space-y-4 text-right text-xs">
                <div
                  className="border-b-2 pb-3 text-center"
                  style={{ borderColor: settings.accentColor }}
                >
                  <h3 className="font-black text-base text-slate-900">
                    {settings.mallContractTitle}
                  </h3>
                  <p className="font-mono font-bold text-xs text-slate-700 tracking-wide mt-0.5">
                    {settings.mallContractTitleEn}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {settings.storeName} ({settings.storeNameEn}) - إدارة الأملاك والمراكز التجارية
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border text-[11px] space-y-1.5 font-semibold">
                  <div className="flex justify-between">
                    <span>
                      رقم المحل / الوحدة: <strong>#A-102 (معرض تجاري)</strong>
                    </span>
                    <span>
                      المساحة: <strong>45 م²</strong>
                    </span>
                  </div>
                  <div>
                    اسم المستأجر: <strong>شركة الأفق للتجارة والخدمات</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>
                      الإيجار الشهري: <strong className="text-emerald-700">$1,200 USD</strong>
                    </span>
                    <span>
                      مبلغ التأمين: <strong className="text-blue-700">$2,400 USD</strong>
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 border-t pt-1">
                    فترة العقد: 2026-01-01 إلى 2026-12-31
                  </div>
                </div>
                <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-[11px] space-y-1">
                  <p className="font-bold text-emerald-900">ملاحظات العقد الأساسية:</p>
                  <p className="text-slate-700 leading-relaxed">
                    {settings.mallContractHeaderNotes}
                  </p>
                </div>
                <div className="text-[10px] text-slate-600 leading-relaxed bg-slate-100 p-2.5 rounded-lg border">
                  <strong>الشروط والأحكام:</strong> {settings.mallContractTermsText}
                </div>
                {settings.mallContractShowSignatures && (
                  <div className="grid grid-cols-2 gap-4 text-center text-[10px] pt-4 border-t">
                    <div>
                      <span className="font-bold block">توقيع إدارة المول</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-2"></div>
                    </div>
                    <div>
                      <span className="font-bold block">توقيع المستأجر</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-2"></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. MALL TERMINATION PREVIEW */}
            {previewDocType === "mall_termination" && (
              <div className="space-y-4 text-right text-xs">
                <div className="border-b-2 pb-3 text-center border-rose-400">
                  <h3 className="font-black text-base text-slate-900">
                    {settings.mallTerminationTitle}
                  </h3>
                  <p className="font-mono font-bold text-xs text-slate-700 tracking-wide mt-0.5">
                    {settings.mallTerminationTitleEn}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {settings.storeName} ({settings.storeNameEn}) - قسم تسليم المحلات والفسخ
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border text-[11px] space-y-1.5 font-semibold">
                  <div className="flex justify-between">
                    <span>
                      رقم المحل: <strong>#B-204</strong>
                    </span>
                    <span>
                      تاريخ الفسخ: <strong>{new Date().toLocaleDateString("ar-EG")}</strong>
                    </span>
                  </div>
                  <div>
                    المستأجر: <strong>مؤسسة النور للأزياء</strong>
                  </div>
                  <div className="bg-rose-50 p-2 rounded border border-rose-200 text-rose-800 font-bold flex justify-between">
                    <span>صافي التأمين المسترد للعميل:</span>
                    <span className="font-mono text-sm">$1,500.00 USD</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed bg-amber-50 p-3 rounded-xl border border-amber-200">
                  {settings.mallTerminationTermsText}
                </p>
                {settings.mallTerminationShowSignatures && (
                  <div className="grid grid-cols-2 gap-4 text-center text-[10px] pt-4 border-t">
                    <div>
                      <span className="font-bold block">توقيع وإقرار إدارة المول</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-2"></div>
                    </div>
                    <div>
                      <span className="font-bold block">توقيع المستأجر (المسلم)</span>
                      <div className="h-8 border-b border-dashed border-slate-400 mt-2"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-muted/50 p-3 rounded-2xl border border-border text-[11px] text-muted-foreground flex items-center gap-2">
            <Info size={16} className="text-emerald-500 shrink-0" />
            <span>
              عند النقر على <strong>تطبيق وحفظ التصميم</strong> يتم تحديث أسلوب طباعة الفواتير
              والإيصالات في نقاط البيع والكاشير تلقائياً دون الحاجة لإعادة تشغيل النظام.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
