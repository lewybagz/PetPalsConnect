import { dark } from "./tokens";

/**
 * The map, in the dark palette.
 *
 * `MapScreen` switched `mapType` between `"standard"` and `"night"` for its
 * dark mode. `"night"` is not one of the values react-native-maps accepts
 * (standard, satellite, hybrid, terrain, mutedStandard), so on Android it fell
 * back to standard and on iOS it was ignored - a toggle that changed its own
 * icon and nothing else, which is the same failure the app's dark-mode switch
 * had. Google Maps styling is a JSON array on `customMapStyle`, and this is it.
 *
 * Built from the tokens rather than from a copied Snazzy Maps theme, so a
 * full-screen map is the same dark as the sheet that slides over it. Roads and
 * water lighten in steps from the background; labels use the same two ink
 * levels as the rest of the app.
 */
const paint = (featureType, elementType, color) => ({
  ...(featureType ? { featureType } : {}),
  ...(elementType ? { elementType } : {}),
  stylers: [{ color }],
});

export const darkMapStyle = [
  // The ground.
  { elementType: "geometry", stylers: [{ color: dark.bg }] },
  { elementType: "labels.text.stroke", stylers: [{ color: dark.bg }] },
  { elementType: "labels.text.fill", stylers: [{ color: dark.textMuted }] },

  // Points of interest stay quiet; the app's own pins are the subject.
  paint("poi", "labels.text.fill", dark.textFaint),
  paint("poi.park", "geometry", dark.surfaceAlt),
  paint("poi.park", "labels.text.fill", dark.textMuted),

  // Roads read as lines on the ground rather than as content.
  paint("road", "geometry", dark.surface),
  paint("road", "geometry.stroke", dark.border),
  paint("road", "labels.text.fill", dark.textFaint),
  paint("road.highway", "geometry", dark.surfaceAlt),
  paint("road.highway", "geometry.stroke", dark.border),

  paint("transit", "geometry", dark.surface),
  // `primarySoft` is a desaturated navy in the dark palette, which is what
  // water wants to be - and it keeps the map inside the token set.
  paint("water", "geometry", dark.primarySoft),
  paint("water", "labels.text.fill", dark.textFaint),

  // Administrative boundaries: present, not loud.
  paint("administrative", "geometry", dark.border),
  paint("administrative.land_parcel", "labels", dark.textFaint),
];

export default darkMapStyle;
