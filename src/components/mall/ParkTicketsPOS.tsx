// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  Ticket,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  RotateCcw,
  FileSpreadsheet,
  Search,
  Building2,
  User,
  DollarSign,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Settings,
  Users,
  ArrowRight,
  FileText,
  Check,
  Calendar,
  Clock,
  Briefcase,
  HelpCircle,
  Landmark,
  ArrowLeftRight,
  Edit2,
  Eye,
  Sparkles,
  Gamepad2,
  Waves,
  Compass,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  erpStore,
  ParkTicketItem,
  ParkCustomer,
  ParkOperationalTreasury,
  ParkTicketTransaction,
  ParkShift,
  ParkTicketCartItem,
  TreasuryAccount,
} from "@/shared/services/erpStore";
import { getReceiptDesignSettings, ReceiptDesignSettings } from "@/shared/services/receiptSettings";
import { printerService } from "@/shared/services/printerService";
import { RestocashLogo } from "@/components/RestocashLogo";
import { ParkShiftLauncherModal } from "@/components/mall/ParkShiftLauncherModal";
import { ParkShiftClosingReportModal } from "@/components/mall/ParkShiftClosingReportModal";
import { ParkCashierTreasuryModal } from "./ParkCashierTreasuryModal";

export { ParkShiftLauncherModal, ParkShiftClosingReportModal, ParkCashierTreasuryModal };

interface ParkTicketsPOSViewProps {
  onClosePOS: () => void;
}

function CategoryPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
        active
          ? "bg-primary text-primary-foreground shadow"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            active
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-card text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function ParkTicketsPOSView({ onClosePOS }: ParkTicketsPOSViewProps) {
  const [, forceRender] = useState(0);

  useEffect(() => {
    return erpStore.subscribe(() => {
      forceRender((prev) => prev + 1);
    });
  }, []);

  const state = erpStore.getState();
  const ticketItems = erpStore.getParkTicketItems().filter((t) => t.is_active);
  const customers = erpStore.getParkCustomers();
  const activeShift = erpStore.getActiveParkShift();
  const baseSspRate = erpStore.getExchangeRate("SSP");

  // Filtering & Search state
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isShiftLauncherModalOpen, setIsShiftLauncherModalOpen] = useState(!activeShift);

  // Cart State
  const [cartItems, setCartItems] = useState<ParkTicketCartItem[]>([]);

  console.log("ParkTicketsPOS rendering, cartItems:", cartItems);
  const [currency, setCurrency] = useState<"USD" | "SSP">("USD");
  const [customSspRate, setCustomSspRate] = useState<number>(baseSspRate);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "visa" | "bank_transfer" | "credit">(
    "cash",
  );
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [txTime, setTxTime] = useState<string>(new Date().toTimeString().slice(0, 5));
  const [overallNotes, setOverallNotes] = useState<string>("");

  // Modals state
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [editingItemNoteIndex, setEditingItemNoteIndex] = useState<number | null>(null);
  const [itemNoteInput, setItemNoteInput] = useState<string>("");
  const [isTreasuriesModalOpen, setIsTreasuriesModalOpen] = useState(false);
  const [isCustomersModalOpen, setIsCustomersModalOpen] = useState(false);
  const [isPricesModalOpen, setIsPricesModalOpen] = useState(false);
  const [isShiftCloseModalOpen, setIsShiftCloseModalOpen] = useState(false);
  const [isCashierTreasuryModalOpen, setIsCashierTreasuryModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [completedSaleResult, setCompletedSaleResult] = useState<any>(null);

  // Quick Customer Add Modal
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState("");
  const [quickCustPhone, setQuickCustPhone] = useState("");
  const [quickCustCompany, setQuickCustCompany] = useState("");

  // Calculate totals
  const subtotalUsd = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price_usd * item.quantity, 0);
  }, [cartItems]);

  const effectiveRate = currency === "SSP" ? customSspRate : 1;
  const totalPayableInCurrency = useMemo(() => {
    if (currency === "SSP") {
      return Math.round(subtotalUsd * customSspRate);
    }
    return subtotalUsd;
  }, [subtotalUsd, currency, customSspRate]);

  // Rate warning check
  const isRateWarning = useMemo(() => {
    if (currency !== "SSP") return false;
    const diffRatio = Math.abs(customSspRate - baseSspRate) / baseSspRate;
    return diffRatio > 0.1; // >10% deviation
  }, [currency, customSspRate, baseSspRate]);

  // Filtered ticket items
  const filteredTickets = useMemo(() => {
    return ticketItems.filter((ticket) => {
      // Category filter
      if (activeCategory !== "all") {
        const type = (ticket.type || "").toLowerCase();
        const name = (ticket.name_ar + " " + (ticket.name_en || "")).toLowerCase();
        if (activeCategory === "entry") {
          const isEntry =
            type === "single" ||
            type === "entry" ||
            name.includes("دخول") ||
            name.includes("فردي") ||
            (!name.includes("عائل") && !name.includes("لعب") && !name.includes("مسبح"));
          if (!isEntry) return false;
        } else if (activeCategory === "family") {
          const isFam =
            type === "family" ||
            type === "vip" ||
            (ticket.persons_count && ticket.persons_count > 1) ||
            name.includes("عائل") ||
            name.includes("باقة") ||
            name.includes("vip") ||
            name.includes("مجموعة");
          if (!isFam) return false;
        } else if (activeCategory === "rides") {
          const isRides =
            type === "rides" ||
            type === "games" ||
            name.includes("لعب") ||
            name.includes("ملاهي") ||
            name.includes("ألعاب") ||
            name.includes("قطار") ||
            name.includes("سيارات");
          if (!isRides) return false;
        } else if (activeCategory === "facilities") {
          const isFac =
            type === "facility" ||
            type === "pool" ||
            name.includes("مسبح") ||
            name.includes("مرافق") ||
            name.includes("خدم") ||
            name.includes("سينما") ||
            name.includes("بولينج");
          if (!isFac) return false;
        }
      }

      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchNameAr = ticket.name_ar?.toLowerCase().includes(q);
        const matchNameEn = ticket.name_en?.toLowerCase().includes(q);
        const matchType = ticket.type?.toLowerCase().includes(q);
        return matchNameAr || matchNameEn || matchType;
      }
      return true;
    });
  }, [ticketItems, activeCategory, search]);

  // Category counts
  const categoryCounts = useMemo(() => {
    let entry = 0;
    let family = 0;
    let rides = 0;
    let facilities = 0;

    ticketItems.forEach((ticket) => {
      const type = (ticket.type || "").toLowerCase();
      const name = (ticket.name_ar + " " + (ticket.name_en || "")).toLowerCase();
      if (
        type === "family" ||
        type === "vip" ||
        (ticket.persons_count && ticket.persons_count > 1) ||
        name.includes("عائل") ||
        name.includes("باقة") ||
        name.includes("vip") ||
        name.includes("مجموعة")
      ) {
        family++;
      } else if (
        type === "rides" ||
        type === "games" ||
        name.includes("لعب") ||
        name.includes("ملاهي") ||
        name.includes("ألعاب")
      ) {
        rides++;
      } else if (
        type === "facility" ||
        type === "pool" ||
        name.includes("مسبح") ||
        name.includes("مرافق") ||
        name.includes("خدم")
      ) {
        facilities++;
      } else {
        entry++;
      }
    });

    return {
      all: ticketItems.length,
      entry,
      family,
      rides,
      facilities,
    };
  }, [ticketItems]);

  // Add Item to cart (Restocash POS Style)
  const handleAddToCart = (ticket: ParkTicketItem) => {
    console.log("Adding ticket to cart:", ticket);
    setCartItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.ticket_id === ticket.id && !i.note);
      if (existingIdx >= 0) {
        return prev.map((item, i) =>
          i === existingIdx ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          ticket_id: ticket.id,
          name_ar: ticket.name_ar,
          price_usd: ticket.price_usd,
          quantity: 1,
          note: "",
        },
      ];
    });
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    console.log("Updating quantity for index:", index, "to:", newQty);
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((_, idx) => idx !== index));
    } else {
      setCartItems((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, quantity: newQty } : item)),
      );
    }
  };

  const handleSaveItemNote = () => {
    if (editingItemNoteIndex !== null) {
      setCartItems((prev) =>
        prev.map((item, idx) =>
          idx === editingItemNoteIndex ? { ...item, note: itemNoteInput.trim() } : item,
        ),
      );
      setEditingItemNoteIndex(null);
      setItemNoteInput("");
    }
  };

  const handleQuickAddCustomer = () => {
    if (!quickCustName.trim()) {
      toast.error("يرجى إدخال اسم العميل!");
      return;
    }
    const newCust = erpStore.addParkCustomer({
      name_ar: quickCustName.trim(),
      phone: quickCustPhone.trim(),
      company: quickCustCompany.trim(),
    });
    setSelectedCustomerId(newCust.id);
    setIsQuickAddCustomerOpen(false);
    setQuickCustName("");
    setQuickCustPhone("");
    setQuickCustCompany("");
    toast.success(`تم إضافة العميل (${newCust.name_ar}) واختياره بنجاح`);
  };

  const handleProcessSale = () => {
    if (cartItems.length === 0) {
      toast.error("سلة التذاكر فارغة! يرجى إضافة تذاكر أولاً.");
      return;
    }

    if (paymentMethod === "visa" && !referenceNumber.trim()) {
      toast.error("يرجى إدخال رقم تأكيد عملية الفيزا (مطلوب وإجباري)!");
      return;
    }

    if (paymentMethod === "bank_transfer" && !referenceNumber.trim()) {
      toast.error("يرجى إدخال رقم التحويل البنكي (مطلوب وإجباري)!");
      return;
    }

    if (paymentMethod === "credit" && !selectedCustomerId) {
      toast.error("يرجى اختيار العميل عند الدفع الآجل!");
      return;
    }

    try {
      const res = erpStore.processParkTicketSale({
        items: cartItems,
        currency,
        exchange_rate: customSspRate,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        customer_id: selectedCustomerId,
        transaction_date: txDate,
        transaction_time: txTime,
        notes: overallNotes,
      });

      setCompletedSaleResult(res);
      setIsCheckoutModalOpen(false);
      setIsReceiptModalOpen(true);
      toast.success(`تم إصدار التذاكر بنجاح! رقم الفاتورة: ${res.transaction.tx_number}`);

      // Reset cart immediately as requested
      setCartItems([]);
      setReferenceNumber("");
      setOverallNotes("");
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء تنفيذ عملية التذاكر");
    }
  };

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((s, i) => s + i.quantity, 0);
  }, [cartItems]);

  const formatTicketPrice = (usd: number) => {
    if (currency === "SSP") {
      const ssp = Math.round(usd * customSspRate);
      return `${ssp.toLocaleString()} SSP`;
    }
    return `$${usd.toFixed(2)} USD`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden text-right font-sans antialiased"
      style={{ fontFamily: '"Tajawal", "Cairo", system-ui, sans-serif' }}
    >
      {/* 1. RESTAURANT-STYLE GRADIENT HEADER */}
      <header
        className="px-6 lg:px-8 py-4 border-b border-border/20 flex flex-wrap items-center justify-between gap-4 text-white shrink-0 shadow-sm"
        style={{ background: "var(--gradient-primary)" }}
      >
        {/* Left Side: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <RestocashLogo size={32} variant="white" showDeveloper={false} />
          <div>
            <h1 className="text-base lg:text-lg font-black leading-tight flex items-center gap-2">
              <span>نقطة بيع تذاكر الحديقة والمرافق</span>
              <span
                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${activeShift ? "bg-white/20 backdrop-blur text-white border-white/25" : "bg-destructive text-destructive-foreground border-destructive"}`}
              >
                {activeShift ? `وردية #${activeShift.shift_number}` : "الوردية مغلقة"}
              </span>
            </h1>
            <p className="text-xs text-white/80 mt-0.5 flex items-center gap-2">
              <span>
                أمين الصندوق: <strong>{activeShift?.cashier_name || "غير محدد"}</strong>
              </span>
              <span>•</span>
              <span>{new Date().toLocaleDateString("ar-EG")}</span>
            </p>
          </div>
        </div>

        {/* Center: Search Bar */}
        <div className="relative w-full sm:w-72 lg:w-96 order-3 sm:order-2">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70" size={18} />
          <input
            type="text"
            placeholder="البحث في التذاكر والمرافق والألعاب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/15 backdrop-blur border border-white/20 rounded-2xl py-2.5 pr-11 pl-4 text-sm text-white placeholder:text-white/60 outline-none focus:border-white/60 focus:bg-white/20 transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Right Side: Back to Admin / Mall */}
        <div className="flex items-center gap-2 order-2 sm:order-3">
          <button
            type="button"
            onClick={onClosePOS}
            className="bg-white/15 hover:bg-white/25 active:scale-95 text-white border border-white/25 rounded-2xl px-4 py-2 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <ArrowRight size={15} />
            <span>رجوع للسجل والتقارير</span>
          </button>
        </div>
      </header>

      {/* 2. SUB-BAR: QUICK MANAGEMENT MODALS & CURRENCY CONTROLS */}
      <div className="px-6 lg:px-8 py-2.5 bg-slate-900 border-b border-border flex flex-wrap items-center justify-between gap-3 text-white shrink-0">
        {/* Quick Action Navigation Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCashierTreasuryModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Wallet size={14} className="text-emerald-400" />
            <span>خزينة الكاشير</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCustomersModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Users size={14} className="text-blue-400" />
            <span>إدارة العملاء</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPricesModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Settings size={14} className="text-amber-400" />
            <span>أسعار التذاكر</span>
          </button>

          {activeShift ? (
            <button
              type="button"
              onClick={() => setIsShiftCloseModalOpen(true)}
              className="bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-rose-800 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Lock size={14} className="text-rose-400" />
              <span>إغلاق الوردية</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsShiftLauncherModalOpen(true)}
              className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-800 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Lock size={14} className="text-emerald-400" />
              <span>فتح وردية جديدة</span>
            </button>
          )}
        </div>

        {/* Currency Switcher & Rate Input */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                currency === "USD"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              دولار ($)
            </button>
            <button
              type="button"
              onClick={() => setCurrency("SSP")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                currency === "SSP"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              جنيه (SSP)
            </button>
          </div>

          {currency === "SSP" && (
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 font-bold">$1 =</span>
              <input
                type="number"
                value={customSspRate}
                onChange={(e) => setCustomSspRate(Number(e.target.value) || baseSspRate)}
                className="w-16 bg-slate-900 text-white font-bold text-center rounded-lg border border-slate-700 px-1 py-0.5 text-xs outline-none focus:border-primary"
              />
              <span className="text-slate-400 font-bold">SSP</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. MAIN WORKSPACE: CATEGORIES + PRODUCTS CATALOG (LEFT) & STICKY CART (RIGHT) */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* CATALOG AREA */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/15">
          {/* CATEGORY PILLS BAR */}
          <div className="px-6 lg:px-8 py-3.5 border-b border-border bg-card flex gap-2 overflow-x-auto pb-2 shrink-0">
            <CategoryPill
              label="الكل"
              count={categoryCounts.all}
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            <CategoryPill
              label="تذاكر الدخول الفردية"
              count={categoryCounts.entry}
              active={activeCategory === "entry"}
              onClick={() => setActiveCategory("entry")}
            />
            <CategoryPill
              label="باقات عائلية ومجموعات"
              count={categoryCounts.family}
              active={activeCategory === "family"}
              onClick={() => setActiveCategory("family")}
            />
            <CategoryPill
              label="ألعاب وملاهي الأطفال"
              count={categoryCounts.rides}
              active={activeCategory === "rides"}
              onClick={() => setActiveCategory("rides")}
            />
            <CategoryPill
              label="مرافق وخدمات VIP"
              count={categoryCounts.facilities}
              active={activeCategory === "facilities"}
              onClick={() => setActiveCategory("facilities")}
            />
          </div>

          {/* TICKET ITEMS GRID */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            {filteredTickets.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 lg:gap-4">
                {filteredTickets.map((ticket) => {
                  const sspPrice = Math.round(ticket.price_usd * customSspRate);
                  const isFam =
                    ticket.type === "family" ||
                    ticket.type === "vip" ||
                    (ticket.persons_count && ticket.persons_count > 1);
                  const isRide =
                    ticket.type === "rides" ||
                    ticket.type === "games" ||
                    ticket.name_ar.includes("لعب") ||
                    ticket.name_ar.includes("ملاهي");
                  const isPool =
                    ticket.type === "pool" ||
                    ticket.type === "facility" ||
                    ticket.name_ar.includes("مسبح");

                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => handleAddToCart(ticket)}
                      className="group bg-card rounded-2xl overflow-hidden border border-border transition-all hover:-translate-y-1 active:scale-[0.98] text-right cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
                      style={{ boxShadow: "var(--shadow-card)" }}
                    >
                      {/* Top Visual Banner */}
                      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-teal-500/15 via-emerald-500/10 to-primary/15 flex items-center justify-center border-b border-border/50">
                        {/* Themed Vector Visuals */}
                        <div className="w-12 h-12 rounded-2xl bg-card/80 backdrop-blur shadow-xs flex items-center justify-center text-primary transition group-hover:scale-110">
                          {isFam ? (
                            <Users size={24} />
                          ) : isRide ? (
                            <Gamepad2 size={24} />
                          ) : isPool ? (
                            <Waves size={24} />
                          ) : (
                            <Ticket size={24} />
                          )}
                        </div>

                        {/* Price Badge (Top Left) */}
                        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[11px] font-black px-2 py-1 rounded-full shadow-md">
                          {formatTicketPrice(ticket.price_usd)}
                        </div>

                        {/* Persons Tag Badge (Top Right) */}
                        <div className="absolute top-0 right-0 bg-slate-900/90 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-bl-2xl shadow-md z-10">
                          {ticket.persons_count && ticket.persons_count > 1
                            ? `${ticket.persons_count} أفراد`
                            : "فرد واحد"}
                        </div>
                      </div>

                      {/* Card Content Details */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-xs text-card-foreground line-clamp-2 leading-tight group-hover:text-primary transition">
                            {ticket.name_ar}
                          </h4>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {ticket.name_en || (isFam ? "باقة عائلية شاملة" : "تذكرة دخول نظامية")}
                          </p>
                        </div>

                        {/* Action Footer */}
                        <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2">
                          <span className="text-[11px] text-primary font-bold flex items-center gap-1 group-hover:underline">
                            <Plus size={12} /> إضافة
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {currency === "USD"
                              ? `~ ${sspPrice.toLocaleString()} SSP`
                              : `$${ticket.price_usd.toFixed(2)} USD`}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground bg-card rounded-3xl border border-dashed border-border p-8 text-center">
                <Ticket size={40} className="opacity-40 mb-3 text-primary" />
                <h3 className="font-bold text-base text-foreground mb-1">لا توجد تذاكر مطابقة</h3>
                <p className="text-xs max-w-sm">
                  لم نتمكن من العثور على أي تذاكر تطابق معايير البحث أو القسم المختار.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* 4. RESTAURANT-STYLE STICKY CART SIDEBAR (DESKTOP) */}
        <aside
          className={`${isMobileCartOpen ? "flex" : "hidden"} lg:flex lg:w-[380px] xl:w-[420px] bg-card border-r border-border flex-col shrink-0 sticky top-0 h-full self-start overflow-hidden`}
          style={{ boxShadow: "var(--shadow-elegant)" }}
        >
          {/* Cart Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-primary-foreground shadow-xs"
                style={{ background: "var(--gradient-primary)" }}
              >
                <ShoppingCart size={18} />
              </div>
              <div>
                <h3 className="font-black text-base leading-none text-foreground">سلة التذاكر</h3>
                <p className="text-xs text-muted-foreground mt-1 font-bold">
                  {cartItems.length} أصناف • {totalCartCount}{" "}
                  {totalCartCount === 1 ? "تذكرة" : "تذاكر"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 items-end">
              {/* Close button for mobile */}
              <button
                className="lg:hidden text-xs font-bold text-muted-foreground hover:text-foreground"
                onClick={() => setIsMobileCartOpen(false)}
              >
                إغلاق السلة <X size={14} className="inline" />
              </button>

              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="text-xs text-destructive hover:underline font-bold transition cursor-pointer"
                >
                  مسح الكل
                </button>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
            {cartItems.length > 0 ? (
              cartItems.map((item, idx) => (
                <div
                  key={`${item.ticket_id}-${idx}`}
                  className="flex gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-muted/70 border border-border/60 transition group"
                >
                  {/* Thumbnail */}
                  <div className="w-13 h-13 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Ticket size={20} />
                  </div>

                  {/* Details & Controls */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    {/* Title + Action Icons */}
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-bold text-xs text-card-foreground line-clamp-1">
                        {item.name_ar}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItemNoteIndex(idx);
                            setItemNoteInput(item.note || "");
                          }}
                          className={`p-1 rounded-lg border text-xs transition cursor-pointer ${
                            item.note
                              ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30"
                              : "bg-background border-border text-muted-foreground hover:text-primary"
                          }`}
                          title="إضافة ملاحظة"
                        >
                          <FileText size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, 0)}
                          className="p-1 rounded-lg bg-background border border-border text-muted-foreground hover:text-destructive transition cursor-pointer"
                          title="حذف الصنف"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Note Tag if Present */}
                    {item.note && (
                      <div className="flex items-center justify-between gap-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-lg px-2 py-0.5 text-[10px] font-bold mt-1">
                        <span className="truncate">{item.note}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCartItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, note: "" } : it)),
                            );
                          }}
                          className="text-amber-700 hover:text-destructive shrink-0"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}

                    {/* Price + Stepper */}
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40">
                      <span className="text-xs font-black text-primary">
                        {formatTicketPrice(item.price_usd * item.quantity)}
                      </span>

                      {/* Stepper (LTR layout) */}
                      <div
                        className="flex items-center gap-1 bg-card border border-border rounded-xl p-0.5 shadow-xs"
                        dir="ltr"
                      >
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                          className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-muted text-foreground transition cursor-pointer"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="w-6 text-center font-black text-xs text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                          className="h-6 w-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition cursor-pointer"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center border-2 border-dashed border-border rounded-3xl bg-muted/10 flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <ShoppingCart size={24} className="text-muted-foreground/60" />
                </div>
                <h4 className="text-xs font-black text-foreground mb-1">سلة التذاكر فارغة</h4>
                <p className="text-[11px] text-muted-foreground max-w-[200px] leading-relaxed">
                  اضغط على أي تذكرة في القائمة لإضافتها فوراً لسلة الشراء.
                </p>
              </div>
            )}
          </div>

          {/* Cart Footer */}
          <div className="border-t border-border p-5 space-y-3.5 bg-card shrink-0">
            {/* Total Summary */}
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-muted-foreground">مجموع الطلبات:</span>
                <span className="text-2xl font-black text-primary">
                  {formatTicketPrice(subtotalUsd)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">
                يتم تحديد العملة وطريقة الدفع وطباعة التذاكر عند الضغط على إتمام الطلب.
              </p>
            </div>

            {/* Big Action Checkout Button */}
            <button
              type="button"
              disabled={cartItems.length === 0 || !activeShift}
              onClick={() => setIsCheckoutModalOpen(true)}
              className="w-full py-4 rounded-2xl text-primary-foreground font-black text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 active:scale-[0.99] transition shadow flex items-center justify-center gap-2 cursor-pointer"
              style={{
                background: "var(--gradient-primary)",
                boxShadow: "var(--shadow-elegant)",
              }}
            >
              <ShoppingCart size={18} />
              <span>{activeShift ? "إتمام الطلب" : "يجب فتح وردية أولاً"}</span>
              <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs mr-auto font-black">
                {formatTicketPrice(subtotalUsd)}
              </span>
            </button>
          </div>
        </aside>
      </div>

      {/* 5. MOBILE FLOATING CART BAR (IF NOT DESKTOP) */}
      {!isMobileCartOpen && (
        <div className="lg:hidden fixed bottom-6 left-6 z-40">
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center relative hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-white/20"
            style={{ background: "var(--gradient-primary)", color: "white" }}
          >
            <ShoppingCart size={24} />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-black min-w-[22px] h-[22px] rounded-full flex items-center justify-center px-1 border-2 border-background shadow-sm">
                {totalCartCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* DETAILED CHECKOUT MODAL (RESTANT POS STYLE CHECKOUT FLOW) */}
      <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-teal-600">
              <CreditCard size={18} />
              تفاصيل إتمام وتأكيد طلب التذاكر
            </DialogTitle>
            <DialogDescription className="text-xs">
              حدد طريقة الدفع، والعملة، ورقم التأكيد والمعلومات المطلوبة لإصدار التذاكر والطباعة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* CURRENCY & EXCHANGE RATE SELECTOR */}
            <div className="p-3.5 rounded-2xl bg-teal-500/5 border border-teal-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <DollarSign size={15} className="text-teal-600" />
                  عملة التحصيل وإسعار الفاتورة:
                </span>
                <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setCurrency("USD")}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      currency === "USD"
                        ? "bg-teal-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    دولار ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency("SSP")}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      currency === "SSP"
                        ? "bg-teal-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    جنيه (SSP)
                  </button>
                </div>
              </div>

              {currency === "SSP" && (
                <div className="space-y-2 pt-2 border-t border-teal-500/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">
                      سعر الصرف المعتمد ($1 =):
                    </span>
                    <div className="flex items-center gap-1 w-[140px]">
                      <Input
                        type="number"
                        value={customSspRate}
                        onChange={(e) => setCustomSspRate(Number(e.target.value) || baseSspRate)}
                        className="h-8 rounded-xl font-bold text-xs text-center"
                      />
                      <span className="text-[11px] font-bold text-muted-foreground">SSP</span>
                    </div>
                  </div>

                  {isRateWarning && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[11px] font-bold flex items-start gap-1.5">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        تنبيه: سعر الصرف المدخل يختلف بأكثر من 10% عن سعر الصرف الرسمي النظامي ($1 ={" "}
                        {baseSspRate} SSP)!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PAYMENT METHOD SELECTOR */}
            <div className="space-y-2">
              <label className="text-xs font-black text-foreground block">طريقة الدفع:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`p-3 rounded-2xl border text-center font-bold text-xs transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    paymentMethod === "cash"
                      ? "border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-600/30 font-black"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  <DollarSign size={18} />
                  <span>نقدي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("visa")}
                  className={`p-3 rounded-2xl border text-center font-bold text-xs transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    paymentMethod === "visa"
                      ? "border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-600/30 font-black"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  <CreditCard size={18} />
                  <span>فيزا / بطاقة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("bank_transfer")}
                  className={`p-3 rounded-2xl border text-center font-bold text-xs transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    paymentMethod === "bank_transfer"
                      ? "border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-600/30 font-black"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  <Building2 size={18} />
                  <span>تحويل بنكي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("credit")}
                  className={`p-3 rounded-2xl border text-center font-bold text-xs transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    paymentMethod === "credit"
                      ? "border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-600/30 font-black"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                  }`}
                >
                  <Briefcase size={18} />
                  <span>آجل (حساب)</span>
                </button>
              </div>
            </div>

            {/* CONDITIONAL PAYMENT INPUTS */}
            {paymentMethod === "visa" && (
              <div className="space-y-1 bg-amber-500/5 p-3.5 rounded-2xl border border-amber-500/20">
                <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <span>رقم تأكيد عملية الفيزا *</span>
                  <span className="text-[10px] text-rose-500 font-normal">(مطلوب إجباري)</span>
                </label>
                <Input
                  placeholder="أدخل رقم التأكيد / الإيصال الخاص بالبطاقة..."
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="h-9 rounded-xl font-mono text-xs"
                />
              </div>
            )}

            {paymentMethod === "bank_transfer" && (
              <div className="space-y-1 bg-blue-500/5 p-3.5 rounded-2xl border border-blue-500/20">
                <label className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                  <span>رقم التحويل البنكي / العملية *</span>
                  <span className="text-[10px] text-rose-500 font-normal">(مطلوب إجباري)</span>
                </label>
                <Input
                  placeholder="أدخل مرجع عملية التحويل البنكي..."
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="h-9 rounded-xl font-mono text-xs"
                />
              </div>
            )}

            {paymentMethod === "credit" && (
              <div className="space-y-2 bg-purple-500/5 p-3.5 rounded-2xl border border-purple-500/20">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-purple-800 dark:text-purple-300">
                    اختيار العميل للبيع الآجل *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddCustomerOpen(true)}
                    className="text-[11px] text-purple-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    عميل جديد
                  </button>
                </div>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger className="h-9 rounded-xl text-xs font-bold">
                    <SelectValue placeholder="اختر العميل من القائمة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name_ar} {c.company ? `(${c.company})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* DATE & TIME SYSTEM CONTROLS (REQUIREMENT 7) */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-muted/30 border border-border">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  تاريخ الفاتورة المعاملة:
                </label>
                <Input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="h-9 text-xs font-bold rounded-xl"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                  وقت الفاتورة المعاملة:
                </label>
                <Input
                  type="time"
                  value={txTime}
                  onChange={(e) => setTxTime(e.target.value)}
                  className="h-9 text-xs font-bold rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                ملاحظات الفاتورة العام (اختياري):
              </label>
              <Input
                placeholder="أدخل أي ملاحظات خاصة على الفاتورة..."
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                className="h-9 text-xs font-medium rounded-xl"
              />
            </div>

            {/* TOTAL PAYABLE BOX */}
            <div className="p-3.5 rounded-2xl bg-teal-600/10 text-teal-900 dark:text-teal-100 border border-teal-600/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-black block">إجمالي المستحق للدفع:</span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  شامل القيود المحاسبية التلقائية
                </span>
              </div>
              <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                {currency === "USD"
                  ? `$${totalPayableInCurrency.toFixed(2)} USD`
                  : `${totalPayableInCurrency.toLocaleString()} SSP`}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCheckoutModalOpen(false)}
              className="rounded-xl"
            >
              إلغاء
            </Button>

            <Button
              onClick={handleProcessSale}
              className="bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl gap-2 cursor-pointer h-10 px-5"
            >
              <Printer size={16} />
              إتمام الطلب وإصدار التذاكر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ITEM NOTE EDIT MODAL */}
      <Dialog
        open={editingItemNoteIndex !== null}
        onOpenChange={(open) => !open && setEditingItemNoteIndex(null)}
      >
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black">إضافة ملاحظة للتذكرة</DialogTitle>
            <DialogDescription className="text-xs">
              سيتم حفظ هذه الملاحظة مع الفاتورة والقيد المحاسبي والتقارير.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="مثال: خصم خاص، تذكرة مجانية، ملاحظة على الزائر..."
              value={itemNoteInput}
              onChange={(e) => setItemNoteInput(e.target.value)}
              className="rounded-xl text-xs font-bold"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingItemNoteIndex(null)}
              className="rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleSaveItemNote}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl"
            >
              حفظ الملاحظة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK ADD CUSTOMER MODAL */}
      <Dialog open={isQuickAddCustomerOpen} onOpenChange={setIsQuickAddCustomerOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <User size={18} className="text-teal-600" />
              إضافة عميل جديد سريعة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold block mb-1">اسم العميل (عربي) *</label>
              <Input
                placeholder="اسم العميل..."
                value={quickCustName}
                onChange={(e) => setQuickCustName(e.target.value)}
                className="h-9 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">رقم الهاتف (اختياري)</label>
              <Input
                placeholder="رقم الهاتف..."
                value={quickCustPhone}
                onChange={(e) => setQuickCustPhone(e.target.value)}
                className="h-9 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="font-bold block mb-1">اسم الشركة / الجهة (اختياري)</label>
              <Input
                placeholder="اسم الشركة..."
                value={quickCustCompany}
                onChange={(e) => setQuickCustCompany(e.target.value)}
                className="h-9 rounded-xl font-bold"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsQuickAddCustomerOpen(false)}
              className="rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleQuickAddCustomer}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold"
            >
              إضافة واختيار
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRINTABLE RECEIPT MODAL (SYNCHRONIZED WITH RECEIPT DESIGN SETTINGS) */}
      <ParkReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        saleData={completedSaleResult}
      />

      {/* MODALS INTEGRATION */}
      <ParkOperationalTreasuriesModal
        isOpen={isTreasuriesModalOpen}
        onClose={() => setIsTreasuriesModalOpen(false)}
      />

      <ParkCustomersModal
        isOpen={isCustomersModalOpen}
        onClose={() => setIsCustomersModalOpen(false)}
      />

      <ParkTicketPricesModal
        isOpen={isPricesModalOpen}
        onClose={() => setIsPricesModalOpen(false)}
      />

      <ParkShiftClosingReportModal
        isOpen={isShiftCloseModalOpen}
        onClose={() => setIsShiftCloseModalOpen(false)}
        onShiftClosed={() => {
          setIsShiftCloseModalOpen(false);
          setIsShiftLauncherModalOpen(true);
        }}
      />

      <ParkCashierTreasuryModal
        isOpen={isCashierTreasuryModalOpen}
        onClose={() => setIsCashierTreasuryModalOpen(false)}
        onOpenCloseShift={() => {
          setIsCashierTreasuryModalOpen(false);
          setIsShiftCloseModalOpen(true);
        }}
      />

      <ParkShiftLauncherModal
        isOpen={isShiftLauncherModalOpen}
        onClose={() => setIsShiftLauncherModalOpen(false)}
        onShiftOpened={() => setIsShiftLauncherModalOpen(false)}
      />
    </div>
  );
}

