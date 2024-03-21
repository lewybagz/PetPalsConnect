const PetMatch = require("../models/PetMatch");

function calculateBreedCompatibility(
  currentPetBreed,
  potentialMatchBreed,
  breedCompatibilityMap
) {
  if (currentPetBreed === potentialMatchBreed) return 20;
  if (breedCompatibilityMap[currentPetBreed].includes(potentialMatchBreed))
    return 10;
  return 0;
}

function calculateTemperamentCompatibility(
  currentPetTemperament,
  potentialMatchTemperament,
  temperamentCompatibilityMap,
  activityCompatibilityMap
) {
  let score = 0;
  if (currentPetTemperament === potentialMatchTemperament) {
    score += 20;
  } else if (
    temperamentCompatibilityMap[currentPetTemperament].includes(
      potentialMatchTemperament
    )
  ) {
    score += 10;
  }

  // Calculate additional score based on activity-temperament compatibility
  temperamentCompatibilityMap[currentPetTemperament].forEach((activity) => {
    if (
      activityCompatibilityMap[activity].includes(potentialMatchTemperament)
    ) {
      score += 5; // Increment score for each activity that is also compatible with the potential match's temperament
    }
  });

  return score;
}

function calculateActivityCompatibility(
  currentPetActivities,
  potentialMatchActivities,
  activityCompatibilityMap
) {
  const currentPetActivityValues = currentPetActivities.map(
    (activity) => activity.value
  );
  const potentialMatchActivityValues = potentialMatchActivities.map(
    (activity) => activity.value
  );

  const sharedActivities = currentPetActivityValues.filter((activityValue) =>
    potentialMatchActivityValues.includes(activityValue)
  );

  let activityScore = 0;
  sharedActivities.forEach((activityValue) => {
    if (activityCompatibilityMap[activityValue]) {
      activityScore += activityCompatibilityMap[activityValue].length * 5; // Weight by the number of compatible temperaments for the activity
    }
  });

  return activityScore;
}

