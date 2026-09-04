import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../../api/axios";
import { useTailwind } from "../../styles/tailwind";
import { useToast } from "../../components/ui";
import {
  PHOTO_LIMIT,
  addPetPhoto,
  deleteStoredPhoto,
  makePrimary,
} from "../../services/photos";

/**
 * Add, reorder and remove a pet's photos.
 *
 * There was no way to do any of this. A photo could only be attached while the
 * pet was being created, so anyone who skipped that step - and the step is
 * skippable by design - had a pet with no picture, permanently, in an app
 * whose entire browse experience is photographs.
 */
const PetPhotosScreen = ({ route, navigation }) => {
  const tailwind = useTailwind();
  const toast = useToast();
  const petId = route?.params?.petId ?? route?.params?.pet?._id;

  const [pet, setPet] = useState(route?.params?.pet ?? null);
  const [photos, setPhotos] = useState(route?.params?.pet?.photos ?? []);
  const [loading, setLoading] = useState(!route?.params?.pet && Boolean(petId));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (pet || !petId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/api/pets/${petId}`);
        if (cancelled) return;
        setPet(data);
        setPhotos(data.photos ?? []);
      } catch (error) {
        if (!cancelled) {
          console.warn("[photos]", error.message);
          toast.error("Could not load this pet.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [petId, pet, toast]);

  /**
   * The server is the record. Saving after every change means closing the
   * screen mid-edit cannot lose a photo that was already uploaded and paid for.
   */
  const save = async (next) => {
    const previous = photos;
    setPhotos(next);

    try {
      await api.put(`/api/pets/${petId}`, { photos: next });
    } catch (error) {
      setPhotos(previous);
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const add = async (fromCamera) => {
    if (photos.length >= PHOTO_LIMIT) {
      // Reaching the limit is not an error and does not need a modal in the way.
      toast.show(`A pet can have up to ${PHOTO_LIMIT} photos.`);
      return;
    }

    setBusy(true);
    setProgress(0);
    try {
      const result = await addPetPhoto({ petId, fromCamera, onProgress: setProgress });

      if (result.denied) {
        toast.warning(
          fromCamera
            ? "Camera access is off. You can turn it on in Settings."
            : "Photo access is off. You can turn it on in Settings."
        );
        return;
      }
      if (result.cancelled) return;

      await save([...photos, result.url]);
    } catch (error) {
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const remove = (url) =>
    Alert.alert("Remove this photo?", undefined, [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await save(photos.filter((photo) => photo !== url));
          // Best effort, and after the record is updated: an orphaned file is
          // cheap, a photo that reappears because the delete failed is not.
          deleteStoredPhoto(url);
        },
      },
    ]);

  if (loading) {
    return (
      <View testID="photos-loading" style={tailwind("flex-1 items-center justify-center")}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView testID="pet-photos" contentContainerStyle={tailwind("p-4")}>
      <Text style={tailwind("text-xl font-bold mb-1")}>
        {pet?.name ? `${pet.name}'s photos` : "Photos"}
      </Text>
      <Text style={tailwind("text-sm text-gray-500 mb-4")}>
        The first photo is the one people see when they find {pet?.name ?? "your pet"}.
      </Text>

      {photos.length === 0 ? (
        <View
          testID="photos-empty"
          style={tailwind("items-center justify-center py-10 bg-gray-50 rounded-2xl mb-4")}
        >
          <Ionicons name="camera-outline" size={40} color="#9ca3af" />
          <Text style={tailwind("text-gray-500 mt-2")}>No photos yet</Text>
        </View>
      ) : (
        photos.map((url, index) => (
          <View
            key={url}
            testID={`photo-${index}`}
            style={tailwind("flex-row items-center bg-white border border-gray-200 rounded-2xl p-3 mb-3")}
          >
            <Image source={{ uri: url }} style={tailwind("h-20 w-20 rounded-xl")} />

            <View style={tailwind("flex-1 ml-3")}>
              {index === 0 ? (
                <Text style={tailwind("text-xs font-semibold text-blue-700 mb-1")}>
                  Main photo
                </Text>
              ) : (
                <TouchableOpacity
                  testID={`make-primary-${index}`}
                  onPress={() => save(makePrimary(photos, url))}
                >
                  <Text style={tailwind("text-blue-600 mb-1")}>Make main photo</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity testID={`remove-${index}`} onPress={() => remove(url)}>
                <Text style={tailwind("text-red-500")}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {busy ? (
        <View testID="photos-uploading" style={tailwind("items-center py-4")}>
          <ActivityIndicator />
          <Text style={tailwind("text-sm text-gray-500 mt-2")}>
            {progress > 0 ? `Uploading ${Math.round(progress * 100)}%` : "Preparing…"}
          </Text>
        </View>
      ) : (
        <View style={tailwind("flex-row mt-2")}>
          <TouchableOpacity
            testID="add-from-library"
            onPress={() => add(false)}
            style={tailwind("flex-1 bg-blue-600 rounded-xl py-3 items-center mr-2")}
          >
            <Text style={tailwind("text-white font-semibold")}>Add a photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="add-from-camera"
            onPress={() => add(true)}
            style={tailwind("flex-1 border border-gray-300 rounded-xl py-3 items-center")}
          >
            <Text style={tailwind("font-semibold")}>Take one</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        testID="photos-done"
        onPress={() => navigation.goBack()}
        style={tailwind("py-4 items-center")}
      >
        <Text style={tailwind("text-gray-500")}>Done</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default PetPhotosScreen;
