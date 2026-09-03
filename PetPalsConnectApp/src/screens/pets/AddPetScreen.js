import React, { useState, useEffect } from "react";
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
import * as ImagePicker from "expo-image-picker";
import storage from "@react-native-firebase/storage";
import { Picker } from "@react-native-picker/picker";
import DropDownPicker from "react-native-dropdown-picker";
import { useSelector, useDispatch } from "react-redux";
import api from "../../api/axios";
import { getStoredToken } from "../../../utils/tokenutil";
import { removeCache, CacheKeys } from "../../services/localCache";
import { clearError } from "../../redux/actions";
import LoadingScreen from "../../components/LoadingScreenComponent";
const AddPetScreen = (navigation) => {
  const MAX_PHOTOS = 5;
  const [petDetails, setPetDetails] = useState([]);
  const [isNewUser, setIsNewUser] = useState(false);
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();

  const userId = useSelector((state) => state.userReducer.userId);
  const currentUser = useSelector((state) => state.userReducer.currentUser);
  const isLoading = useSelector((state) => state.userReducer.isLoading);
  const error = useSelector((state) => state.userReducer.error);

  useEffect(() => {
    if (error) {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

  const [currentPet, setCurrentPet] = useState({
    name: "",
    breed: "",
    age: "",
    photos: [],
    specialNeeds: "",
    temperament: "",
    weight: { value: 0, unit: "lbs" },
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
  // Hooks must run in the same order on every render, so this early return has
  // to come after every useState/useEffect above - not in the middle of them.
  if (isLoading) {
    return <LoadingScreen />;
  }

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
  const handleChoosePhoto = async () => {
    if (currentPet.photos.length >= MAX_PHOTOS) {
      Alert.alert(
        "Limit Reached",
        "You can only upload up to " + MAX_PHOTOS + " photos."
      );
      return;
    }

    // expo-image-picker replaces react-native-image-picker. It is
    // promise-based and requests permission itself, rather than taking a
    // callback and assuming permission was already granted.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to add pictures of your pet."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets?.[0];
    if (!asset) return;

    const uploadedUrl = await uploadImageToFirebase(asset.uri);
    if (uploadedUrl) {
      setCurrentPet((previous) => ({
        ...previous,
        photos: [...previous.photos, uploadedUrl],
      }));
    }
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
      const token = await getStoredToken(); // Retrieve the token
      for (const pet of petDetails) {
        const response = await api.post("/api/pets", pet, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const newPetId = response.data._id;
        petIds.push(newPetId);

        // Matching runs server-side. This screen used to import the backend's
        // matchPets controller directly, which cannot execute on a device.
        await api.post(`/api/petmatches/run/${newPetId}`).catch((error) =>
          console.warn("[pets] Match run failed:", error.message)
        );
      }

      await removeCache(CacheKeys.pets);

      if (isNewUser) {
        // Create a complete user profile in MongoDB for new users
        await createUserProfileInMongoDB(currentUser, petIds);
        navigation.navigate("Home", { showPopup: true, showTutorial: true });
        setIsNewUser(false);
      } else {
        // Update existing user document with new pet IDs
        await api.patch(
          `/api/users/${userId}`,
          { pets: petIds },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        navigation.navigate("Home");
      }
      Alert.alert("Success", "Pets added successfully!");
      setPetDetails([]);

      navigation.navigate("Home", { showPopup: isNewUser });
    } catch (error) {
      console.error("Error submitting pets:", error);
      Alert.alert("Error", "Failed to add pets. Please try again.");
    }
  };

  // Function to create user profile in MongoDB
  const createUserProfileInMongoDB = async (user, petIds) => {
    const userProfile = {
      email: user.email,
      pets: petIds,
      // Add other user details as required
    };

    try {
      const token = await getStoredToken(); // Retrieve the token
      await api.post("/api/users", userProfile, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
