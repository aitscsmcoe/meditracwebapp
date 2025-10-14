// src/renderer/pages/DoctorDashboard.jsx
import React from "react";

export default function DoctorDashboard() {
  const doctor = JSON.parse(localStorage.getItem("doctorData") || "{}");
  return (
    <div style={{ padding: 30 }}>
      <h2 style={{ color: "#1565c0" }}>
        Welcome, {doctor.doctorName || "Doctor"}
      </h2>
      <p>Email: {doctor.email}</p>
      <p>Clinic: {doctor.clinicName}</p>
      <p>Status: {doctor.status}</p>
    </div>
  );
}
