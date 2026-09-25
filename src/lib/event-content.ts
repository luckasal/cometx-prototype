/** Optional editorial sections live in the existing Supabase description field.
 * Plain descriptions remain an About section. Markdown ## headings split sections;
 * content is rendered as text, never as HTML. Unknown headings are preserved.
 */
export type EventContentSection = { title: string | null; body: string };
export function splitEventContent(description: string | null): EventContentSection[] {
  const sections: EventContentSection[] = [];
  let title: string | null = null;
  let lines: string[] = [];
  const flush = () => {
    const body = lines.join("\n").trim();
    if (body) sections.push({ title, body });
    lines = [];
  };
  for (const line of (description ?? "").split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      title = heading[1] ?? null;
    } else lines.push(line);
  }
  flush();
  return sections;
}
