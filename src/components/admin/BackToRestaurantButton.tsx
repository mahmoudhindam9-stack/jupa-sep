import { Link } from "@tanstack/react-router";
import { ArrowRight, Grid3X3, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackToRestaurantButton() {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Link to="/admin" search={{ tab: "grid" }}>
        <Button
          variant="default"
          size="sm"
          className="gap-2 font-bold rounded-xl shadow-xs text-xs"
        >
          <Grid3X3 size={15} />
          لوحة الأقسام الرئيسية
        </Button>
      </Link>
      <Link to="/admin/restaurant">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 font-bold rounded-xl border-primary/30 text-primary hover:bg-primary/10 text-xs"
        >
          <Store size={15} />
          إدارة المطعم
        </Button>
      </Link>
    </div>
  );
}
