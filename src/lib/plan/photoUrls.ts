import data from "./photo-data.json";

const PHOTOS = data as Record<string, { url: string }>;

/** The bundled Wikipedia photo for a catalog place, if there is one. No network, no quota. */
export function catalogPhoto(attractionId: string | null | undefined): string | null {
  return (attractionId && PHOTOS[attractionId]?.url) || null;
}
