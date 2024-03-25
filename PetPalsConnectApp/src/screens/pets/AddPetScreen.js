import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Button,
} from "react-native";
import { launchImageLibrary } from "react-native-image-picker";
import { useNavigation } from "@react-navigation/native";
import storage from "@react-native-firebase/storage";
import { Picker } from "@react-native-picker/picker";
import { matchPets } from "../../../../backend/controllers/";
import DropDownPicker from "react-native-dropdown-picker";
import { useSelector } from "react-redux";
import Realm from "realm";
import axios from "axios";

const AddPetScreen = () => {
  const MAX_PHOTOS = 5;
  const navigation = useNavigation();
  const [petDetails, setPetDetails] = useState([]);
  const [isNewUser, setIsNewUser] = useState(false);
  const [open, setOpen] = useState(false);
  const userId = useSelector((state) => state.user.userId);
  const currentUser = useSelector((state) => state.user);
  const [currentPet, setCurrentPet] = useState({
    name: "",
    breed: "",
    age: "",
    photos: [], // Array to store photo URLs
    specialNeeds: "",
    temperament: "",
    weight: { value: 0, unit: "lbs" }, // Default unit is lbs, can be lbs or kg
    favoriteActivities: [],
  });

  const [activities, setActivities] = useState([
    { label: "Walking", value: "walking" },
    { label: "Playing Fetch", value: "fetch" },
    { label: "Swimming", value: "swimming" },
    { label: "Hiking", value: "hiking" },
    { label: "Tug of War", value: "tug_of_war" },
    { label: "Agility Training", value: "agility_training" },
    { label: "Hide and Seek", value: "hide_and_seek" },
    { label: "Chasing Bubbles", value: "bubbles" },
    { label: "Frisbee", value: "frisbee" },
    { label: "Dog Park Visits", value: "dog_park" },
    { label: "Doggie Playdates", value: "playdates" },
    { label: "Sniffari (scent games)", value: "sniffari" },
    { label: "Digging Games", value: "digging" },
    { label: "Chew Toys", value: "chew_toys" },
    { label: "Interactive Puzzles", value: "puzzles" },
    { label: "Obstacle Course", value: "obstacle_course" },
  ]);

  const breeds = [
    "Labrador",
    "Poodle",
    "Beagle",
    "Bulldog",
    "Yorkshire Terrier",
    "Chihuahua",
    "German Shepherd",
    "Golden Retriever",
    "French Bulldog",
    "Shih Tzu",
    "Boxer",
    "Pug",
    "Dachshund",
    "Great Dane",
    "Siberian Husky",
    "Maltese",
    "Cavalier King Charles Spaniel",
    "Pit Bull Terrier",
    "Rottweiler",
    "Australian Shepherd",
    "Basset Hound",
    "Border Collie",
    "Cocker Spaniel",
    "Doberman Pinscher",
    "Bernese Mountain Dog",
    "Bloodhound",
    "Bulmastiff",
    "Collie",
    "Dalmatian",
    "English Setter",
    "Greyhound",
    "Havanese",
    "Irish Setter",
    "Jack Russell Terrier",
    "Lhasa Apso",
    "Mastiff",
    "Newfoundland",
    "Old English Sheepdog",
    "Papillon",
    "Pointer",
    "Rhodesian Ridgeback",
    "Samoyed",
    "Scottish Terrier",
    "Weimaraner",
    "Whippet",
    "Akita",
    "Alaskan Malamute",
    "Bichon Frise",
    "Boston Terrier",
    "Brussels Griffon",
    "Cairn Terrier",
    "Chinese Shar-Pei",
    "Cane Corso",
    "Shiba Inu",
    "American Bulldog",
    "English Springer Spaniel",
    "Staffordshire Bull Terrier",
    "Miniature Schnauzer",
    "Shetland Sheepdog",
    "Vizsla",
    "Chow Chow",
    "Belgian Malinois",
    "Pomeranian",
    "Cardigan Welsh Corgi",
    "Australian Cattle Dog",
    "American Eskimo Dog",
    "Shar Pei",
    "Wire Fox Terrier",
    "Portuguese Water Dog",
    "West Highland White Terrier",
    "Saint Bernard",
    "Soft Coated Wheaten Terrier",
  ];
  const sortedBreeds = breeds.sort();
  const temperaments = [
    "Calm",
    "Energetic",
    "Friendly",
    "Neuroticism",
    "Motive Driven",
    "Extrovert",
  ];

  const activityLevels = [
    { label: "Low", value: "low" },
    { label: "Moderate", value: "moderate" },
    { label: "High", value: "high" },
  ];

  const socializationLevels = [
    { label: "Introvert", value: "introvert" },
    { label: "Balanced", value: "balanced" },
    { label: "Extrovert", value: "extrovert" },
  ];

  //TODO: ASK ABOUT HOW TO DISPLAY BENIFITS OF SUBSCRIPTION FEATURES

  const onActivitySelect = (item) => {
    if (!currentPet.favoriteActivities.includes(item.value)) {
      setCurrentPet({
        ...currentPet,
        favoriteActivities: [...currentPet.favoriteActivities, item.value],
      });
    }
  };

  const removeActivity = (activity) => {
    setCurrentPet({
      ...currentPet,
      favoriteActivities: currentPet.favoriteActivities.filter(
        (a) => a !== activity
      ),
    });
  };
  const handleAddPet = () => {
    if (!currentPet.name || !currentPet.breed || !currentPet.age) {
      Alert.alert("Error", "Please fill all the fields.");
      return;
    }
    setPetDetails([...petDetails, currentPet]);
    setCurrentPet({ name: "", breed: "", age: "" });
    Alert.alert(
      "Add Another Pet?",
      "",
      [
        { text: "Yes", onPress: () => console.log("Adding more") },
        { text: "No", onPress: () => submitPets() },
      ],
      { cancelable: false }
    );
  };

  const handleWeightChange = (text) => {
    setCurrentPet({
      ...currentPet,
      weight: { ...currentPet.weight, value: parseFloat(text) || 0 },
    });
  };
  const handleChoosePhoto = () => {
    if (currentPet.photos.length >= MAX_PHOTOS) {
      Alert.alert(
        "Limit Reached",
        "You can only upload up to " + MAX_PHOTOS + " photos."
      );
      return;
    }

    launchImageLibrary({ noData: true }, async (response) => {
      if (response.didCancel) {
        console.log("User cancelled image picker");
      } else if (response.error) {
        console.log("ImagePicker Error: ", response.error);
      } else {
        const uploadedUrl = await uploadImageToFirebase(response.uri);
        if (uploadedUrl) {
          setCurrentPet({
            ...currentPet,
            photos: [...currentPet.photos, uploadedUrl],
          });
        }
      }
    });
  };

  const uploadImageToFirebase = async (uri) => {
    const filename = uri.substring(uri.lastIndexOf("/") + 1);
    const uploadUri = Platform.OS === "ios" ? uri.replace("file://", "") : uri;
    const storageRef = storage().ref(`uploads/${filename}`);

    try {
      await storageRef.putFile(uploadUri);
      const url = await storageRef.getDownloadURL();
      return url;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const submitPets = async () => {
    try {
      let petIds = [];
      for (const pet of petDetails) {
        const response = await axios.post("/api/pets", pet);
        const newPetId = response.data._id;
        petIds.push(newPetId);

        Realm.write(() => {
          Realm.create("Pet", {
            _id: newPetId,
            age: pet.age,
            breed: pet.breed,
            name: pet.name,
            owner: pet.owner, // Assuming owner's ID is available in pet object
            photos: pet.photos,
            location: pet.location ? pet.location.toString() : null, // Handle optional fields
            playdates: pet.playdates.map((pd) => pd.toString()), // Convert ObjectId to string
            specialNeeds: pet.specialNeeds,
            temperament: pet.temperament,
            weight: pet.weight,
          });
        });

        // Run the matching algorithm
        await matchPets(newPetId, false);
      }

      if (isNewUser) {
        // Create a complete user profile in MongoDB for new users
        await createUserProfileInMongoDB(currentUser, petIds);
        navigation.navigate("Home", { showPopup: true, showTutorial: true });
        setIsNewUser(false); // Reset the flag to avoid showing the popup again
      } else {
        // Update existing user document with new pet IDs
        await axios.patch(`/api/users/${userId}`, { pets: petIds });
        navigation.navigate("Home");
      }
      Alert.alert("Success", "Pets added successfully!");
      setPetDetails([]);

      // Navigate to HomeScreen
      navigation.navigate("Home", { showPopup: isNewUser });
    } catch (error) {
      console.error("Error submitting pets:", error);
      Alert.alert("Error", "Failed to add pets. Please try again.");
    }
  };

  // Function to create user profile in MongoDB
  const createUserProfileInMongoDB = async (user, petIds) => {
    // Define user profile data structure here
    const userProfile = {
      email: user.email,
      pets: petIds,
      // Add other user details as required
    };

    // Send a POST request to your backend to create a user document
    try {
      await axios.post("/api/users", userProfile);
    } catch (error) {
      console.error("Error creating user profile in MongoDB:", error);
    }
  };
  return (
    <ScrollView style={{ padding: 20 }}>
      <Text>Add Your Pet&rsquo;s Details</Text>
      <TextInput
        placeholder="Pet's Name"
        value={currentPet.name}
        onChangeText={(text) => setCurrentPet({ ...currentPet, name: text })}
      />
      <Text>Breed:</Text>
      <Text>
        Close Enough Counts - if you don&rsquo;t find the exact breed, pick the
        closest one.
      </Text>
      <Picker
        selectedValue={currentPet.breed}
        onValueChange={(itemValue) =>
          setCurrentPet({ ...currentPet, breed: itemValue })
        }
      >
        {sortedBreeds.map((breed) => (
          <Picker.Item key={breed} label={breed} value={breed} />
        ))}
      </Picker>
      <TextInput
        placeholder="Age"
        value={currentPet.age}
        onChangeText={(text) => setCurrentPet({ ...currentPet, age: text })}
        keyboardType="numeric"
      />

      <Text>
        Note: The first image you upload will be your pet&rsquo;s profile
        picture. The rest can be seen from your pet&rsquo;s profile page.
      </Text>
      <Button title="Upload Photo" onPress={handleChoosePhoto} />

      <TextInput
        placeholder="Special Needs"
        value={currentPet.specialNeeds}
        onChangeText={(text) =>
          setCurrentPet({ ...currentPet, specialNeeds: text })
        }
      />

      {/* Temperament Dropdown */}
      <Text>Temperament:</Text>
      <Picker
        selectedValue={currentPet.temperament}
        onValueChange={(itemValue) =>
          setCurrentPet({ ...currentPet, temperament: itemValue })
        }
      >
        {temperaments.map((temp) => (
          <Picker.Item key={temp} label={temp} value={temp} />
        ))}
      </Picker>

      <TextInput
        placeholder="Weight"
        value={String(currentPet.weight.value)}
        onChangeText={handleWeightChange}
        keyboardType="numeric"
      />
      <Picker
        selectedValue={currentPet.weight.unit}
        onValueChange={(unitValue) =>
          setCurrentPet({
            ...currentPet,
            weight: { ...currentPet.weight, unit: unitValue },
          })
        }
      >
        <Picker.Item label="lbs" value="lbs" />
        <Picker.Item label="kg" value="kg" />
      </Picker>

      <Text>Activity Level:</Text>
      <Picker
        selectedValue={currentPet.activityLevel}
        onValueChange={(itemValue) =>
          setCurrentPet({ ...currentPet, activityLevel: itemValue })
        }
      >
        {activityLevels.map((level) => (
          <Picker.Item
            key={level.value}
            label={level.label}
            value={level.value}
          />
        ))}
      </Picker>

      {/* Socialization Level Dropdown */}
      <Text>Socialization Level:</Text>
      <Picker
        selectedValue={currentPet.socializationLevel}
        onValueChange={(itemValue) =>
          setCurrentPet({ ...currentPet, socializationLevel: itemValue })
        }
      >
        {socializationLevels.map((level) => (
          <Picker.Item
            key={level.value}
            label={level.label}
            value={level.value}
          />
        ))}
      </Picker>

      <TextInput
        placeholder="Health Information"
        value={currentPet.healthInformation}
        onChangeText={(text) =>
          setCurrentPet({ ...currentPet, healthInformation: text })
        }
        multiline
      />
      <Text style={{ marginTop: 5, fontStyle: "italic", fontSize: 12 }}>
        Note: This info is just to keep other pet owners informed and
        won&rsquo;t be used for pet matching.
      </Text>

      <DropDownPicker
        open={open}
        value={currentPet.favoriteActivities}
        items={activities}
        setOpen={setOpen}
        setValue={onActivitySelect}
        setItems={setActivities}
        multiple={true}
        mode="BADGE"
      />
      <View>
        {currentPet.favoriteActivities.map((activity, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => removeActivity(activity)}
          >
            <Text>{activity} x</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={handleAddPet}>
        <Text>Add Pet</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default AddPetScreen;