const breedCompatibility = {
  Labrador: [
    "Poodle",
    "Golden Retriever",
    "Boxer",
    "Bernese Mountain Dog",
    "Newfoundland",
    "Rottweiler",
    "Australian Shepherd",
    "Border Collie",
    "Vizsla",
  ],
  Poodle: [
    "Labrador",
    "Golden Retriever",
    "Bichon Frise",
    "Cavalier King Charles Spaniel",
    "Maltese",
    "Havanese",
    "Soft Coated Wheaten Terrier",
  ],
  Beagle: [
    "Bulldog",
    "Basset Hound",
    "Dachshund",
    "Cocker Spaniel",
    "Cavalier King Charles Spaniel",
    "Brittany Spaniel",
    "Springer Spaniel",
  ],
  Bulldog: [
    "Beagle",
    "Pug",
    "French Bulldog",
    "Boston Terrier",
    "Shih Tzu",
    "Cavalier King Charles Spaniel",
  ],
  "Yorkshire Terrier": [
    "Maltese",
    "Shih Tzu",
    "Pomeranian",
    "Papillon",
    "Chihuahua",
  ],
  Chihuahua: [
    "Yorkshire Terrier",
    "Maltese",
    "Shih Tzu",
    "Pomeranian",
    "Papillon",
    "Toy Poodle",
    "Boston Terrier",
  ],
  "German Shepherd": [
    "Labrador",
    "Golden Retriever",
    "Rottweiler",
    "Belgian Malinois",
    "Australian Shepherd",
    "Border Collie",
    "Doberman Pinscher",
  ],
  "Golden Retriever": [
    "Labrador",
    "Poodle",
    "Bernese Mountain Dog",
    "Newfoundland",
    "Rottweiler",
    "Australian Shepherd",
    "Border Collie",
  ],
  "French Bulldog": [
    "Bulldog",
    "Pug",
    "Boston Terrier",
    "Cavalier King Charles Spaniel",
  ],
  "Shih Tzu": [
    "Bulldog",
    "Yorkshire Terrier",
    "Maltese",
    "Pomeranian",
    "Pug",
    "French Bulldog",
    "Cavalier King Charles Spaniel",
  ],
  Boxer: [
    "Labrador",
    "Bulldog",
    "Doberman Pinscher",
    "Rottweiler",
    "German Shepherd",
  ],
  Pug: [
    "Bulldog",
    "French Bulldog",
    "Boston Terrier",
    "Shih Tzu",
    "Cavalier King Charles Spaniel",
  ],
  Dachshund: [
    "Beagle",
    "Basset Hound",
    "Cocker Spaniel",
    "Cavalier King Charles Spaniel",
  ],
  "Great Dane": [
    "Rottweiler",
    "Doberman Pinscher",
    "Mastiff",
    "Newfoundland",
    "Saint Bernard",
  ],
  "Siberian Husky": [
    "Alaskan Malamute",
    "German Shepherd",
    "Belgian Malinois",
    "Australian Shepherd",
    "Border Collie",
  ],
  Maltese: [
    "Yorkshire Terrier",
    "Shih Tzu",
    "Pomeranian",
    "Papillon",
    "Chihuahua",
    "Havanese",
    "Bichon Frise",
  ],
  "Cavalier King Charles Spaniel": [
    "Beagle",
    "Bulldog",
    "Pug",
    "French Bulldog",
    "Shih Tzu",
    "Cocker Spaniel",
    "Dachshund",
    "Bichon Frise",
  ],
  "Pit Bull Terrier": [
    "Bulldog",
    "Boxer",
    "Staffordshire Bull Terrier",
    "American Bulldog",
    "American Staffordshire Terrier",
  ],
  Rottweiler: [
    "Labrador",
    "German Shepherd",
    "Doberman Pinscher",
    "Boxer",
    "Mastiff",
    "Great Dane",
  ],
  "Australian Shepherd": [
    "Labrador",
    "Golden Retriever",
    "German Shepherd",
    "Border Collie",
    "Vizsla",
  ],
  "Basset Hound": [
    "Beagle",
    "Dachshund",
    "Cocker Spaniel",
    "Cavalier King Charles Spaniel",
  ],
  "Border Collie": [
    "Labrador",
    "Golden Retriever",
    "German Shepherd",
    "Australian Shepherd",
    "Shetland Sheepdog",
  ],
  "Cocker Spaniel": [
    "Beagle",
    "Cavalier King Charles Spaniel",
    "Dachshund",
    "Basset Hound",
    "Springer Spaniel",
  ],
  "Doberman Pinscher": [
    "Boxer",
    "Rottweiler",
    "German Shepherd",
    "Belgian Malinois",
    "Great Dane",
  ],
  "Bernese Mountain Dog": [
    "Labrador",
    "Golden Retriever",
    "Newfoundland",
    "Saint Bernard",
    "Rottweiler",
  ],
  Bloodhound: ["Basset Hound", "Coonhound", "Treeing Walker Coonhound"],
  Bulmastiff: ["Mastiff", "Saint Bernard", "Rottweiler", "Doberman Pinscher"],
  Collie: [
    "Shetland Sheepdog",
    "Australian Shepherd",
    "Border Collie",
    "German Shepherd",
  ],
  Dalmatian: ["Boxer", "Pointer", "Weimaraner", "Doberman Pinscher"],
  "English Setter": [
    "Irish Setter",
    "Gordon Setter",
    "Pointer",
    "Brittany Spaniel",
  ],
  Greyhound: ["Whippet", "Saluki", "Afghan Hound", "Italian Greyhound"],
  Havanese: [
    "Maltese",
    "Shih Tzu",
    "Poodle",
    "Bichon Frise",
    "Cavalier King Charles Spaniel",
  ],
  "Irish Setter": [
    "English Setter",
    "Gordon Setter",
    "Brittany Spaniel",
    "Welsh Springer Spaniel",
  ],
  "Jack Russell Terrier": [
    "Parson Russell Terrier",
    "Rat Terrier",
    "Yorkshire Terrier",
    "Cairn Terrier",
  ],
  "Lhasa Apso": ["Shih Tzu", "Maltese", "Pomeranian", "Havanese"],
  Mastiff: [
    "Rottweiler",
    "Great Dane",
    "Saint Bernard",
    "Bullmastiff",
    "Cane Corso",
  ],
  Newfoundland: [
    "Labrador",
    "Golden Retriever",
    "Bernese Mountain Dog",
    "Saint Bernard",
    "Great Pyrenees",
  ],
  "Old English Sheepdog": ["Bearded Collie", "Briard", "Bobtail", "Puli"],
  Papillon: [
    "Yorkshire Terrier",
    "Maltese",
    "Chihuahua",
    "Pomeranian",
    "Cavalier King Charles Spaniel",
  ],
  Pointer: [
    "Weimaraner",
    "Vizsla",
    "German Shorthaired Pointer",
    "Brittany Spaniel",
    "English Setter",
  ],
  "Rhodesian Ridgeback": [
    "Boxer",
    "Doberman Pinscher",
    "Rottweiler",
    "German Shepherd",
  ],
  Samoyed: ["Siberian Husky", "Alaskan Malamute", "Great Pyrenees", "Keeshond"],
  "Scottish Terrier": [
    "Cairn Terrier",
    "West Highland White Terrier",
    "Skye Terrier",
    "Dandie Dinmont Terrier",
  ],
  Weimaraner: ["Pointer", "Vizsla", "Doberman Pinscher", "Rhodesian Ridgeback"],
  Whippet: ["Greyhound", "Italian Greyhound", "Saluki", "Afghan Hound"],
  Akita: ["Siberian Husky", "Alaskan Malamute", "Shiba Inu", "Chow Chow"],
  "Alaskan Malamute": ["Siberian Husky", "Akita", "Samoyed", "Great Pyrenees"],
  "Bichon Frise": [
    "Maltese",
    "Havanese",
    "Poodle",
    "Shih Tzu",
    "Cavalier King Charles Spaniel",
  ],
  "Boston Terrier": [
    "French Bulldog",
    "Pug",
    "Bulldog",
    "Chihuahua",
    "Shih Tzu",
  ],
  "Brussels Griffon": [
    "Affenpinscher",
    "Pug",
    "French Bulldog",
    "Boston Terrier",
  ],
  "Cairn Terrier": [
    "Scottish Terrier",
    "West Highland White Terrier",
    "Skye Terrier",
    "Jack Russell Terrier",
  ],
  "Chinese Shar-Pei": ["Chow Chow", "Shar Pei", "Akita", "Bullmastiff"],
  "Cane Corso": ["Mastiff", "Bullmastiff", "Rottweiler", "Doberman Pinscher"],
  "Shiba Inu": ["Akita", "Chow Chow", "Shar Pei", "Shikoku"],
  "American Bulldog": [
    "Pit Bull Terrier",
    "Staffordshire Bull Terrier",
    "Bulldog",
    "Boxer",
  ],
  "English Springer Spaniel": [
    "Cocker Spaniel",
    "Brittany Spaniel",
    "Welsh Springer Spaniel",
    "Cavalier King Charles Spaniel",
  ],
  "Staffordshire Bull Terrier": [
    "Pit Bull Terrier",
    "American Bulldog",
    "American Staffordshire Terrier",
    "Bulldog",
    "Boxer",
  ],
  "Miniature Schnauzer": [
    "Standard Schnauzer",
    "Giant Schnauzer",
    "Affenpinscher",
    "Scottish Terrier",
  ],
  "Shetland Sheepdog": [
    "Collie",
    "Border Collie",
    "Australian Shepherd",
    "Pembroke Welsh Corgi",
  ],
  Vizsla: [
    "Weimaraner",
    "Pointer",
    "German Shorthaired Pointer",
    "Golden Retriever",
    "Labrador",
  ],
  "Chow Chow": ["Akita", "Shar Pei", "Shiba Inu", "Chinese Shar-Pei"],
  "Belgian Malinois": [
    "German Shepherd",
    "Doberman Pinscher",
    "Rottweiler",
    "Dutch Shepherd",
  ],
  Pomeranian: [
    "Maltese",
    "Yorkshire Terrier",
    "Chihuahua",
    "Papillon",
    "Shih Tzu",
  ],
  "Cardigan Welsh Corgi": [
    "Pembroke Welsh Corgi",
    "Shetland Sheepdog",
    "Dachshund",
    "Basset Hound",
  ],
  "Australian Cattle Dog": [
    "Australian Shepherd",
    "Border Collie",
    "Collie",
    "Heeler",
  ],
  "American Eskimo Dog": ["Samoyed", "Keeshond", "Pomeranian", "Maltese"],
  "Shar Pei": ["Chinese Shar-Pei", "Chow Chow", "Bullmastiff", "Cane Corso"],
  "Wire Fox Terrier": [
    "Jack Russell Terrier",
    "Cairn Terrier",
    "Scottish Terrier",
    "Welsh Terrier",
  ],
  "Portuguese Water Dog": [
    "Standard Poodle",
    "Irish Water Spaniel",
    "Flat-Coated Retriever",
    "Golden Retriever",
  ],
  "West Highland White Terrier": [
    "Scottish Terrier",
    "Cairn Terrier",
    "Skye Terrier",
    "Jack Russell Terrier",
  ],
  "Saint Bernard": [
    "Bernese Mountain Dog",
    "Newfoundland",
    "Great Pyrenees",
    "Mastiff",
  ],
  "Soft Coated Wheaten Terrier": [
    "Poodle",
    "Bichon Frise",
    "Havanese",
    "Cavalier King Charles Spaniel",
  ],
};

