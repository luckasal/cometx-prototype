import { Link } from "@tanstack/react-router";

export function CometXLogo({ footer = false }: { footer?: boolean }) {
  return (
    <Link to="/" aria-label="CometX - Come and Meet Expats" className="block shrink-0">
      <img
        src={footer ? "/brand/cometx/cometx-logo-cloud.svg" : "/brand/cometx/cometx-logo-lime.svg"}
        alt="CometX"
        className={footer ? "h-auto w-44" : "h-auto w-32 lg:w-36"}
      />
    </Link>
  );
}
