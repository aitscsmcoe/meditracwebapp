// src/renderer/pages/DoctorActivationPage.jsx
import React from "react";

export default function DoctorActivationPage() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "Segoe UI, sans-serif",
        background: "linear-gradient(120deg, #64b5f6, #bbdefb)",
      }}
    >
      <div
        style={{
          background: "white",
          padding: 30,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          textAlign: "center",
        }}
      >
        <h2 style={{ color: "#1565c0", marginBottom: 10 }}>
          Doctor Activation Page
        </h2>
        <p style={{ color: "#555", fontSize: 15 }}>
          This section will allow doctors to register and link their Firestore account.
        </p>
        <p style={{ fontSize: 13, color: "#777", marginTop: 20 }}>
          (Placeholder page — functionality will be added next.)
        </p>
      </div>
    </div>
  );
}
