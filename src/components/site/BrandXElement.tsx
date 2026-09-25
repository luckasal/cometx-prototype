import { cn } from "@/lib/utils";
import { brandAssets } from "@/lib/brand-assets";

export function BrandXElement({ className, half = false, variant }: { className?: string; half?: boolean; variant?: keyof typeof brandAssets.elements }) {
  return (
    <img
      src={brandAssets.elements[variant ?? (half ? "half" : "full")]}
      alt=""
      aria-hidden="true"
      className={cn("pointer-events-none select-none object-contain", className)}
    />
  );
}
