// src/renderer/services/firebaseAdmin.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

// ✅ Your Firebase Project Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBoqRC58GOarQ1v3FSxlPT0wHlDseTxXno",
  authDomain: "meditrack-admin-69386.firebaseapp.com",
  projectId: "meditrack-admin-69386",
  storageBucket: "meditrack-admin-69386.firebasestorage.app",
  messagingSenderId: "189030134159",
  appId: "1:189030134159:web:e3917f936ba2475e9b1bfa",
  measurementId: "G-1Z7HGR774G",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Admin references
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);

// ✅ Optional unified export aliases for compatibility
export const db = adminDb;
export const auth = adminAuth;

// ✅ Helper exports for auth operations
export {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
};
