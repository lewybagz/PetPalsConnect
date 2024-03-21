import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Function to get user profile from Firestore
async function getUserProfile() {
  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;

  if (user) {
    const userDocRef = doc(db, "users", user.uid); // Using UID as document identifier
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      return userDocSnap.data(); // Returns user profile data
    } else {
      // Handle the case where the user document doesn't exist
      console.log("No such document!");
    }
  } else {
    // Handle the case where the user is not logged in
    console.log("No user logged in!");
  }
}

// Usage in a React component
function SomeComponent() {
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    getUserProfile().then((profile) => {
      setUserProfile(profile);
    });
  }, []);

  // Now you can use `userProfile` in your component
}
