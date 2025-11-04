// src/renderer/pages/AdminLoginPage.jsx
import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { adminAuth } from "../services/firebaseAdmin";
import { useNavigate } from "react-router-dom";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("aitscsmcoe@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const navigate = useNavigate();

  // ✅ Admin Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setMessage("Authenticating...");

    try {
      const cred = await signInWithEmailAndPassword(adminAuth, email, password);
      console.log("✅ Firebase Auth login success:", cred.user.email);

      if (cred.user.email === "aitscsmcoe@gmail.com") {
        setMessage("✅ Login successful. Redirecting...");
        setTimeout(() => navigate("/admin-dashboard"), 800);
      } else {
        setMessage("🚫 You are not authorized as admin.");
      }
    } catch (error) {
      console.error("Firebase Auth login failed:", error);
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password"
      ) {
        setMessage("❌ Invalid email or password.");
      } else if (error.code === "auth/user-not-found") {
        setMessage("❌ No admin account found with this email.");
      } else {
        setMessage(`❌ ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ Password Reset Handler
  const handleSendReset = async () => {
    if (!email) {
      setMessage("Please enter your email to reset password.");
      return;
    }

    try {
      await sendPasswordResetEmail(adminAuth, email);
      setMessage("📩 Password reset link sent to your email.");
      setIsResetMode(false);
    } catch (error) {
      console.error("Password reset failed:", error);
      setMessage("❌ Failed to send reset email. Check email or try again.");
    }
  };

  // ✅ Logout Handler
  const handleLogout = async () => {
  try {
    await signOut(adminAuth); // or use doctorAuth if you have separate
    localStorage.clear();
    sessionStorage.clear();

    // For Electron reload
    if (window?.location) {
      window.location.replace("/"); // redirect to email entry page
      setTimeout(() => {
        window.location.reload(); // hard reload after short delay
      }, 100);
    }
  } catch (err) {
    console.error("Logout failed:", err);
    alert("Error while logging out. Please restart the app manually.");
  }
};


  return (
    <div style={outer}>
      <div style={card}>
        <h2 style={{ color: "#1565c0" }}>Admin Login</h2>

        {/* Reset Password Mode */}
        {isResetMode ? (
          <>
            <p style={{ fontSize: 14, color: "#555" }}>
              Enter your admin email to receive a reset link.
            </p>
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              required
            />
            <button onClick={handleSendReset} style={btn}>
              Send Reset Link
            </button>
            <button
              onClick={() => setIsResetMode(false)}
              style={{ ...btn, background: "#90a4ae", marginTop: 8 }}
            >
              Back to Login
            </button>
          </>
        ) : (
          // Login Form
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              required
            />

            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...input, paddingRight: 35 }}
                required
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                style={eyeIcon}
                title={showPassword ? "Hide Password" : "Show Password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </span>
            </div>

            <button type="submit" disabled={loading} style={btn}>
              {loading ? "Please wait..." : "Login"}
            </button>

            <button
              type="button"
              onClick={() => setIsResetMode(true)}
              style={{
                width: "100%",
                marginTop: 10,
                color: "#1565c0",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Forgot Password?
            </button>
          </form>
        )}

        {message && (
          <p style={{ marginTop: 12, color: "#444", fontSize: 14 }}>{message}</p>
        )}

        <hr style={{ margin: "20px 0" }} />
        <button onClick={handleLogout} style={logoutBtn}>
          Logout
        </button>
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

const logoutBtn = {
  width: "100%",
  background: "#ef5350",
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
