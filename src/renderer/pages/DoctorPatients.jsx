// src/renderer/pages/DoctorPatients.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import dayjs from "dayjs";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore as getDoctorFs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 20;

export default function DoctorPatients({ doctor }) {
  const navigate = useNavigate();

  /* ---------------------- Shared Firebase App ---------------------- */
  const { clinicApp, clinicAuth, clinicFs } = useMemo(() => {
    try {
      const cfgRaw = localStorage.getItem("doctorFirebaseConfig");
      if (!cfgRaw) return {};
      const cfg = JSON.parse(cfgRaw);
      if (!cfg?.projectId) return {};

      const appName = `meditrac-doc-${cfg.projectId}`;
      const existing = getApps().find((a) => a.name === appName);
      const app = existing || initializeApp(cfg, appName);

      return {
        clinicApp: app,
        clinicAuth: getAuth(app),
        clinicFs: getDoctorFs(app),
      };
    } catch (err) {
      console.error("Firebase initialization error:", err);
      return {};
    }
  }, []);

  /* ---------------------- States ---------------------- */
  const [connected, setConnected] = useState(false);
  const [dbPassword, setDbPassword] = useState("");
  const [connectError, setConnectError] = useState("");
  const [subTab, setSubTab] = useState("add");
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [permissionError, setPermissionError] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    gender: "Male",
    dob: "",
    weight: "",
    bloodGroup: "",
    notes: "",
  });

  /* ---------------------- DB Connect ---------------------- */
  const handleDbConnect = async () => {
    if (!clinicAuth || !doctor?.email) {
      alert("Firebase not configured. Save config first.");
      return;
    }
    try {
      if (clinicAuth.currentUser?.email === doctor.email) {
        setConnected(true);
        setConnectError("");
        return;
      }
      await signInWithEmailAndPassword(clinicAuth, doctor.email, dbPassword);
      setConnected(true);
      setConnectError("");
      alert("✅ Connected to clinic database successfully.");
    } catch (err) {
      console.error("DB connection failed:", err);
      setConnected(false);
      setConnectError("Invalid password or Firebase Auth error.");
    }
  };

  /* ---------------------- Fetch Patients ---------------------- */
  const fetchPatients = useCallback(async () => {
    if (!clinicFs || !connected) return;
    setLoading(true);
    try {
      const q = query(
        collection(clinicFs, "Patients"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setPermissionError("");
    } catch (err) {
      console.error("Error loading patients:", err);
      if (err.code === "permission-denied") {
        setPermissionError("⚠️ Insufficient Firestore permission. Try reconnecting to clinic DB.");
      }
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [clinicFs, connected]);

  useEffect(() => {
    if (connected && subTab === "list") fetchPatients();
  }, [connected, subTab, fetchPatients]);

  /* ---------------------- Add Patient ---------------------- */
  const onlyDigits = (s) => s.replace(/\D+/g, "");
  const validateMobile = (m) => /^[0-9]{10}$/.test(m);

  const handleAddPatient = async (ev) => {
    ev.preventDefault();
    if (!clinicFs || !connected) return alert("Please connect first.");
    if (!form.firstName.trim() || !form.lastName.trim())
      return alert("Enter first and last name.");
    if (!validateMobile(form.mobile.trim()))
      return alert("Enter valid 10-digit mobile number.");

    setAdding(true);
    try {
      const payload = {
        ...form,
        patientId: "P-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdAt: (await import("firebase/firestore")).serverTimestamp(),
      };
      await addDoc(collection(clinicFs, "Patients"), payload);
      alert("✅ Patient added successfully.");
      setForm({
        firstName: "",
        lastName: "",
        mobile: "",
        gender: "Male",
        dob: "",
        weight: "",
        bloodGroup: "",
        notes: "",
      });
      setSubTab("list");
      fetchPatients();
    } catch (err) {
      console.error("Add failed:", err);
      alert("Failed to add patient.");
    } finally {
      setAdding(false);
    }
  };

  const filtered = patients.filter((p) => {
    const t = search.trim().toLowerCase();
    if (!t) return true;
    return (
      p.firstName?.toLowerCase().includes(t) ||
      p.lastName?.toLowerCase().includes(t) ||
      p.mobile?.toLowerCase().includes(t) ||
      p.patientId?.toLowerCase().includes(t)
    );
  });

  const openPatientDetails = (id) => navigate(`/doctor-dashboard/patient/${id}`);

  /* ---------------------- UI ---------------------- */
  return (
    <div style={outer}>
      <div style={headerRow}>
        <h2 style={{ margin: 0, color: "#1565c0" }}>👨‍⚕️ My Patients</h2>
        {!connected ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              placeholder="Clinic DB password"
              value={dbPassword}
              onChange={(e) => setDbPassword(e.target.value)}
              autoComplete="new-password"
              style={input}
            />
            <button style={btnPrimary} onClick={handleDbConnect}>
              Connect
            </button>
          </div>
        ) : (
          <span style={{ color: "green", fontWeight: 700 }}>Connected</span>
        )}
      </div>

      {connectError && <div style={warnBox}>{connectError}</div>}

      {connected ? (
        <>
          <div style={tabBar}>
            <button style={tabBtn(subTab === "add")} onClick={() => setSubTab("add")}>
              ➕ Add Patient
            </button>
            <button style={tabBtn(subTab === "list")} onClick={() => setSubTab("list")}>
              📋 Registered Patients
            </button>
          </div>

          {subTab === "add" && (
            <form onSubmit={handleAddPatient} style={formBox}>
              <div style={grid}>
                <LabeledInput label="First Name" value={form.firstName} onChange={(v) => setForm((f) => ({ ...f, firstName: v }))} />
                <LabeledInput label="Last Name" value={form.lastName} onChange={(v) => setForm((f) => ({ ...f, lastName: v }))} />
                <LabeledInput label="Mobile" value={form.mobile} onChange={(v) => setForm((f) => ({ ...f, mobile: onlyDigits(v).slice(0, 10) }))} />
                <LabeledSelect label="Gender" value={form.gender} onChange={(v) => setForm((f) => ({ ...f, gender: v }))} options={["Male", "Female", "Other"]} />
                <LabeledInput label="Date of Birth" type="date" value={form.dob} onChange={(v) => setForm((f) => ({ ...f, dob: v }))} />
                <LabeledInput label="Weight (kg)" value={form.weight} onChange={(v) => setForm((f) => ({ ...f, weight: onlyDigits(v) }))} />
                <LabeledSelect label="Blood Group" value={form.bloodGroup} onChange={(v) => setForm((f) => ({ ...f, bloodGroup: v }))} options={["", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]} />
              </div>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={notesBox} placeholder="Notes..." />
              <button type="submit" style={btnPrimary}>{adding ? "Saving..." : "Save Patient"}</button>
            </form>
          )}

          {subTab === "list" && (
            <div style={listCard}>
              {permissionError && <div style={warnBox}>{permissionError}</div>}
              <div style={toolbar}>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} style={searchBox} placeholder="Search..." />
              </div>
              {loading ? (
                <p>Loading...</p>
              ) : (
                <table style={table}>
                  <thead style={thead}>
                    <tr>
                      <th>#</th><th>ID</th><th>Name</th><th>Mobile</th><th>Gender</th><th>Added</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => (
                      <tr key={p.id} style={i % 2 ? trAlt : undefined}>
                        <td>{i + 1}</td>
                        <td>{p.patientId}</td>
                        <td>{p.firstName} {p.lastName}</td>
                        <td>{p.mobile}</td>
                        <td>{p.gender}</td>
                        <td>{p.createdAt?.seconds ? dayjs(p.createdAt.seconds * 1000).format("DD MMM YYYY") : "-"}</td>
                        <td><button style={btnSecondary} onClick={() => openPatientDetails(p.id)}>👁 View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={hintCard}><p>Save Firebase config in Dashboard, then connect here.</p></div>
      )}
    </div>
  );
}

/* ---------- Reusable Inputs ---------- */
function LabeledInput({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={input} />
    </div>
  );
}
function LabeledSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={input}>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt || "-"}</option>
        ))}
      </select>
    </div>
  );
}

