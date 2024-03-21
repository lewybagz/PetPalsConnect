// firebaseStorageSetup.js
import storage from "@react-native-firebase/storage";

// Function to upload file
async function uploadFile(pathToFile, fileName) {
  const reference = storage().ref(fileName);
  const task = reference.putFile(pathToFile);

  task.on("state_changed", (taskSnapshot) => {
    console.log(
      `${taskSnapshot.bytesTransferred} transferred out of ${taskSnapshot.totalBytes}`
    );
  });

  try {
    await task;
    const url = await reference.getDownloadURL();
    console.log("File uploaded!", url);
    return url; // Return the URL of the uploaded file
  } catch (error) {
    console.log("Error uploading file:", error);
  }
}

// Function to download file
async function getFileUrl(fileName) {
  const url = await storage().ref(fileName).getDownloadURL();
  console.log("File URL:", url);
  return url;
}

export { uploadFile, getFileUrl };
