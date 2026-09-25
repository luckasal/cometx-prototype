# Default event detail template

`EventDetailTemplate` renders public events and authenticated admin previews from the existing Supabase event detail response. The custom 2026 symposium archive is unchanged.

## Staff editing

- Edit the event in `/admin/events`. Set its image, dates, venue, registration window, capacity, speakers, workshops and tickets using the existing editor.
- The long description accepts optional `##` headings, for example `## What to expect` or `## Pro koho je akce?`. These are headings, not prescribed event claims. Empty sections are omitted. Plain descriptions remain an About section; `- ` lines support lists. HTML is displayed as text.
- Use Preview. Save changes to refresh an open preview on the same origin; returning focus also refreshes it. Unsaved form values are not published or shown in preview.
- `?preview=1` does not grant access: the server still verifies admin permissions. Preview booking buttons are disabled.
- Prices, discounts and availability come from existing server calculations. Guest users sign in to see their eligible member pricing. Unknown capacity is not presented as unlimited.

No migrations or new event-specific content were added. Missing images, ticket types and speaker records must be supplied through the existing CMS; the template does not invent them.
