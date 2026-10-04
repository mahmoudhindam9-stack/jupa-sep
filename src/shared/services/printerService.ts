// Thermal Printer Service (Web Serial & ESC/POS + Fallback to Browser Print Preview)
import { getReceiptDesignSettings } from "./receiptSettings";
import { printRawHtml } from "@/shared/utils/printAccountingDocument";

export interface PrintableReceiptData {
  storeName?: string;
  storeSubtitle?: string;
  taxNumber?: string;
  commercialRegister?: string;
  logoUrl?: string;
  branchName?: string;
  address?: string;
  phone?: string;
  orderNumber?: string | number;
  orderType?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  customerName?: string;
  cashierName?: string;
  date?: string;
  time?: string;
  systemTimestamp?: string;
  journalEntryRef?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    notes?: string;
    note?: string;
    selectedAdditions?: any[];
  }>;
  subtotal: number;
  discount?: number;
  serviceFee?: number;
  deliveryFee?: number;
  tax?: number;
  taxRate?: number;
  total: number;
  totalPaidInCurrency?: number;
  currency?: string;
  exchangeRate?: number;
  thankYouMessage?: string;
  footerNotes?: string;
  wifiInfo?: string;
}

class ThermalPrinterService {
  private port: any = null;
  private writer: any = null;
  private isConnected: boolean = false;

  constructor() {
    this.checkSavedPrinter();
  }

  private checkSavedPrinter() {
    if (typeof window !== "undefined" && "serial" in navigator) {
      (navigator as any).serial
        ?.getPorts()
        .then((ports: any[]) => {
          if (ports.length > 0) {
            this.port = ports[0];
            this.isConnected = true;
            this.notifyStatus();
          }
        })
        .catch(() => {});
    }
  }

  public isPrinterConnected(): boolean {
    return this.isConnected;
  }

