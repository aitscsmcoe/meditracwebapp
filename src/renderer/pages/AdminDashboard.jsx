// src/renderer/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { adminDb, adminAuth } from "../services/firebaseAdmin";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const snapshot = await getDocs(collection(adminDb, "DoctorsRegistered"));
        const docs = snapshot.docs.map((docSnap, index) => ({
          id: docSnap.id,
          sn: index + 1,
          ...docSnap.data(),
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

  const parseToDate = (value) => {
    if (!value) return null;
    try {
      if (value instanceof Timestamp) return value.toDate();
      if (typeof value === "object" && value?.seconds) return new Date(value.seconds * 1000);
      if (typeof value === "string") {
        const d = new Date(value);
        if (!isNaN(d)) return d;
      }
      if (value instanceof Date) return value;
    } catch (e) {}
    return null;
  };

  const formatDate = (value) => {
    const d = parseToDate(value);
    if (!d) return "-";
    return dayjs(d).format("DD MMM YYYY");
  };

  const updateDoctorInState = (id, patch) => {
    setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  // Activate: update ONLY status, activationDate, expectedRenewalDate
  const handleActivate = async (doctorId) => {
    // only allow when status === "Requested"
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!doctor || doctor.status !== "Requested") {
      alert("Activate is only allowed when status is Requested.");
      return;
    }

    if (!window.confirm("Activate this doctor? This will set activation date to today and renewal +1 year.")) return;

    try {
      const activationDate = new Date();
      const renewalDate = new Date();
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);

      const ref = doc(adminDb, "DoctorsRegistered", doctorId);
      await updateDoc(ref, {
        status: "Active",
        activationDate: Timestamp.fromDate(activationDate),
        expectedRenewalDate: Timestamp.fromDate(renewalDate),
      });

      // update local state (only those fields)
      updateDoctorInState(doctorId, {
        status: "Active",
        activationDate: Timestamp.fromDate(activationDate),
        expectedRenewalDate: Timestamp.fromDate(renewalDate),
      });
    } catch (error) {
      console.error("Activation error:", error);
      alert("Failed to activate. Check console for details.");
    }
  };

  // Renew: update ONLY expectedRenewalDate
  const handleRenew = async (doctorId) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!doctor || doctor.status !== "Active") {
      alert("Renew is only allowed when doctor is Active.");
      return;
    }

    if (!window.confirm("Renew this doctor's subscription? This sets expected renewal to +1 year from today.")) return;

    try {
      const renewalDate = new Date();
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);

      const ref = doc(adminDb, "DoctorsRegistered", doctorId);
      await updateDoc(ref, {
        expectedRenewalDate: Timestamp.fromDate(renewalDate),
      });

      updateDoctorInState(doctorId, { expectedRenewalDate: Timestamp.fromDate(renewalDate) });
      alert("Renewal updated.");
    } catch (error) {
      console.error("Renew error:", error);
      alert("Failed to renew. See console.");
    }
  };

  // Delete: remove document
  const handleDelete = async (doctorId) => {
    if (!window.confirm("Delete this doctor permanently? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(adminDb, "DoctorsRegistered", doctorId));
      setDoctors((prev) => prev.filter((d) => d.id !== doctorId));
      if (selectedDoctor && selectedDoctor.id === doctorId) setSelectedDoctor(null);
      alert("Doctor deleted.");
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete. See console.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(adminAuth);
      localStorage.clear();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Error during logout.");
    }
  };

  const isRenewalExpired = (expectedRenewalDate) => {
    const d = parseToDate(expectedRenewalDate);
    if (!d) return true; // treat missing date as due
    return new Date() > d;
  };

  return (
    <div style={outer}>
      <div style={header}>
        <h2 style={{ margin: 0 }}>MediTrac Admin Dashboard</h2>
        <button onClick={handleLogout} style={logoutBtn}>Logout</button>
      </div>

      {loading ? (
        <p>Loading doctor records...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead style={thead}>
              <tr>
                <th>#</th>
                <th>Doctor Name</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>Activation</th>
                <th>Renewal</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {doctors.length === 0 && (
                <tr><td colSpan={9} style={td}>No doctors found.</td></tr>
              )}

              {doctors.map((d) => {
                const status = d.status || "Registered";
                const activationDisplay = formatDate(d.activationDate);
                const renewalDisplay = formatDate(d.expectedRenewalDate);
                const registrationDisplay = formatDate(d.registrationDate);

                const activateEnabled = status === "Requested";
                const renewEnabled = status === "Active";

                const expired = isRenewalExpired(d.expectedRenewalDate);

                return (
                  <tr key={d.id} style={row}>
                    <td style={td}>{d.sn}</td>
                    <td style={td}>{d.doctorName || "-"}</td>
                    <td style={td}>{d.email}</td>
                    <td style={td}>{d.mobile || "-"}</td>
                    <td style={td}>
                      <span style={{
                        color: status === "Active" ? "green" : status === "Requested" ? "#f57c00" : status === "Expired" ? "red" : "#555",
                        fontWeight: 600,
                      }}>{status}</span>
                    </td>
                    <td style={td}>{activationDisplay}</td>
                    <td style={td}>
                      {renewalDisplay}
                      <div style={{ marginTop: 6 }}>
                        <button
                          onClick={() => renewEnabled && handleRenew(d.id)}
                          disabled={!renewEnabled}
                          style={{ ...btnRenew, ...(renewEnabled ? {} : btnDisabled) }}
                          title={!renewEnabled ? "Renew disabled until doctor is Active" : expired ? "Renew (Due)" : `Next: ${renewalDisplay}`}
                        >
                          Renew
                        </button>
                        {!renewEnabled && <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>(Disabled)</div>}
                        {renewEnabled && (
                          <div style={{ fontSize: 12, color: expired ? "red" : "#666", marginTop: 6 }}>
                            {expired ? "(Due)" : `(Next: ${renewalDisplay})`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={td}>{registrationDisplay}</td>
                    <td style={{ ...td, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => activateEnabled && handleActivate(d.id)}
                        disabled={!activateEnabled}
                        style={{ ...btnActivate, ...(activateEnabled ? {} : btnDisabled) }}
                        title={!activateEnabled ? "Activate disabled until doctor requests activation" : "Activate doctor"}
                      >
                        Activate
                      </button>

                      <button style={btnView} onClick={() => setSelectedDoctor(d)}>View</button>
                      <button style={btnDelete} onClick={() => handleDelete(d.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedDoctor && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>Doctor Details</h3>
            <p><b>Name:</b> {selectedDoctor.doctorName || "-"}</p>
            <p><b>Clinic:</b> {selectedDoctor.clinicName || "-"}</p>
            <p><b>Email:</b> {selectedDoctor.email}</p>
            <p><b>Mobile:</b> {selectedDoctor.mobile || "-"}</p>
            <p><b>Clinic Address:</b> {selectedDoctor.clinicAddress || "-"}</p>
            <p><b>Doctor Address:</b> {selectedDoctor.doctorAddress || "-"}</p>
            <p><b>Activation:</b> {formatDate(selectedDoctor.activationDate)}</p>
            <p><b>Renewal:</b> {formatDate(selectedDoctor.expectedRenewalDate)}</p>
            <p><b>Registered:</b> {formatDate(selectedDoctor.registrationDate)}</p>
            <p><b>Status:</b> {selectedDoctor.status || "Registered"}</p>
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button style={btnClose} onClick={() => setSelectedDoctor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Styles ---------- */
const outer = { padding: "30px", fontFamily: "Segoe UI, sans-serif", background: "#f4f7fc", minHeight: "100vh", lineHeight: "1.6" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1565c0", color: "white", padding: "12px 24px", borderRadius: 10, marginBottom: 20, boxShadow: "0 3px 8px rgba(0,0,0,0.1)" };
const logoutBtn = { background: "#ef5350", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 14 };
const table = { width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.08)" };
const thead = { background: "#1976d2", color: "white", textAlign: "left" };
const row = { borderBottom: "1px solid #eee" };
const td = { padding: "10px 12px", verticalAlign: "middle" };

const btnActivate = { background: "#4caf50", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnRenew = { background: "#0288d1", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnDelete = { background: "#e53935", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnView = { background: "#ffa000", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnDisabled = { opacity: 0.5, cursor: "not-allowed" };

const modalOverlay = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalContent = { background: "white", padding: "22px", borderRadius: 10, width: "480px", boxShadow: "0 6px 18px rgba(0,0,0,0.18)", textAlign: "left" };
const btnClose = { background: "#1976d2", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer" };
