import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import storage from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";

/**
 * Everything to do with getting a photo onto a pet.
 *
 * This lived twice, inline, in the two add-a-pet screens, with two different
 * ideas of where files go: one wrote `uploads/<the device's filename>` - a
 * flat namespace with no owner in the path, so two people photographing
 * `IMG_0042.jpg` overwrote each other and no Storage rule could tell whose
 * file was whose - and the other wrote `pets/<userId>-<timestamp>.jpg`.
 *
 * Neither compressed. A photo off a modern phone is 3-8MB, and this is an app
 * whose entire browse experience is photographs: uploading raw is slow on the
 * good connection and impossible on the bad one, and every byte is billed
 * twice, once to store and once to serve.
 */

/** A pet is a pet, not a photo album. Six is plenty and bounds the cost. */
export const PHOTO_LIMIT = 6;

/**
 * Longest edge, in pixels. A pet card is a phone-width image; 1280 still looks
 * sharp on a 3x screen and is roughly a tenth of the original's size.
 */
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.7;

/** Firebase's own host. A photo URL that is not from here did not come from us. */
const STORAGE_HOSTS = ["firebasestorage.googleapis.com", "storage.googleapis.com"];

/** True when a stored value looks like one of our uploads. */
export const isStoredPhoto = (url) => {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    return STORAGE_HOSTS.includes(new URL(url).host);
  } catch {
    return false;
  }
};

/**
 * Where a file lives. Every path starts with the uploader's Firebase uid so
 * `storage.rules` can check ownership - which a flat `uploads/` namespace made
 * impossible.
 */
export const petPhotoPath = (uid, petId) =>
  `pets/${uid}/${petId ?? "unassigned"}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.jpg`;

export const profilePhotoPath = (uid) =>
  `profiles/${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

/** Asks for the right permission and opens the library or the camera. */
export const pickPhoto = async ({ fromCamera = false } = {}) => {
  const permission = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return { cancelled: true, denied: true };
  }

  const options = {
    mediaTypes: ["images"],
    allowsEditing: true,
    // Pet cards are square, so cropping here beats cropping at render time.
    aspect: [1, 1],
    quality: 1,
  };

  const result = fromCamera
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.[0]) {
    return { cancelled: true, denied: false };
  }

  return { cancelled: false, asset: result.assets[0] };
};

/**
 * Resizes and re-encodes before anything touches the network.
 *
 * Falls back to the original on failure: a photo that is merely large is much
 * better than no photo, and this runs while somebody is waiting.
 */
export const compressPhoto = async (uri) => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_DIMENSION } }],
      { compress: JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    console.warn("[photos] Could not compress, uploading as-is:", error.message);
    return uri;
  }
};

/** iOS hands back a file:// URI that the native uploader will not take. */
const localPath = (uri) =>
  Platform.OS === "ios" ? uri.replace("file://", "") : uri;

/**
 * Uploads one already-compressed file and resolves with its download URL.
 * `onProgress` receives 0-1 so a caller can show something moving.
 */
const uploadTo = async (path, uri, onProgress) => {
  const reference = storage().ref(path);
  const task = reference.putFile(localPath(uri), { contentType: "image/jpeg" });

  if (onProgress) {
    task.on("state_changed", (snapshot) => {
      if (snapshot.totalBytes > 0) {
        onProgress(snapshot.bytesTransferred / snapshot.totalBytes);
      }
    });
  }

  await task;
  return reference.getDownloadURL();
};

const currentUid = () => getAuth().currentUser?.uid ?? null;

/**
 * Picks, compresses and uploads a photo for a pet.
 * Resolves with `{ url }`, or `{ cancelled: true }` if the user backed out.
 */
export const addPetPhoto = async ({ petId, fromCamera = false, onProgress } = {}) => {
  const uid = currentUid();
  if (!uid) throw new Error("You need to be signed in to add a photo");

  const picked = await pickPhoto({ fromCamera });
  if (picked.cancelled) return picked;

  const compressed = await compressPhoto(picked.asset.uri);
  const url = await uploadTo(petPhotoPath(uid, petId), compressed, onProgress);

  return { cancelled: false, url };
};

/** The same, for the signed-in person's own profile photo. */
export const addProfilePhoto = async ({ fromCamera = false, onProgress } = {}) => {
  const uid = currentUid();
  if (!uid) throw new Error("You need to be signed in to add a photo");

  const picked = await pickPhoto({ fromCamera });
  if (picked.cancelled) return picked;

  const compressed = await compressPhoto(picked.asset.uri);
  const url = await uploadTo(profilePhotoPath(uid), compressed, onProgress);

  return { cancelled: false, url };
};

/**
 * Removes a file we uploaded, best effort.
 *
 * A photo the user has already removed from their pet should not come back as
 * an error dialog because the delete failed; the orphan costs a fraction of a
 * penny and a lifecycle rule can sweep it.
 */
export const deleteStoredPhoto = async (url) => {
  if (!isStoredPhoto(url)) return false;

  try {
    await storage().refFromURL(url).delete();
    return true;
  } catch (error) {
    console.warn("[photos] Could not delete:", error.message);
    return false;
  }
};

/** Moves a photo to the front, which is the one every card and list shows. */
export const makePrimary = (photos, url) => {
  if (!Array.isArray(photos) || !photos.includes(url)) return photos ?? [];
  return [url, ...photos.filter((photo) => photo !== url)];
};
