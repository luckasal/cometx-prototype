# CometX brand assets

Source: `Vizuální identita-20260924T135506Z-1-001.zip`, supplied locally in `Documents/workZurich`. The complete ZIP was inspected recursively: **96 entries**, including 14 macOS metadata files, 80 SVG/PNG exports, one 71-page brandbook and one Illustrator file. No nested ZIPs, standalone font files, photo folders, background textures or additional icon exports were present.

## Inventory and website mapping

| Assets found | Repository location | Website use |
| --- | --- | --- |
| 9 wordmark colors, SVG + PNG | `public/brand/cometx/logo/` | Lime wordmark in the header and admin sidebar, through `CometXLogo` |
| 9 wordmarks with claim, SVG + PNG | `public/brand/cometx/logo-claim/` | Cloud White footer logo with the official claim |
| 9 X symbols, SVG + PNG | `public/brand/cometx/symbol/` | Section headings, local browser favicon and Apple icon |
| 9 X-with-claim compositions, SVG + PNG | `public/brand/cometx/symbol-claim/` | Available for campaigns; deliberately not used as the main site logo |
| Full X and half X, lime + dark, SVG + PNG | `public/brand/cometx/elements/x-04` through `x-07` | Existing home/page hero decorations and replacement for the handmade brush divider; `BrandXElement` preserves proportions |
| Brandbook 1.0, Idiom studio, 2026 | `docs/brand/cometx-brandbook-1.0.pdf` | Source for logo spacing, type, colors, graphics and photography rules |
| Illustrator `tvar + aplikace.ai` | Retained in the original ZIP, outside the web bundle | All 7 artboards inspected: 3 layout examples (2 embedded photographs), then the 4 exported X shapes. Examples are not event records or ready-to-publish event promotions |
| Existing authentic event/community photos | `public/assets/cometx/`, `src/assets/hero-symposium.jpg` | Retained in existing event/article/hero placements; no invented photos or people |

All 9 export colors are available: Deep Space, Connection Lime, Night Gray, Cloud White, Network Violet, Impact Orange, Electric Cyan, black and white. Prefer SVG for the web. PNGs remain available for staff and integrations. The 60.7 MB Illustrator production source stays in the supplied archive rather than being served publicly or duplicated in Git.

## Reuse and rules

- `src/lib/brand-assets.ts` is the shared path catalog. `CometXLogo` identifies the site; `BrandXElement` is decorative only. Never rebuild the wordmark with text or rotate/stretch/recolor it.
- `src/styles.css` defines named palette tokens and maps them to existing UI roles. Primary colors are **#E1F03C** and **#212020**; secondary colors **#8B60E6**, **#FF5333**, **#54E8FA**; neutrals **#ECECEC**, **#515151**, **#FFFFFF** (brandbook pp. 45-49). Existing dark UI surfaces are retained. Use secondary colors sparingly, with readable contrast.
- Satoshi is the primary family; Inter is the permitted fallback (pp. 40-42). Existing Satoshi web loading remains; obsolete Quicksand loading is removed. Bold headings, regular body text. No font binaries are supplied in this ZIP.
- Logo clear space is 75% of the X height; standalone X clear space is 50%. Minimum artwork heights are 13px for the wordmark and 17px for the X (pp. 18-22, 33-38). Shared components combine original SVG margins with padding and supported sizes. Header switches to a compact menu before navigation collides with the logo.
- X shapes may be cropped/rotated, but not distorted (p. 53). The site crops original artwork in decoration containers; it does not create replacement paths. Photographs retain natural skin tones without a blanket saturation filter (pp. 59-63).

## Findings and limits

- The previous `cometx-logo-lime.svg` and `cometx-logo-cloud.svg` are actually **X-with-claim** artwork. Active site references now use the proper wordmark. Legacy URLs remain for compatibility; use the catalog for new work.
- Electric Cyan PNG `Logo.png` and `Symbol + claim.png` are swapped in the source package. Their destination filenames are corrected; original bytes and source names are preserved in the manifest.
- Lime X graphics contain **#DCF000**, while the brandbook and logos specify **#E1F03C**. Original artwork is kept unchanged; UI colors follow the brandbook. Request corrected exports from the designer before changing artwork fills.
- Five illustrative icon examples appear as vector artwork on brandbook p. 57, but have no separate exports. Existing functional UI icons remain; no replacements were invented or cropped from the reference page.
- Photos are embedded in the AI/brandbook examples, with no standalone editorial photo library or usage metadata. They were inspected, not reassigned to speakers or events. Existing sourced site photos remain in use.
- Existing Caviar Dreams font and old Wix logo files are legacy assets, not part of this identity package, and are not used by the shared logo component.

`docs/brand/asset-manifest.json` records **every** archive entry, source-to-destination mapping, size and SHA-256. Reimport with `./scripts/import-brand-assets.ps1 -ZipPath '<official ZIP path>'`. The importer rejects unclassified files rather than silently omitting new assets.
