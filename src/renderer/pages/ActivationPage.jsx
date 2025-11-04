// src/renderer/pages/ActivationPage.jsx
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { adminDb } from "../services/firebaseAdmin";

export default function ActivationPage({ setUserType }) {
  const [clinicName, setClinicName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [degree, setDegree] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (email.trim().toLowerCase() === "aitscsmcoe@gmail.com") {
      setUserType("admin");
      return;
    }

    try {
      await addDoc(collection(adminDb, "ActivationRequests"), {
        clinicName,
        doctorName,
        email,
        mobile,
        degree,
        specialization,
        requestDate: serverTimestamp(),
        status: "Pending",
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Error adding activation request:", error);
      alert("Error sending activation request.");
    }
  };

  if (submitted)
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "Segoe UI, sans-serif" }}>
        <h2>✅ Activation Request Sent</h2>
        <p>
          Thank you, Dr. {doctorName}. Your request has been received.
          <br />
          Contact your app provider for your activation code.
        </p>
      </div>
    );

  return (
    <div style={outer}>
      <div style={card}>
        <h2>MediTrac Activation</h2>
        <form onSubmit={handleSubmit}>
          <input placeholder="Clinic Name" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required style={inputStyle} />
          <input placeholder="Doctor Name" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} required style={inputStyle} />
          <input placeholder="Degree (MBBS, MD...)" value={degree} onChange={(e) => setDegree(e.target.value)} required style={inputStyle} />
          <input placeholder="Specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} required style={inputStyle} />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          <input placeholder="Mobile Number" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} required style={inputStyle} />
          <button type="submit" style={buttonStyle}>Get Activation Code</button>
        </form>
      </div>
    </div>
  );
}

const outer = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "Segoe UI, sans-serif", background: "#f3f6f9" };
const card = { background: "white", padding: 30, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.1)", width: 400, textAlign: "center" };
const inputStyle = { width: "100%", marginBottom: 12, padding: 10, borderRadius: 8, border: "1px solid #ccc" };
const buttonStyle = { width: "100%", padding: 12, background: "#1565c0", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: "1rem" };
