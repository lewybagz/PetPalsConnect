// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAUMPI7W4QqmEJ-S245e4ie7pZx7JBF-0I",
  authDomain: "petpalsconnectmf.firebaseapp.com",
  projectId: "petpalsconnectmf",
  storageBucket: "petpalsconnectmf.appspot.com",
  messagingSenderId: "580748091504",
  appId: "1:580748091504:web:428d6e86afc3438a3554b5",
  measurementId: "G-EKD3L8HWVX",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, firestore, storage };