{
  /* PRINTABLE RECEIPT COMPONENT - FULLY SYNCHRONIZED WITH RECEIPT DESIGN PAGE */
}
export function ParkReceiptModal({
  isOpen,
  onClose,
  saleData,
}: {
  isOpen: boolean;
  onClose: () => void;
  saleData: any;
}) {
  const [receiptSettings, setReceiptSettings] = useState<ReceiptDesignSettings>(
    getReceiptDesignSettings(),
  );

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setReceiptSettings(getReceiptDesignSettings());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("receipt_settings_updated", handleSettingsUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("receipt_settings_updated", handleSettingsUpdate);
      }
    };
  }, []);

  if (!saleData || !saleData.transaction) return null;
  const tx: ParkTicketTransaction = saleData.transaction;
  const je = saleData.journalEntry;

  const handlePrint = async () => {
    const receiptData = {
      storeName: receiptSettings.storeName,
      storeSubtitle: receiptSettings.storeSubtitle,
      taxNumber: receiptSettings.taxNumber,
      commercialRegister: receiptSettings.commercialRegister,
      logoUrl: receiptSettings.logoUrl,
      branchName: receiptSettings.branchName,
      orderNumber: tx.tx_number,
      journalEntryRef: tx.journal_entry_ref,
      orderType: "تذاكر دخول حديقة ومرافق المول",
      paymentMethod:
        tx.payment_method === "cash"
          ? "نقدي"
          : tx.payment_method === "visa"
            ? "فيزا / بطاقة"
            : tx.payment_method === "bank_transfer"
              ? "تحويل بنكي"
              : "آجل على الحساب",
      referenceNumber: tx.reference_number,
      customerName: tx.customer_name,
      cashierName: tx.created_by,
      date: tx.transaction_date,
      time: tx.transaction_time,
      systemTimestamp: tx.system_timestamp,
      items: tx.items.map((i) => ({
        name: i.name_ar,
        quantity: i.quantity,
        price: i.price_usd,
        note: i.note,
      })),
      subtotal: tx.subtotal_usd,
      total: tx.total_usd,
      totalPaidInCurrency: tx.total_paid_in_currency,
      currency: tx.currency,
      exchangeRate: tx.exchange_rate,
      thankYouMessage: receiptSettings.thankYouMessage,
      footerNotes: receiptSettings.footerNotesText,
      wifiInfo: receiptSettings.wifiPasswordText,
    };

    if (printerService.isPrinterConnected()) {
      toast.success("تم إرسال إيصال التذكرة مباشرة إلى الطابعة الحرارية المتصلة 🖨️");
      printerService.printReceipt(receiptData);
    } else {
      toast.success("جاري إرسال أمر الطباعة 🖨️");
      printerService.printHtmlWindow(receiptData);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-black text-teal-600">
            معاينة وإصدار تذكرة الدخول / الإيصال
          </DialogTitle>
          <DialogDescription className="text-center text-xs">
            تصميم الفاتورة مقتبس تلقائياً من صفحة تصميم الفواتير والسندات
          </DialogDescription>
        </DialogHeader>

        {/* RECEIPT DESIGN PREVIEW */}
        <div
          id="invoice"
          style={{ fontFamily: receiptSettings.fontFamily || "Tajawal" }}
          className="space-y-4 py-3 text-xs border border-border p-4 rounded-2xl bg-card shadow-xs"
        >
          {/* STORE HEADER */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-border">
            {receiptSettings.showLogo && receiptSettings.logoUrl && (
              <img
                src={receiptSettings.logoUrl}
                alt="Store Logo"
                className="max-h-14 mx-auto mb-2 object-contain"
              />
            )}
            <h3
              style={{ color: receiptSettings.accentColor || "#10b981" }}
              className="font-black text-base"
            >
              {receiptSettings.storeName}
            </h3>
            {receiptSettings.storeSubtitle && (
              <p className="text-[11px] font-bold text-muted-foreground">
                {receiptSettings.storeSubtitle}
              </p>
            )}
            {receiptSettings.showBranchName && receiptSettings.branchName && (
              <p className="text-[10px] text-muted-foreground">{receiptSettings.branchName}</p>
            )}
            {receiptSettings.showTaxNumber && receiptSettings.taxNumber && (
              <p className="text-[10px] text-muted-foreground font-mono">
                الرقم الضريبي: {receiptSettings.taxNumber}
              </p>
            )}
            {receiptSettings.showCommercialRegister && receiptSettings.commercialRegister && (
              <p className="text-[10px] text-muted-foreground font-mono">
                سجل تجاري: {receiptSettings.commercialRegister}
              </p>
            )}
          </div>

          {/* RECEIPT META DATA */}
          <div className="space-y-1 text-[11px] bg-muted/30 p-2.5 rounded-xl border border-border">
            <div className="flex justify-between items-center font-mono">
              <span className="font-bold text-foreground">رقم الفاتورة (الرقم التسلسلي):</span>
              <span className="font-black text-teal-600 text-sm">{tx.tx_number}</span>
            </div>
            <div className="flex justify-between items-center font-mono text-[10px]">
              <span className="text-muted-foreground">رقم القيد المحاسبي:</span>
              <span className="font-bold text-primary">{tx.journal_entry_ref}</span>
            </div>

            <div className="pt-1.5 border-t border-border/50 space-y-1">
              <div className="flex justify-between">
                <span>نوع الفاتورة:</span>
                <span className="font-bold">تذاكر دخول ومرافق</span>
              </div>
              {receiptSettings.showPaymentMethod && (
                <div className="flex justify-between">
                  <span>طريقة الدفع:</span>
                  <span className="font-bold">
                    {tx.payment_method === "cash"
                      ? "نقدي"
                      : tx.payment_method === "visa"
                        ? "فيزا / بطاقة"
                        : tx.payment_method === "bank_transfer"
                          ? "تحويل بنكي"
                          : "آجل"}
                  </span>
                </div>
              )}
              {tx.reference_number && (
                <div className="flex justify-between font-mono">
                  <span>المرجع / التأكيد:</span>
                  <span className="font-bold">{tx.reference_number}</span>
                </div>
              )}
              {receiptSettings.showCustomerDetails && tx.customer_name && (
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span className="font-bold">{tx.customer_name}</span>
                </div>
              )}
              {receiptSettings.showCashierName && (
                <div className="flex justify-between">
                  <span>أمين الصندوق:</span>
                  <span className="font-bold">{tx.created_by}</span>
                </div>
              )}
            </div>

            {/* DUAL TIMESTAMP SYSTEM DISPLAY (REQUIREMENT 7) */}
            <div className="pt-1.5 border-t border-dashed border-border space-y-1 font-mono text-[10px]">
              <div className="flex justify-between text-foreground font-bold">
                <span>تاريخ وحين المعاملة:</span>
                <span>
                  {tx.transaction_date} {tx.transaction_time}
                </span>
              </div>
              {tx.systemTimestamp && (
                <div className="flex justify-between text-muted-foreground">
                  <span>تاريخ التسجيل بالنظام:</span>
                  <span>{new Date(tx.systemTimestamp).toLocaleString("ar-EG")}</span>
                </div>
              )}
            </div>
          </div>

          {/* TICKET ITEMS TABLE */}
          <table className="w-full text-right border-collapse text-[11px]">
            <thead>
              <tr className="border-b-2 border-foreground/20 font-black">
                <th className="py-1.5">التذكرة</th>
                <th className="py-1.5 text-center">العدد</th>
                <th className="py-1.5 text-left">الإجمالي ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {tx.items.map((item, i) => (
                <tr key={i}>
                  <td className="py-1.5 font-bold">
                    {item.name_ar}
                    {receiptSettings.showItemNotes && item.note && (
                      <div className="text-[10px] text-muted-foreground font-normal">
                        • ملاحظة: {item.note}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 text-center font-bold">x{item.quantity}</td>
                  <td className="py-1.5 text-left font-black">
                    ${(item.price_usd * item.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* TOTALS & CURRENCY BREAKDOWN */}
          <div className="border-t border-dashed border-border pt-2 space-y-1">
            <div className="flex justify-between font-bold text-muted-foreground">
              <span>المجموع الفرعي ($):</span>
              <span>${tx.total_usd.toFixed(2)}</span>
            </div>
            <div
              style={{ borderColor: receiptSettings.accentColor || "#10b981" }}
              className="flex justify-between items-center font-black text-sm p-2.5 rounded-xl border bg-muted/20"
            >
              <span>المبلغ المدفوع بالعملة ({tx.currency}):</span>
              <span style={{ color: receiptSettings.accentColor || "#10b981" }}>
                {tx.currency === "USD"
                  ? `$${tx.total_paid_in_currency}`
                  : `${tx.total_paid_in_currency.toLocaleString()} SSP`}
              </span>
            </div>
            {tx.currency === "SSP" && (
              <p className="text-[10px] text-muted-foreground text-left font-mono">
                سعر الصرف المعتمد: $1 = {tx.exchange_rate} SSP
              </p>
            )}
          </div>

          {/* ZATCA QR / BARCODE PLACEHOLDER */}
          {receiptSettings.showQRCode && (
            <div className="pt-2 text-center">
              <div className="w-24 h-24 bg-foreground/5 border border-foreground/10 rounded-xl mx-auto flex items-center justify-center font-mono text-[9px] text-muted-foreground">
                [رمز QR ZATCA]
              </div>
            </div>
          )}

          {/* FOOTER DISCLAIMERS & THANK YOU MESSAGE */}
          <div className="text-center pt-2 space-y-1 border-t border-dashed border-border">
            {receiptSettings.showThankYouMsg && receiptSettings.thankYouMessage && (
              <p
                style={{ color: receiptSettings.accentColor || "#10b981" }}
                className="font-bold text-xs"
              >
                {receiptSettings.thankYouMessage}
              </p>
            )}
            {receiptSettings.showFooterNotes && receiptSettings.footerNotesText && (
              <p className="text-[10px] text-muted-foreground">{receiptSettings.footerNotesText}</p>
            )}
            {receiptSettings.showWifiPass && receiptSettings.wifiPasswordText && (
              <p className="text-[10px] font-bold text-muted-foreground">
                شبكة WiFi: {receiptSettings.wifiPasswordText}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
            إغلاق
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-1.5 font-bold"
          >
            <Printer size={15} />
            طباعة التذكرة الإيصال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

{
  /* OPERATIONAL TREASURIES LINK MODAL */
}
export function ParkOperationalTreasuriesModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const state = erpStore.getState();
  const realTreasuries = state.treasuries || [];
  const [opTreasuries, setOpTreasuries] = useState(erpStore.getParkOperationalTreasuries());

  const handleLinkChange = (opId: string, realId: string) => {
    erpStore.updateParkOperationalTreasuryLink(opId, realId);
    setOpTreasuries(erpStore.getParkOperationalTreasuries());
    toast.success("تم التحديث بنجاح!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2 text-teal-600">
            <Landmark size={18} />
            إدارة الخزائن التشغيلية الثمانية (8)
          </DialogTitle>
          <DialogDescription className="text-xs">
            يتم توجيه مبيعات التذاكر تلقائياً إلى الخزينة التشغيلية المناسبة حسب طريقة الدفع
            والعملة، وعند إغلاق الوردية يتم ترحيلها تلقائياً للخزائن الحقيقية.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="overflow-x-auto border border-border rounded-2xl">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border font-black text-muted-foreground">
                  <th className="p-3">اسم الخزينة التشغيلية</th>
                  <th className="p-3">طريقة الدفع والعملة</th>
                  <th className="p-3">الرصيد الحالي</th>
                  <th className="p-3">الربط بالخزينة الحقيقية للترحيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {opTreasuries.map((op) => (
                  <tr key={op.id} className="hover:bg-muted/30 transition">
                    <td className="p-3 font-bold text-foreground">{op.name_ar}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {op.payment_method} | {op.currency}
                      </Badge>
                    </td>
                    <td className="p-3 font-black text-teal-600">
                      {op.currency === "USD"
                        ? `$${op.balance}`
                        : `${op.balance.toLocaleString()} SSP`}
                    </td>
                    <td className="p-3">
                      <Select
                        value={op.linked_real_treasury_id}
                        onValueChange={(val) => handleLinkChange(op.id, val)}
                      >
                        <SelectTrigger className="h-8 text-xs font-bold rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {realTreasuries
                            .filter((rt) => rt.currency === op.currency)
                            .map((rt) => (
                              <SelectItem key={rt.id} value={rt.id}>
                                {rt.name_ar} ({rt.account_code || rt.id})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="bg-teal-600 text-white rounded-xl font-bold">
            حفظ وإغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

{
  /* CUSTOMERS MANAGEMENT MODAL */
}
export function ParkCustomersModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [customers, setCustomers] = useState(erpStore.getParkCustomers());
  const [nameAr, setNameAr] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  const handleAdd = () => {
    if (!nameAr.trim()) {
      toast.error("يرجى إدخال اسم العميل!");
      return;
    }
    erpStore.addParkCustomer({ name_ar: nameAr, phone, company });
    setCustomers(erpStore.getParkCustomers());
    setNameAr("");
    setPhone("");
    setCompany("");
    toast.success("تم إضافة العميل بنجاح!");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center gap-2 text-teal-600">
            <Users size={18} />
            إدارة عملاء التذاكر الآجلة
          </DialogTitle>
          <DialogDescription className="text-xs">
            إضافة وتعديل بيانات العملاء والجهات المستفيدة من مبيعات التذاكر الآجلة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-muted/40 p-3 rounded-2xl border border-border">
            <Input
              placeholder="اسم العميل (عربي) *"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className="h-8 text-xs font-bold rounded-xl"
            />
            <Input
              placeholder="رقم الهاتف"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-8 text-xs font-mono rounded-xl"
            />
            <Input
              placeholder="اسم الشركة / الجهة"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="h-8 text-xs font-bold rounded-xl"
            />
            <Button
              onClick={handleAdd}
              className="sm:col-span-3 h-8 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl gap-1 mt-1"
            >
              <Plus size={14} /> إضافة عميل جديد
            </Button>
          </div>

          <div className="overflow-x-auto border border-border rounded-2xl">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border font-black">
                  <th className="p-2.5">اسم العميل</th>
                  <th className="p-2.5">الهاتف</th>
                  <th className="p-2.5">الشركة</th>
                  <th className="p-2.5 text-left">الرصيد الآجل الحالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="p-2.5 font-bold">{c.name_ar}</td>
                    <td className="p-2.5 font-mono">{c.phone || "-"}</td>
                    <td className="p-2.5">{c.company || "-"}</td>
                    <td className="p-2.5 text-left font-mono font-bold text-rose-600">
                      ${c.balance_usd || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="bg-teal-600 text-white rounded-xl font-bold">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

{
  /* TICKET PRICES MANAGEMENT MODAL */
}
export function ParkTicketPricesModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ParkTicketItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Add / Edit Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ParkTicketItem | null>(null);
  const [formData, setFormData] = useState({
    name_ar: "",
    name_en: "",
    type: "single_regular" as
      "single_regular" | "family_regular" | "single_holiday" | "family_holiday" | "custom",
    persons_count: 1,
    price_usd: 5,
    is_active: true,
  });

  // Delete Confirmation State
  const [deletingItem, setDeletingItem] = useState<ParkTicketItem | null>(null);

  const refreshItems = () => {
    setItems(erpStore.getParkTicketItems());
  };

  useEffect(() => {
    if (isOpen) {
      refreshItems();
    }
  }, [isOpen]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      name_ar: "",
      name_en: "",
      type: "single_regular",
      persons_count: 1,
      price_usd: 5,
      is_active: true,
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (it: ParkTicketItem) => {
    setEditingItem(it);
    setFormData({
      name_ar: it.name_ar,
      name_en: it.name_en || "",
      type: it.type || "custom",
      persons_count: it.persons_count || 1,
      price_usd: it.price_usd || 0,
      is_active: it.is_active !== undefined ? it.is_active : true,
    });
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_ar.trim()) {
      toast.error("يرجى إدخال اسم التذكرة بالعربية");
      return;
    }
    if (Number(formData.price_usd) < 0) {
      toast.error("لا يمكن أن يكون السعر أقل من الصفر");
      return;
    }
    if (Number(formData.persons_count) < 1) {
      toast.error("يجب أن يكون عدد الأفراد 1 على الأقل");
      return;
    }

    if (editingItem) {
      erpStore.updateParkTicketItem(editingItem.id, {
        name_ar: formData.name_ar.trim(),
        name_en: formData.name_en.trim(),
        type: formData.type,
        persons_count: Number(formData.persons_count),
        price_usd: Number(formData.price_usd),
        is_active: formData.is_active,
      });
      toast.success(`تم تحديث بيانات التذكرة "${formData.name_ar}" بنجاح!`);
    } else {
      erpStore.addParkTicketItem({
        name_ar: formData.name_ar.trim(),
        name_en: formData.name_en.trim(),
        type: formData.type,
        persons_count: Number(formData.persons_count),
        price_usd: Number(formData.price_usd),
        is_active: formData.is_active,
      });
      toast.success(`تمت إضافة التذكرة الجديدة "${formData.name_ar}" بنجاح!`);
    }

    setIsFormOpen(false);
    refreshItems();
  };

  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    erpStore.deleteParkTicketItem(deletingItem.id);
    toast.success(`تم حذف تذكرة "${deletingItem.name_ar}" نهائياً من النظام`);
    setDeletingItem(null);
    refreshItems();
  };

  const handlePriceChange = (id: string, newPrice: number) => {
    if (newPrice < 0) return;
    erpStore.updateParkTicketItem(id, { price_usd: newPrice });
    refreshItems();
    toast.success("تم تحديث السعر بنجاح!");
  };

  const handleToggleActive = (it: ParkTicketItem) => {
    const nextState = !it.is_active;
    erpStore.updateParkTicketItem(it.id, { is_active: nextState });
    refreshItems();
    toast.info(`تم ${nextState ? "تفعيل" : "تعطيل"} تذكرة "${it.name_ar}"`);
  };

  const filteredItems = items.filter((it) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      it.name_ar.toLowerCase().includes(q) || (it.name_en && it.name_en.toLowerCase().includes(q))
    );
  });

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "single_regular":
        return {
          label: "أيام عادية - فردي",
          color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200",
        };
      case "family_regular":
        return {
          label: "أيام عادية - عائلي",
          color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200",
        };
      case "single_holiday":
        return {
          label: "عطلات وأعياد - فردي",
          color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200",
        };
      case "family_holiday":
        return {
          label: "عطلات وأعياد - عائلي",
          color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200",
        };
      default:
        return {
          label: "مخصص / خدمات",
          color: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200",
        };
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[760px] rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <DialogTitle className="text-base font-black flex items-center gap-2 text-teal-600">
                  <Settings size={18} />
                  إدارة أسعار وتذاكر الدخول
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  إضافة، تعديل، وحذف أنواع وأسعار تذاكر الحديقة والمرافق وتحديثها فوراً بنقاط البيع.
                </DialogDescription>
              </div>

              <Button
                onClick={handleOpenAdd}
                className="bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl text-xs gap-1.5 cursor-pointer shadow-xs h-9 px-3.5 self-start sm:self-auto"
              >
                <Plus size={15} />
                إضافة نوع تذكرة جديد
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            {/* Search Filter Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث عن تذكرة بالاسم..."
                  className="pr-9 h-9 text-xs rounded-xl bg-card"
                />
              </div>
              <Badge variant="outline" className="h-9 px-3 font-bold text-xs rounded-xl">
                إجمالي التذاكر: {items.length}
              </Badge>
            </div>

            {/* Table of items */}
            <div className="overflow-x-auto border border-border rounded-2xl bg-card">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/60 border-b border-border font-black text-muted-foreground">
                    <th className="p-3">اسم التذكرة</th>
                    <th className="p-3 text-center">التصنيف</th>
                    <th className="p-3 text-center">الأفراد</th>
                    <th className="p-3 text-center">السعر الرسمي ($)</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        لا توجد تذاكر مطابقة لخيارات البحث
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((it) => {
                      const typeInfo = getTypeLabel(it.type);
                      return (
                        <tr key={it.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-foreground">{it.name_ar}</div>
                            {it.name_en && (
                              <div className="text-[10px] text-muted-foreground font-sans">
                                {it.name_en}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${typeInfo.color}`}
                            >
                              {typeInfo.label}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className="bg-muted px-2 py-1 rounded-lg">
                              {it.persons_count || 1} فرد
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-mono font-black text-teal-600 text-sm">$</span>
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={it.price_usd}
                                onChange={(e) => handlePriceChange(it.id, Number(e.target.value))}
                                className="h-8 w-20 text-center font-mono font-black text-xs rounded-xl"
                              />
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(it)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-black cursor-pointer transition border ${
                                it.is_active
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300"
                              }`}
                            >
                              {it.is_active ? "● مفعلة" : "○ معطلة"}
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEdit(it)}
                                className="h-8 px-2.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 dark:border-blue-900 rounded-xl cursor-pointer gap-1"
                                title="تعديل بيانات التذكرة"
                              >
                                <Edit2 size={12} />
                                تعديل
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeletingItem(it)}
                                className="h-8 px-2.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200 dark:border-rose-900 rounded-xl cursor-pointer gap-1"
                                title="حذف التذكرة"
                              >
                                <Trash2 size={12} />
                                حذف
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button
              onClick={onClose}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black px-6"
            >
              حفظ وإغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD / EDIT TICKET DIALOG */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl z-[60]">
          <form onSubmit={handleSaveForm}>
            <DialogHeader>
              <DialogTitle className="text-base font-black flex items-center gap-2 text-teal-600">
                {editingItem ? <Edit2 size={18} /> : <Plus size={18} />}
                {editingItem ? "تعديل بيانات التذكرة" : "إضافة نوع تذكرة جديد"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingItem
                  ? "قم بتعديل بيانات التذكرة والسعر والأفراد المشمولين ثم اضغط حفظ التعديلات."
                  : "أدخل تفاصيل التذكرة الجديدة والسعر بالدولار لإدراجها في شاشات المبيعات."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div className="space-y-1.5">
                <Label className="font-bold text-foreground">
                  اسم التذكرة (بالعربية) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  required
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  placeholder="مثال: تذكرة دخول فردية - أيام عادية"
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-bold text-foreground">
                  اسم التذكرة (بالإنجليزية - اختياري)
                </Label>
                <Input
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  placeholder="e.g. Single Entrance Ticket - Regular"
                  className="rounded-xl h-9 text-xs font-sans text-left"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-bold text-foreground">نوع / تصنيف التذكرة</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(val: any) => setFormData({ ...formData, type: val })}
                  >
                    <SelectTrigger className="h-9 rounded-xl text-xs">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      <SelectItem value="single_regular">أيام عادية - فردي</SelectItem>
                      <SelectItem value="family_regular">أيام عادية - عائلي</SelectItem>
                      <SelectItem value="single_holiday">عطلات وأعياد - فردي</SelectItem>
                      <SelectItem value="family_holiday">عطلات وأعياد - عائلي</SelectItem>
                      <SelectItem value="custom">مخصص / خدمات أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold text-foreground">عدد الأفراد المشمولين</Label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={formData.persons_count}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        persons_count: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="rounded-xl h-9 text-xs font-mono font-bold text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1.5">
                  <Label className="font-bold text-foreground">
                    السعر الرسمي بالدولار ($) <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute right-3 top-2.5 font-bold text-teal-600 font-mono">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      value={formData.price_usd}
                      onChange={(e) =>
                        setFormData({ ...formData, price_usd: Number(e.target.value) })
                      }
                      className="rounded-xl h-9 text-xs pr-7 font-mono font-black"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border border-border p-2.5 rounded-xl bg-muted/40 mt-4">
                  <div className="space-y-0.5">
                    <Label className="font-bold text-xs cursor-pointer">حالة التفعيل</Label>
                    <div className="text-[10px] text-muted-foreground">
                      {formData.is_active ? "متاحة للبيع" : "معطلة مؤقتاً"}
                    </div>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="rounded-xl font-bold text-xs h-9"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black text-xs h-9 px-5 gap-1.5 shadow-sm cursor-pointer"
              >
                <Check size={14} />
                {editingItem ? "تأكيد وحفظ التعديلات" : "تأكيد إضافة التذكرة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={Boolean(deletingItem)} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl z-[60]">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-600">
              <AlertCircle size={18} />
              تأكيد حذف التذكرة
            </DialogTitle>
            <DialogDescription className="text-xs pt-1 text-foreground leading-relaxed">
              هل أنت متأكد من رغبتك في حذف تذكرة{" "}
              <strong className="text-rose-600 font-black">"{deletingItem?.name_ar}"</strong> (سعر:
              ${deletingItem?.price_usd})؟
              <br />
              <span className="text-muted-foreground text-[11px] mt-1 block">
                ملاحظة: لن تظهر هذه التذكرة بعد الآن في شاشة نقاط البيع وإصدار التذاكر.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="border-t border-border pt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingItem(null)}
              className="rounded-xl font-bold text-xs h-9"
            >
              تراجع وإلغاء
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs h-9 px-5 gap-1.5 shadow-sm cursor-pointer"
            >
              <Trash2 size={14} />
              نعم، تأكيد الحذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

{
  /* SHIFT CLOSING MODAL */
}
export function ParkShiftClosingModal({
  isOpen,
  onClose,
  onShiftClosed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onShiftClosed: () => void;
}) {
  return (
    <ParkShiftClosingReportModal isOpen={isOpen} onClose={onClose} onShiftClosed={onShiftClosed} />
  );
}

{
  /* REFUND MODAL */
}
export function ParkRefundModal({
  isOpen,
  onClose,
  transaction,
}: {
  isOpen: boolean;
  onClose: () => void;
  transaction: ParkTicketTransaction | null;
}) {
  const [reason, setReason] = useState("");

  if (!transaction) return null;

  const handleProcessRefund = () => {
    if (!reason.trim()) {
      toast.error("يرجى إدخال سبب الإرجاع!");
      return;
    }

    try {
      erpStore.refundParkTicketTransaction(transaction.id, reason.trim());
      toast.success("تم إرجاع المعاملة وتوليد القيد المحاسبي العكسي بنجاح!");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء عملية الإرجاع");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-rose-600 flex items-center gap-2">
            <RotateCcw size={18} />
            إرجاع / استرداد تذكرة دخول
          </DialogTitle>
          <DialogDescription className="text-xs">
            سيتم عكس القيد المحاسبي بالكامل وتعديل رصيد الخزينة التشغيلية.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div className="p-3 rounded-2xl bg-muted/40 border border-border space-y-1">
            <p>
              رقم المعاملة (الفاتورة):{" "}
              <strong className="font-mono text-teal-600">{transaction.tx_number}</strong>
            </p>
            <p>
              المبلغ:{" "}
              <strong className="font-black">
                ${transaction.total_usd} ({transaction.total_paid_in_currency}{" "}
                {transaction.currency})
              </strong>
            </p>
            <p>
              تاريخ المعاملة:{" "}
              <strong>
                {transaction.transaction_date} {transaction.transaction_time}
              </strong>
            </p>
          </div>

          <div>
            <label className="font-bold block mb-1">سبب الإرجاع والاسترداد *</label>
            <Textarea
              placeholder="اكتب سبب استرداد التذكرة (مطلوب)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-xl text-xs font-medium min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
            إلغاء
          </Button>

          <Button
            onClick={handleProcessRefund}
            className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black gap-1"
          >
            <RotateCcw size={14} /> تأكيد الإرجاع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

{
  /* FULL TRANSACTION DETAILS PREVIEW MODAL WITH DUAL TIMESTAMPS & DATE/TIME EDITING (REQUIREMENT 7) */
}
export function ParkTransactionDetailsModal({
  isOpen,
  onClose,
  transaction,
}: {
  isOpen: boolean;
  onClose: () => void;
  transaction: ParkTicketTransaction | null;
}) {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  useEffect(() => {
    if (transaction) {
      setEditDate(transaction.transaction_date || "");
      setEditTime(transaction.transaction_time || "");
    }
  }, [transaction]);

  if (!transaction) return null;
  const state = erpStore.getState();
  const je = (state.journalEntries || []).find(
    (j) => j.reference === transaction.journal_entry_ref || j.id === transaction.journal_entry_ref,
  );

  const handleSaveDateEdit = () => {
    if (!editDate || !editTime) {
      toast.error("يرجى إدخال تاريخ ووقت صحيحين!");
      return;
    }

    try {
      erpStore.updateParkTicketTransactionDateTime(transaction.id, editDate, editTime);
      toast.success("تم تحديث تاريخ المعاملة بنجاح مع الحفاظ على رقم الفاتورة وتاريخ التسجيل!");
      setIsEditingDate(false);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء التحديث");
    }
  };

  const handlePrintReceipt = async () => {
    const settings = getReceiptDesignSettings();
    const receiptData = {
      storeName: settings.storeName,
      storeSubtitle: settings.storeSubtitle,
      taxNumber: settings.taxNumber,
      commercialRegister: settings.commercialRegister,
      logoUrl: settings.logoUrl,
      branchName: settings.branchName,
      orderNumber: transaction.tx_number,
      journalEntryRef: transaction.journal_entry_ref,
      orderType: "تذاكر دخول حديقة ومرافق المول",
      paymentMethod:
        transaction.payment_method === "cash"
          ? "نقدي"
          : transaction.payment_method === "visa"
            ? "فيزا / بطاقة"
            : transaction.payment_method === "bank_transfer"
              ? "تحويل بنكي"
              : "آجل على الحساب",
      referenceNumber: transaction.reference_number,
      customerName: transaction.customer_name,
      cashierName: transaction.created_by,
      date: transaction.transaction_date,
      time: transaction.transaction_time,
      systemTimestamp: transaction.system_timestamp,
      items: transaction.items.map((i) => ({
        name: i.name_ar,
        quantity: i.quantity,
        price: i.price_usd,
        note: i.note,
      })),
      subtotal: transaction.subtotal_usd,
      total: transaction.total_usd,
      totalPaidInCurrency: transaction.total_paid_in_currency,
      currency: transaction.currency,
      exchangeRate: transaction.exchange_rate,
      thankYouMessage: settings.thankYouMessage,
      footerNotes: settings.footerNotesText,
      wifiInfo: settings.wifiPasswordText,
    };

    if (printerService.isPrinterConnected()) {
      toast.success("تم إرسال إيصال التذكرة مباشرة إلى الطابعة الحرارية المتصلة 🖨️");
      printerService.printReceipt(receiptData);
    } else {
      toast.success("جاري إرسال أمر الطباعة 🖨️");
      printerService.printHtmlWindow(receiptData);
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[650px] rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-black flex items-center justify-between">
            <span>تفاصيل معاملة التذاكر والقيد المحاسبي</span>
            <Badge variant="outline" className="font-mono font-bold text-teal-600">
              {transaction.tx_number}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Status banner */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between font-bold ${
              transaction.status === "refunded"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-700"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700"
            }`}
          >
            <span>
              حالة المعاملة:{" "}
              {transaction.status === "refunded" ? "مسترجعة / ملغاة" : "مكتملة ومقبولة"}
            </span>
            {transaction.status === "refunded" && (
              <span className="text-[11px] font-normal">
                سبب الإرجاع: {transaction.refund_reason}
              </span>
            )}
          </div>

          {/* DUAL TIMESTAMPS & DETAILS SECTION (REQUIREMENT 7) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-muted-foreground text-[10px]">تاريخ ووقت المعاملة:</span>
                <button
                  type="button"
                  onClick={() => setIsEditingDate(!isEditingDate)}
                  className="text-[10px] text-teal-600 hover:underline font-bold flex items-center gap-0.5"
                >
                  <Edit2 size={11} /> تعديل
                </button>
              </div>
              <strong className="font-bold text-foreground block font-mono">
                {transaction.transaction_date} {transaction.transaction_time}
              </strong>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px]">
                تاريخ التسجيل بالنظام (نظامي):
              </span>
              <strong className="font-mono text-muted-foreground text-[11px] block">
                {transaction.system_timestamp
                  ? new Date(transaction.system_timestamp).toLocaleString("ar-EG")
                  : "-"}
              </strong>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px]">طريقة الدفع:</span>
              <strong className="font-bold">
                {transaction.payment_method === "cash"
                  ? "نقدي"
                  : transaction.payment_method === "visa"
                    ? "فيزا"
                    : transaction.payment_method === "bank_transfer"
                      ? "تحويل بنكي"
                      : "آجل"}
              </strong>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px]">العملة وسعر الصرف:</span>
              <strong className="font-bold">
                {transaction.currency} (سعر الصرف: {transaction.exchange_rate})
              </strong>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px]">العميل:</span>
              <strong className="font-bold">{transaction.customer_name || "عميل نقدي عام"}</strong>
            </div>

            <div>
              <span className="text-muted-foreground block text-[10px]">رقم القيد المحاسبي:</span>
              <strong className="font-mono text-primary font-bold">
                {transaction.journal_entry_ref}
              </strong>
            </div>
          </div>

          {/* EDIT DATE/TIME FORM IF ACTIVATED */}
          {isEditingDate && (
            <div className="p-3.5 rounded-2xl bg-teal-500/5 border border-teal-500/20 space-y-3">
              <h4 className="font-black text-xs text-teal-700 flex items-center gap-1.5">
                <Calendar size={14} /> تعديل تاريخ ووقت المعاملة (للمستخدم المصرّح له)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                تنبيه: يتغير تاريخ المعاملة فقط بينما يبقى رقم الفاتورة ({transaction.tx_number})
                وتاريخ التسجيل بالنظام ثابتاً غير قابل للتغيير للأغراض الترقيمية والتدقيقية.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold block mb-1">التاريخ الجديد:</label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="h-8 text-xs font-bold rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold block mb-1">الوقت الجديد:</label>
                  <Input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="h-8 text-xs font-bold rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingDate(false)}
                  className="rounded-xl h-7 text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveDateEdit}
                  className="bg-teal-600 text-white rounded-xl h-7 text-xs font-bold"
                >
                  حفظ التعديل
                </Button>
              </div>
            </div>
          )}

          {/* Line items */}
          <div className="space-y-1">
            <h4 className="font-black text-foreground">بنود التذاكر المباعة:</h4>
            <table className="w-full text-right border-collapse text-xs border border-border rounded-xl overflow-hidden">
              <thead>
                <tr className="bg-muted/50 border-b border-border font-bold">
                  <th className="p-2">التذكرة</th>
                  <th className="p-2 text-center">الكمية</th>
                  <th className="p-2">السعر ($)</th>
                  <th className="p-2 text-left">الإجمالي ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transaction.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2">
                      <span className="font-bold">{item.name_ar}</span>
                      {item.note && (
                        <div className="text-[10px] text-muted-foreground">ملاحظة: {item.note}</div>
                      )}
                    </td>
                    <td className="p-2 text-center font-bold">{item.quantity}</td>
                    <td className="p-2">${item.price_usd}</td>
                    <td className="p-2 text-left font-black">
                      ${(item.price_usd * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Related Journal Entry lines */}
          {je && (
            <div className="space-y-1 pt-2 border-t border-border">
              <h4 className="font-black text-foreground">
                أسطر القيد المحاسبي التلقائي ({je.reference || je.id}):
              </h4>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-right text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border font-bold">
                      <th className="p-2">رمز الحساب</th>
                      <th className="p-2">اسم الحساب / الوصف</th>
                      <th className="p-2 text-left">مدينة</th>
                      <th className="p-2 text-left">دائنة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {je.lines.map((l: any, i: number) => (
                      <tr key={i}>
                        <td className="p-2 font-mono font-bold">{l.account_code}</td>
                        <td className="p-2">{l.description}</td>
                        <td className="p-2 text-left font-bold text-emerald-600">
                          {l.debit > 0 ? l.debit : "-"}
                        </td>
                        <td className="p-2 text-left font-bold text-rose-600">
                          {l.credit > 0 ? l.credit : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
            إغلاق
          </Button>

          <Button
            size="sm"
            onClick={handlePrintReceipt}
            className="bg-teal-600 text-white hover:bg-teal-700 rounded-xl gap-1 font-bold"
          >
            <Printer size={15} /> طباعة إيصال التذكرة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
