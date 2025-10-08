import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ActivationPage from "./pages/ActivationPage";
import DoctorRegisterPage from "./pages/DoctorRegisterPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  const [isActivated, setIsActivated] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        {!isActivated ? (
          <Route path="*" element={<ActivationPage setIsActivated={setIsActivated} />} />
        ) : (
          <>
            <Route path="/register" element={<DoctorRegisterPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
