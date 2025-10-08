import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { adminDb } from "../services/firebaseAdmin";

export default function ActivationPage({ setIsActivated }) {
  const [clinicName, setClinicName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(adminDb, "ActivationRequests"), {
      clinicName,
      doctorName,
      email,
      requestDate: new Date().toISOString(),
      status: "Pending"
    });
    setSubmitted(true);
  };

  if (submitted)
    return (
      <div style={{ padding: 30 }}>
        <h2>Activation Request Sent ✅</h2>
        <p>Contact your app provider for the activation code.</p>
      </div>
    );

  return (
    <div style={{ padding: 30 }}>
      <h2>App Activation</h2>
      <form onSubmit={handleSubmit}>
        <input placeholder="Clinic Name" value={clinicName} onChange={(e) => setClinicName(e.target.value)} /><br />
        <input placeholder="Doctor Name" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} /><br />
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><br />
        <button type="submit">Get Activation Code</button>
      </form>
    </div>
  );
}
