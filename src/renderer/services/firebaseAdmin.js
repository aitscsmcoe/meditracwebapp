import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyBoqRC58GOarQ1v3FSxlPT0wHlDseTxXno",
  authDomain: "meditrack-admin-69386.firebaseapp.com",
  projectId: "meditrack-admin-69386",
  storageBucket: "meditrack-admin-69386.firebasestorage.app",
  messagingSenderId: "189030134159",
  appId: "1:189030134159:web:e3917f936ba2475e9b1bfa",
  measurementId: "G-1Z7HGR774G"
};
const app = initializeApp(firebaseConfig);
export const adminDb = getFirestore(app);
