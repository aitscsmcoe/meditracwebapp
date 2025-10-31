// src/renderer/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import EmailEntryPage from "./pages/EmailEntryPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import DoctorLoginPage from "./pages/DoctorLoginPage";
import DoctorDashboard from "./pages/DoctorDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import DoctorActivationPage from "./pages/DoctorActivationPage"; // (placeholder for now)
import DoctorProfileSetup from "./pages/DoctorProfileSetup"; // new - doctor completes profile & requests activation

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<EmailEntryPage />} />

        {/* Admin routes */}
        <Route path="/admin-login" element={<AdminLoginPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />

        {/* Doctor routes */}
        <Route path="/doctor-login" element={<DoctorLoginPageWrapper />} />
        <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
        <Route path="/doctor-activation" element={<DoctorActivationPage />} />

        {/* New: doctor profile setup (complete profile + request activation) */}
        <Route path="/doctor-setup" element={<DoctorProfileSetup />} />
      </Routes>
    </Router>
  );
}

/**
 * Wrapper so we can pass navigation + success handler easily
 * (left unchanged so it continues to work with your existing DoctorLoginPage)
 */
function DoctorLoginPageWrapper() {
  const navigate = useNavigate();
  return (
    <DoctorLoginPage
      onLoginSuccess={(email, data) => {
        localStorage.setItem("doctorEmail", email);
        localStorage.setItem("doctorData", JSON.stringify(data));
        navigate("/doctor-dashboard");
      }}
    />
  );
}
