import { toast as sonnerToast } from "sonner";
import { isRestaurantScreenPath } from "@/components/navigation/navigationRegistry";

const RESTAURANT_NOTIFICATION_PATTERNS = [
  "استدعاء كابتن",
  "استدعاء الكابتن",
  "طلب ذاتي",
  "طلب عميل جديد",
  "طلب جديد على طاولة",
  "طلب فاتورة",
  "طلب الفاتورة",
  "الطلب جاهز",
  "مخزن الفرن والمطبخ",
  "طلبات عملاء QR",
];

function isCustomerMenuPage(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  const search = window.location.search;
  return path.startsWith("/menu") || search.includes("page=menu");
}

export function useToast() {
  const toast = ({
    title,
    description,
    variant,
    duration,
  }: {
    title?: string;
    description?: string;
    variant?: "default" | "destructive";
    duration?: number;
  }) => {
    const combinedText = `${title || ""} ${description || ""}`;
    const isRestaurantAlert = RESTAURANT_NOTIFICATION_PATTERNS.some((pattern) =>
      combinedText.includes(pattern),
    );

    if (isRestaurantAlert && !isRestaurantScreenPath() && !isCustomerMenuPage()) {
      return;
    }

    const effectiveDuration =
      typeof duration === "number" ? duration : isCustomerMenuPage() ? 1500 : 3500;

    sonnerToast(title || "", {
      description,
      duration: effectiveDuration,
      style: variant === "destructive" ? { background: "#ef4444", color: "#ffffff" } : undefined,
    });
  };

  return { toast };
}


