export type DiretorioCoordinates = { lat: number; lng: number };

/** Aceita só pontos plausíveis no Brasil (rejeita 0,0 e coordenadas genéricas/fora do país). */
export function isPlausibleDiretorioCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  // Null Island e ruídos próximos de (0,0)
  if (Math.abs(lat) < 0.2 && Math.abs(lng) < 0.2) return false;
  // Bounding box amplo do Brasil continental + faixa costeira
  if (lat < -34.5 || lat > 5.5) return false;
  if (lng < -74.5 || lng > -32.0) return false;
  return true;
}

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
    if (isPlausibleDiretorioCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }
  return null;
}