const temperamentCompatibility = {
  Calm: ["walking", "bubbles", "sniffari", "chew_toys", "puzzles"],
  Energetic: [
    "walking",
    "fetch",
    "swimming",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "frisbee",
    "dog_park",
    "playdates",
    "digging",
    "chew_toys",
    "obstacle_course",
  ],
  Friendly: [
    "walking",
    "fetch",
    "swimming",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "bubbles",
    "frisbee",
    "dog_park",
    "playdates",
    "chew_toys",
  ],
  Neuroticism: ["chew_toys", "puzzles"],
  "Motive Driven": [
    "fetch",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "frisbee",
    "sniffari",
    "digging",
    "puzzles",
    "obstacle_course",
  ],
  Extravert: ["dog_park", "playdates"],
};

const activityCompatibility = {
  walking: ["Calm", "Energetic", "Friendly"],
  fetch: ["Energetic", "Friendly", "Motive Driven"],
  swimming: ["Energetic", "Friendly"],
  hiking: ["Energetic", "Friendly", "Motive Driven"],
  tug_of_war: ["Energetic", "Friendly", "Motive Driven"],
  agility_training: ["Energetic", "Friendly", "Motive Driven"],
  hide_and_seek: ["Energetic", "Friendly", "Motive Driven"],
  bubbles: ["Calm", "Friendly"],
  frisbee: ["Energetic", "Friendly", "Motive Driven"],
  dog_park: ["Energetic", "Friendly", "Extravert"],
  playdates: ["Energetic", "Friendly", "Extravert"],
  sniffari: ["Calm", "Motive Driven"],
  digging: ["Energetic", "Motive Driven"],
  chew_toys: ["Calm", "Energetic", "Friendly"],
  puzzles: ["Calm", "Motive Driven"],
  obstacle_course: ["Energetic", "Friendly", "Motive Driven"],
};

