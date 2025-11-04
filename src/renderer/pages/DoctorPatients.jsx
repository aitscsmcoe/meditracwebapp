// src/renderer/pages/DoctorPatients.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from "firebase/firestore";
import dayjs from "dayjs";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore as getDoctorFs } from "firebase/firestore";

const PAGE_SIZE = 20;

export default function DoctorPatients({ doctorFs, doctor }) {
  const [subTab, setSubTab] = useState("register"); // 'register' | 'list'

  // clinic (doctor) auth
  const [clinicAuthReady, setClinicAuthReady] = useState(false);
  const [clinicAuthError, setClinicAuthError] = useState("");
  const [dbPassword, setDbPassword] = useState("");

  // data/paging
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [patients, setPatients] = useState([]);
  const [pageCursors, setPageCursors] = useState([]);
  const [isLastPage, setIsLastPage] = useState(false);

  // add form
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

  // Build (or reuse) doctor's Firebase app from saved config in localStorage
  const clinicApp = useMemo(() => {
    try {
      const raw = localStorage.getItem("doctorFirebaseConfig");
      if (!raw) return null;
      const cfg = JSON.parse(raw);
      if (!cfg?.projectId) return null;
      const appName = `meditrac-doc-${cfg.projectId}`;
      const existing = getApps().find((a) => a.name === appName);
      return existing || initializeApp(cfg, appName);
    } catch {
      return null;
    }
  }, []);

  const clinicAuth = useMemo(() => (clinicApp ? getAuth(clinicApp) : null), [clinicApp]);
  const clinicFs = useMemo(() => (clinicApp ? getDoctorFs(clinicApp) : null), [clinicApp]);

  // Require: doctorFs (from Dashboard) & localStorage config & sign-in to clinicAuth
  const ensureClinicSignIn = async () => {
    if (!clinicAuth || !doctor?.email) return;
    try {
      if (clinicAuth.currentUser?.email === doctor.email) {
        setClinicAuthReady(true);
        setClinicAuthError("");
        return;
      }
      if (!dbPassword) {
        setClinicAuthReady(false);
        setClinicAuthError("Enter your Clinic DB password then click Sign In.");
        return;
      }
      await signInWithEmailAndPassword(clinicAuth, doctor.email, dbPassword);
      setClinicAuthReady(true);
      setClinicAuthError("");
    } catch (err) {
      console.error("Clinic sign-in failed:", err);
      setClinicAuthReady(false);
      setClinicAuthError("Sign-in failed. Check password or Auth user in your Firebase project.");
    }
  };

  useEffect(() => {
    // try auto-ready if already signed-in
    if (clinicAuth?.currentUser?.email === doctor?.email) {
      setClinicAuthReady(true);
      setClinicAuthError("");
    }
  }, [clinicAuth, doctor?.email]);

  // Load one page
  const fetchPage = async (direction = "first") => {
    if (!clinicFs || !clinicAuthReady) return;
    setLoading(true);
    try {
      let q = query(collection(clinicFs, "Patients"), orderBy("createdAt", "desc"), limit(PAGE_SIZE));

      if (direction === "next" && pageCursors.length > 0) {
        const last = pageCursors[pageCursors.length - 1];
        if (last) {
          q = query(
            collection(clinicFs, "Patients"),
            orderBy("createdAt", "desc"),
            startAfter(last),
            limit(PAGE_SIZE)
          );
        }
      } else if (direction === "prev") {
        const newStack = [...pageCursors];
        newStack.pop();
        let q2 = query(collection(clinicFs, "Patients"), orderBy("createdAt", "desc"), limit(PAGE_SIZE));
        if (newStack.length > 0) {
          q2 = query(
            collection(clinicFs, "Patients"),
            orderBy("createdAt", "desc"),
            startAfter(newStack[newStack.length - 1]),
            limit(PAGE_SIZE)
          );
        }
        const snap2 = await getDocs(q2);
        setPatients(snap2.docs.map((d) => ({ id: d.id, ...d.data() })));
        setIsLastPage(snap2.docs.length < PAGE_SIZE);
        setPageCursors(newStack);
        setLoading(false);
        return;
      }

      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPatients(docs);
      setIsLastPage(snap.docs.length < PAGE_SIZE);

      if (direction === "first") {
        setPageCursors(snap.docs.length ? [snap.docs[snap.docs.length - 1]] : []);
      } else if (direction === "next") {
        setPageCursors((prev) =>
          snap.docs.length ? [...prev, snap.docs[snap.docs.length - 1]] : prev
        );
      }
    } catch (err) {
      console.error("Error loading patients:", err);
    } finally {
      setLoading(false);
    }
  };

  // First page after sign-in ready
  useEffect(() => {
    if (clinicFs && clinicAuthReady) fetchPage("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicFs, clinicAuthReady]);

  // Search (client-side on current page)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter(
      (p) =>
        p.firstName?.toLowerCase().includes(term) ||
        p.lastName?.toLowerCase().includes(term) ||
        p.mobile?.toLowerCase().includes(term) ||
        p.patientId?.toLowerCase().includes(term)
    );
  }, [search, patients]);

  const ageFromDob = (dobStr) => {
    if (!dobStr) return "-";
    const d = dayjs(dobStr);
    if (!d.isValid()) return "-";
    const years = dayjs().diff(d, "year");
    return `${years}`;
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    if (!clinicFs || !clinicAuthReady) {
      return alert("❌ Please sign in to your Clinic DB first.");
    }
    try {
      const patientId = "P-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      const payload = {
        ...form,
        patientId,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(clinicFs, "Patients"), payload);
      alert("✅ Patient added successfully!");
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
      await fetchPage("first");
      setSubTab("list");
    } catch (err) {
      console.error("Add patient failed:", err);
      alert("❌ Failed to add patient. Check Clinic DB Auth sign-in & rules.");
    }
  };

  // If config not present, block entire tab
  const hasConfig = !!localStorage.getItem("doctorFirebaseConfig");

  return (
    <div style={outer}>
      {!hasConfig || !doctorFs ? (
        <div style={blocked}>
          <h3>Clinic Database not configured</h3>
          <p>Go to <b>Dashboard</b> → paste Config → <b>Test Connection</b> → <b>Save Config</b>.</p>
        </div>
      ) : !clinicAuthReady ? (
        <div style={banner}>
          <div>
            <b>Clinic DB Sign-In required</b>
            <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
              Email: <b>{doctor?.email}</b> (created in your Firebase project under Authentication → Users)
            </div>
            {clinicAuthError && <div style={{ color: "red", marginTop: 6 }}>{clinicAuthError}</div>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              placeholder="Clinic DB password"
              value={dbPassword}
              onChange={(e) => setDbPassword(e.target.value)}
              style={input}
            />
            <button onClick={ensureClinicSignIn} style={btnPrimary}>Sign In</button>
          </div>
        </div>
      ) : null}

      {/* Sub-tabs */}
      <div style={subtabBar}>
        <button
          style={subTabBtn(subTab === "register")}
          onClick={() => setSubTab("register")}
          disabled={!clinicAuthReady}
          title={!clinicAuthReady ? "Sign in to Clinic DB first" : ""}
        >
          ➕ Register Patient
        </button>
        <button
          style={subTabBtn(subTab === "list")}
          onClick={() => setSubTab("list")}
          disabled={!clinicAuthReady}
          title={!clinicAuthReady ? "Sign in to Clinic DB first" : ""}
        >
          📋 Registered Patients
        </button>
      </div>

      {/* Register Patient */}
      {subTab === "register" && clinicAuthReady && (
        <form onSubmit={handleAddPatient} style={formBox}>
          <h3 style={{ marginTop: 0, color: "#0d47a1" }}>📝 Register New Patient</h3>
          <div style={grid}>
            <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
            <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
            <Field label="Mobile" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} required />
            <Field label="Gender" type="select" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={["Male", "Female", "Other"]} />
            <Field label="Date of Birth" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} />
            <Field label="Weight (kg)" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} />
            <Field label="Blood Group" type="select" value={form.bloodGroup} onChange={(v) => setForm({ ...form, bloodGroup: v })} options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]} />
          </div>
          <div>
            <label><b>Notes:</b></label>
            <textarea
              style={notesBox}
              placeholder="Basic details or medical notes..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <button type="submit" style={btnPrimary} disabled={adding}>
            {adding ? "Saving..." : "Save Patient"}
          </button>
        </form>
      )}

      {/* Registered Patients */}
      {subTab === "list" && clinicAuthReady && (
        <div style={{ background: "white", padding: 16, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <div style={toolbar}>
            <input
              type="text"
              placeholder="Search by Name, Mobile, or Patient ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={searchBox}
            />
            <div style={{ fontSize: 13, color: "#555" }}>
              Page size: <b>{PAGE_SIZE}</b>
            </div>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : patients.length === 0 ? (
            <p style={{ color: "gray" }}>No patients found.</p>
          ) : (
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Patient ID</th>
                  <th style={th}>Name</th>
                  <th style={th}>Mobile</th>
                  <th style={th}>Gender</th>
                  <th style={th}>Blood Group</th>
                  <th style={th}>Age</th>
                  <th style={th}>Added On</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}>{p.patientId}</td>
                    <td style={td}>{p.firstName} {p.lastName}</td>
                    <td style={td}>{p.mobile}</td>
                    <td style={td}>{p.gender}</td>
                    <td style={td}>{p.bloodGroup}</td>
                    <td style={td}>{ageFromDob(p.dob)}</td>
                    <td style={td}>
                      {p.createdAt?.seconds
                        ? dayjs(p.createdAt.seconds * 1000).format("DD MMM YYYY")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={pager}>
            <button
              style={btnSecondary}
              onClick={() => fetchPage("prev")}
              disabled={pageCursors.length === 0 || loading}
            >
              ⬅️ Previous
            </button>
            <button
              style={btnSecondary}
              onClick={() => fetchPage("next")}
              disabled={isLastPage || loading}
            >
              Next ➡️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Field ----------
const Field = ({ label, value, onChange, type = "text", required = false, options = [] }) => (
  <div>
    <label><b>{label}:</b></label>
    {type === "select" ? (
      <select value={value} onChange={(e) => onChange(e.target.value)} style={input}>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    ) : (
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        style={input}
      />
    )}
  </div>
);

// ---------- Styles ----------
const outer = { padding: 20, background: "#f4f7fc", minHeight: "100vh", fontFamily: "Segoe UI, sans-serif" };
const blocked = { background: "#fff3e0", border: "1px solid #ffe0b2", padding: 16, borderRadius: 8, marginBottom: 12 };
const banner = { background: "#fff8e1", border: "1px solid #ffe082", padding: 12, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 };
const subtabBar = { display: "flex", gap: 8, marginBottom: 12 };
const subTabBtn = (active) => ({
  background: active ? "#1565c0" : "white",
  color: active ? "white" : "#1565c0",
  border: "1px solid #1565c0",
  padding: "8px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
});
const formBox = { background: "white", padding: 20, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: 20 };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 };
const notesBox = { width: "100%", height: 80, borderRadius: 6, border: "1px solid #ccc", padding: 8, resize: "none" };
const toolbar = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 };
const searchBox = { flex: 1, padding: 8, marginRight: 10, borderRadius: 6, border: "1px solid #ccc" };
const table = { width: "100%", borderCollapse: "collapse", background: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" };
const th = { textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #eee" };
const td = { padding: "8px 10px", borderBottom: "1px solid #f2f2f2" };
const pager = { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 };
const btnPrimary = { background: "#1565c0", color: "white", border: "none", padding: "8px 12px", borderRadius: 6, cursor: "pointer" };
const btnSecondary = { background: "white", color: "#1565c0", border: "1px solid #1565c0", padding: "6px 10px", borderRadius: 6, cursor: "pointer" };
const input = { width: "100%", padding: 6, borderRadius: 6, border: "1px solid #ccc", marginBottom: 8 };
