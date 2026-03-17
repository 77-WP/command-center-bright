import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";

export default function Placeholder() {
  const { pathname } = useLocation();
  const name = pathname.slice(1).charAt(0).toUpperCase() + pathname.slice(2);

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
      <Construction className="h-12 w-12 mb-4 opacity-30" />
      <h2 className="text-lg font-semibold text-foreground">{name}</h2>
      <p className="text-sm mt-1">This module is coming soon.</p>
    </div>
  );
}
