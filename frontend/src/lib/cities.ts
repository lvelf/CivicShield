// City → [lng, lat] lookup for placing donor arcs at a real, self-declared origin. Donors pick a
// city from this curated list (or stay anonymous); the choice is stored on-chain via DonorRegistry.
// Coordinates are approximate city centers — enough to anchor an arc on a 360×180 world map.
export type LngLat = [number, number];

export const CITIES: { name: string; coord: LngLat }[] = [
  { name: "New York", coord: [-74.0, 40.7] },
  { name: "San Francisco", coord: [-122.4, 37.8] },
  { name: "London", coord: [-0.1, 51.5] },
  { name: "Berlin", coord: [13.4, 52.5] },
  { name: "Paris", coord: [2.35, 48.85] },
  { name: "Lisbon", coord: [-9.14, 38.72] },
  { name: "Lagos", coord: [3.38, 6.52] },
  { name: "Tokyo", coord: [139.7, 35.7] },
  { name: "Singapore", coord: [103.8, 1.35] },
  { name: "Bangalore", coord: [77.6, 12.97] },
  { name: "Mumbai", coord: [72.8, 19.0] },
  { name: "Dubai", coord: [55.27, 25.2] },
  { name: "São Paulo", coord: [-46.6, -23.5] },
  { name: "Mexico City", coord: [-99.13, 19.43] },
  { name: "Toronto", coord: [-79.38, 43.65] },
  { name: "Sydney", coord: [151.2, -33.9] },
  { name: "Seoul", coord: [126.98, 37.57] },
  { name: "Nairobi", coord: [36.82, -1.29] },
];

const BY_NAME = new Map(CITIES.map((c) => [c.name.toLowerCase(), c.coord]));

/** Resolve a self-declared region label to coordinates, or null if it isn't a known city. */
export function cityCoord(region: string | undefined): LngLat | null {
  if (!region) return null;
  return BY_NAME.get(region.trim().toLowerCase()) ?? null;
}
