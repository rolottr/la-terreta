// Coordinates are independent of language and saved memory IDs.
export const cafeSite = { x: 6.4, z: 11.5, yaw: -Math.PI / 2 };
export const waterSeat = { x: -103, z: -23, yaw: Math.PI };
export const photoInteractionRange = 3.5;
export const photoSite = { x: 3.6, z: 15.5, yaw: Math.PI };
export const hiddenPlaces = [
  { id: "courtyard", x: -23, z: 38, radius: 3.2, entrance: { x: -23, z: 29 } },
  {
    id: "orange-clearing",
    x: -48,
    z: 62,
    radius: 3.2,
    entrance: { x: -48, z: 47 },
  },
  { id: "roof-terrace", x: 21, z: 81, radius: 2.5, entrance: { x: 21, z: 64 } },
] as const;
export const terraceSite = hiddenPlaces[2];
