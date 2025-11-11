// src/renderer/pages/PatientDetails.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc, getDoc, collection, addDoc, getDocs,
  orderBy, query, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore as getDoctorFs } from "firebase/firestore";
import dayjs from "dayjs";

/* ---------------------------------------------------- */
export default function PatientDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  /* ---------- Shared Firebase Instance ---------- */
  const { clinicFs } = useMemo(() => {
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
      return { clinicFs: getDoctorFs(app) };
    } catch (err) {
      console.error("Firebase init failed:", err);
      return {};
    }
  }, []);

  /* ---------- State ---------- */
  const [patient, setPatient] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingVisit, setEditingVisit] = useState(null);

  const [newVisit, setNewVisit] = useState({
    visitDate: dayjs().format("YYYY-MM-DD"),
    reason: "",
    diagnosis: "",
    prescriptions: [],
    notes: "",
    followUpDate: "",
  });

  const [prescriptionEntry, setPrescriptionEntry] = useState({
    name: "",
    m: false,
    a: false,
    e: false,
    bl: false,
  });

  /* ---------- Load Patient ---------- */
  useEffect(() => {
    const loadPatient = async () => {
      if (!clinicFs || !id) return;
      try {
        const ref = doc(clinicFs, "Patients", id);
        const snap = await getDoc(ref);
        if (snap.exists()) setPatient({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.error("Patient load error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPatient();
  }, [clinicFs, id]);

  /* ---------- Load Visits ---------- */
  const loadVisits = async () => {
    if (!clinicFs || !id) return;
    try {
      const q = query(
        collection(clinicFs, "Patients", id, "Visits"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setVisits(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Visits load error:", err);
    }
  };
  useEffect(() => { loadVisits(); }, [clinicFs, id]);

  /* ---------- Add Visit ---------- */
  const handleAddVisit = async (e) => {
    e.preventDefault();
    if (!newVisit.reason.trim()) return alert("Enter reason for visit.");
    setAdding(true);
    try {
      await addDoc(collection(clinicFs, "Patients", id, "Visits"), {
        ...newVisit,
        createdAt: serverTimestamp(),
      });
      setNewVisit({
        visitDate: dayjs().format("YYYY-MM-DD"),
        reason: "",
        diagnosis: "",
        prescriptions: [],
        notes: "",
        followUpDate: "",
      });
      await loadVisits();
    } catch (err) {
      console.error("Add visit failed:", err);
      alert("Failed to add visit.");
    } finally {
      setAdding(false);
    }
  };

  /* ---------- Edit Visit ---------- */
  const handleEditSave = async () => {
    if (!editingVisit) return;
    try {
      const ref = doc(clinicFs, "Patients", id, "Visits", editingVisit.id);
      await updateDoc(ref, { ...editingVisit });
      setEditingVisit(null);
      await loadVisits();
    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update visit.");
    }
  };

  const handleDeleteVisit = async (visitId) => {
    if (!window.confirm("Delete this visit?")) return;
    try {
      await deleteDoc(doc(clinicFs, "Patients", id, "Visits", visitId));
      await loadVisits();
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Delete failed.");
    }
  };

  /* ---------- Prescription Helpers ---------- */
  const addPrescription = () => {
    if (!prescriptionEntry.name.trim()) return;
    setNewVisit((v) => ({
      ...v,
      prescriptions: [...v.prescriptions, prescriptionEntry],
    }));
    setPrescriptionEntry({ name: "", m: false, a: false, e: false, bl: false });
  };
  const removePrescription = (i) => {
    setNewVisit((v) => ({
      ...v,
      prescriptions: v.prescriptions.filter((_, idx) => idx !== i),
    }));
  };

  /* ---------- Back Button (FIXED) ---------- */
  const goBackToMyPatients = () => {
    // If there is history to go back (came from list), do that to preserve state & auth
    // Otherwise, fall back to /doctor-dashboard (root of Doctor area)
    const canGoBack = (window.history?.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0);
    if (canGoBack) {
      navigate(-1);
    } else {
      navigate("/doctor-dashboard", { replace: true });
    }
  };

  /* ---------- Print Visit (Two-Column Details) ---------- */
  const printVisit = (v) => {
    const age = patient.dob ? dayjs().diff(dayjs(patient.dob), "year") : "-";

    const html = `
      <html>
      <head>
        <title>Prescription - ${patient.firstName}</title>
        <style>
          body { font-family:'Segoe UI',sans-serif; padding:24px; }
          .spacer { height:100px; } /* ~5 lines blank for letterhead space */
          .grid { display:grid; grid-template-columns: 1fr 1fr; column-gap: 32px; row-gap: 6px; }
          .rowfull { grid-column: 1 / span 2; }
          .label { font-weight: 600; }
          table { width:100%; border-collapse:collapse; margin-top:12px; }
          th,td { border:1px solid #ccc; padding:6px; text-align:center; }
          th { background:#f0f5ff; }
          .section { margin-top:14px; }
          .footer { text-align:right; font-size:11px; color:#777; margin-top:20px; }
        </style>
      </head>
      <body>
        <div class="spacer"></div>

        <div class="grid">
          <div><span class="label">Visit Date:</span> ${v.visitDate || "-"}</div>
          <div><span class="label">Follow-up Date:</span> ${v.followUpDate || "-"}</div>
          <div><span class="label">Patient Name:</span> ${patient.firstName} ${patient.lastName || ""}</div>
          <div><span class="label">Age:</span> ${age}</div>
          <div><span class="label">Blood Group:</span> ${patient.bloodGroup || "-"}</div>
          <div><span class="label">Weight:</span> ${patient.weight || "-"} kg</div>
        </div>

        <div class="section">
          <h4>Prescriptions</h4>
          <table>
            <tr><th>Medicine</th><th>M</th><th>A</th><th>E</th><th>BL</th></tr>
            ${(v.prescriptions || []).map(p =>
              `<tr><td style="text-align:left;padding-left:8px">${p.name}</td><td>${p.m ? "✔" : ""}</td><td>${p.a ? "✔" : ""}</td><td>${p.e ? "✔" : ""}</td><td>${p.bl ? "✔" : ""}</td></tr>`
            ).join("")}
          </table>
        </div>

        ${v.notes ? `<div class="section rowfull"><span class="label">Notes:</span> ${v.notes}</div>` : ""}

        <div class="footer">Generated by MediTrac</div>
        <script>window.onload=function(){window.print();}</script>
      </body>
      </html>
    `;
    const w = window.open("", "_blank", "width=800,height=1000");
    w.document.write(html);
    w.document.close();
  };

  /* ---------- UI ---------- */
  if (loading) return <div style={outer}><p>Loading patient...</p></div>;
  if (!patient) return <div style={outer}><p>Patient not found.</p></div>;

  return (
    <div style={outer}>
      <button onClick={goBackToMyPatients} style={btnBack}>
        ← Back to My Patients
      </button>

      <div style={headerBox}>
        <h2 style={{ color: "#1565c0" }}>{patient.firstName} {patient.lastName}</h2>
        <div style={{ color: "#555" }}>
          <b>ID:</b> {patient.patientId} &nbsp;|&nbsp;
          <b>Mobile:</b> {patient.mobile} &nbsp;|&nbsp;
          <b>Gender:</b> {patient.gender}
        </div>
      </div>

      {/* ---------- Add Visit ---------- */}
      <div style={visitCard}>
        <h3 style={{ color: "#0d47a1" }}>➕ Add Visit</h3>
        <form onSubmit={handleAddVisit}>
          <div style={grid}>
            <LabeledInput label="Visit Date" type="date" value={newVisit.visitDate}
              onChange={(v) => setNewVisit((f) => ({ ...f, visitDate: v }))} />
            <LabeledInput label="Follow-up Date" type="date" value={newVisit.followUpDate}
              onChange={(v) => setNewVisit((f) => ({ ...f, followUpDate: v }))} />
          </div>
          <LabeledInput label="Reason for Visit (Symptoms)*" value={newVisit.reason}
            onChange={(v) => setNewVisit((f) => ({ ...f, reason: v }))} required />
          <LabeledInput label="Diagnosis" value={newVisit.diagnosis}
            onChange={(v) => setNewVisit((f) => ({ ...f, diagnosis: v }))} />

          <h4>Prescriptions</h4>
          <div style={prescriptionRow}>
            <input
              type="text"
              placeholder="Medicine name"
              value={prescriptionEntry.name}
              onChange={(e) => setPrescriptionEntry((p) => ({ ...p, name: e.target.value }))}
              style={input}
            />
            <div style={checkboxGroup}>
              {["m", "a", "e", "bl"].map((t) => (
                <label key={t} style={checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={prescriptionEntry[t]}
                    onChange={(e) => setPrescriptionEntry((p) => ({ ...p, [t]: e.target.checked }))}
                  /> {t.toUpperCase()}
                </label>
              ))}
              <button type="button" onClick={addPrescription} style={btnSecondary}>Add</button>
            </div>
          </div>

          {newVisit.prescriptions.length > 0 && (
            <table style={miniTable}>
              <thead><tr><th>Medicine</th><th>M</th><th>A</th><th>E</th><th>BL</th><th></th></tr></thead>
              <tbody>
                {newVisit.prescriptions.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.m ? "✔" : ""}</td>
                    <td>{p.a ? "✔" : ""}</td>
                    <td>{p.e ? "✔" : ""}</td>
                    <td>{p.bl ? "✔" : ""}</td>
                    <td><button type="button" onClick={() => removePrescription(i)} style={btnTiny}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <LabeledInput label="Notes" value={newVisit.notes}
            onChange={(v) => setNewVisit((f) => ({ ...f, notes: v }))} />

          <button type="submit" style={btnPrimary} disabled={adding}>
            {adding ? "Saving..." : "Save Visit"}
          </button>
        </form>
      </div>

      {/* ---------- Visit History ---------- */}
      <div style={visitListCard}>
        <h3 style={{ color: "#0d47a1" }}>📋 Visit History</h3>
        {visits.length === 0 ? (
          <p style={{ color: "#777" }}>No visits yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead style={thead}>
                <tr>
                  <th>Date</th><th>Reason</th><th>Diagnosis</th><th>Notes</th><th>Prescriptions</th><th>Follow-up</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td>{v.visitDate || "-"}</td>
                    <td>{v.reason || "-"}</td>
                    <td>{v.diagnosis || "-"}</td>
                    <td>{v.notes || "-"}</td>
                    <td>
                      {(v.prescriptions || []).map((p, i) => (
                        <div key={i}>
                          {p.name} [{["M","A","E","BL"].filter(t => p[t.toLowerCase()]).join(", ")}]
                        </div>
                      ))}
                    </td>
                    <td>{v.followUpDate || "-"}</td>
                    <td>
                      <button onClick={() => setEditingVisit(v)} style={btnSecondaryTiny}>✏️</button>
                      <button onClick={() => handleDeleteVisit(v.id)} style={btnDangerTiny}>🗑</button>
                      <button onClick={() => printVisit(v)} style={btnPrimaryTiny}>🖨</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Edit Modal ---------- */}
      {editingVisit && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3>Edit Visit</h3>
            <LabeledInput label="Visit Date" type="date" value={editingVisit.visitDate}
              onChange={(v) => setEditingVisit((f) => ({ ...f, visitDate: v }))} />
            <LabeledInput label="Follow-up Date" type="date" value={editingVisit.followUpDate}
              onChange={(v) => setEditingVisit((f) => ({ ...f, followUpDate: v }))} />
            <LabeledInput label="Reason for Visit (Symptoms)" value={editingVisit.reason}
              onChange={(v) => setEditingVisit((f) => ({ ...f, reason: v }))} />
            <LabeledInput label="Diagnosis" value={editingVisit.diagnosis}
              onChange={(v) => setEditingVisit((f) => ({ ...f, diagnosis: v }))} />
            <LabeledInput label="Notes" value={editingVisit.notes}
              onChange={(v) => setEditingVisit((f) => ({ ...f, notes: v }))} />

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={handleEditSave} style={btnPrimary}>Save</button>
              <button onClick={() => setEditingVisit(null)} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Components & Styles ---------- */
function LabeledInput({ label, value, onChange, type = "text", required = false }) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: "red" }}>*</span>}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={required} style={input} />
    </div>
  );
}

const outer = { padding: 20, background: "#f4f7fc", minHeight: "100vh", fontFamily: "Segoe UI, sans-serif" };
const btnBack = { background: "white", border: "1px solid #1565c0", color: "#1565c0", borderRadius: 6, padding: "6px 12px", cursor: "pointer", marginBottom: 12 };
const headerBox = { background: "white", padding: 16, borderRadius: 10, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" };
const visitCard = { background: "white", padding: 20, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginBottom: 16 };
const visitListCard = { background: "white", padding: 20, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 };
const labelStyle = { display: "block", fontWeight: 600, marginBottom: 6 };
const input = { width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ccc", marginBottom: 8 };
const btnPrimary = { background: "#1565c0", color: "white", border: "none", padding: "8px 12px", borderRadius: 6, cursor: "pointer" };
const btnSecondary = { background: "white", border: "1px solid #1565c0", color: "#1565c0", borderRadius: 6, padding: "6px 10px", cursor: "pointer" };
const btnTiny = { border: "none", background: "transparent", cursor: "pointer", color: "red" };
const btnPrimaryTiny = { background: "#1565c0", color: "white", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer", marginLeft: 4 };
const btnSecondaryTiny = { background: "#fff", border: "1px solid #1565c0", color: "#1565c0", borderRadius: 4, padding: "2px 6px", cursor: "pointer", marginRight: 4 };
const btnDangerTiny = { background: "#e53935", color: "white", border: "none", borderRadius: 4, padding: "2px 6px", cursor: "pointer" };
const table = { width: "100%", borderCollapse: "collapse", border: "1px solid #eaeaea" };
const miniTable = { width: "100%", marginTop: 10, borderCollapse: "collapse", border: "1px solid #eaeaea", fontSize: 13 };
const thead = { background: "#f0f5ff", color: "#0d47a1" };
const prescriptionRow = { display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 };
const checkboxGroup = { display: "flex", justifyContent: "center", gap: 12, alignItems: "center", flexWrap: "wrap" };
const checkboxLabel = { display: "flex", alignItems: "center", gap: 4 };
const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const modalBox = { background: "white", padding: 20, borderRadius: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.2)", width: "90%", maxWidth: 500 };