/* ---------- Styles ---------- */
const outer = { padding: 20, background: "#f4f7fc", minHeight: "100vh", fontFamily: "Segoe UI, sans-serif" };
const headerRow = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 };
const tabBar = { display: "flex", gap: 8, marginBottom: 12 };
const tabBtn = (active) => ({
  background: active ? "#1565c0" : "white",
  color: active ? "white" : "#1565c0",
  border: "1px solid #1565c0",
  padding: "8px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
});
const formBox = { background: "white", padding: 20, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", maxWidth: 980 };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 };
const notesBox = { width: "100%", minHeight: 80, borderRadius: 6, border: "1px solid #ccc", padding: 8 };
const listCard = { background: "white", padding: 16, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" };
const hintCard = { background: "white", padding: 16, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", maxWidth: 620 };
const toolbar = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 };
const searchBox = { flex: 1, padding: 8, marginRight: 10, borderRadius: 6, border: "1px solid #ccc" };
const table = { width: "100%", borderCollapse: "collapse", border: "1px solid #eaeaea" };
const thead = { background: "#f0f5ff", color: "#0d47a1" };
const trAlt = { background: "#fafafa" };
const labelStyle = { display: "block", fontWeight: 600, marginBottom: 6 };
const warnBox = { background: "#fff8e1", border: "1px solid #ffe082", color: "#5d4037", padding: 10, borderRadius: 8, marginBottom: 10 };
const btnPrimary = { background: "#1565c0", color: "white", border: "none", padding: "8px 12px", borderRadius: 6, cursor: "pointer" };
const btnSecondary = { background: "white", color: "#1565c0", border: "1px solid #1565c0", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const input = { width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", marginBottom: 8 };
