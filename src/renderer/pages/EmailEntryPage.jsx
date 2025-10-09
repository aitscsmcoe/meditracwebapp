import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { adminDb } from "../services/firebaseAdmin";

export default function EmailEntryPage({ setUserType, setEmail }) {
  const [inputEmail, setInputEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async (e) => {
    e.preventDefault();
    setLoading(true);

    const email = inputEmail.trim().toLowerCase();
    setEmail(email);

    if (email === "aitscsmcoe@gmail.com") {
      setUserType("admin");
      setLoading(false);
      return;
    }

    try {
      // Check if doctor already registered
      const q = query(
        collection(adminDb, "DoctorsRegistered"),
        where("email", "==", email)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setUserType("activation"); // new doctor → activation flow
      } else {
        setUserType("doctor"); // existing doctor → login flow
      }
    } catch (err) {
      console.error("Error checking email:", err);
      alert("Error checking email.");
    }

    setLoading(false);
  };

  return (
    <div style={container}>
      <div style={box}>
        <h2>MediTrac</h2>
        <p style={{ color: "#555" }}>Enter your registered email address</p>
        <form onSubmit={handleContinue}>
          <input
            type="email"
            placeholder="Email ID"
            value={inputEmail}
            onChange={(e) => setInputEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? "Checking..." : "Continue"}
          </button>
        </form>
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
  width: 350,
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
