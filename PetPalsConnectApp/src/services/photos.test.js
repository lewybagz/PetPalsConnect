import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import storage from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";

import {
  PHOTO_LIMIT,
  addPetPhoto,
  addProfilePhoto,
  compressPhoto,
  deleteStoredPhoto,
  isStoredPhoto,
  makePrimary,
  petPhotoPath,
  profilePhotoPath,
} from "./photos";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: "jpeg" },
}));

// jest.setup mocks this module globally with a plain function; this file needs
// to vary who is signed in, so it needs a jest.fn.
jest.mock("@react-native-firebase/auth", () => ({ getAuth: jest.fn() }));

/**
 * The one place a photo gets picked, shrunk and uploaded.
 *
 * This logic lived twice, inline, in the two add-a-pet screens - with two
 * different storage paths, neither compressing, and neither with an owner in
 * the path for the Storage rules to check.
 */

const putFile = jest.fn();
const getDownloadURL = jest.fn();
const deleteFile = jest.fn();
let lastRefPath = null;

jest.mock("@react-native-firebase/storage", () => {
  const ref = jest.fn();
  const storageFn = jest.fn(() => ({ ref, refFromURL: jest.fn() }));
  storageFn.__ref = ref;
  return { __esModule: true, default: storageFn };
});

beforeEach(() => {
  jest.clearAllMocks();
  lastRefPath = null;

  putFile.mockReturnValue(Promise.resolve());
  getDownloadURL.mockResolvedValue(
    "https://firebasestorage.googleapis.com/v0/b/petpals/o/x.jpg?alt=media"
  );

  storage.__ref.mockImplementation((path) => {
    lastRefPath = path;
    return { putFile, getDownloadURL, delete: deleteFile };
  });
  storage.mockReturnValue({
    ref: storage.__ref,
    refFromURL: jest.fn(() => ({ delete: deleteFile })),
  });

  getAuth.mockReturnValue({ currentUser: { uid: "firebase-uid" } });

  ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///tmp/original.jpg" }],
  });
  ImagePicker.launchCameraAsync.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///tmp/camera.jpg" }],
  });
  ImageManipulator.manipulateAsync.mockResolvedValue({ uri: "file:///tmp/small.jpg" });
});

describe("storage paths", () => {
  it("puts the uploader's uid at the front", () => {
    // `uploads/<the device's filename>` had no owner in it, so two people
    // photographing IMG_0042.jpg overwrote each other and no rule could tell
    // whose file was whose.
    expect(petPhotoPath("uid-1", "pet-1")).toMatch(/^pets\/uid-1\/pet-1\//);
    expect(profilePhotoPath("uid-1")).toMatch(/^profiles\/uid-1\//);
  });

  it("does not collide for the same pet twice", () => {
    expect(petPhotoPath("uid-1", "pet-1")).not.toBe(petPhotoPath("uid-1", "pet-1"));
  });

  it("has somewhere to put a photo taken before the pet exists", () => {
    expect(petPhotoPath("uid-1", undefined)).toMatch(/^pets\/uid-1\/unassigned\//);
  });
});

describe("compression", () => {
  it("resizes and re-encodes before uploading", async () => {
    const uri = await compressPhoto("file:///tmp/original.jpg");

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      "file:///tmp/original.jpg",
      [{ resize: { width: 1280 } }],
      expect.objectContaining({ compress: 0.7 })
    );
    expect(uri).toBe("file:///tmp/small.jpg");
  });

  it("uploads the original rather than nothing if compression fails", async () => {
    ImageManipulator.manipulateAsync.mockRejectedValue(new Error("out of memory"));

    // A photo that is merely large beats no photo, and somebody is waiting.
    expect(await compressPhoto("file:///tmp/original.jpg")).toBe(
      "file:///tmp/original.jpg"
    );
  });
});

describe("adding a pet photo", () => {
  it("compresses, uploads under the owner's path, and returns the URL", async () => {
    const result = await addPetPhoto({ petId: "pet-1" });

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalled();
    expect(lastRefPath).toMatch(/^pets\/firebase-uid\/pet-1\//);
    expect(result.url).toContain("firebasestorage.googleapis.com");
  });

  it("reports a refused permission rather than failing silently", async () => {
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });

    const result = await addPetPhoto({ petId: "pet-1" });

    expect(result).toEqual({ cancelled: true, denied: true });
    expect(putFile).not.toHaveBeenCalled();
  });

  it("does nothing when the picker is dismissed", async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });

    const result = await addPetPhoto({ petId: "pet-1" });

    expect(result.cancelled).toBe(true);
    expect(result.denied).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it("uses the camera when asked", async () => {
    await addPetPhoto({ petId: "pet-1", fromCamera: true });

    expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("refuses to upload when nobody is signed in", async () => {
    getAuth.mockReturnValue({ currentUser: null });

    await expect(addPetPhoto({ petId: "pet-1" })).rejects.toThrow(/signed in/);
  });
});

describe("profile photos", () => {
  it("goes under profiles/<uid>", async () => {
    await addProfilePhoto();
    expect(lastRefPath).toMatch(/^profiles\/firebase-uid\//);
  });
});

describe("removing", () => {
  it("only tries to delete files we stored", async () => {
    expect(await deleteStoredPhoto("https://example.com/cat.jpg")).toBe(false);
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("swallows a failed delete", async () => {
    deleteFile.mockRejectedValue(new Error("not found"));

    // An orphaned file costs a fraction of a penny; an error dialog for a
    // photo the user already removed costs more.
    expect(
      await deleteStoredPhoto("https://firebasestorage.googleapis.com/v0/b/p/o/x.jpg")
    ).toBe(false);
  });
});

describe("recognising our own URLs", () => {
  it("accepts Firebase storage hosts and nothing else", () => {
    expect(isStoredPhoto("https://firebasestorage.googleapis.com/v0/b/p/o/x.jpg")).toBe(true);
    expect(isStoredPhoto("https://example.com/x.jpg")).toBe(false);
    expect(isStoredPhoto("not a url")).toBe(false);
    expect(isStoredPhoto(null)).toBe(false);
  });
});

describe("ordering", () => {
  it("moves a photo to the front without losing the others", () => {
    const photos = ["a", "b", "c"];
    expect(makePrimary(photos, "c")).toEqual(["c", "a", "b"]);
  });

  it("leaves the list alone when the photo is not in it", () => {
    expect(makePrimary(["a", "b"], "z")).toEqual(["a", "b"]);
    expect(makePrimary(undefined, "z")).toEqual([]);
  });
});

describe("the limit", () => {
  it("matches the one the server enforces", () => {
    // backend/services/photos.js caps at the same number.
    expect(PHOTO_LIMIT).toBe(6);
  });
});
