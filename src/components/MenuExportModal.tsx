import React, { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Printer,
  Sparkles,
  Search,
  Check,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Download,
  UtensilsCrossed,
  Layers,
  ChefHat,
} from "lucide-react";
import { menuService } from "@/features/menu/services/menuService";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { Category, MenuItem } from "@/shared/types";
import { Button } from "@/components/ui/button";

interface MenuExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MenuTheme = "gold" | "light" | "bistro";
type MenuLayout = "grid" | "list";

export function MenuExportModal({ isOpen, onClose }: MenuExportModalProps) {
  const { lang, currency, formatPrice } = useSettings();
  const [theme, setTheme] = useState<MenuTheme>("gold");
  const [layout, setLayout] = useState<MenuLayout>("grid");
  const [showImages, setShowImages] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [restaurantName, setRestaurantName] = useState(
    lang === "ar" ? "مطعم وجبة - Restocash Restaurant" : "Restocash Restaurant",
  );
  const [restaurantSubtitle, setRestaurantSubtitle] = useState(
    lang === "ar"
      ? "أشهى المأكولات الشرقية والغربية بكل جودة وإتقان"
      : "Delicious Gourmet Cuisine & Fine Dining",
  );

  const printRef = useRef<HTMLDivElement>(null);

  const categoriesQuery = useQuery({
    queryKey: ["menu_categories"],
    queryFn: () => menuService.getCategories(),
    enabled: isOpen,
  });

  const itemsQuery = useQuery({
    queryKey: ["menu_items"],
    queryFn: () => menuService.getMenuItems(),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];

  // Filter items based on search and category
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name_ar.toLowerCase().includes(search.toLowerCase().trim());
    const matchesCategory = selectedCategory === "all" || item.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group items by category for menu layout
  const categoryMap = new Map<string, MenuItem[]>();
  filteredItems.forEach((item) => {
    const catId = item.category_id || "uncategorized";
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, []);
    }
    categoryMap.get(catId)!.push(item);
  });

  const handlePrint = () => {
    window.print();
  };

  // Theme style mappings
  const themeStyles = {
    gold: {
      modalBg: "bg-stone-950 text-amber-50 border-amber-900/50",
      headerBg: "bg-gradient-to-r from-stone-900 via-stone-950 to-stone-900 border-amber-500/20",
      cardBg: "bg-stone-900/80 border-amber-500/20 hover:border-amber-500/40",
      categoryHeader: "text-amber-300 border-amber-500/30 bg-amber-500/10",
      priceText: "text-amber-400 font-black",
      badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
      titleText: "text-amber-200",
      subText: "text-stone-400",
      dots: "border-amber-500/20",
    },
    light: {
      modalBg: "bg-slate-50 text-slate-900 border-slate-200",
      headerBg: "bg-white border-slate-200",
      cardBg: "bg-white border-slate-200 shadow-sm hover:border-indigo-300",
      categoryHeader: "text-indigo-900 border-indigo-200 bg-indigo-50/80",
      priceText: "text-indigo-600 font-black",
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
      titleText: "text-slate-900",
      subText: "text-slate-500",
      dots: "border-slate-300",
    },
    bistro: {
      modalBg: "bg-[#FDFBF7] text-amber-950 border-amber-900/20",
      headerBg: "bg-[#F7F2E8] border-amber-900/20",
      cardBg: "bg-white border-amber-900/15 shadow-xs hover:border-amber-900/30",
      categoryHeader: "text-amber-900 border-amber-900/20 bg-amber-900/5",
      priceText: "text-rose-900 font-black",
      badge: "bg-amber-900/10 text-amber-900 border-amber-900/20",
      titleText: "text-amber-950",
      subText: "text-amber-800/70",
      dots: "border-amber-900/30",
    },
  }[theme];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      {/* Hide controls on print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-menu-area, #printable-menu-area * {
            visibility: visible;
          }
          #printable-menu-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: ${theme === "gold" ? "#121212" : theme === "bistro" ? "#FDFBF7" : "#FFFFFF"} !important;
            color: ${theme === "gold" ? "#FFF" : "#000"} !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className={`w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border ${themeStyles.modalBg} shadow-2xl overflow-hidden transition-all duration-300`}
      >
        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print p-4 bg-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base text-white">
                {lang === "ar" ? "تصدير وطباعة قائمة الطعام (المنيو)" : "Export & Print Menu"}
              </h2>
              <p className="text-[11px] text-slate-400">
                {lang === "ar"
                  ? "تصميم استعراضي احترافي يعكس تعديلات المنيو والأسعار الحالية"
                  : "Professional printable layout synced with live items & prices"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handlePrint}
              className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-black text-xs h-9 rounded-xl shadow-md flex items-center gap-2 active:scale-95 transition"
            >
              <Printer size={15} />
              <span>{lang === "ar" ? "طباعة / حفظ كـ PDF" : "Print / Save PDF"}</span>
            </Button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Customizer Toolbar (Hidden on Print) */}
        <div className="no-print p-3 sm:p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Theme Selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-bold text-[11px]">
              {lang === "ar" ? "الستايل:" : "Theme:"}
            </span>
            <button
              onClick={() => setTheme("gold")}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                theme === "gold"
                  ? "bg-amber-500 text-stone-950 shadow-xs"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span>✨</span>
              <span>{lang === "ar" ? "فخامة ذهبية" : "Luxury Gold"}</span>
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                theme === "light"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span>☀️</span>
              <span>{lang === "ar" ? "ناصع عصري" : "Modern Light"}</span>
            </button>
            <button
              onClick={() => setTheme("bistro")}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                theme === "bistro"
                  ? "bg-amber-900 text-amber-100 shadow-xs"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <span>☕</span>
              <span>{lang === "ar" ? "مقهى كلاسيكي" : "Classic Bistro"}</span>
            </button>
          </div>

          {/* Layout & Options */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Grid vs List */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setLayout("grid")}
                className={`p-1.5 rounded-lg transition ${
                  layout === "grid"
                    ? "bg-amber-500 text-stone-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
                title={lang === "ar" ? "عرض بطاقات مصورة" : "Grid Cards"}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setLayout("list")}
                className={`p-1.5 rounded-lg transition ${
                  layout === "list"
                    ? "bg-amber-500 text-stone-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
                title={lang === "ar" ? "عرض قائمة مطعم كلاسيكية" : "Classic List"}
              >
                <List size={15} />
              </button>
            </div>

            {/* Toggle Images */}
            <button
              onClick={() => setShowImages(!showImages)}
              className={`px-3 py-1.5 rounded-xl font-bold border transition flex items-center gap-1.5 ${
                showImages
                  ? "bg-slate-800 text-amber-400 border-amber-500/30"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <ImageIcon size={14} />
              <span>
                {lang === "ar"
                  ? showImages
                    ? "إخفاء الصور"
                    : "إظهار الصور"
                  : showImages
                    ? "Hide Images"
                    : "Show Images"}
              </span>
            </button>
          </div>

          {/* Search & Category filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search
                size={14}
                className={`absolute ${lang === "ar" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-slate-400`}
              />
              <input
                type="text"
                placeholder={lang === "ar" ? "بحث بالمنيو..." : "Search menu..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full bg-slate-900 border border-slate-800 rounded-xl py-1.5 ${
                  lang === "ar" ? "pr-8 pl-3" : "pl-8 pr-3"
                } text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-500 transition`}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl py-1.5 px-3 text-xs text-white outline-none focus:border-amber-500 transition cursor-pointer"
            >
              <option value="all">{lang === "ar" ? "جميع الأقسام" : "All Categories"}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ar}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Printable Menu Canvas Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8" id="printable-menu-area" ref={printRef}>
          {/* Header Branding */}
          <div className="text-center space-y-3 pb-8 mb-8 border-b border-current/15 relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 mb-1 shadow-inner">
              <ChefHat size={32} />
            </div>

            <div className="space-y-1">
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="no-print font-black text-2xl sm:text-3xl text-center bg-transparent border-b border-transparent hover:border-current/30 focus:border-amber-500 outline-none w-full max-w-lg transition"
              />
              <h1 className="print:block hidden font-black text-3xl sm:text-4xl tracking-tight">
                {restaurantName}
              </h1>

              <input
                type="text"
                value={restaurantSubtitle}
                onChange={(e) => setRestaurantSubtitle(e.target.value)}
                className="no-print text-xs sm:text-sm text-center bg-transparent border-b border-transparent hover:border-current/30 focus:border-amber-500 outline-none w-full max-w-md opacity-80 transition"
              />
              <p className="print:block hidden text-xs sm:text-sm opacity-80">
                {restaurantSubtitle}
              </p>
            </div>

            {/* Language & Currency Indicator Badge */}
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full text-[11px] font-bold border border-current/20 bg-current/5 mt-2">
              <span>
                {lang === "ar" ? "العملة المعتمدة:" : "Currency:"}{" "}
                <strong className="font-black">{currency}</strong>
              </span>
              <span>•</span>
              <span>
                {lang === "ar" ? "إجمالي الأصناف المتاحة:" : "Total Items:"}{" "}
                <strong className="font-black">{filteredItems.length}</strong>
              </span>
            </div>
          </div>

          {/* Menu Sections & Categories */}
          {itemsQuery.isLoading || categoriesQuery.isLoading ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold opacity-70">
                {lang === "ar" ? "جاري تجهيز وتنسيق أصناف المنيو..." : "Preparing menu layout..."}
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center space-y-2 opacity-60">
              <UtensilsCrossed size={40} className="mx-auto text-amber-500" />
              <p className="font-bold text-sm">
                {lang === "ar"
                  ? "لا توجد أصناف تطابق فلتر البحث الحالية"
                  : "No items match your query"}
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {categories.map((cat) => {
                const categoryItems = categoryMap.get(cat.id);
                if (!categoryItems || categoryItems.length === 0) return null;

                return (
                  <div key={cat.id} className="space-y-4">
                    {/* Category Title Header */}
                    <div
                      className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl border font-black text-sm sm:text-base ${themeStyles.categoryHeader}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500">❖</span>
                        <h3>{cat.name_ar}</h3>
                      </div>
                      <span className="text-xs font-semibold opacity-75">
                        ({categoryItems.length} {lang === "ar" ? "صنف" : "items"})
                      </span>
                    </div>

                    {/* Layout Mode 1: Grid Cards */}
                    {layout === "grid" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {categoryItems.map((item) => (
                          <div
                            key={item.id}
                            className={`p-3 sm:p-4 rounded-2xl border flex flex-col justify-between transition group ${themeStyles.cardBg}`}
                          >
                            <div className="space-y-2.5">
                              {showImages && item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name_ar}
                                  className="w-full h-32 sm:h-36 object-cover rounded-xl border border-current/10 shadow-xs"
                                />
                              )}

                              <div>
                                <h4 className="font-bold text-sm sm:text-base leading-snug">
                                  {item.name_ar}
                                </h4>
                                {item.ingredients &&
                                  Array.isArray(item.ingredients) &&
                                  item.ingredients.length > 0 && (
                                    <p className="text-[11px] opacity-70 mt-1 line-clamp-2">
                                      {item.ingredients
                                        .map((ing: any) => ing.notes || ing.inventory_id)
                                        .join("، ")}
                                    </p>
                                  )}
                              </div>
                            </div>

                            <div className="mt-4 pt-2.5 border-t border-current/10 flex items-center justify-between">
                              <span className={`text-sm sm:text-base ${themeStyles.priceText}`}>
                                {formatPrice(item.price)}
                              </span>
                              {item.is_available === false && (
                                <span className="text-[10px] bg-rose-500/20 text-rose-500 px-2 py-0.5 rounded-md font-bold">
                                  {lang === "ar" ? "غير متوفر حالياً" : "Out of Stock"}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Layout Mode 2: Classic Restaurant List with Leader Dots */}
                    {layout === "list" && (
                      <div className="space-y-3 px-1">
                        {categoryItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-baseline justify-between gap-3 text-xs sm:text-sm group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {showImages && item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name_ar}
                                  className="w-10 h-10 object-cover rounded-lg border border-current/10 shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <span className="font-bold text-sm">{item.name_ar}</span>
                              </div>
                            </div>

                            {/* Dotted Leader Line */}
                            <div
                              className={`flex-1 border-b-2 border-dotted mx-2 ${themeStyles.dots}`}
                            />

                            {/* Price */}
                            <div className="shrink-0 text-right">
                              <span className={`text-sm sm:text-base ${themeStyles.priceText}`}>
                                {formatPrice(item.price)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Notes for Print */}
          <div className="mt-12 pt-6 border-t border-current/15 text-center text-[11px] opacity-70 space-y-1">
            <p className="font-bold">
              {lang === "ar"
                ? "جميع الأسعار تشمل ضريبة القيمة المضافة ومحدثة لحظياً"
                : "All prices are subject to local tax & updated in real-time."}
            </p>
            <p>© {new Date().getFullYear()} Restocash POS • Powered by Restocash ERP</p>
          </div>
        </div>
      </div>
    </div>
  );
}
