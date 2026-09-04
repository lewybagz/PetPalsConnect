import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
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
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch, toast]);

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
   * Queues this pet and clears the form for the next one.
   *
   * There was one button here, and it asked "Add another pet?" in a modal
   * whose "Yes" was `console.log("Adding more")` - so the only thing that
   * happened was the reset, which spread a *three-key* object over the form
   * state and dropped `photos`, `weight` and `favoriteActivities`. The next
   * tap on "Add photo" then read `.length` on undefined and crashed the
   * screen.
   *
   * A modal is a poor way to ask "are you finished?" anyway: it stops the app
   * to ask a question the screen can answer by showing what is queued and
   * offering a second button. So there is no question now.
   *
   * `weight` is checked here because matching compares size and the server
   * requires it: leaving it out would queue a pet whose save fails at the end
   * of the flow rather than at the field.
   */
  const handleAddPet = () => {
    if (!currentPet.name || !currentPet.breed || !currentPet.age) {
      toast.show("Fill in the name, breed and age first.");
      return;
    }
    if (!currentPet.weight?.value) {
      toast.show("Add a weight - matching compares size.");
      return;
    }

    setPetDetails([...petDetails, currentPet]);
    setCurrentPet(EMPTY_PET);
    toast.success(`${currentPet.name} added - save when you're done.`);
  };

  const handleWeightChange = (text) => {
    setCurrentPet({
      ...currentPet,
      weight: { ...currentPet.weight, value: parseFloat(text) || 0 },
    });
  };
  const handleChoosePhoto = async () => {
    if (currentPet.photos.length >= PHOTO_LIMIT) {
      toast.show(`That's the limit - ${PHOTO_LIMIT} photos per pet.`);
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
        toast.show("Allow photo access to add pictures of your pet.");
        return;
      }
      if (result.cancelled) return;

      setCurrentPet((previous) => ({
        ...previous,
        photos: [...previous.photos, result.url],
      }));
    } catch (error) {
      toast.error(error.message);
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
    // Takes the list rather than reading state, because `setPetDetails` does
    // not apply until the next render: a caller that queues and submits in one
    // handler would save every pet *except* the one just added.
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
      toast.error(
        error.response?.data?.message ?? "Couldn't save that. Try again."
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
        <Text>Add Pet</Text>
      </TouchableOpacity>

      {petDetails.length > 0 ? (
        <TouchableOpacity onPress={() => submitPets()} disabled={submitting}>
          <Text>
            {submitting
              ? "Saving..."
              : `Save ${petDetails.length === 1 ? "1 pet" : `${petDetails.length} pets`}`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

export default AddPetScreen;