const directTemperamentCompatibility = {
  Calm: ["Friendly", "Neuroticism", "Motive Driven"],
  Energetic: ["Friendly", "Motive Driven", "Extravert"],
  Friendly: ["Calm", "Energetic", "Extravert"],
  Neuroticism: ["Calm"],
  "Motive Driven": ["Calm", "Energetic"],
  Extravert: ["Energetic", "Friendly"],
};
const directActivityCompatibility = {
  walking: [
    "fetch",
    "swimming",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "bubbles",
    "frisbee",
    "dog_park",
    "playdates",
    "chew_toys",
    "obstacle_course",
  ],
  fetch: [
    "walking",
    "swimming",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "frisbee",
    "dog_park",
    "playdates",
    "obstacle_course",
  ],
  swimming: [
    "walking",
    "fetch",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "frisbee",
    "dog_park",
    "playdates",
    "obstacle_course",
  ],
  hiking: [
    "walking",
    "fetch",
    "swimming",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "frisbee",
    "dog_park",
    "playdates",
    "obstacle_course",
  ],
  tug_of_war: [
    "walking",
    "fetch",
    "swimming",
    "hiking",
    "agility_training",
    "hide_and_seek",
    "frisbee",
    "dog_park",
    "playdates",
    "obstacle_course",
  ],
  agility_training: [
    "walking",
    "fetch",
    "swimming",
    "hiking",
    "tug_of_war",
    "hide_and_seek",
    "frisbee",
    "dog_park",
    "playdates",
    "obstacle_course",
  ],
  hide_and_seek: [
    "walking",
    "fetch",
    "swimming",
    "hiking",
    "tug_of_war",
    "agility_training",
    "frisbee",
    "dog_park",
    "playdates",
    "obstacle_course",
  ],
  bubbles: ["walking", "chew_toys"],
  frisbee: [
    "walking",
    "fetch",
    "swimming",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "dog_park",
    "playdates",
    "obstacle_course",
  ],
  dog_park: [
    "walking",
    "fetch",
    "swimming",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "frisbee",
    "playdates",
  ],
  playdates: [
    "walking",
    "fetch",
    "swimming",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "frisbee",
    "dog_park",
  ],
  sniffari: ["walking", "chew_toys", "puzzles"],
  digging: ["walking", "chew_toys"],
  chew_toys: ["walking", "bubbles", "sniffari", "digging"],
  puzzles: ["walking", "sniffari"],
  obstacle_course: [
    "walking",
    "fetch",
    "swimming",
    "hiking",
    "tug_of_war",
    "agility_training",
    "hide_and_seek",
    "frisbee",
  ],
};

