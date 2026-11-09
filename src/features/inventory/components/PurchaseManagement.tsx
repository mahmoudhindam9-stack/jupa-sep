// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { erpStore, PurchaseOrder } from "@/shared/services/erpStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag,
  CheckCircle,
  Clock,
  FileText,
  Printer,
  Trash2,
  Receipt,
  ArrowUpRight,
} from "lucide-react";

interface PurchaseManagementProps {
  inventoryItems: { id: string; name_ar: string; unit: string }[];
  onRefreshInventory?: () => void;
}

export function PurchaseManagement({
  inventoryItems: _inventoryItems,
  onRefreshInventory,
}: PurchaseManagementProps) {
  const navigate = useNavigate();
  const [erpState, setErpState] = useState(erpStore.getState());
  const { toast } = useToast();

  useEffect(() => {
    return erpStore.subscribe(() => {
      setErpState(erpStore.getState());
    });
  }, []);

  const currentBranch = useMemo(
    () =>
      erpState.branches.find((b) => b.id === erpState.currentBranchId) || erpState.branches[0],
    [erpState],
  );

  const orders = useMemo(
    () =>
      erpState.purchaseOrders.filter((o) => o.branch_id === currentBranch.id && !o.deleted),
    [erpState, currentBranch],
  );

  const handleReceiveOrder = (po: PurchaseOrder) => {
    try {
      erpStore.receivePurchaseOrder(po.id);
      setErpState(erpStore.getState());
      onRefreshInventory?.();

      toast({
        title: "تم استلام البضاعة بالمخزن",
        description: `تم تأكيد استلام الفاتورة (${po.invoice_number}) وتحديث أرصدة المخزون وربط القيد بالإدارة المالية.`,
      });
    } catch (e: any) {
      toast({
        title: "خطأ",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = (po: PurchaseOrder) => {
    erpStore.deletePurchaseOrder(po.id);
    setErpState(erpStore.getState());
    toast({
      title: "تم نقل الفاتورة لسلة المحذوفات",
      description: `تم حذف أمر التوريد رقم ${po.invoice_number}`,
    });
  };

  const handlePrintPO = (po: PurchaseOrder) => {
    const supplier = erpState.suppliers.find((s) => s.id === po.supplier_id);
    const printWin = window.open("", "_blank", "width=850,height=700");
    if (!printWin) return;

    const rowsHtml = po.items
      .map(
        (item, idx) => `
      <tr>
        <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;font-weight:bold;">${item.name_ar}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${item.unit_cost.toLocaleString()} $</td>
        <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;font-weight:bold;">${(item.quantity * item.unit_cost).toLocaleString()} $</td>
      </tr>
    `,
      )
      .join("");

    printWin.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>فاتورة مشتريات وتوريد - ${po.invoice_number}</title>
          <style>
            body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #0f172a; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
            th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2 style="margin:0;">سند وفاتورة توريد مخزني</h2>
              <p style="margin:4px 0 0;font-size:13px;">الفرع: ${currentBranch.name_ar}</p>
            </div>
            <div style="text-align:left;font-size:13px;">
              <div><strong>رقم الفاتورة:</strong> ${po.invoice_number}</div>
              <div><strong>التاريخ:</strong> ${new Date(po.created_at).toLocaleDateString("ar-EG")}</div>
              <div><strong>المورد:</strong> ${supplier?.name_ar || "مورد عام"}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>الصنف</th>
                <th>الكمية</th>
                <th>سعر الوحدة</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="margin-top:20px;text-align:left;font-size:16px;font-weight:bold;">
            الإجمالي الكلي: ${po.total_amount.toLocaleString()} $
          </div>
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-4 rounded-2xl shadow-2xs">
        <div>
          <h3 className="font-black text-sm text-foreground flex items-center gap-2">
            <ShoppingBag size={18} className="text-primary" />
            <span>سجل فواتير المشتريات وأوامر التوريد المرتبطة بالإدارة المالية ({orders.length})</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-semibold">
            يتم إصدار جميع فواتير الشراء وسندات الصرف للموردين مركزياً من خلال صفحة السندات في الإدارة المالية لضمان دقة القيود والخزائن.
          </p>
        </div>
        <Button
          onClick={() =>
            navigate({
              to: "/admin/ledger",
              search: { tab: "vouchers", dept: "restaurant" } as any,
            })
          }
          className="rounded-xl font-black text-xs gap-2 h-10 px-4 shadow-sm shrink-0 cursor-pointer"
        >
          <Receipt size={15} />
          <span>إصدار فاتورة مشتريات / سند توريد (الإدارة المالية)</span>
          <ArrowUpRight size={14} />
        </Button>
      </div>

      <div className="space-y-3">
        {orders.map((po) => {
          const supplier = erpState.suppliers.find((s) => s.id === po.supplier_id);
          return (
            <Card key={po.id} className="p-4 border-border shadow-xs space-y-3 rounded-2xl">
              <div className="flex flex-wrap items-center justify-between border-b border-border pb-3 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-primary" />
                    <span className="font-bold text-sm text-foreground">
                      فاتورة: {po.invoice_number}
                    </span>
                    <Badge
                      variant={po.status === "received" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {po.status === "received" ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle size={10} /> مستلمة بالمخزن
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> قيد الانتظار
                        </span>
                      )}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-500/40 text-amber-600"
                    >
                      {po.payment_type === "cash"
                        ? "مدفوع نقداً"
                        : po.payment_type === "credit"
                          ? "آجل (ذمم)"
                          : "دفعة جزئية"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    المورد:{" "}
                    <span className="font-semibold text-foreground">
                      {supplier?.name_ar || "غير محدد"}
                    </span>{" "}
                    | التاريخ: {new Date(po.created_at).toLocaleDateString("ar-EG")}
                  </p>
                </div>

                <div className="text-left">
                  <p className="text-xs text-muted-foreground">الإجمالي الكلي</p>
                  <p className="text-base font-black text-primary">
                    {po.total_amount.toLocaleString()} $
                  </p>
                </div>
              </div>

              <div className="bg-muted/30 p-2.5 rounded-xl space-y-1 text-xs">
                {po.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-0.5">
                    <span>
                      • {item.name_ar} (الكمية:{" "}
                      <strong className="font-mono">{item.quantity}</strong>)
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {(item.quantity * item.unit_cost).toLocaleString()} $ ({item.unit_cost}{" "}
                      $/للوحدة)
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  المدفوع:{" "}
                  <strong className="text-emerald-600 font-mono">
                    {po.paid_amount.toLocaleString()} $
                  </strong>{" "}
                  | المتبقي:{" "}
                  <strong className="text-destructive font-mono">
                    {(po.total_amount - po.paid_amount).toLocaleString()} $
                  </strong>
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintPO(po)}
                    className="gap-1.5 text-xs font-bold h-8 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Printer size={13} /> طباعة الفاتورة
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteOrder(po)}
                    className="gap-1 text-xs font-bold h-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 size={13} /> حذف
                  </Button>
                  {po.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => handleReceiveOrder(po)}
                      className="gap-1 text-xs font-bold h-8"
                    >
                      <CheckCircle size={14} /> استلام وتأكيد بالمخزن
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl bg-card/40 space-y-3">
            <p className="text-sm font-bold">لا توجد أوامر توريد أو فواتير مشتريات مسجلة حالياً.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate({
                  to: "/admin/ledger",
                  search: { tab: "vouchers", dept: "restaurant" } as any,
                })
              }
              className="rounded-xl font-bold text-xs gap-1.5"
            >
              <Receipt size={14} />
              <span>الانتقال لصفحة السندات بالإدارة المالية لإصدار فاتورة مشتريات</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
