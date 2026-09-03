/**
 * Compatibility reference data for matching.
 *
 * Split out from the scoring so the tables can be edited (or replaced with
 * something data-driven) without touching the algorithm.
 *
 * Two bugs lived here before: "Extravert" was spelled that way in these tables
 * while the app offers "Extrovert", so that temperament never matched anything;
 * and two structurally different maps (temperament -> activities and
 * temperament -> temperaments) were passed to the same parameter, so the
 * scorer looked activities up in a temperament table and threw.
 */

/** Temperaments the app offers. Anything else is treated as unknown. */
const TEMPERAMENTS = [
  "Calm",
  "Energetic",
  "Friendly",
  "Neuroticism",
  "Motive Driven",
  "Extrovert",
];

/** Which temperaments get along. Symmetric by construction (asserted in tests). */
const TEMPERAMENT_AFFINITY = {
  Calm: ["Friendly", "Neuroticism", "Motive Driven"],
  Energetic: ["Friendly", "Motive Driven", "Extrovert"],
  Friendly: ["Calm", "Energetic", "Motive Driven", "Extrovert", "Neuroticism"],
  Neuroticism: ["Calm", "Friendly"],
  "Motive Driven": ["Calm", "Energetic", "Friendly"],
  Extrovert: ["Energetic", "Friendly"],
};

/** Which temperaments enjoy each activity. Keys match the app's activity values. */
const ACTIVITY_TEMPERAMENTS = {
  walking: ["Calm", "Energetic", "Friendly"],
  fetch: ["Energetic", "Friendly", "Motive Driven"],
  swimming: ["Energetic", "Friendly"],
  hiking: ["Energetic", "Friendly", "Motive Driven"],
  tug_of_war: ["Energetic", "Friendly", "Motive Driven"],
  agility_training: ["Energetic", "Friendly", "Motive Driven"],
  hide_and_seek: ["Energetic", "Friendly", "Motive Driven"],
  bubbles: ["Calm", "Friendly"],
  frisbee: ["Energetic", "Friendly", "Motive Driven"],
  dog_park: ["Energetic", "Friendly", "Extrovert"],
  playdates: ["Energetic", "Friendly", "Extrovert"],
  sniffari: ["Calm", "Motive Driven"],
  digging: ["Energetic", "Motive Driven"],
  chew_toys: ["Calm", "Energetic", "Friendly"],
  puzzles: ["Calm", "Motive Driven"],
  obstacle_course: ["Energetic", "Friendly", "Motive Driven"],
};

/**
 * Breeds that tend to play well together.
 *
 * Only a hint - breed contributes a small part of the score, because
 * temperament and play style matter far more than pedigree for a playdate.
 * Unlisted breeds simply score zero here rather than throwing.
 */
