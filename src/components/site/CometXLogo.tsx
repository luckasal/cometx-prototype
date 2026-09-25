import { Link } from "@tanstack/react-router";
import { brandAssets } from "@/lib/brand-assets";

export function CometXLogo({ footer = false }: { footer?: boolean }) {
  return (
    <Link to="/" aria-label="CometX - Come and Meet Expats" className={footer ? "brand-logo brand-logo-footer" : "brand-logo"}>
      <img
        src={footer ? brandAssets.footerLogo : brandAssets.logo}
        alt="CometX"
        width={382.7}
        height={footer ? 184.3 : 127.6}
        className="block h-auto w-full"
      />
    </Link>
  );
}
