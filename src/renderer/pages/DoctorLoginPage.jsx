// src/renderer/pages/DoctorLoginPage.jsx
import React, { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { adminAuth, adminDb } from "../services/firebaseAdmin";
import { useNavigate } from "react-router-dom";

export default function DoctorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isNewDoctor, setIsNewDoctor] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // check doctor existence in Firestore
  const checkDoctor = async (emailValue) => {
    if (!emailValue || !emailValue.includes("@")) return;
    try {
      const ref = doc(adminDb, "DoctorsRegistered", emailValue);
      const snap = await getDoc(ref);
      setIsNewDoctor(!snap.exists());
    } catch (err) {
      console.error("Error checking doctor:", err);
    }
  };

  useEffect(() => {
    if (email) checkDoctor(email);
  }, [email]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword) return setMessage("Fill all fields.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(adminAuth, email, password);

      // create doctor record with minimal fields AND registrationDate as Timestamp
      await setDoc(doc(adminDb, "DoctorsRegistered", email), {
        email,
        status: "Registered",
        registrationDate: Timestamp.fromDate(new Date()),
        createdAt: serverTimestamp(),
      });

      setMessage("Account created. Please complete profile and request activation.");
      // go to profile setup so doctor fills remaining data
      navigate("/doctor-setup");
    } catch (error) {
      console.error("Registration error:", error);
      if (error.code === "auth/email-already-in-use") {
        setMessage("Email already registered. Please login.");
        setIsNewDoctor(false);
      } else {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setMessage("Enter both fields.");

    setLoading(true);
    try {
      await signInWithEmailAndPassword(adminAuth, email, password);

      // read doctor record and decide route based on status
      const ref = doc(adminDb, "DoctorsRegistered", email);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        const status = data.status || "Registered";
        if (status === "Active") {
          navigate("/doctor-dashboard");
        } else if (status === "Requested") {
          setMessage("Your activation request is pending for approval, whatsapp only -8830680737");
          // keep doctor on login/profile page or route to a read-only profile page; we'll keep here
        } else {
          // Registered or other: redirect to profile setup to complete details
          navigate("/doctor-setup");
        }
      } else {
        // If doctor record missing, create minimal and send to setup
        await setDoc(ref, {
          email,
          status: "Registered",
          registrationDate: Timestamp.fromDate(new Date()),
          createdAt: serverTimestamp(),
        });
        navigate("/doctor-setup");
      }
    } catch (error) {
      console.error("Login error:", error);
      if (error.code === "auth/user-not-found") {
        setIsNewDoctor(true);
        setMessage("No account found. Please register.");
      } else if (error.code === "auth/wrong-password") {
        setMessage("Incorrect password.");
      } else {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) return setMessage("Enter email first.");
    try {
      await sendPasswordResetEmail(adminAuth, email);
      setMessage("Password reset link sent.");
    } catch (err) {
      console.error("Reset error:", err);
      setMessage("Failed to send reset link. See console.");
    }
  };

  return (
    <div style={outer}>
      <div style={card}>
        <h2 style={{ color: "#1976d2" }}>{isNewDoctor ? "Doctor Registration" : "Doctor Login"}</h2>

        <input
          type="email"
          placeholder="Enter Doctor Email"
          value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          style={input}
        />

        <form onSubmit={isNewDoctor ? handleRegister : handleLogin}>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...input, paddingRight: 35 }}
            />
            <span onClick={() => setShowPassword(!showPassword)} style={eyeIcon}>
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>

          {isNewDoctor && (
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={input}
            />
          )}

          <button type="submit" style={btn} disabled={loading}>
            {loading ? "Please wait..." : isNewDoctor ? "Register" : "Login"}
          </button>
        </form>

        {!isNewDoctor && (
          <p style={{ color: "#1565c0", cursor: "pointer", marginTop: 10 }} onClick={handlePasswordReset}>
            Forgot Password?
          </p>
        )}

        {message && <p style={{ marginTop: 10 }}>{message}</p>}
      </div>
    </div>
  );
}

/* styles kept same as earlier */
const outer = { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "linear-gradient(120deg,#64b5f6,#bbdefb)", fontFamily: "Segoe UI, sans-serif" };
const card = { background: "white", padding: 30, borderRadius: 12, boxShadow: "0 4px 10px rgba(0,0,0,0.1)", width: 360, textAlign: "center" };
const input = { width: "100%", padding: 10, margin: "8px 0", borderRadius: 6, border: "1px solid #ccc", fontSize: 15 };
const btn = { width: "100%", background: "#1976d2", color: "white", border: "none", padding: 10, borderRadius: 6, cursor: "pointer", fontSize: 15 };
const eyeIcon = { position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#666", fontSize: 14, userSelect: "none" };
