import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { addPetPhoto } from "../../services/photos";

import { useTailwind } from "../../styles/tailwind";
import { OnboardingProgress } from "../../components/ui";
import { useAuthSession } from "../../context/AuthSessionContext";
import { describeApiError } from "../../utils/authErrors";
import { BREEDS } from "../../data/breeds";

/**
 * The last step of onboarding: the user's first pet.
 *
 * Deliberately short: name, breed, age and weight - what the schema requires
 * and what matching needs - plus an optional photo. The full AddPetScreen also
 * asks for temperament and favourite activities, which sharpen matching but do
 * not need to stand between a new user and the app; the pet's own screen
 * prompts for those later.
 *
 * RootNavigator shows this whenever a profile exists with no pets, so it also
 * covers resuming after an interrupted first attempt. It is a prompt rather
 * than a wall: skipping is remembered, and screens that need a pet offer to
 * add one instead.
 */
export default function AddFirstPetScreen() {
  const tailwind = useTailwind();
  const { createPet, skipPetSetup, signOut } = useAuthSession();

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [weight, setWeight] = useState("");
  const [weightUnit, setWeightUnit] = useState("lbs");
  const [photo, setPhoto] = useState(null);
  const [breedPickerOpen, setBreedPickerOpen] = useState(false);
  const [breedQuery, setBreedQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const filteredBreeds = useMemo(() => {
    const query = breedQuery.trim().toLowerCase();
    if (!query) return BREEDS;
    return BREEDS.filter((option) => option.toLowerCase().includes(query));
  }, [breedQuery]);

  const parsedAge = Number(age);
  const ageIsValid = age !== "" && Number.isFinite(parsedAge) && parsedAge >= 0 && parsedAge < 40;

  const parsedWeight = Number(weight);
  const weightIsValid =
    weight !== "" && Number.isFinite(parsedWeight) && parsedWeight > 0 && parsedWeight < 400;

  // Stored in pounds so matching compares like with like, whichever unit the
  // owner prefers to type.
  const weightInPounds = weightUnit === "kg" ? parsedWeight * 2.20462 : parsedWeight;

  const canSubmit =
    !submitting &&
    !uploading &&
    name.trim().length > 0 &&
    breed !== "" &&
    ageIsValid &&
    weightIsValid;

  const onChoosePhoto = async () => {
    // Picking, compressing and uploading live in services/photos - this screen
    // and AddPetScreen each had their own copy, writing to different paths,
    // neither compressing, and neither with an owner in the path for the
    // Storage rules to check.
    setUploading(true);
    try {
      const result = await addPetPhoto({ fromCamera: false });

      if (result.denied) {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to add a picture of your pet."
        );
        return;
      }
      if (result.cancelled) return;

      setPhoto(result.url);
    } catch (err) {
      console.warn("[pets] Photo upload failed:", err.message);
      // A failed upload must not block onboarding - the photo is optional.
      Alert.alert(
        "Couldn't upload that photo",
        "You can add one later from your pet's profile."
      );
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await createPet({
        name: name.trim(),
        breed,
        age: parsedAge,
        weight: Math.round(weightInPounds * 10) / 10,
        photos: photo ? [photo] : [],
      });
      // No navigation: the session re-reads the profile, sees a pet, and
      // RootNavigator swaps in the app.
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onSkip = () => {
    Alert.alert(
      "Look around first?",
      "You can add a pet any time from the More tab. Matching and playdates stay locked until you do.",
      [
        { text: "Add my pet", style: "cancel" },
        { text: "Skip for now", onPress: skipPetSetup },
      ]
    );
  };

  const onSignOut = () => {
    Alert.alert(
      "Sign out?",
      "Your account stays. You can add your pet next time you open the app.",
      [
        { text: "Keep going", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: signOut },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={tailwind("flex-1 bg-white")}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={tailwind("flex-grow justify-center px-8 py-12")}
        keyboardShouldPersistTaps="handled"
      >
        <OnboardingProgress step={3} />

        <View style={tailwind("items-center mb-8")}>
          <Ionicons name="paw" size={48} color="tomato" />
          <Text style={tailwind("text-2xl font-bold text-gray-900 mt-4")}>
            Add your first pet
          </Text>
          <Text style={tailwind("text-center text-gray-600 mt-2")}>
            PetPals is built around your pet. Matching, playdates and chat all
            start here - but you can look around first if you&apos;d rather.
          </Text>
        </View>

        {error && (
          <View style={tailwind("bg-red-50 border border-red-200 rounded-lg p-3 mb-4")}>
            <Text style={tailwind("text-red-600 text-center")}>{error}</Text>
          </View>
        )}

        <Pressable onPress={onChoosePhoto} style={tailwind("items-center mb-6")}>
          <View
            style={tailwind(
              "w-24 h-24 rounded-full bg-gray-100 items-center justify-center overflow-hidden border border-gray-200"
            )}
          >
            {uploading ? (
              <ActivityIndicator />
            ) : photo ? (
              <Image source={{ uri: photo }} style={{ width: 96, height: 96 }} />
            ) : (
              <Ionicons name="camera-outline" size={28} color="#999" />
            )}
          </View>
          <Text style={tailwind("text-sm text-gray-500 mt-2")}>
            {photo ? "Change photo" : "Add a photo (optional)"}
          </Text>
        </Pressable>

        <Text style={tailwind("text-sm font-medium text-gray-700 mb-1")}>Name</Text>
        <TextInput
          style={tailwind("border border-gray-300 rounded-lg px-3 py-3 mb-4 text-base")}
          placeholder="Rex"
          placeholderTextColor="#a1a1a1"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={40}
          editable={!submitting}
        />

        <Text style={tailwind("text-sm font-medium text-gray-700 mb-1")}>Breed</Text>
        <Pressable
          onPress={() => setBreedPickerOpen(true)}
          disabled={submitting}
          style={tailwind(
            "border border-gray-300 rounded-lg px-3 py-3 mb-4 flex-row items-center justify-between"
          )}
        >
          <Text style={tailwind(breed ? "text-base text-gray-900" : "text-base text-gray-400")}>
            {breed || "Choose a breed"}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#888" />
        </Pressable>

        <Text style={tailwind("text-sm font-medium text-gray-700 mb-1")}>Age (years)</Text>
        <TextInput
          style={tailwind(
            `border rounded-lg px-3 py-3 mb-2 text-base ${
              age !== "" && !ageIsValid ? "border-red-400" : "border-gray-300"
            }`
          )}
          placeholder="3"
          placeholderTextColor="#a1a1a1"
          value={age}
          onChangeText={(value) => setAge(value.replace(/[^0-9.]/g, ""))}
          keyboardType="decimal-pad"
          maxLength={4}
          editable={!submitting}
        />
        {age !== "" && !ageIsValid && (
          <Text style={tailwind("text-xs text-red-500 mb-4")}>
            Enter an age between 0 and 40.
          </Text>
        )}

        <Text style={tailwind("text-sm font-medium text-gray-700 mb-1 mt-2")}>Weight</Text>
        <View style={tailwind("flex-row items-center mb-2")}>
          <TextInput
            style={tailwind(
              `flex-1 border rounded-lg px-3 py-3 text-base ${
                weight !== "" && !weightIsValid ? "border-red-400" : "border-gray-300"
              }`
            )}
            placeholder={weightUnit === "kg" ? "12" : "25"}
            placeholderTextColor="#a1a1a1"
            value={weight}
            onChangeText={(value) => setWeight(value.replace(/[^0-9.]/g, ""))}
            keyboardType="decimal-pad"
            maxLength={5}
            editable={!submitting}
          />
          <View style={tailwind("flex-row ml-3 border border-gray-300 rounded-lg overflow-hidden")}>
            {["lbs", "kg"].map((unit) => (
              <Pressable
                key={unit}
                onPress={() => setWeightUnit(unit)}
                disabled={submitting}
                style={tailwind(
                  `px-4 py-3 ${weightUnit === unit ? "bg-red-500" : "bg-white"}`
                )}
              >
                <Text
                  style={tailwind(
                    `font-medium ${weightUnit === unit ? "text-white" : "text-gray-600"}`
                  )}
                >
                  {unit}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {weight !== "" && !weightIsValid ? (
          <Text style={tailwind("text-xs text-red-500 mb-4")}>
            Enter a weight between 0 and 400 {weightUnit}.
          </Text>
        ) : (
          <Text style={tailwind("text-xs text-gray-500 mb-4")}>
            We use this to match your pet with others of a similar size.
          </Text>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          style={tailwind(
            `rounded-lg py-4 items-center mt-4 ${canSubmit ? "bg-red-500" : "bg-gray-300"}`
          )}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={tailwind("text-white font-semibold text-base")}>
              Finish setting up
            </Text>
          )}
        </Pressable>

        <Text style={tailwind("text-xs text-center text-gray-400 mt-4")}>
          You can add temperament and favourite activities from your pet&apos;s
          profile later - they help us find even better matches.
        </Text>

        <Pressable
          onPress={onSkip}
          disabled={submitting}
          style={tailwind("mt-5 items-center py-2")}
        >
          <Text style={tailwind("text-gray-600 font-medium")}>Skip for now</Text>
        </Pressable>

        <Pressable onPress={onSignOut} style={tailwind("mt-3 items-center")}>
          <Text style={tailwind("text-gray-400 text-sm")}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={breedPickerOpen}
        animationType="slide"
        onRequestClose={() => setBreedPickerOpen(false)}
      >
        <View style={tailwind("flex-1 bg-white pt-14 px-6")}>
          <View style={tailwind("flex-row items-center justify-between mb-4")}>
            <Text style={tailwind("text-lg font-bold text-gray-900")}>Choose a breed</Text>
            <Pressable onPress={() => setBreedPickerOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={26} color="#444" />
            </Pressable>
          </View>

          <TextInput
            style={tailwind("border border-gray-300 rounded-lg px-3 py-3 mb-3 text-base")}
            placeholder="Search breeds"
            placeholderTextColor="#a1a1a1"
            value={breedQuery}
            onChangeText={setBreedQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <FlatList
            data={filteredBreeds}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setBreed(item);
                  setBreedQuery("");
                  setBreedPickerOpen(false);
                }}
                style={tailwind("py-3 border-b border-gray-100 flex-row items-center justify-between")}
              >
                <Text style={tailwind("text-base text-gray-800")}>{item}</Text>
                {breed === item && (
                  <Ionicons name="checkmark" size={20} color="tomato" />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={tailwind("text-gray-500 text-center mt-8")}>
                No breeds match “{breedQuery}”. Choose “Other”.
              </Text>
            }
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
