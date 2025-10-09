import React, { useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { adminDb, adminAuth } from "../services/firebaseAdmin";
import AdminDashboard from "./AdminDashboard";

export default function AdminLoginPage({ email }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [isForgot, setIsForgot] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Fetch admin doc
  const fetchAdminDoc = async () => {
    const q = query(collection(adminDb, "Admins"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, data: snap.docs[0].data() };
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1️⃣ Try Firebase Auth first
      try {
        const userCred = await signInWithEmailAndPassword(adminAuth, email, password);
        console.log("✅ Firebase Auth login success:", userCred.user.email);

        // Sync Firestore password
        const adminDoc = await fetchAdminDoc();
        if (adminDoc) {
          await updateDoc(doc(adminDb, "Admins", adminDoc.id), {
            password: password,
          });
        }

        setLoggedIn(true);
        setLoading(false);
        return;
      } catch (authErr) {
        console.warn("Firebase Auth login failed:", authErr.message);
      }

      // 2️⃣ Fallback: Check Firestore directly
      const adminDoc = await fetchAdminDoc();
      if (!adminDoc) throw new Error("Admin not found in Firestore.");

      const stored = adminDoc.data.password;
      if (stored.trim() === password.trim()) {
        console.log("✅ Firestore password match");
        setLoggedIn(true);
      } else {
        setError("Incorrect password!");
      }
    } catch (err) {
      console.error("Error in login flow:", err);
      setError("Login failed. Check console for details.");
    }

    setLoading(false);
  };

  const handleSendResetEmail = async () => {
    setResetLoading(true);
    setError("");

    try {
      // Check if admin user exists in Auth
      const methods = await fetchSignInMethodsForEmail(adminAuth, email);
      if (methods.length === 0) {
        console.log("No Auth user found, creating one...");
        const tmpPass = "Tmp@" + Math.floor(100000 + Math.random() * 900000);
        await createUserWithEmailAndPassword(adminAuth, email, tmpPass);
        await signOut(adminAuth);
      }

      await sendPasswordResetEmail(adminAuth, email);
      alert(`✅ Password reset link sent to ${email}. Check Inbox or Spam.`);
      setIsForgot(false);
    } catch (err) {
      console.error("Error sending reset email:", err);
      setError("Failed to send reset email. See console for details.");
    }

    setResetLoading(false);
  };

  if (loggedIn) return <AdminDashboard />;

  return (
    <div style={container}>
      <div style={box}>
        <h2>Admin Login</h2>
        <p style={{ color: "#555" }}>{email}</p>

        {!isForgot ? (
          <>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              <button type="submit" style={buttonStyle} disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>

            <p
              style={linkStyle}
              onClick={() => setIsForgot(true)}
            >
              Forgot Password?
            </p>

            {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
          </>
        ) : (
          <>
            <h3>Reset Password</h3>
            <p style={{ fontSize: 13, color: "#555" }}>
              A password reset link will be sent to <strong>{email}</strong>.
            </p>

            <button
              style={buttonStyle}
              onClick={handleSendResetEmail}
              disabled={resetLoading}
            >
              {resetLoading ? "Sending..." : "Send Reset Email"}
            </button>

            <p
              style={linkStyle}
              onClick={() => setIsForgot(false)}
            >
              Back to Login
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const container = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  background: "#f3f6f9",
  fontFamily: "Segoe UI, sans-serif",
};
const box = {
  background: "white",
  padding: 30,
  borderRadius: 10,
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  textAlign: "center",
  width: 420,
};
const inputStyle = {
  width: "100%",
  padding: 10,
  marginBottom: 12,
  borderRadius: 8,
  border: "1px solid #ccc",
};
const buttonStyle = {
  width: "100%",
  padding: 12,
  background: "#1565c0",
  color: "white",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: "1rem",
};
const linkStyle = {
  color: "#1565c0",
  cursor: "pointer",
  textDecoration: "underline",
  marginTop: 10,
};
