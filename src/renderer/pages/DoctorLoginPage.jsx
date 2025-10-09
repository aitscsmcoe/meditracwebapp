import React, { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { adminDb } from "../services/firebaseAdmin";

export default function DoctorLoginPage({ email }) {
  const [password, setPassword] = useState("");
  const [doctorData, setDoctorData] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();

    const q = query(
      collection(adminDb, "DoctorsRegistered"),
      where("email", "==", email)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("Doctor not found or not activated yet!");
      return;
    }

    const data = snapshot.docs[0].data();

    if (data.password === password) {
      setDoctorData(data);
    } else {
      alert("Incorrect password!");
    }
  };

  if (doctorData)
    return (
      <div style={{ padding: 40 }}>
        <h2>Welcome, Dr. {doctorData.doctorName}</h2>
        <p>Clinic: {doctorData.clinicName}</p>
        <p>Email: {doctorData.email}</p>
      </div>
    );

  return (
    <div style={container}>
      <div style={box}>
        <h2>Doctor Login</h2>
        <p>{email}</p>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <button type="submit" style={buttonStyle}>
            Login
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
