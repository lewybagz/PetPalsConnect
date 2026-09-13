import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import { fetchNearbyLocations, fetchLocation } from "../api/playdates";
import { importPlaces } from "../api/maps";
import { fetchUserPreferences } from "../../services/UserService";
import { requestLocationPermission } from "../services/location";

/**
 * Where two dogs can meet, for the screens that arrange it.
 *
 * One hook rather than a copy per screen, because scheduling a playdate and
 * changing one ask the identical question and the app previously answered it
 * two different ways: `SchedulePlaydateScreen` had a working picker, and
 * `PlaydateModificationScreen` navigated to a separate list screen that never
 * sent the choice back, so a playdate's venue could not be changed at all.
 * That list is deleted; this is what both use.
 *
 * **Parks and trails only.** The whole directory is in `Location` - vets,
 * pet shops, hotels, patios - and the picker sent no category filter, so it
 * offered a boarding kennel as a venue for two dogs to meet. `placeCategories`
 * has said "the playdate location pickers want park" since it was written;
 * this is the first thing that acts on it. Trails are in because a trailhead
 * is a place two owners genuinely meet to walk dogs together.
 */
export const PLAYDATE_CATEGORIES = ["park", "trail"];

const DEFAULT_RANGE_MILES = 10;

/**
 * How wide to import when the area is cold.
 *
 * Wider than the browse range on purpose: an import is billed Google traffic
 * and this only ever fires once, so covering a sensible radius beats doing it
 * again from the next screen.
 */
const IMPORT_RANGE_MILES = 12;

/**
 * @returns {{
 *   places: Array, loading: boolean, error: string|null, importing: boolean,
 *   selected: object|null, choose: (place: object|null) => void, reload: () => void,
 * }}
 */
export const usePlaydatePlaces = ({ profileId, presetLocationId = null } = {}) => {
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * An import is billed traffic, so it fires at most once per mount and never
   * again after a failure. Same rule the care hub and the map already follow -
   * a ref rather than state because changing it must not re-render, and
   * because the effect that reads it also sets it.
   */
  const importAttempted = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const preferences = await fetchUserPreferences(profileId);
        const range = preferences?.playdateRange ?? DEFAULT_RANGE_MILES;

        // Asked through the app's own disclosure sheet, never the OS prompt
        // directly. Without permission the list still loads, just not
        // nearest-first.
        const status = await requestLocationPermission();
        let coords = {};
        if (status === "granted") {
          const position = await Location.getCurrentPositionAsync({});
          coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }

        let nearby = await fetchNearbyLocations({
          ...coords,
          range,
          categories: PLAYDATE_CATEGORIES,
        });

        /**
         * Fill a cold area in rather than telling somebody to go elsewhere.
         *
         * This screen was the one place-consuming screen that could not heal
         * itself: the care hub and the map both import on an empty list, so a
         * user who happened to open one of those first got a working picker
         * and a user who came straight here got "No places found nearby yet"
         * and a dead end. Every condition is load-bearing - a known position,
         * a genuinely empty list, and not already tried this mount.
         */
        if (
          nearby.length === 0 &&
          coords.latitude != null &&
          !importAttempted.current
        ) {
          importAttempted.current = true;
          if (!cancelled) setImporting(true);

          const result = await importPlaces({
            ...coords,
            rangeMiles: IMPORT_RANGE_MILES,
          }).catch(() => ({ configured: false, imported: 0 }));

          if (!cancelled) setImporting(false);

          // Only worth re-reading if it actually found something; otherwise
          // the empty state below already says the right thing.
          if (result.imported > 0) {
            nearby = await fetchNearbyLocations({
              ...coords,
              range,
              categories: PLAYDATE_CATEGORIES,
            });
          }
        }

        if (cancelled) return;

        setLocations(nearby);
        if (nearby.length === 0) {
          setError(
            coords.latitude == null
              ? "Share your location to see places near you."
              : "No parks or trails found near you yet."
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[playdate] locations:", err.message);
          setError("Could not load places near you.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setImporting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, reloadToken]);

  /**
   * A place chosen before arriving is fetched by id rather than looked up in
   * the nearby list: a favourite, or the venue a playdate already has, can be
   * well outside the owner's range, and an empty "Where" section under a
   * button that said "Schedule a playdate here" would be a strange thing to
   * show.
   */
  useEffect(() => {
    if (!presetLocationId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const place = await fetchLocation(presetLocationId);
        if (!cancelled && place?._id) setSelected(place);
      } catch (err) {
        console.warn("[playdate] location:", err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [presetLocationId]);

  /**
   * The nearby list with the chosen place on the front of it.
   *
   * Merged on read rather than pushed into state: the two loads race, and
   * prepending to state meant whichever finished second won - usually the
   * nearby fetch, which replaces the array and dropped the chosen place.
   */
  const places =
    selected && !locations.some((item) => item._id === selected._id)
      ? [selected, ...locations]
      : locations;

  const reload = useCallback(() => {
    importAttempted.current = false;
    setReloadToken((token) => token + 1);
  }, []);

  return { places, loading, importing, error, selected, choose: setSelected, reload };
};
