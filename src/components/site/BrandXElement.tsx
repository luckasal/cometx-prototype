import { cn } from "@/lib/utils";

export function BrandXElement({ className, half = false }: { className?: string; half?: boolean }) {
  return (
    <img
      src={half ? "/brand/cometx/cometx-x-element-06.svg" : "/brand/cometx/cometx-x-element-04.svg"}
      alt=""
      aria-hidden="true"
      className={cn("pointer-events-none select-none", className)}
    />
  );
}
