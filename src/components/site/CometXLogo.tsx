import { Link } from "@tanstack/react-router";

/** The wordmark used in cometx.ch's header, including its original Caviar Dreams font. */
export function CometXLogo({ footer = false }: { footer?: boolean }) {
  return (
    <Link to="/" aria-label="CometX - Come and Meet Expats" className="flex shrink-0 items-center gap-3 text-white">
      <span className={footer ? "block size-20 overflow-hidden" : "block size-11 overflow-hidden"}>
        <img
          src="/cometx-official-logo.png"
          alt=""
          className="h-auto w-full max-w-none"
        />
      </span>
      <span className="cometx-wordmark">
        <span className={footer ? "block text-2xl" : "block text-xl"}>CometX</span>
        <span className={footer ? "mt-1 block text-sm" : "hidden text-sm min-[1150px]:block"}>
          Come and Meet Expats
        </span>
      </span>
    </Link>
  );
}
