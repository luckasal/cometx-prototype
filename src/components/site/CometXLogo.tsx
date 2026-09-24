import { Link } from "@tanstack/react-router";

/** The wordmark used in cometx.ch's header, including its original Caviar Dreams font. */
export function CometXLogo({ footer = false }: { footer?: boolean }) {
  return (
    <Link to="/" aria-label="CometX - Come and Meet Expats" className="cometx-wordmark shrink-0 text-white">
      <span>CometX</span>
      <span className={footer ? "mt-1 block text-base" : "hidden min-[1100px]:inline"}>
        {footer ? "Come and Meet Expats" : " - Come and Meet Expats"}
      </span>
    </Link>
  );
}
