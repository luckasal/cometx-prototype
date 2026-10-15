export const eventMediaMaxBytes = 5 * 1024 * 1024;
export const managedEventMediaPath = /^(?:event-heroes|event-gallery|speaker-photos)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i;

export const eventMediaExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function eventImageIssue(file: { size: number; type: string }): string | null {
  if (!Object.prototype.hasOwnProperty.call(eventMediaExtensions, file.type)) {
    return "Choose a JPEG, PNG or WebP image.";
  }
  if (file.size < 1 || file.size > eventMediaMaxBytes) {
    return "Images must be between 1 byte and 5 MB.";
  }
  return null;
}
