# Official CometX assets

Verified 23 September 2026, requested by the CometX prototype owner.

- Graphic logo: https://www.cometx.ch/annual-symposium (image labelled "logo Cometx")
  https://static.wixstatic.com/media/41f758_855abc257bd443d2a13cdfafee8b6375~mv2.png
- Header wordmark font: see `fonts/SOURCE.md`.
- 15 team portraits: https://www.cometx.ch/about-us; exact named mapping and crop
  coordinates in `src/lib/team-photos.ts`.
- 22 speaker portraits: the Speakers 2026 directory on
  https://www.cometx.ch/annual-symposium.
- 35 partner logos: https://www.cometx.ch/partners, including its embedded directory.

The speaker/partner source manifest is `supabase/official-assets.json` and those
records are stored in the owner's Supabase project. Portraits and partner logos
currently load from the original Wix CDN; the logo and font are stored locally.
Names are matched from the official cards, not inferred from faces. Seed event
dates/prices remain demo values, not the live site's booking offer. The real 2026
speaker lineup is used as presentation content, not a new attendance commitment.
