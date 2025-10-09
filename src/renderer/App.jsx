import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import EmailEntryPage from "./pages/EmailEntryPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import ActivationPage from "./pages/ActivationPage";
import AdminDashboard from "./pages/AdminDashboard";
import DoctorLoginPage from "./pages/DoctorLoginPage";

export default function App() {
  const [userType, setUserType] = useState(""); // admin | doctor | activation
  const [email, setEmail] = useState("");

  return (
    <BrowserRouter>
      <Routes>
        {!userType ? (
          <Route
            path="*"
            element={<EmailEntryPage setUserType={setUserType} setEmail={setEmail} />}
          />
        ) : userType === "admin" ? (
          <Route path="*" element={<AdminLoginPage email={email} />} />
        ) : userType === "activation" ? (
          <Route path="*" element={<ActivationPage email={email} />} />
        ) : userType === "doctor" ? (
          <Route path="*" element={<DoctorLoginPage email={email} />} />
        ) : null}
      </Routes>
    </BrowserRouter>
  );
}
