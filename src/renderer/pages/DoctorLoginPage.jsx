// src/renderer/pages/DoctorLoginPage.jsx
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { adminAuth, adminDb } from "../services/firebaseAdmin";

export default function DoctorLoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("Checking credentials...");
    setLoading(true);

    try {
      const userCred = await signInWithEmailAndPassword(adminAuth, email, password);
      console.log("✅ Doctor Auth success:", userCred.user.email);

      // Check doctor's status in Firestore
      const q = query(collection(adminDb, "DoctorsRegistered"), where("email", "==", email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setMessage("❌ No registration found for this email.");
        return;
      }

      const docData = snapshot.docs[0].data();
      const status = docData.status || "Pending";

      switch (status) {
        case "Active":
          setMessage("✅ Login successful. Redirecting...");
          setTimeout(() => onLoginSuccess(email, docData), 1000);
          break;
        case "Pending":
          setMessage("⏳ Your registration is pending admin approval.");
          break;
        case "Expired":
          setMessage("⚠️ Your activation has expired. Please contact admin.");
          break;
        case "Removed":
          setMessage("🚫 Your account has been removed by admin.");
          break;
        default:
          setMessage("❌ Invalid account state. Contact admin.");
      }
    } catch (err) {
      console.error("Login failed:", err);
      setMessage("❌ Login failed. Check email/password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={outer}>
      <div style={card}>
        <h2 style={{ color: "#1565c0", marginBottom: 12 }}>Doctor Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Doctor email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />

          {/* Password Input with Eye Icon */}
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...input, paddingRight: 35 }}
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              style={eyeIcon}
              title={showPassword ? "Hide Password" : "Show Password"}
            >
              {showPassword ? "🙈" : "👁️"}
            </span>
          </div>

          <button type="submit" style={btn} disabled={loading}>
            {loading ? "Please wait..." : "Login"}
          </button>
        </form>
        <p style={{ marginTop: 10, color: "#444" }}>{message}</p>
      </div>
    </div>
  );
}

// ---------- Styles ----------
const outer = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  background: "linear-gradient(120deg, #42a5f5, #90caf9)",
  fontFamily: "Segoe UI, sans-serif",
};

const card = {
  background: "white",
  padding: 30,
  borderRadius: 12,
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  width: 340,
  textAlign: "center",
};

const input = {
  width: "100%",
  padding: 10,
  margin: "8px 0",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 15,
};

const btn = {
  width: "100%",
  background: "#1565c0",
  color: "white",
  border: "none",
  padding: 10,
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 15,
};

const eyeIcon = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  cursor: "pointer",
  color: "#666",
  fontSize: 14,
  userSelect: "none",
};
