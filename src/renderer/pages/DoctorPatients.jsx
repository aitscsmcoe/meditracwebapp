// src/renderer/pages/DoctorPatients.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  getCountFromServer, // for total patients
} from "firebase/firestore";
import dayjs from "dayjs";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore as getDoctorFs } from "firebase/firestore";
import PatientDetails from "./PatientDetails"; // inline sub-tab rendering

const PAGE_SIZE = 10000;

export default function DoctorPatients({ doctor }) {
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
      const auth = getAuth(app);
      setPersistence(auth, browserLocalPersistence).catch(() => {});
      return { clinicApp: app, clinicAuth: auth, clinicFs: getDoctorFs(app) };
    } catch (err) {
      console.error("Firebase init error:", err);
      return {};
    }
  }, []);

  useEffect(() => {
    try {
      if (clinicApp && clinicApp.options && !localStorage.getItem("doctorFirebaseConfig")) {
        localStorage.setItem("doctorFirebaseConfig", JSON.stringify(clinicApp.options));
      }
    } catch {}
  }, [clinicApp]);

  /* ---------------------- States ---------------------- */
  const [connected, setConnected] = useState(false);
  const [dbPassword, setDbPassword] = useState("");
  const [connectError, setConnectError] = useState("");
  const [subTab, setSubTab] = useState("add");
  const [openPatients, setOpenPatients] = useState([]); // patient sub-tabs
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [popupMessage, setPopupMessage] = useState(""); // inline messages

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

  /* ---------- Pagination state ---------- */
  const [page, setPage] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);

  /* ---------------------- Auto Connection ---------------------- */
  useEffect(() => {
    if (clinicAuth && doctor?.email && clinicAuth.currentUser?.email === doctor.email) {
      setConnected(true);
    }
  }, [clinicAuth, doctor]);

  const handleDbConnect = async () => {
    if (!clinicAuth || !doctor?.email) {
      setPopupMessage("Firebase not configured. Save config first.");
      return;
    }
    try {
      if (clinicAuth.currentUser?.email === doctor.email) {
        setConnected(true);
        return;
      }
      await setPersistence(clinicAuth, browserLocalPersistence).catch(() => {});
      await signInWithEmailAndPassword(clinicAuth, doctor.email, dbPassword);
      setConnected(true);
      setDbPassword("");

      // Auto-save configuration immediately after login
      const config = clinicApp?.options;
      if (config) {
        localStorage.setItem("doctorFirebaseConfig", JSON.stringify(config));
        setPopupMessage("✅ Configuration saved successfully.");
      }

      if (subTab === "list") fetchPatients();
    } catch (err) {
      console.error("DB connect failed:", err);
      setConnected(false);
      setConnectError("Invalid password or Firebase Auth error.");
      setPopupMessage("⚠️ DB Connection failed. Please try again.");
    }
  };

  /* ---------------------- Fetch Patients (paged) ---------------------- */
  const fetchPatients = useCallback(async () => {
    if (!clinicFs || !connected) return;
    setLoading(true);
    try {
      const q = query(
        collection(clinicFs, "Patients"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * page) // simple growing-window paging
      );
      const snap = await getDocs(q);
      setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const countSnap = await getCountFromServer(collection(clinicFs, "Patients"));
      setTotalPatients(countSnap.data().count);

      setPermissionError("");
    } catch (err) {
      console.error("Load patients:", err);
      if (err.code === "permission-denied") {
        setPermissionError("⚠️ Firestore permission denied. Try reconnecting.");
      }
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [clinicFs, connected, page]);

  useEffect(() => {
    if (connected && subTab === "list") fetchPatients();
  }, [connected, subTab, page, fetchPatients]);

  /* ---------------------- Add Patient ---------------------- */
  const onlyDigits = (s) => (s ?? "").replace(/\D+/g, "");
  const validateMobile = (m) => /^[0-9]{10}$/.test(m ?? "");

  const handleAddPatient = async (ev) => {
    ev.preventDefault();
    if (!clinicFs || !connected) return setPopupMessage("Please connect first.");
    if (!form.firstName?.trim() || !form.lastName?.trim())
      return setPopupMessage("Enter name.");
    if (!validateMobile(form.mobile?.trim()))
      return setPopupMessage("Enter valid 10-digit mobile.");

    setAdding(true);
    try {
      const payload = {
        ...form,
        patientId: "P-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        createdAt: (await import("firebase/firestore")).serverTimestamp(),
      };
      await addDoc(collection(clinicFs, "Patients"), payload);
      setPopupMessage("✅ Patient added successfully.");
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
      setPopupMessage("⚠️ Failed to add patient.");
    } finally {
      setAdding(false);
    }
  };

  /* ---------------------- Filter / Search ---------------------- */
  const filtered = patients.filter((p) => {
    const t = (search ?? "").trim().toLowerCase();
    if (!t) return true;
    return (
      (p.firstName ?? "").toLowerCase().includes(t) ||
      (p.lastName ?? "").toLowerCase().includes(t) ||
      (p.mobile ?? "").toLowerCase().includes(t) ||
      (p.patientId ?? "").toLowerCase().includes(t)
    );
  });

  /* ---------------------- Sub-tab open/close logic ---------------------- */
  const openPatientTab = (patient) => {
    if (!openPatients.find((x) => x.id === patient.id)) {
      setOpenPatients([...openPatients, patient]);
      setSubTab(patient.id);
    } else {
      setSubTab(patient.id);
    }
  };

  const closePatientTab = (id) => {
    setOpenPatients((prev) => prev.filter((p) => p.id !== id));
    if (subTab === id) setSubTab("list");
  };

  /* ---------------------- Pagination helpers ---------------------- */
  const totalPages = Math.max(1, Math.ceil(totalPatients / PAGE_SIZE));

  const goPrev = () => {
    if (page > 1) setPage((p) => p - 1);
  };
  const goNext = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

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
              value={dbPassword ?? ""}
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
      {popupMessage && <div style={popupMessageBox}>{popupMessage}</div>}

      {connected ? (
        <>
          {/* ----- Tab Bar ----- */}
          <div style={tabBar}>
            <button style={tabBtn(subTab === "add")} onClick={() => setSubTab("add")}>
              ➕ Add Patient
            </button>
            <button style={tabBtn(subTab === "list")} onClick={() => setSubTab("list")}>
              📋 Registered Patients
            </button>

            {openPatients.map((p) => (
              <div key={p.id} style={tabWrapper}>
                <button
                  style={tabBtn(subTab === p.id)}
                  onClick={() => setSubTab(p.id)}
                >
                  {p.firstName} {p.lastName}
                </button>
                <button onClick={() => closePatientTab(p.id)} style={closeBtn}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* ----- Add Patient Tab ----- */}
          {subTab === "add" && (
            <form onSubmit={handleAddPatient} style={formBox}>
              <div style={grid}>
                <LabeledInput
                  label="First Name"
                  value={form.firstName ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
                />
                <LabeledInput
                  label="Last Name"
                  value={form.lastName ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
                />
                <LabeledInput
                  label="Mobile"
                  value={form.mobile ?? ""}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      mobile: onlyDigits(v).slice(0, 10),
                    }))
                  }
                />
                <LabeledSelect
                  label="Gender"
                  value={form.gender ?? "Male"}
                  onChange={(v) => setForm((f) => ({ ...f, gender: v }))}
                  options={["Male", "Female", "Other"]}
                />
                <LabeledInput
                  label="Date of Birth"
                  type="date"
                  value={form.dob ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, dob: v }))}
                />
                <LabeledInput
                  label="Weight (kg)"
                  value={form.weight ?? ""}
                  onChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      weight: onlyDigits(v).slice(0, 3),
                    }))
                  }
                />
                <LabeledSelect
                  label="Blood Group"
                  value={form.bloodGroup ?? ""}
                  onChange={(v) => setForm((f) => ({ ...f, bloodGroup: v }))}
                  options={["", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]}
                />
              </div>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                style={notesBox}
                placeholder="Notes..."
              />
              <button type="submit" style={btnPrimary}>
                {adding ? "Saving..." : "Save Patient"}
              </button>
            </form>
          )}

          {/* ----- Registered Patients Tab ----- */}
          {subTab === "list" && (
            <div style={listCard}>
              {permissionError && <div style={warnBox}>{permissionError}</div>}
              <div style={toolbar}>
                <input
                  type="text"
                  value={search ?? ""}
                  onChange={(e) => setSearch(e.target.value)}
                  style={searchBox}
                  placeholder="Search..."
                />
              </div>

              <div style={{ marginBottom: 8 }}>
                Total Registered Patients: {totalPatients}
              </div>

              {loading ? (
                <p>Loading...</p>
              ) : (
                <>
                  <table style={table}>
                    <thead style={thead}>
                      <tr>
                        <th>#</th>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Mobile</th>
                        <th>Gender</th>
                        <th>Added</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, i) => (
                        <tr key={p.id} style={i % 2 ? trAlt : undefined}>
                          <td>{i + 1}</td>
                          <td>{p.patientId}</td>
                          <td>
                            {p.firstName} {p.lastName}
                          </td>
                          <td>{p.mobile}</td>
                          <td>{p.gender}</td>
                          <td>
                            {p.createdAt?.seconds
                              ? dayjs(p.createdAt.seconds * 1000).format(
                                  "DD MMM YYYY"
                                )
                              : "-"}
                          </td>
                          <td>
                            <button
                              style={btnSecondary}
                              onClick={() => openPatientTab(p)}
                            >
                              👁 View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination controls */}
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={goPrev} disabled={page === 1} style={btnSecondary}>
                      ◀ Prev
                    </button>
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      onClick={goNext}
                      disabled={page === totalPages}
                      style={btnSecondary}
                    >
                      Next ▶
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ----- Inline Patient Details Sub-tabs ----- */}
          {openPatients.map(
            (p) =>
              subTab === p.id && (
                <div key={p.id} style={subTabPanel}>
                  <PatientDetails id={p.id} inline />
                </div>
              )
          )}
        </>
      ) : (
        <div style={hintCard}>
          <p>Save Firebase config in Dashboard, then connect here.</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Reusable Inputs ---------- */
function LabeledInput({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={input}
      />
    </div>
  );
}

function LabeledSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={input}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt || "-"}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---------- Styles ---------- */
const outer = {
  padding: 20,
  background: "#f4f7fc",
  minHeight: "100vh",
  fontFamily: "Segoe UI, sans-serif",
};
const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};
const tabBar = { display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" };
const tabWrapper = { display: "flex", alignItems: "center" };
const closeBtn = {
  background: "transparent",
  border: "none",
  color: "red",
  cursor: "pointer",
  marginLeft: 4,
};
const tabBtn = (active) => ({
  background: active ? "#1565c0" : "white",
  color: active ? "white" : "#1565c0",
  border: "1px solid #1565c0",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
});
const subTabPanel = { marginTop: 10 };
const formBox = {
  background: "white",
  padding: 20,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  maxWidth: 980,
};
const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginBottom: 10,
};
const notesBox = {
  width: "100%",
  minHeight: 80,
  borderRadius: 6,
  border: "1px solid #ccc",
  padding: 8,
};
const listCard = {
  background: "white",
  padding: 16,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
};
const hintCard = {
  background: "white",
  padding: 16,
  borderRadius: 10,
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  maxWidth: 620,
};
const toolbar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
};
const searchBox = {
  flex: 1,
  padding: 8,
  marginRight: 10,
  borderRadius: 6,
  border: "1px solid #ccc",
};
const table = {
  width: "100%",
  borderCollapse: "collapse",
  border: "1px solid #eaeaea",
};
const thead = { background: "#f0f5ff", color: "#0d47a1" };
const trAlt = { background: "#fafafa" };
const labelStyle = { display: "block", fontWeight: 600, marginBottom: 6 };
const warnBox = {
  background: "#fff8e1",
  border: "1px solid #ffe082",
  color: "#5d4037",
  padding: 10,
  borderRadius: 8,
  marginBottom: 10,
};
const btnPrimary = {
  background: "#1565c0",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: 6,
  cursor: "pointer",
};
const btnSecondary = {
  background: "white",
  color: "#1565c0",
  border: "1px solid #1565c0",
  padding: "6px 10px",
  borderRadius: 6,
  cursor: "pointer",
};
const input = {
  width: "100%",
  padding: 8,
  borderRadius: 6,
  border: "1px solid #ccc",
  marginBottom: 8,
};
const popupMessageBox = {
  color: "orange",
  fontWeight: "bold",
  marginTop: "10px",
};
