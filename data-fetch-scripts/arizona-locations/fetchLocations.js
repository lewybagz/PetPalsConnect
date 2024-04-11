require("dotenv").config({ path: __dirname + "/.env" });
const axios = require("axios");
const fs = require("fs"); // Import the fs module

const GOOGLE_PLACES_API_URL =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function fetchAndStoreLocations() {
  console.log("Fetching locations from Google Places API...");
  // CHANGE
  const query = "pet-friendly+locations+in+California";
  const response = await axios.get(GOOGLE_PLACES_API_URL, {
    params: {
      query: query,
      key: GOOGLE_API_KEY,
    },
  });

  const locations = response.data.results;
  console.log(`Fetched ${locations.length} locations.`);

  const locationDocs = locations.map((place) => {
    let photoUrl = null;
    if (place.photos && place.photos.length > 0) {
      const photoReference = place.photos[0].photo_reference;
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
    }
    return {
      address: place.formatted_address,
      description: place.name,
      photo: photoUrl,
      geoLocation: {
        type: "Point",
        coordinates: [place.geometry.location.lng, place.geometry.location.lat],
      },
      placeId: place.place_id,
    };
  });

  // CHANGE
  const outputFile = "./californiaLocationDocs.json";

  const formattedDocuments = locationDocs.map((doc) => ({
    address: doc.address,
    description: doc.description,
    photo: doc.photo,
    geoLocation: {
      type: "Point",
      coordinates: [
        parseFloat(doc.geoLocation.coordinates[0]),
        parseFloat(doc.geoLocation.coordinates[1]),
      ],
    },
    placeId: doc.placeId,
  }));

  // Write the formatted documents to a new file
  fs.writeFileSync(
    outputFile,
    JSON.stringify(formattedDocuments, null, 2),
    "utf-8"
  );
  console.log(`Exported ${locations.length} locationDocs to ${outputFile}`);
}

// Execute the function to fetch and store locations
fetchAndStoreLocations().catch(console.error);