const PetMatchController = {
  async getAllPetMatches(req, res) {
    try {
      const petMatches = await PetMatch.find()
        .populate("Pet1")
        .populate("Pet2")
        .populate("RelevantToUser")
        .populate("Creator");
      res.json(petMatches);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async getPetMatchById(req, res, next) {
    let petMatch;
    try {
      petMatch = await PetMatch.findById(req.params.id)
        .populate("Pet1")
        .populate("Pet2")
        .populate("RelevantToUser")
        .populate("Creator");
      if (petMatch == null) {
        return res.status(404).json({ message: "Cannot find pet match" });
      }
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }

    res.petMatch = petMatch;
    next();
  },

  async getPetById(req, res) {
    try {
      const pet = await pet.findById(req.params.id).populate("location");
      if (pet == null) {
        return res.status(404).json({ message: "Cannot find pet" });
      }
      // Now you have the pet's location populated
      res.json(pet);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  async matchPets(petId, isSubscribed, req) {
    const pet = await pet.findById(req.params.id).populate("location");
    const currentPet = await pet.findById(petId);

    if (!currentPet) return;

    const potentialMatches = await pet.find({ _id: { $ne: petId } });

    let matches = potentialMatches.map((potentialMatch) => {
      let score = 0;

      // Existing breed compatibility calculations
      score += calculateBreedCompatibility(
        currentPet.breed,
        potentialMatch.breed,
        breedCompatibility
      );

      // Existing temperament compatibility calculations
      score += calculateTemperamentCompatibility(
        currentPet.temperament,
        potentialMatch.temperament,
        directTemperamentCompatibility,
        directActivityCompatibility
      );

      // Enhanced temperament compatibility for subscribed users
      if (isSubscribed && temperamentCompatibility[currentPet.temperament]) {
        score += temperamentCompatibility[currentPet.temperament]
          .map((activity) =>
            potentialMatch.activities.includes(activity) ? 5 : 0
          )
          .reduce((sum, current) => sum + current, 0);
      }

      // Enhanced activity compatibility for subscribed users
      if (isSubscribed && currentPet.activities) {
        score += calculateActivityCompatibility(
          currentPet.activities,
          potentialMatch.activities,
          activityCompatibility
        );
      }

      // Return the match along with the calculated score
      return { matchId: potentialMatch._id, score };
    });

    // Sort and filter matches
    matches = matches
      .filter((match) => match.score > 20)
      .sort((a, b) => b.score - a.score);

    // Create PetMatch documents for each match
    for (const match of matches) {
      await this.createPetMatch({
        MatchScore: match.score,
        Pet1: petId,
        Pet2: match.matchId,
        RelevantToUser: currentPet.owner,
        Creator: currentPet.owner,
      });
    }

    return matches;
  },
  async matchPetsHandler(req, res) {
    const { petId, isSubscribed } = req.body; // Get petId and isSubscribed from request body

    try {
      const matches = await this.matchPets(petId, isSubscribed); // Call the existing matchPets method
      res.status(200).json(matches); // Return the matches
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async createPetMatch(req, res) {
    const petMatch = new PetMatch({
      MatchScore: req.body.MatchScore,
      Pet1: req.body.Pet1,
      Pet2: req.body.Pet2,
      RelevantToUser: req.body.RelevantToUser,
      Creator: req.body.Creator,
      Slug: req.body.Slug,
    });

    try {
      const newPetMatch = await petMatch.save();
      res.status(201).json(newPetMatch);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  },
};

module.exports = PetMatchController;
