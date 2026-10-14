import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackToRestaurantButton() {
  return (
    <Link to="/admin/restaurant" className="inline-flex">
      <Button variant="outline" size="sm" className="gap-2 font-bold">
        <ArrowRight size={16} />
        العودة لإدارة المطعم
      </Button>
    </Link>
  );
}
