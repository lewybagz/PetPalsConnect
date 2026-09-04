import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Button,
} from "react-native";
import { PHOTO_LIMIT, addPetPhoto } from "../../services/photos";
import { Picker } from "@react-native-picker/picker";
import DropDownPicker from "react-native-dropdown-picker";
import { useSelector, useDispatch } from "react-redux";
import api from "../../api/axios";
import { removeCache, CacheKeys } from "../../services/localCache";
import { useAuthSession } from "../../context/AuthSessionContext";
import { BREEDS } from "../../data/breeds";
import { clearError } from "../../redux/actions";
import LoadingScreen from "../../components/LoadingScreenComponent";
import { useToast } from "../../components/ui";

/**
 * A blank form.
 *
 * Resetting used to spread `{ name, breed, age }` over the state, which
 * dropped `photos`, `weight` and `favoriteActivities` - so the next photo tap
 * read `.length` on undefined and crashed the screen.
 */
const EMPTY_PET = {
  name: "",
  breed: "",
  age: "",
  photos: [],
  specialNeeds: "",
  temperament: "",
  weight: { value: 0, unit: "lbs" },
  favoriteActivities: [],
};

const AddPetScreen = ({ navigation }) => {
  const toast = useToast();

  const [petDetails, setPetDetails] = useState([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const dispatch = useDispatch();
  const { refresh } = useAuthSession();

  const isLoading = useSelector((state) => state.user.isLoading);
  const error = useSelector((state) => state.user.error);

  useEffect(() => {
    if (error) {
      Alert.alert("Error", error, [
        { text: "OK", onPress: () => dispatch(clearError()) },
      ]);
    }
  }, [error, dispatch]);

  const [currentPet, setCurrentPet] = useState(EMPTY_PET);

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

  // Shared with onboarding so the two lists cannot drift apart.
  const sortedBreeds = BREEDS;
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
  /**
   * Queues this pet and asks whether there is another.
   *
   * "Yes" was `console.log("Adding more")`, so the only thing that happened
   * was the reset below - which spread a *three-key* object over the form
   * state, dropping `photos`, `weight` and `favoriteActivities`. The next tap
   * on "Add photo" then read `currentPet.photos.length` on undefined and
   * threw, so adding a second pet crashed the screen.
   *
   * `weight` is checked here too: matching compares size, and the server
   * requires it, so leaving it out queues a pet whose save fails at the end of
   * the flow rather than at the field.
   */
  const handleAddPet = () => {
    if (!currentPet.name || !currentPet.breed || !currentPet.age) {
      Alert.alert("Error", "Please fill all the fields.");
      return;
    }
    if (!currentPet.weight?.value) {
      Alert.alert("Error", "Please give a weight - matching compares size.");
      return;
    }

    const queued = [...petDetails, currentPet];
    setPetDetails(queued);
    setCurrentPet(EMPTY_PET);

    Alert.alert(
      "Add another pet?",
      `${currentPet.name} is ready to save.`,
      [
        {
          text: "Add another",
          onPress: () => toast.success(`${currentPet.name} added`),
        },
        { text: "Save and finish", onPress: () => submitPets(queued) },
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
    if (currentPet.photos.length >= PHOTO_LIMIT) {
      Alert.alert(
        "Limit Reached",
        `You can add up to ${PHOTO_LIMIT} photos.`
      );
      return;
    }

    // Picking, compressing and uploading all live in services/photos, which
    // is also where the storage path is decided. This screen wrote to
    // `uploads/<the device's filename>` and the onboarding screen wrote
    // somewhere else entirely, neither compressed, and neither path had an
    // owner in it for the Storage rules to check.
    setUploading(true);
    try {
      const result = await addPetPhoto({ fromCamera: false });

      if (result.denied) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to add pictures of your pet."
        );
        return;
      }
      if (result.cancelled) return;

      setCurrentPet((previous) => ({
        ...previous,
        photos: [...previous.photos, result.url],
      }));
    } catch (error) {
      Alert.alert("Upload failed", error.message);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Adds every pet on the form.
   *
   * The server derives ownership from the token and links each pet to the
   * profile itself. This used to read `response.data._id` (the response is
   * `{ pet, matches }`, so that was always undefined) and then PATCH the
   * collected ids onto the user - client-driven linking that wrote undefined.
   */
  const submitPets = async (pets = petDetails) => {
    // `setPetDetails` does not apply until the next render, so submitting
    // straight after queueing saved every pet *except* the one just added.
    if (pets.length === 0) return;

    setSubmitting(true);
    try {
      for (const pet of pets) {
        await api.post("/api/pets", {
          name: pet.name,
          breed: pet.breed,
          age: Number(pet.age),
          weight: pet.weight?.value ? Number(pet.weight.value) : undefined,
          photos: pet.photos ?? [],
          specialNeeds: pet.specialNeeds,
          temperament: pet.temperament,
          favoriteActivities: pet.favoriteActivities ?? [],
        });
      }

      await removeCache(CacheKeys.pets);
      // Keeps the session's pet list (and the onboarding gate) in step.
      await refresh();

      setPetDetails([]);
      toast.success(pets.length === 1 ? "Pet added" : `${pets.length} pets added`);
      navigation.goBack();
    } catch (error) {
      console.error("Error submitting pets:", error);
      Alert.alert(
        "Error",
        error.response?.data?.message ?? "Failed to add pets. Please try again."
      );
    } finally {
      setSubmitting(false);
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
      <Button
        title={uploading ? "Uploading…" : "Upload Photo"}
        onPress={handleChoosePhoto}
        disabled={uploading}
      />

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
      <TouchableOpacity onPress={handleAddPet} disabled={submitting}>
        <Text>{submitting ? "Saving..." : "Add Pet"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default AddPetScreen;
