// src/renderer/pages/DoctorDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  collection as fsCollection,
  Timestamp,
} from "firebase/firestore";
import { adminDb, adminAuth } from "../services/firebaseAdmin";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore as getDoctorFs, collection as docCollection } from "firebase/firestore";
import DoctorPatients from "./DoctorPatients";

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const user = adminAuth.currentUser;
  const doctorEmail = user?.email;

  const [doctor, setDoctor] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cfgText, setCfgText] = useState("");
  const [cfgStatus, setCfgStatus] = useState("idle"); // idle | ok | error
  const [cfgError, setCfgError] = useState("");
  const cfgRef = useRef(null);

  // doctor profile form
  const [form, setForm] = useState({
    mobile: "",
    clinicName: "",
    clinicAddress: "",
    doctorAddress: "",
    degree: "",
    specialization: "",
    experienceYears: "",
  });

  // ---------- Load doctor ----------
  const loadDoctor = useCallback(async () => {
    if (!doctorEmail) return;
    try {
      const ref = doc(adminDb, "DoctorsRegistered", doctorEmail);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setDoctor(data);
        localStorage.setItem("dClinicname", data.clinicName || "-")
        localStorage.setItem("dClinicaddress", data.clinicAddress || "-")
        localStorage.setItem("dDegree", data.degree || "-")
        localStorage.setItem("dSp", data.specialization || "-")
        localStorage.setItem("dMobile", data.mobile || "-")
        setForm({
          mobile: data.mobile || "",
          clinicName: data.clinicName || "",
          clinicAddress: data.clinicAddress || "",
          doctorAddress: data.doctorAddress || "",
          degree: data.degree || "",
          specialization: data.specialization || "",
          experienceYears: data.experienceYears || "",
        });
        setCfgText(
          data.doctorFirebaseConfig ? JSON.stringify(data.doctorFirebaseConfig, null, 2) : ""
        );
        setCfgStatus(data.doctorDbReady ? "ok" : "idle");
      }
    } catch (err) {
      console.error("Error loading doctor:", err);
    }
  }, [doctorEmail]);

  useEffect(() => {
    loadDoctor();
  }, [loadDoctor]);

  const fmt = (v) =>
    v && (v instanceof Timestamp || v?.seconds)
      ? dayjs((v instanceof Timestamp ? v.toDate() : new Date(v.seconds * 1000))).format(
          "DD MMM YYYY"
        )
      : "-";

  // ---------- Save profile ----------
  const handleSaveProfile = async () => {
    if (!doctorEmail) return;
    try {
      setSaving(true);
      await updateDoc(doc(adminDb, "DoctorsRegistered", doctorEmail), {
        mobile: form.mobile || "",
        clinicName: form.clinicName || "",
        clinicAddress: form.clinicAddress || "",
        doctorAddress: form.doctorAddress || "",
        degree: form.degree || "",
        specialization: form.specialization || "",
        experienceYears: form.experienceYears || "",
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
      setMessage("✅ Profile updated.");
      await loadDoctor();
    } catch (e) {
      console.error(e);
      setMessage("❌ Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Config parsing ----------
  const parseConfig = () => {
    try {
      return JSON.parse(cfgText);
    } catch {
      return null;
    }
  };

  // ---------- Test Firestore connection ----------
  const handleTestConnection = async () => {
    const cfg = parseConfig();
    if (!cfg) {
      setCfgError("Invalid JSON format.");
      setCfgStatus("error");
      return;
    }
    try {
      const appName = `meditrac-doc-${cfg.projectId}`;
      const existing = getApps().find((a) => a.name === appName);
      const app = existing || initializeApp(cfg, appName);
      const fs = getDoctorFs(app);

      // Lightweight read from diagnostics collection
      await getDocs(docCollection(fs, "_connection_test"));
      setCfgStatus("ok");
      setCfgError("");
      setMessage("✅ Firestore Connected Successfully!");
    } catch (err) {
      console.error("Connection failed:", err);
      setCfgStatus("error");
      setCfgError("❌ Connection failed. Check rules or config.");
    }
  };

  // ---------- Save config to Admin DB ----------
  const handleSaveConfig = async () => {
    const cfg = parseConfig();
    if (!cfg) {
      setCfgError("Please paste valid JSON config.");
      setCfgStatus("error");
      return;
    }
    try {
      await updateDoc(doc(adminDb, "DoctorsRegistered", doctorEmail), {
        doctorFirebaseConfig: cfg,
        doctorDbReady: cfgStatus === "ok",
        updatedAt: serverTimestamp(),
      });
      localStorage.setItem("doctorFirebaseConfig", JSON.stringify(cfg));
      setMessage("✅ Firebase configuration saved.");
      await loadDoctor();
    } catch (err) {
      console.error(err);
      setCfgError("❌ Failed to save config.");
    }
  };

  // ---------- Firestore instance for DoctorPatients ----------
  const doctorFs = useMemo(() => {
    try {
      const raw = parseConfig() || doctor?.doctorFirebaseConfig;
      if (!raw || !raw.projectId) return null;
      const appName = `meditrac-doc-${raw.projectId}`;
      const existing = getApps().find((a) => a.name === appName);
      const app = existing || initializeApp(raw, appName);
      return getDoctorFs(app);
    } catch {
      return null;
    }
  }, [cfgText, doctor]);

  // ---------- Real-time connection monitor (every 10 min) ----------
  useEffect(() => {
    if (!doctorFs) return;
    let mounted = true;
    const check = async () => {
      try {
        await getDocs(fsCollection(doctorFs, "_connection_test"));
        if (mounted && cfgStatus !== "ok") setCfgStatus("ok");
      } catch (e) {
        if (!mounted) return;
        setCfgStatus("error");
        setCfgError("⚠️ Firestore connection lost.");
      }
    };
    const id = setInterval(check, 1800000); // 30 minutes
    check();
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [doctorFs]); // eslint-disable-line

  // ---------- Logout / Refresh ----------
  const handleLogout = async () => {
    await signOut(adminAuth);
    localStorage.clear();
    window.location.replace("/");
    setTimeout(() => window.location.reload(), 120);
  };
  const handleRefresh = async () => {
    setMessage("🔄 Refreshing...");
    await loadDoctor();
    setMessage("✅ Refreshed.");
  };

  // ---------- Tabs ----------
  const patientsTabDisabled = cfgStatus !== "ok";
  localStorage.setItem("dName", doctor.doctorName || "-")

  const DashboardTab = () => (
    <div style={tabContainer}>
      {doctor && (
        <>
          {/* Summary header */}
          <div style={summaryBox}>
            <div><b>Doctor:</b> {doctor.doctorName || "-"}</div>
            <div><b>Email:</b> {doctor.email || "-"}</div>
            <div><b>Status:</b> {doctor.status || "Registered"}</div>
            <div><b>Registration:</b> {fmt(doctor.registrationDate)}</div>
            <div><b>Activation:</b> {fmt(doctor.activationDate)}</div>
            <div><b>Renewal:</b> {fmt(doctor.expectedRenewalDate)}</div>
            <div>
              <b>Database Connection:</b>{" "}
              <span style={{
                fontWeight: "bold",
                color: cfgStatus === "ok" ? "green" : cfgStatus === "error" ? "red" : "gray"
              }}>
                {cfgStatus === "ok"
                  ? "Connected ✅"
                  : cfgStatus === "error"
                  ? "Disconnected ⚠️"
                  : "Not Configured"}
              </span>
            </div>
          </div>

          {/* Profile edit */}
          <div style={editBox}>
            <div style={{ display: "flex", justifyContent: "flex-start", gap: 10 }}>
              <button onClick={() => setEditing(!editing)} style={btnPrimary}>
                {editing ? "Cancel Edit" : "✏️ Edit"}
              </button>
              {editing && (
                <button onClick={handleSaveProfile} style={btnSecondary}>
                  {saving ? "Saving..." : "💾 Save"}
                </button>
              )}
            </div>

            <h3 style={{ color: "#1565c0", marginTop: 15 }}>Doctor Profile Details</h3>
            <h4 style={{ color: "#e762e7ff", marginTop: 15 }}>Note: Fileds on this page you can NOT directly edit easily for safety. Recommeded to copy past required details.</h4>
            <div style={grid}>
              <Field label="Mobile" value={form.mobile} editable={editing} onChange={(v) => setForm({ ...form, mobile: v })} />
              <Field label="Clinic Name" value={form.clinicName} editable={editing} onChange={(v) => setForm({ ...form, clinicName: v })} />
              <Field label="Degree" value={form.degree} editable={editing} onChange={(v) => setForm({ ...form, degree: v })} />
              <Field label="Specialization" value={form.specialization} editable={editing} onChange={(v) => setForm({ ...form, specialization: v })} />
              <Field label="Experience (years)" value={form.experienceYears} editable={editing} onChange={(v) => setForm({ ...form, experienceYears: v })} />
              <Field label="Clinic Address" value={form.clinicAddress} editable={editing} onChange={(v) => setForm({ ...form, clinicAddress: v })} wide />
              <Field label="Doctor Address" value={form.doctorAddress} editable={editing} onChange={(v) => setForm({ ...form, doctorAddress: v })} wide />
            </div>
          </div>

          {/* Firebase setup wizard */}
          <div style={wizardBox}>
            <h2 style={{ color: "#0d47a1" }}>Secure & Working Firestore Setup Guide</h2>
            <p style={{ fontStyle: "italic", marginBottom: 15 }}>
              🧱 Step-by-step Instructions for Each Doctor
            </p>

            <ol style={stepList}>
              <li><b>1️⃣ Create Firebase Project</b><br />
                Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer">Firebase Console</a> → Add Project → name it (e.g., MediTrac-Dr-Joshi). Disable Analytics → Create Project.
              </li>
              <li><b>2️⃣ Enable Firestore Database</b><br />Build → Firestore Database → Create Database → Production Mode.</li>
              <li><b>3️⃣ Enable Authentication</b><br />Build → Authentication → Enable Email/Password → (Optional) add sender name “MediTrac Clinic” in Password Reset template.</li>
              <li><b>4️⃣ Add Web App (Get Config JSON)</b><br />Project Settings → General → Web App → Register → Copy JSON like below:
                <pre style={jsonBox}>{`{
  "apiKey": "AIzaSy....",
  "authDomain": "meditrac-clinic.firebaseapp.com",
  "projectId": "meditrac-clinic",
  "storageBucket": "meditrac-clinic.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abcd"
}`}</pre>
              </li>
              <li><b>5️⃣ Secure Firestore Access (Rules)</b><br />Paste this in Firestore → Rules → Publish (replace email with your MediTrac login email):
                <pre style={ruleBox}>{`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /_connection_test/{document=**} {
      allow read: if true;
      allow write: if false;
    }
    match /{document=**} {
      allow read, write: if request.auth != null &&
        request.auth.token.email == "${doctorEmail}";
    }
  }
}`}</pre>
              </li>
              <li><b>6️⃣ Add Authentication User</b><br />In Authentication → Users → Add user → Use the same email and any password (you’ll enter it inside “My Patients”).</li>
              <li><b>7️⃣ Save & Test</b><br />Paste JSON below → Click “Test Connection” → Expect ✅ Connected. Then click “Save Config”.</li>
            </ol>

            <textarea
              ref={cfgRef}
              style={configArea}
              placeholder="Paste Firebase Config JSON here..."
              value={cfgText}
              onChange={(e) => setCfgText(e.target.value)}
              onFocus={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={handleTestConnection} style={btnSecondary}>Test Connection</button>
              <button onClick={handleSaveConfig} style={btnPrimary}>Save Config</button>
            </div>
            {cfgStatus === "ok" && <p style={{ color: "green" }}>✅ Firestore Connected Successfully!</p>}
            {cfgStatus === "error" && <p style={{ color: "red" }}>{cfgError}</p>}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div style={outer}>
      <div style={topBar}>
        <div>
          <button
            onClick={() => setActiveTab("dashboard")}
            style={tabButton(activeTab === "dashboard")}
          >
            Dashboard
          </button>
          <button
            onClick={() => !patientsTabDisabled && setActiveTab("patients")}
            style={tabButton(activeTab === "patients", patientsTabDisabled)}
            disabled={patientsTabDisabled}
            title={patientsTabDisabled ? "Configure & test Firestore in Dashboard first" : ""}
          >
            My Patients
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleRefresh} style={btnSecondary}>Refresh</button>
          <button onClick={handleLogout} style={btnDanger}>Logout</button>
        </div>
      </div>

      {activeTab === "dashboard" ? (
        <DashboardTab />
      ) : (
        <DoctorPatients doctorFs={doctorFs} doctor={doctor} />
      )}

      {message && <p style={{ padding: 20 }}>{message}</p>}
    </div>
  );
}

// ---------- Field ----------
const Field = ({ label, value, editable, onChange, wide }) => (
  <div style={{ marginBottom: 10, gridColumn: wide ? "1 / -1" : "auto" }}>
    <b>{label}:</b>
    {editable ? (
      <input
        style={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.stopPropagation()}
      />
    ) : (
      <span style={{ marginLeft: 6 }}>{value || "-"}</span>
    )}
  </div>
);

// ---------- Styles ----------
const outer = { fontFamily: "Segoe UI, sans-serif", background: "#f4f7fc", minHeight: "100vh" };
const topBar = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1565c0", color: "white", padding: "12px 20px" };
const tabButton = (active, disabled) => ({
  background: active ? "white" : "transparent",
  color: active ? "#1565c0" : "white",
  opacity: disabled ? 0.6 : 1,
  border: "none",
  padding: "8px 12px",
  borderRadius: 6,
  cursor: disabled ? "not-allowed" : "pointer",
  fontWeight: 600,
});
const btnPrimary = { background: "#1565c0", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer" };
const btnSecondary = { background: "white", color: "#1565c0", border: "1px solid #1565c0", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const btnDanger = { background: "#ef5350", color: "white", border: "none", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const tabContainer = { padding: 20 };
const summaryBox = { background: "white", borderRadius: 10, padding: 15, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 };
const editBox = { background: "white", borderRadius: 10, padding: 15, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: 20 };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const wizardBox = { background: "white", borderRadius: 10, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginTop: 20 };
const stepList = { lineHeight: 1.8, marginLeft: 20 };
const ruleBox = { background: "#f4f7fc", padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", fontFamily: "monospace", fontSize: 13, overflowX: "auto" };
const jsonBox = { background: "#fafafa", border: "1px solid #ddd", borderRadius: 6, padding: 8, fontFamily: "monospace", fontSize: 13, overflowX: "auto" };
const configArea = {
  width: "100%",
  height: 200,
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: 10,
  fontFamily: "monospace",
  resize: "none",
  background: "#fafafa",
  lineHeight: 1.5,
  overscrollBehavior: "contain",
};
const input = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", marginTop: 5 };
