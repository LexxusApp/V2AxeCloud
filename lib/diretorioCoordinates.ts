export type DiretorioCoordinates = { lat: number; lng: number };

export function parseGoogleMapsCoordinates(link: string | null | undefined): DiretorioCoordinates | null {
  if (!link) return null;

  let decoded = link;
  try {
    decoded = decodeURIComponent(link);
  } catch {
    // Links importados podem conter '%' literal; o endereço original ainda pode ser válido.
  }

  const patterns = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}
