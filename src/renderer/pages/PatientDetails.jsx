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
export default function PatientDetails({ id: propId, inline = false }) {
  const routeParams = useParams();
  const navigate = useNavigate();
  const id = propId || routeParams.id;

  /* ---------- Firebase App ---------- */
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
      console.error("Firebase init failed:", err);
      return {};
    }
  }, []);

  /* Auto-save config if needed */
  useEffect(() => {
    try {
      if (clinicApp && clinicApp.options && !localStorage.getItem("doctorFirebaseConfig")) {
        localStorage.setItem("doctorFirebaseConfig", JSON.stringify(clinicApp.options));
        console.info("Auto-saved Firebase config from PatientDetails.");
      }
    } catch (err) {
      console.warn("Auto-save config failed:", err);
    }
  }, [clinicApp]);

  /* ---------- States ---------- */
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
    dose: "",  // Added dose field
    m: false,
    a: false,
    e: false,
    bl: false,
  });

  const [suggestions, setSuggestions] = useState(
    JSON.parse(localStorage.getItem("medicineSuggestions")) || []
  );

  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(true); // For toggling suggestions visibility

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

     /* ---------- Delete Visit ---------- */

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

    // Save to localStorage for future suggestions
    const updatedSuggestions = [...new Set([...suggestions, prescriptionEntry.name])];
    setSuggestions(updatedSuggestions);
    localStorage.setItem("medicineSuggestions", JSON.stringify(updatedSuggestions));

    setPrescriptionEntry({ name: "", dose: "", m: false, a: false, e: false, bl: false });
  };

  const removePrescription = (i) => {
    setNewVisit((v) => ({
      ...v,
      prescriptions: v.prescriptions.filter((_, idx) => idx !== i),
    }));
  };

  const handleMedicineInputChange = (e) => {
    const input = e.target.value;
    setPrescriptionEntry((prev) => ({ ...prev, name: input }));

    // Filter suggestions based on user input
    const filtered = suggestions.filter((medicine) =>
      medicine.toLowerCase().includes(input.toLowerCase())
    );
    setFilteredSuggestions(filtered);
  };

  const handleSuggestionClick = (suggestion) => {
    setPrescriptionEntry((prev) => ({ ...prev, name: suggestion }));
    setFilteredSuggestions([]);  // Clear suggestions after selection
  };

  const toggleSuggestionsVisibility = () => {
    setIsSuggestionsVisible(!isSuggestionsVisible); // Toggle the visibility of suggestions list
  };

  /* ---------- Get doctor's details from Doctors dashboard from local storage ---------- */
  const docClinicName = localStorage.getItem("dClinicname");
  const docClinicAddress = localStorage.getItem("dClinicaddress");
  const docName = localStorage.getItem("dName");
  const docDegree = localStorage.getItem("dDegree");
  const docSp = localStorage.getItem("dSp");
  const docMobile = localStorage.getItem("dMobile");

  /* ---------- Print Visit ---------- */
  const printVisit = (v) => {
    const age = patient?.dob ? dayjs().diff(dayjs(patient.dob), "year") : "-";

    const html = `
      <html>
      <head>
        <title>Prescription - ${patient?.firstName || ""}</title>
        <style>
          body { font-family:'Segoe UI',sans-serif; padding:24px; border: 4px solid #6a6b83ff;; position:relative; }
          .clinic {color: #d6148cff; font-size:32px;font-family:Georgia; text-align:center;}
          .clinicAddress {font-size:16px;font-family:Areal; text-align:center;}
          .doctorName {font-size:18px;font-family:Areal;}
          .swasthasya { position: absolute; top: 20%; left: 10%; font-size: 50px; opacity: 0.1; transform: rotate(-45deg); color: orange; font-family: "Georgia", sans-serif; }
          .bline{ border:2px solid #6a6b83ff; }
          .label { font-weight: 600; }
          .label1 { font-weight: 600; margin-left:300px;}
          table { width:100%; border-collapse:collapse; margin-top:12px; }
          th,td { border:1px solid #ccccccff; padding:3px; text-align:center; }
          th { background:#f0f5ff; }
          .section { margin-top:10px; }
          .footer { text-align:right; font-size:11px; color:#777; margin-top:20px; }
          .doctor-details { background-color: #FFCC80; padding: 10px; border-radius: 8px; }
          .doctor-symbol { position: absolute; top: 10px; left: 10px; font-size: 30px; color: red; }
        </style>
      </head>
      <body>
        <div class="doctor-symbol">+</div>
        <div class="swasthasya">स्वस्थस्य स्वास्थ्यरक्षणम्</div>
        <div class="clinic"><b> ${docClinicName} </b></div>
        <div class="clinicAddress">${docClinicAddress}</div>
        <div class="doctor-details"><b> Doctor: </b> ${docName} [${docDegree} (${docSp})]</div>
        <div><b>Mobile- </b> ${docMobile}</div>
        <div class="spacer"></div>
        <hr class="bline">
        <div><span class="label">Visit Date:</span> ${v.visitDate || "-"} <span class="label1">Follow-up Date:</span> ${v.followUpDate || "-"}</div>
        <div><span class="label">Patient Name:</span> ${patient?.firstName || "-"}  ${patient?.lastName || "-"}, &nbsp;
        <b class="label"> (${age} Yrs * ${patient?.bloodGroup || "-"} * ${patient?.weight || "-"} kg * ${patient?.gender || "-"})</b></div>
        <div class="section">
          <h4>Prescriptions</h4>
          <table>
            <tr><th>Medicine</th><th>Dose</th><th>M</th><th>A</th><th>E</th><th>BM?</th></tr>
            ${(v.prescriptions || []).map(p =>
              `<tr><td>${p.name}</td><td> ${p.dose}</td><td>${p.m ? "✔" : ""}</td><td>${p.a ? "✔" : ""}</td><td>${p.e ? "✔" : ""}</td><td>${p.bl ? "✔" : ""}</td></tr>`
            ).join("")}
          </table>
        </div>

        ${v.notes ? `<div class="section"><span class="label">Notes:</span> ${v.notes}</div>` : ""}
        <br>
        <div class="footer">${docName} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
        <h5 style="color: #3bcc53ff;">Go Green, save pages, print only if needed!</h5>
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
      {/* Show Back only if not inline */}
      {!inline && (
        <button onClick={() => navigate("/doctor-dashboard/my-patients")} style={btnBack}>
          ← Back to My Patients
        </button>
      )}

      <div style={headerBox}>
        <h2 style={{ color: "#1565c0" }}>{patient.firstName} {patient.lastName}</h2>
        <div style={{ color: "#555" }}>
          <b>ID:</b> {patient.patientId} &nbsp;|&nbsp;
          <b>Mobile:</b> {patient.mobile} &nbsp;|&nbsp;
          <b>Gender:</b> {patient.gender}
        </div>
      </div>

      {/* Add Visit */}
      <div style={visitCard}>
        <h3 style={{ color: "#0d47a1" }}>➕ Add Visit</h3>
        <form onSubmit={handleAddVisit}>
          <div style={grid}>
            <LabeledInput label="Visit Date" type="date" value={newVisit.visitDate ?? ""} onChange={(v) => setNewVisit((f) => ({ ...f, visitDate: v }))} />
            <LabeledInput label="Follow-up Date" type="date" value={newVisit.followUpDate ?? ""} onChange={(v) => setNewVisit((f) => ({ ...f, followUpDate: v }))} />
          </div>
          <LabeledInput label="Reason for Visit (Symptoms)*" value={newVisit.reason ?? ""} onChange={(v) => setNewVisit((f) => ({ ...f, reason: v }))} required />
          <LabeledInput label="Diagnosis" value={newVisit.diagnosis ?? ""} onChange={(v) => setNewVisit((f) => ({ ...f, diagnosis: v }))} />

          <h4>Prescriptions</h4>
          <div style={prescriptionRow}>
            <input
              type="text"
              placeholder="Medicine name"
              value={prescriptionEntry.name ?? ""}
              onChange={handleMedicineInputChange}
              style={input}
            />
            {isSuggestionsVisible && filteredSuggestions.length > 0 && (
              <div style={{ position: "relative" }}>
                <ul style={suggestionListStyle}>
                  {filteredSuggestions.map((suggestion, index) => (
                    <li key={index} style={suggestionItemStyle} onClick={() => handleSuggestionClick(suggestion)}>
                      {suggestion}
                    </li>
                  ))}
                </ul>
                <button onClick={toggleSuggestionsVisibility} style={closeButtonStyle}><b>X</b></button>
              </div>
            )}
            <input
              type="text"
              placeholder="Dose (e.g., 10mg)"
              value={prescriptionEntry.dose ?? ""}
              onChange={(e) => setPrescriptionEntry((p) => ({ ...p, dose: e.target.value }))}
              style={input}
            />
            <div style={checkboxGroup}>
              {["m", "a", "e", "bl"].map((t) => (
                <label key={t} style={checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={!!prescriptionEntry[t]}
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
                    <td>{p.dose}</td>
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

          <LabeledInput label="Notes" value={newVisit.notes ?? ""} onChange={(v) => setNewVisit((f) => ({ ...f, notes: v }))} />

          <button type="submit" style={btnPrimary} disabled={adding}>
            {adding ? "Saving..." : "Save Visit"}
          </button>
        </form>
      </div>

      {/* Visit History */}
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
                        <div key={i}>{p.name} [{["M","A","E","BL"].filter(t => p[t.toLowerCase()]).join(", ")}]</div>
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

      {/* Edit Modal */}
      {editingVisit && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3>Edit Visit</h3>
            <LabeledInput label="Reason" value={editingVisit.reason ?? ""} onChange={(v) => setEditingVisit((f) => ({ ...f, reason: v }))} />
            <LabeledInput label="Diagnosis" value={editingVisit.diagnosis ?? ""} onChange={(v) => setEditingVisit((f) => ({ ...f, diagnosis: v }))} />
            <LabeledInput label="Notes" value={editingVisit.notes ?? ""} onChange={(v) => setEditingVisit((f) => ({ ...f, notes: v }))} />
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

const suggestionListStyle = {
  border: "1px solid #4d2d2dff",
  borderRadius: 5,
  padding: 0,
  margin: 0,
  position: "absolute",
  top: "15px", // Adjusted to appear below the input field
  maxHeight: "100px",
  overflowY: "auto",
  backgroundColor: "#a0ebf5ff",
  zIndex: 9999
};

const suggestionItemStyle = {
  padding: 5,
  cursor: "pointer"
};

const closeButtonStyle = {
  position: "absolute",
  top: 0,
  left:5,
  background: "transparent",
  border: "none",
  fontSize: "16px",
  backgroundColor: "#bef1f8ff",
  color: "red",
  cursor: "pointer"
};
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
const prescriptionRow = { display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 };
const checkboxGroup = { display: "flex", justifyContent: "center", gap: 10, alignItems: "center", flexWrap: "wrap" };
const checkboxLabel = { display: "flex", alignItems: "center", gap: 4 };
const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const modalBox = { background: "white", padding: 20, borderRadius: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.2)", width: "90%", maxWidth: 500 };
