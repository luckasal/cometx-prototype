import { supabase } from "@/integrations/supabase/client";
import { eventImageIssue, eventMediaExtensions } from "./event-media-rules";

export const eventMediaBucket = "cometx-event-media";

export type EventMediaScope = "event-heroes" | "event-gallery" | "speaker-photos";

export async function uploadPartnerLogo(file: File): Promise<string> {
  const issue = eventImageIssue(file);
  if (issue) throw new Error(issue);
  const path = `partner-logos/${crypto.randomUUID()}.${eventMediaExtensions[file.type]}`;
  const { data, error } = await supabase.storage.from(eventMediaBucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error)
    throw new Error("The logo could not be uploaded. Check your staff access and try again.");
  return supabase.storage.from(eventMediaBucket).getPublicUrl(data.path).data.publicUrl;
}

export async function uploadEventImage(file: File, scope: EventMediaScope): Promise<string> {
  const issue = eventImageIssue(file);
  if (issue) throw new Error(issue);
  const path = `${scope}/${crypto.randomUUID()}.${eventMediaExtensions[file.type]}`;
  const { data, error } = await supabase.storage.from(eventMediaBucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error)
    throw new Error("The image could not be uploaded. Check your staff access and try again.");
  return supabase.storage.from(eventMediaBucket).getPublicUrl(data.path).data.publicUrl;
}
