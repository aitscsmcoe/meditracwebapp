// src/renderer/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { adminDb, adminAuth } from "../services/firebaseAdmin";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const snapshot = await getDocs(collection(adminDb, "DoctorsRegistered"));
        const docs = snapshot.docs.map((doc, index) => ({
          id: doc.id,
          sn: index + 1,
          ...doc.data(),
        }));
        setDoctors(docs);
      } catch (error) {
        console.error("Error fetching doctors:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(adminAuth);
      localStorage.clear();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Error while logging out.");
    }
  };

  return (
    <div style={outer}>
      <div style={header}>
        <h2>MediTrac Admin Dashboard</h2>
        <button onClick={handleLogout} style={logoutBtn}>
          Logout
        </button>
      </div>

      {loading ? (
        <p>Loading doctor records...</p>
      ) : (
        <table style={table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Doctor Name</th>
              <th>Clinic Name</th>
              <th>Email</th>
              <th>Mobile</th>
              <th>Status</th>
              <th>Activation</th>
              <th>Expected Renewal</th>
              <th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.sn}</td>
                <td>{doc.doctorName}</td>
                <td>{doc.clinicName}</td>
                <td>{doc.email}</td>
                <td>{doc.mobile}</td>
                <td>{doc.status}</td>
                <td>{doc.activationDate || "-"}</td>
                <td>{doc.expectedRenewalDate || "-"}</td>
                <td>{doc.registrationDate || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Styles ----------
const outer = {
  padding: "30px",
  fontFamily: "Segoe UI, sans-serif",
  background: "#f4f7fc",
  minHeight: "100vh",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
  background: "#1565c0",
  color: "white",
  padding: "10px 20px",
  borderRadius: 8,
};

const logoutBtn = {
  background: "#ef5350",
  color: "white",
  border: "none",
  padding: "6px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  background: "white",
  borderRadius: 8,
  boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
};

const thtd = {
  padding: 10,
  textAlign: "left",
  borderBottom: "1px solid #ddd",
};
