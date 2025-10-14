// src/renderer/pages/EmailEntryPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function EmailEntryPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleContinue = async (e) => {
    e.preventDefault();
    if (!email) {
      setMessage("Please enter your email.");
      return;
    }

    setMessage("Checking...");

    try {
      const adminEmail = "aitscsmcoe@gmail.com";

      if (email.trim().toLowerCase() === adminEmail.toLowerCase()) {
        setMessage("Redirecting to admin login...");
        setTimeout(() => navigate("/admin-login"), 1000);
        return;
      }

      // For any other email, assume doctor flow
      setMessage("Redirecting to doctor login...");
      setTimeout(() => navigate("/doctor-login"), 1000);
    } catch (err) {
      console.error(err);
      setMessage("Error verifying email. Try again.");
    }
  };

  return (
    <div style={outer}>
      <div style={card}>
        <h2 style={{ color: "#1565c0", marginBottom: 12 }}>Welcome to MediTrac</h2>
        <p style={{ marginBottom: 20, color: "#444" }}>
          Please enter your email ID to continue.
        </p>

        <form onSubmit={handleContinue}>
          <input
            type="email"
            placeholder="Enter your email ID"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={input}
          />
          <button type="submit" style={btn}>
            Continue
          </button>
        </form>

        {message && <p style={{ marginTop: 15, color: "#555" }}>{message}</p>}
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
