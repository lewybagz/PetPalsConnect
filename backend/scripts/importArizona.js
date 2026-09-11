/**
 * Seeds the places directory for every Arizona city over 250,000.
 *
 * The app launches in Arizona, and a first user in Glendale should open the
 * care hub to vets, parks, patios and hotels rather than an import spinner.
 * Six centres, one radius each, every category in `placeCategories.IMPORTS`;
 * idempotent by `placeId`, so it can be re-run to backfill new categories.
 *
 * Population is Census Vintage 2025 (July 1 2025 estimates). Scottsdale is
 * 243,006 and just under; it sits inside Phoenix's radius regardless.
 *
 *   node scripts/importArizona.js            # needs MONGODB_URI + GOOGLE_MAPS_API_KEY
 *   node scripts/importArizona.js --dry-run  # lists the searches, calls nothing
 */
const path = require("node:path");

const CITIES = [
  { name: "Phoenix", population: 1665481, latitude: 33.4484, longitude: -112.074 },
  { name: "Tucson", population: 548371, latitude: 32.2226, longitude: -110.9747 },
  { name: "Mesa", population: 513656, latitude: 33.4152, longitude: -111.8315 },
  { name: "Gilbert", population: 287285, latitude: 33.3528, longitude: -111.789 },
  { name: "Chandler", population: 278748, latitude: 33.3062, longitude: -111.8413 },
  { name: "Glendale", population: 260572, latitude: 33.5387, longitude: -112.186 },
];

/** Miles. Phoenix is wide; the East Valley cities overlap, which the upsert absorbs. */
const RADIUS_MILES = 12;

const main = async () => {
  const dryRun = process.argv.includes("--dry-run");
  const { IMPORTS } = require(path.join(__dirname, "../services/placeCategories"));

  console.log(
    `${CITIES.length} cities × ${IMPORTS.length} searches, ${RADIUS_MILES} mi each` +
      (dryRun ? " (dry run)" : "")
  );
  for (const city of CITIES) {
    for (const entry of IMPORTS) {
      console.log(`  ${city.name}: ${entry.category} (${entry.type}${entry.keyword ? ` "${entry.keyword}"` : ""})`);
    }
  }
  if (dryRun) return;

  require(path.join(__dirname, "../config/env"));
  const db = require(path.join(__dirname, "../config/db"));
  const places = require(path.join(__dirname, "../services/places"));

  if (!places.isEnabled()) {
    console.error("GOOGLE_MAPS_API_KEY is not set; nothing to import from.");
    process.exit(1);
  }

  await db.connect();
  let total = 0;
  try {
    for (const city of CITIES) {
      const imported = await places.importNear({
        latitude: city.latitude,
        longitude: city.longitude,
        radiusMiles: RADIUS_MILES,
      });
      total += imported.length;
      console.log(`${city.name}: ${imported.length} places`);
    }
    console.log(`Done: ${total} places upserted.`);
  } finally {
    await require("mongoose").connection.close();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

module.exports = { CITIES, RADIUS_MILES };