const BREED_AFFINITY = {
  Labrador: ["Poodle", "Golden Retriever", "Boxer", "Bernese Mountain Dog", "Newfoundland", "Rottweiler", "Australian Shepherd", "Border Collie", "Vizsla"],
  Poodle: ["Labrador", "Golden Retriever", "Bichon Frise", "Cavalier King Charles Spaniel", "Maltese", "Havanese", "Soft Coated Wheaten Terrier"],
  Beagle: ["Bulldog", "Basset Hound", "Dachshund", "Cocker Spaniel", "Cavalier King Charles Spaniel"],
  Bulldog: ["Beagle", "Pug", "French Bulldog", "Boston Terrier", "Shih Tzu", "Cavalier King Charles Spaniel"],
  "Yorkshire Terrier": ["Maltese", "Shih Tzu", "Pomeranian", "Papillon", "Chihuahua"],
  Chihuahua: ["Yorkshire Terrier", "Maltese", "Shih Tzu", "Pomeranian", "Papillon", "Boston Terrier"],
  "German Shepherd": ["Labrador", "Golden Retriever", "Rottweiler", "Belgian Malinois", "Australian Shepherd", "Border Collie", "Doberman Pinscher"],
  "Golden Retriever": ["Labrador", "Poodle", "Bernese Mountain Dog", "Newfoundland", "Rottweiler", "Australian Shepherd", "Border Collie"],
  "French Bulldog": ["Bulldog", "Pug", "Boston Terrier", "Cavalier King Charles Spaniel"],
  "Shih Tzu": ["Bulldog", "Yorkshire Terrier", "Maltese", "Pomeranian", "Pug", "French Bulldog", "Cavalier King Charles Spaniel"],
  Boxer: ["Labrador", "Bulldog", "Doberman Pinscher", "Rottweiler", "German Shepherd"],
  Pug: ["Bulldog", "French Bulldog", "Boston Terrier", "Shih Tzu", "Cavalier King Charles Spaniel"],
  Dachshund: ["Beagle", "Basset Hound", "Cocker Spaniel", "Cavalier King Charles Spaniel"],
  "Great Dane": ["Rottweiler", "Doberman Pinscher", "Mastiff", "Newfoundland", "Saint Bernard"],
  "Siberian Husky": ["Alaskan Malamute", "German Shepherd", "Belgian Malinois", "Australian Shepherd", "Border Collie"],
  Maltese: ["Yorkshire Terrier", "Shih Tzu", "Pomeranian", "Papillon", "Chihuahua", "Havanese", "Bichon Frise"],
  "Cavalier King Charles Spaniel": ["Beagle", "Bulldog", "Pug", "French Bulldog", "Shih Tzu", "Cocker Spaniel", "Dachshund", "Bichon Frise"],
  "Pit Bull Terrier": ["Bulldog", "Boxer", "Staffordshire Bull Terrier", "American Bulldog"],
  Rottweiler: ["Labrador", "German Shepherd", "Doberman Pinscher", "Boxer", "Mastiff", "Great Dane"],
  "Australian Shepherd": ["Labrador", "Golden Retriever", "German Shepherd", "Border Collie", "Vizsla"],
  "Basset Hound": ["Beagle", "Dachshund", "Cocker Spaniel", "Cavalier King Charles Spaniel"],
  "Border Collie": ["Labrador", "Golden Retriever", "German Shepherd", "Australian Shepherd", "Shetland Sheepdog"],
  "Cocker Spaniel": ["Beagle", "Cavalier King Charles Spaniel", "Dachshund", "Basset Hound"],
  "Doberman Pinscher": ["Boxer", "Rottweiler", "German Shepherd", "Belgian Malinois", "Great Dane"],
  "Bernese Mountain Dog": ["Labrador", "Golden Retriever", "Newfoundland", "Saint Bernard", "Rottweiler"],
  Bloodhound: ["Basset Hound", "Beagle"],
  Bullmastiff: ["Mastiff", "Saint Bernard", "Rottweiler", "Doberman Pinscher"],
  Collie: ["Shetland Sheepdog", "Australian Shepherd", "Border Collie", "German Shepherd"],
  Dalmatian: ["Boxer", "Pointer", "Weimaraner", "Doberman Pinscher"],
  "English Setter": ["Irish Setter", "Pointer"],
  Greyhound: ["Whippet"],
  Havanese: ["Maltese", "Shih Tzu", "Poodle", "Bichon Frise", "Cavalier King Charles Spaniel"],
  "Irish Setter": ["English Setter", "Pointer"],
  "Jack Russell Terrier": ["Yorkshire Terrier", "Cairn Terrier", "Wire Fox Terrier"],
  "Lhasa Apso": ["Shih Tzu", "Maltese", "Pomeranian", "Havanese"],
  Mastiff: ["Rottweiler", "Great Dane", "Saint Bernard", "Bullmastiff", "Cane Corso"],
  Newfoundland: ["Labrador", "Golden Retriever", "Bernese Mountain Dog", "Saint Bernard"],
  "Old English Sheepdog": ["Collie", "Bearded Collie"],
  Papillon: ["Yorkshire Terrier", "Maltese", "Chihuahua", "Pomeranian", "Cavalier King Charles Spaniel"],
  Pointer: ["Weimaraner", "Vizsla", "English Setter", "Irish Setter"],
  "Rhodesian Ridgeback": ["Boxer", "Doberman Pinscher", "Rottweiler", "German Shepherd"],
  Samoyed: ["Siberian Husky", "Alaskan Malamute", "American Eskimo Dog"],
  "Scottish Terrier": ["Cairn Terrier", "West Highland White Terrier"],
  Weimaraner: ["Pointer", "Vizsla", "Doberman Pinscher", "Rhodesian Ridgeback"],
  Whippet: ["Greyhound"],
  Akita: ["Siberian Husky", "Alaskan Malamute", "Shiba Inu", "Chow Chow"],
  "Alaskan Malamute": ["Siberian Husky", "Akita", "Samoyed"],
  "Bichon Frise": ["Maltese", "Havanese", "Poodle", "Shih Tzu", "Cavalier King Charles Spaniel"],
  "Boston Terrier": ["French Bulldog", "Pug", "Bulldog", "Chihuahua", "Shih Tzu"],
  "Brussels Griffon": ["Pug", "French Bulldog", "Boston Terrier"],
  "Cairn Terrier": ["Scottish Terrier", "West Highland White Terrier", "Jack Russell Terrier"],
  "Chinese Shar-Pei": ["Chow Chow", "Akita", "Bullmastiff"],
  "Cane Corso": ["Mastiff", "Bullmastiff", "Rottweiler", "Doberman Pinscher"],
  "Shiba Inu": ["Akita", "Chow Chow"],
  "American Bulldog": ["Pit Bull Terrier", "Staffordshire Bull Terrier", "Bulldog", "Boxer"],
  "English Springer Spaniel": ["Cocker Spaniel", "Cavalier King Charles Spaniel"],
  "Staffordshire Bull Terrier": ["Pit Bull Terrier", "American Bulldog", "Bulldog", "Boxer"],
  "Miniature Schnauzer": ["Scottish Terrier", "Wire Fox Terrier"],
  "Shetland Sheepdog": ["Collie", "Border Collie", "Australian Shepherd"],
  Vizsla: ["Weimaraner", "Pointer", "Golden Retriever", "Labrador"],
  "Chow Chow": ["Akita", "Shiba Inu", "Chinese Shar-Pei"],
  "Belgian Malinois": ["German Shepherd", "Doberman Pinscher", "Rottweiler"],
  Pomeranian: ["Maltese", "Yorkshire Terrier", "Chihuahua", "Papillon", "Shih Tzu"],
  "Cardigan Welsh Corgi": ["Shetland Sheepdog", "Dachshund", "Basset Hound"],
  "Australian Cattle Dog": ["Australian Shepherd", "Border Collie", "Collie"],
  "American Eskimo Dog": ["Samoyed", "Pomeranian", "Maltese"],
  "Wire Fox Terrier": ["Jack Russell Terrier", "Cairn Terrier", "Scottish Terrier"],
  "Portuguese Water Dog": ["Poodle", "Golden Retriever"],
  "West Highland White Terrier": ["Scottish Terrier", "Cairn Terrier", "Jack Russell Terrier"],
  "Saint Bernard": ["Bernese Mountain Dog", "Newfoundland", "Mastiff"],
  "Soft Coated Wheaten Terrier": ["Poodle", "Bichon Frise", "Havanese"],
};

module.exports = {
  TEMPERAMENTS,
  TEMPERAMENT_AFFINITY,
  ACTIVITY_TEMPERAMENTS,
  BREED_AFFINITY,
};
