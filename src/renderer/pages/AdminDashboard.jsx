// src/renderer/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  query,
  where,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { adminDb, adminAuth } from "../services/firebaseAdmin";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [message, setMessage] = useState("");

  // load doctors list
  const loadDoctors = async () => {
    setLoading(true);
    setMessage("");
    try {
      const snap = await getDocs(collection(adminDb, "DoctorsRegistered"));
      const docs = snap.docs.map((d, i) => ({ id: d.id, sn: i + 1, ...d.data() }));
      setDoctors(docs);
    } catch (err) {
      console.error("Error fetching doctors:", err);
      setMessage("Failed to load doctors. Check console.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  // safe parse for firestore Timestamp or object
  const parseToDate = (value) => {
    if (!value) return null;
    try {
      // Firestore Timestamp instance
      if (value instanceof Timestamp) return value.toDate();
      // If shape { seconds, nanoseconds }
      if (typeof value === "object" && value?.seconds) return new Date(value.seconds * 1000);
      // string / ISO
      if (typeof value === "string") {
        const d = new Date(value);
        if (!isNaN(d)) return d;
      }
      if (value instanceof Date) return value;
    } catch (e) {
      // ignore
    }
    return null;
  };

  const formatDate = (value) => {
    const d = parseToDate(value);
    return d ? dayjs(d).format("DD MMM YYYY") : "-";
  };

  const updateDoctorInState = (id, patch) =>
    setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  // Activate doctor: allowed only when status === "Requested"
  const handleActivate = async (doctorId) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!doctor) return alert("Doctor not found.");
    if (doctor.status !== "Requested") return alert("Activate allowed only when status is Requested.");

    if (!window.confirm("Activate this doctor? Activation date will be set to today and renewal +1 year.")) return;

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

      // Clean up ActivationRequests (delete any request for this email)
      try {
        const reqQ = query(
          collection(adminDb, "ActivationRequests"),
          where("doctorEmail", "==", doctor.email)
        );
        const reqSnap = await getDocs(reqQ);
        for (const r of reqSnap.docs) {
          await deleteDoc(r.ref);
        }
      } catch (cleanupErr) {
        console.warn("ActivationRequests cleanup failed:", cleanupErr);
        // continue — not fatal
      }

      updateDoctorInState(doctorId, {
        status: "Active",
        activationDate: Timestamp.fromDate(activationDate),
        expectedRenewalDate: Timestamp.fromDate(renewalDate),
      });

      alert("Doctor activated successfully.");
    } catch (err) {
      console.error("Activation failed:", err);
      alert("Activation failed. Check console for details.");
    }
  };

  // Renew: allowed only when status === "Active"
  const handleRenew = async (doctorId) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!doctor) return alert("Doctor not found.");
    if (doctor.status !== "Active") return alert("Renew allowed only when doctor is Active.");

    if (!window.confirm("Renew this doctor's subscription? This sets expected renewal to +1 year from today.")) return;

    try {
      const renewalDate = new Date();
      renewalDate.setFullYear(renewalDate.getFullYear() + 1);

      const ref = doc(adminDb, "DoctorsRegistered", doctorId);
      await updateDoc(ref, { expectedRenewalDate: Timestamp.fromDate(renewalDate) });

      updateDoctorInState(doctorId, { expectedRenewalDate: Timestamp.fromDate(renewalDate) });
      alert("Renewal date updated.");
    } catch (err) {
      console.error("Renew failed:", err);
      alert("Renewal failed. See console.");
    }
  };

  // Delete doctor record + cleanup activation requests
  const handleDelete = async (doctorId) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    if (!doctor) return alert("Doctor not found.");
    if (!window.confirm("Delete this doctor permanently? This cannot be undone.")) return;

    try {
      await deleteDoc(doc(adminDb, "DoctorsRegistered", doctorId));

      // also remove any activation request
      try {
        const reqQ = query(
          collection(adminDb, "ActivationRequests"),
          where("doctorEmail", "==", doctor.email)
        );
        const reqSnap = await getDocs(reqQ);
        for (const r of reqSnap.docs) await deleteDoc(r.ref);
      } catch (cleanupErr) {
        console.warn("ActivationRequests cleanup on delete failed:", cleanupErr);
      }

      setDoctors((prev) => prev.filter((d) => d.id !== doctorId));
      if (selectedDoctor?.id === doctorId) setSelectedDoctor(null);
      alert("Doctor deleted.");
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed. See console.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(adminAuth);
      localStorage.clear();
      navigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Logout failed. Restart app if needed.");
    }
  };

  return (
    <div style={outer}>
      <div style={header}>
        <h2 style={{ margin: 0 }}>MediTrac Admin Dashboard</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadDoctors} style={btnSecondary}>Refresh</button>
          <button onClick={handleLogout} style={btnDanger}>Logout</button>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {message && <div style={{ marginBottom: 10 }}>{message}</div>}

        {loading ? (
          <p>Loading doctor records...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead style={thead}>
                <tr>
                  <th style={th}>SN</th>
                  <th style={th}>Doctor Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Mobile</th>
                  <th style={th}>Status</th>
                  <th style={th}>Activation</th>
                  <th style={th}>Renewal</th>
                  <th style={th}>Registered</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.length === 0 ? (
                  <tr><td colSpan={9} style={td}>No doctors found.</td></tr>
                ) : (
                  doctors.map((d) => {
                    const status = d.status || "Registered";
                    const activateEnabled = status === "Requested";
                    const renewEnabled = status === "Active";
                    const activationDisplay = formatDate(d.activationDate);
                    const renewalDisplay = formatDate(d.expectedRenewalDate);
                    const registrationDisplay = formatDate(d.registrationDate);

                    return (
                      <tr key={d.id} style={row}>
                        <td style={td}>{d.sn}</td>
                        <td style={td}>{d.doctorName || "-"}</td>
                        <td style={td}>{d.email || "-"}</td>
                        <td style={td}>{d.mobile || "-"}</td>
                        <td style={td}>
                          <span style={{ fontWeight: 600, color:
                            status === "Active" ? "green" :
                            status === "Requested" ? "#f57c00" :
                            status === "Rejected" ? "red" : "#555"
                          }}>{status}</span>
                        </td>
                        <td style={td}>{activationDisplay}</td>
                        <td style={td}>
                          {renewalDisplay}
                          <div style={{ marginTop: 6 }}>
                            <button
                              onClick={() => handleRenew(d.id)}
                              disabled={!renewEnabled}
                              style={{ ...btnRenew, ...(renewEnabled ? {} : btnDisabled) }}
                            >
                              Renew
                            </button>
                          </div>
                        </td>
                        <td style={td}>{registrationDisplay}</td>
                        <td style={{ ...td, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => handleActivate(d.id)}
                            disabled={!activateEnabled}
                            style={{ ...btnActivate, ...(activateEnabled ? {} : btnDisabled) }}
                          >
                            Activate
                          </button>

                          <button onClick={() => setSelectedDoctor(d)} style={btnView}>View</button>
                          <button onClick={() => handleDelete(d.id)} style={btnDelete}>Delete</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: show full doctor details on View */}
      {selectedDoctor && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ marginTop: 0 }}>{selectedDoctor.doctorName || "-"}</h3>
            <div style={{ lineHeight: 1.6 }}>
              <p><b>Email:</b> {selectedDoctor.email || "-"}</p>
              <p><b>Mobile:</b> {selectedDoctor.mobile || "-"}</p>
              <p><b>Clinic:</b> {selectedDoctor.clinicName || "-"}</p>
              <p><b>Clinic Address:</b> {selectedDoctor.clinicAddress || "-"}</p>
              <p><b>Doctor Address:</b> {selectedDoctor.doctorAddress || "-"}</p>
              <p><b>Degree:</b> {selectedDoctor.degree || "-"}</p>
              <p><b>Specialization:</b> {selectedDoctor.specialization || "-"}</p>
              <p><b>Experience:</b> {selectedDoctor.experienceYears ? `${selectedDoctor.experienceYears} years` : "-"}</p>
              <p><b>Status:</b> {selectedDoctor.status || "Registered"}</p>
              <p><b>Registered:</b> {formatDate(selectedDoctor.registrationDate)}</p>
              <p><b>Activation:</b> {formatDate(selectedDoctor.activationDate)}</p>
              <p><b>Renewal:</b> {formatDate(selectedDoctor.expectedRenewalDate)}</p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button style={btnSecondary} onClick={() => setSelectedDoctor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Styles (kept simple and consistent with prior look) */
const outer = { fontFamily: "Segoe UI, sans-serif", background: "#f4f7fc", minHeight: "100vh" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1565c0", color: "white", padding: "12px 20px" };

const table = { width: "100%", borderCollapse: "collapse", background: "white", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" };
const thead = { background: "#1976d2", color: "white", textAlign: "left" };
const th = { padding: "10px 12px", borderBottom: "1px solid #e6eefc" };
const td = { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };
const row = {};

const btnActivate = { background: "#4caf50", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnRenew = { background: "#0288d1", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnDelete = { background: "#e53935", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnView = { background: "#ffa000", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnSecondary = { background: "white", color: "#1565c0", border: "1px solid #1565c0", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnDanger = { background: "#ef5350", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };

const btnDisabled = { opacity: 0.5, cursor: "not-allowed" };

const modalOverlay = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 };
const modalContent = { background: "white", padding: 22, borderRadius: 10, width: 520, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" };