  public async connectThermalPrinter(): Promise<boolean> {
    if (typeof window === "undefined" || !("serial" in navigator)) {
      alert("متصفحك لا يدعم الاتصال المباشر عبر Web Serial. يمكنك استخدام طباعة المتصفح العادية.");
      return false;
    }

    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      this.isConnected = true;
      this.notifyStatus();
      return true;
    } catch (err: any) {
      console.warn("Failed to connect thermal printer via Web Serial:", err);
      this.isConnected = false;
      this.notifyStatus();
      return false;
    }
  }

  public async disconnectPrinter() {
    try {
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (e) {
      console.error(e);
    }
    this.isConnected = false;
    this.notifyStatus();
  }

  private notifyStatus() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("thermal_printer_status_changed", {
          detail: { isConnected: this.isConnected },
        }),
      );
    }
  }

  /**
   * Main Smart Print Method:
   * - If Thermal Printer is CONNECTED -> Direct ESC/POS Print immediately!
   * - If Thermal Printer is NOT CONNECTED -> Fallback to window.print() + printHtmlWindow if needed
   */
  public async printReceipt(
    data?: PrintableReceiptData,
  ): Promise<{ method: "direct" | "browser"; success: boolean }> {
    if (this.isConnected && this.port) {
      console.log("PrinterService: Attempting direct print...");
      try {
        const success = await this.sendEscPosToPrinter(data);
        console.log("PrinterService: Direct print success:", success);
        if (success) {
          return { method: "direct", success: true };
        }
      } catch (err) {
        console.error("PrinterService: Direct thermal print error:", err);
        this.isConnected = false;
        this.notifyStatus();
      }
    }
    console.log("PrinterService: Falling back to browser print...");
    // Fallback: Open Browser Print Preview directly
    if (typeof window !== "undefined") {
      if (data) {
        this.printHtmlWindow(data);
      } else {
        window.print();
      }
      return { method: "browser", success: true };
    }

    return { method: "browser", success: false };
  }

  /**
   * Dedicated Print Window Popup (Bypasses iframe sandboxing and ensures thermal receipt preview)
   */
  public printHtmlWindow(data: PrintableReceiptData) {
    if (typeof window === "undefined") return;

    const settings = getReceiptDesignSettings();
    const storeName = data.storeName || settings.storeName;
    const storeSubtitle = data.storeSubtitle || settings.storeSubtitle;
    const taxNumber = settings.showTaxNumber ? data.taxNumber || settings.taxNumber : "";
    const commercialRegister = settings.showCommercialRegister
      ? data.commercialRegister || settings.commercialRegister
      : "";
    const logoUrl = settings.showLogo ? data.logoUrl || settings.logoUrl : "";
    const accentColor = settings.accentColor || "#10b981";
    const thankYouMessage = settings.showThankYouMsg
      ? data.thankYouMessage || settings.thankYouMessage
      : "";
    const footerNotes = settings.showFooterNotes
      ? data.footerNotes || settings.footerNotesText
      : "";
    const wifiInfo = settings.showWifiPass ? data.wifiInfo || settings.wifiPasswordText : "";
    const showNotes = settings.showItemNotes;

    // Using printRawHtml for robust iframe fallback

    const itemsRows = (data.items || [])
      .map(
        (it) => `
      <tr>
        <td style="text-align: right; padding: 5px 0; border-bottom: 1px dashed #e2e8f0;">
          <div style="font-weight: bold; color: #1e293b;">${it.name}</div>
          ${
            showNotes && (it.notes || it.note)
              ? `<div style="font-size: 10px; color: #64748b; margin-top: 2px;">• ${
                  it.notes || it.note
                }</div>`
              : ""
          }
        </td>
        <td style="text-align: center; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; font-weight: bold;">x${it.quantity}</td>
        <td style="text-align: left; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; font-weight: 900; color: #0f172a;">
          ${(it.price * it.quantity).toFixed(2)} ${data.currency || "USD"}
        </td>
      </tr>
    `,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="ar">
      <head>
        <meta charset="utf-8">
        <title>إيصال تذاكر / مبيعات - #${data.orderNumber || ""}</title>
        <style>
          @page { size: ${settings.receiptPaperWidth === "58mm" ? "58mm" : "80mm"} auto; margin: 0; }
          body {
            font-family: '${settings.fontFamily || "Tajawal"}', sans-serif, system-ui;
            width: ${settings.receiptPaperWidth === "58mm" ? "54mm" : "76mm"};
            margin: 0 auto;
            padding: 12px;
            color: #0f172a;
            background: #fff;
            font-size: 11px;
            line-height: 1.4;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #94a3b8; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .total-box {
            font-size: 15px;
            font-weight: 900;
            border: 2px solid ${accentColor};
            color: ${accentColor};
            padding: 8px;
            margin-top: 8px;
            text-align: center;
            border-radius: 8px;
            background: #f8fafc;
          }
          .print-btn {
            background: ${accentColor};
            color: white;
            border: none;
            padding: 10px 20px;
            font-weight: bold;
            border-radius: 10px;
            cursor: pointer;
            width: 100%;
            margin-bottom: 12px;
            font-size: 14px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          @media print {
            .no-print { display: none !important; }
            body { width: 100%; margin: 0; padding: 5px; }
          }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button onclick="window.print()" class="print-btn">🖨️ اضغط هنا للطباعة الفورية</button>
        </div>

        <div class="text-center">
          ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height: 55px; margin-bottom: 6px; object-fit: contain;" />` : ""}
          <h2 style="margin: 0 0 4px 0; font-size: 17px; font-weight: 900; color: ${accentColor};">${storeName}</h2>
          ${storeSubtitle ? `<div style="font-size: 11px; color: #475569; font-weight: 600;">${storeSubtitle}</div>` : ""}
          ${settings.showBranchName && settings.branchName ? `<div style="font-size: 10px; color: #64748b;">${settings.branchName}</div>` : ""}
          ${taxNumber ? `<div style="font-size: 10px; color: #64748b;">الرقم الضريبي: ${taxNumber}</div>` : ""}
          ${commercialRegister ? `<div style="font-size: 10px; color: #64748b;">سجل تجاري: ${commercialRegister}</div>` : ""}
        </div>
        
        <div class="divider"></div>
        
        ${data.orderNumber ? `<div class="bold text-center" style="font-size: 15px; font-family: monospace; color: #0f172a;">رقم الإيصال: ${data.orderNumber}</div>` : ""}
        ${data.journalEntryRef ? `<div style="font-size: 10px; color: #475569;" class="text-center">رقم القيد: ${data.journalEntryRef}</div>` : ""}
        
        <div style="margin-top: 6px; font-size: 10px; color: #334155;" class="space-y-1">
          ${data.orderType ? `<div><strong>النوع / الفئة:</strong> ${data.orderType}</div>` : ""}
          ${settings.showPaymentMethod && data.paymentMethod ? `<div><strong>طريقة الدفع:</strong> ${data.paymentMethod}</div>` : ""}
          ${data.referenceNumber ? `<div><strong>رقم التأكيد/المرجع:</strong> ${data.referenceNumber}</div>` : ""}
          ${settings.showCustomerDetails && data.customerName ? `<div><strong>العميل:</strong> ${data.customerName}</div>` : ""}
          ${settings.showCashierName && data.cashierName ? `<div><strong>أمين الصندوق:</strong> ${data.cashierName}</div>` : ""}
          
          <div style="margin-top: 4px; border-top: 1px dotted #cbd5e1; padding-top: 4px;">
            ${data.date ? `<div><strong>تاريخ وحين المعاملة:</strong> ${data.date} ${data.time || ""}</div>` : ""}
            ${data.systemTimestamp ? `<div style="color: #64748b;"><strong>تاريخ التسجيل بالنظام:</strong> ${new Date(data.systemTimestamp).toLocaleString("ar-EG")}</div>` : ""}
          </div>
        </div>
        
        <div class="divider"></div>
        
        <table>
          <thead>
            <tr style="border-bottom: 1.5px solid #0f172a; font-weight: 900;">
              <th class="text-right">التذكرة / الصنف</th>
              <th class="text-center">العدد</th>
              <th class="text-left">السعر</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <div style="display: flex; justify-content: space-between; font-weight: 600;">
          <span>المجموع الفرعي:</span>
          <span>${data.subtotal.toFixed(2)} ${data.currency || "USD"}</span>
        </div>
        ${
          data.discount && data.discount > 0
            ? `
          <div style="display: flex; justify-content: space-between; font-weight: bold; color: #e11d48;">
            <span>الخصم:</span>
            <span>-${data.discount.toFixed(2)} ${data.currency || "USD"}</span>
          </div>
        `
            : ""
        }
        ${
          data.tax && data.tax > 0
            ? `
          <div style="display: flex; justify-content: space-between;">
            <span>الضريبة${data.taxRate ? ` (${data.taxRate}%)` : ""}:</span>
            <span>${data.tax.toFixed(2)} ${data.currency || "USD"}</span>
          </div>
        `
            : ""
        }
        
        <div class="total-box">
          الإجمالي: ${data.total.toFixed(2)} ${data.currency || "USD"}
          ${data.totalPaidInCurrency && data.currency === "SSP" ? `<div style="font-size: 11px; margin-top: 2px; font-weight: normal; color: #334155;">(${data.totalPaidInCurrency.toLocaleString()} SSP - بسعر ${data.exchangeRate || 1})</div>` : ""}
        </div>
        
        <div class="divider"></div>
        
        <div class="text-center" style="margin-top: 10px;">
          ${thankYouMessage ? `<div class="bold" style="color: ${accentColor};">${thankYouMessage}</div>` : ""}
          ${footerNotes ? `<div style="font-size: 10px; margin-top: 4px; color: #475569;">${footerNotes}</div>` : ""}
          ${wifiInfo ? `<div style="font-size: 10px; margin-top: 2px; color: #64748b; font-weight: 600;">WiFi: ${wifiInfo}</div>` : ""}
        </div>
        
        <script>
          setTimeout(function() {
            window.focus();
            window.print();
          }, 350);
        </script>
      </body>
      </html>
    `;


    const printWindow = window.open("", "_blank", "width=320,height=600,left=100,top=100");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 500);
      }, 250);
    } else {
      // Fallback for popups blocked: inject a specialized thermal iframe
      let iframe = document.getElementById("thermal-print-iframe") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "thermal-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "80mm";
        iframe.style.height = "100vh";
        iframe.style.zIndex = "-9999";
        iframe.style.opacity = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 500);
      }
    }
  }


  /**
   * Generate ESC/POS commands and send to serial port writer
   */
  private async sendEscPosToPrinter(data?: PrintableReceiptData): Promise<boolean> {
    if (!this.port) return false;

    if (!this.writer) {
      const writableStreamClosed = this.port.writable;
      this.writer = writableStreamClosed.getWriter();
    }

    const encoder = new TextEncoder();
    const bytes: number[] = [];

    // ESC/POS Commands
    const ESC = 0x1b;
    const GS = 0x1d;

    // Initialize Printer
    bytes.push(ESC, 0x40);

    // Center Align
    bytes.push(ESC, 0x61, 1);

    if (data) {
      const storeName = data.storeName || "مطعم ومقهى ريستوكاش";
      const subtitle = data.storeSubtitle || "إيصال مبيعات";
      const orderNum = data.orderNumber ? `#${data.orderNumber}` : "";
      const curr = data.currency || "ج.م";

      // Big Title
      bytes.push(GS, 0x21, 0x11); // Double size
      this.appendUtf8Bytes(bytes, storeName + "\n", encoder);

      bytes.push(GS, 0x21, 0x00); // Normal size
      this.appendUtf8Bytes(bytes, subtitle + "\n", encoder);

      if (data.taxNumber) {
        this.appendUtf8Bytes(bytes, `الرقم الضريبي: ${data.taxNumber}\n`, encoder);
      }

      this.appendUtf8Bytes(bytes, "--------------------------------\n", encoder);

      if (orderNum) {
        bytes.push(ESC, 0x45, 1); // Bold
        this.appendUtf8Bytes(bytes, `رقم الطلب: ${orderNum}\n`, encoder);
        bytes.push(ESC, 0x45, 0); // Bold off
      }

      if (data.date) {
        this.appendUtf8Bytes(bytes, `التاريخ: ${data.date}\n`, encoder);
      }
      if (data.orderType) {
        this.appendUtf8Bytes(bytes, `نوع الطلب: ${data.orderType}\n`, encoder);
      }
      if (data.paymentMethod) {
        this.appendUtf8Bytes(bytes, `طريقة الدفع: ${data.paymentMethod}\n`, encoder);
      }

      this.appendUtf8Bytes(bytes, "--------------------------------\n", encoder);

      // Left align items
      bytes.push(ESC, 0x61, 0);
      data.items.forEach((item) => {
        const line = `${item.name} x${item.quantity} = ${(item.price * item.quantity).toFixed(2)} ${curr}\n`;
        this.appendUtf8Bytes(bytes, line, encoder);
      });

      bytes.push(ESC, 0x61, 1); // Center align
      this.appendUtf8Bytes(bytes, "--------------------------------\n", encoder);

      // Totals
      this.appendUtf8Bytes(bytes, `المجموع الفرعي: ${data.subtotal.toFixed(2)} ${curr}\n`, encoder);
      if (data.discount && data.discount > 0) {
        this.appendUtf8Bytes(bytes, `الخصم: -${data.discount.toFixed(2)} ${curr}\n`, encoder);
      }
      if (data.serviceFee && data.serviceFee > 0) {
        this.appendUtf8Bytes(
          bytes,
          `خدمة الصالة: +${data.serviceFee.toFixed(2)} ${curr}\n`,
          encoder,
        );
      }
      if (data.deliveryFee && data.deliveryFee > 0) {
        this.appendUtf8Bytes(
          bytes,
          `خدمة التوصيل: +${data.deliveryFee.toFixed(2)} ${curr}\n`,
          encoder,
        );
      }
      if (data.tax > 0) {
        const taxRateLabel = data.taxRate ? ` (${data.taxRate}%)` : "";
        this.appendUtf8Bytes(
          bytes,
          `الضريبة${taxRateLabel}: ${data.tax.toFixed(2)} ${curr}\n`,
          encoder,
        );
      }

      bytes.push(ESC, 0x45, 1); // Bold
      bytes.push(GS, 0x21, 0x01); // Double height
      this.appendUtf8Bytes(bytes, `الإجمالي: ${data.total.toFixed(2)} ${curr}\n`, encoder);
      bytes.push(GS, 0x21, 0x00);
      bytes.push(ESC, 0x45, 0);

      this.appendUtf8Bytes(bytes, "--------------------------------\n", encoder);

      if (data.thankYouMessage) {
        this.appendUtf8Bytes(bytes, `${data.thankYouMessage}\n`, encoder);
      }
      if (data.footerNotes) {
        this.appendUtf8Bytes(bytes, `${data.footerNotes}\n`, encoder);
      }
    } else {
      this.appendUtf8Bytes(bytes, "إيصال مبيعات - طباعة حرارية مباشرة\n", encoder);
    }

    // Feed lines & Cut Paper
    bytes.push(ESC, 0x64, 0x04); // Feed 4 lines
    bytes.push(GS, 0x56, 0x41, 0x03); // Full Cut

    const uint8Array = new Uint8Array(bytes);
    await this.writer.write(uint8Array);
    return true;
  }

  private appendUtf8Bytes(targetArray: number[], str: string, encoder: TextEncoder) {
    const encoded = encoder.encode(str);
    encoded.forEach((b) => targetArray.push(b));
  }
}

export const printerService = new ThermalPrinterService();
