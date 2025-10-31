// src/renderer/pages/DoctorDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { adminDb, adminAuth } from "../services/firebaseAdmin";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

/**
 * DoctorDashboard with editable Registration Details (except email, doctorName, dates)
 */

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const user = adminAuth.currentUser;

  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard | patients | registration
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [doctor, setDoctor] = useState(null);
  const [message, setMessage] = useState("");

  // Editing state for profile fields
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    clinicName: "",
    clinicAddress: "",
    doctorAddress: "",
    mobile: "",
  });
  const [saving, setSaving] = useState(false);

  // parse timestamps/values to Date
  const parseToDate = (value) => {
    if (!value) return null;
    try {
      if (value?.toDate) return value.toDate(); // Firestore Timestamp
      if (value?.seconds) return new Date(value.seconds * 1000);
      if (typeof value === "string") {
        const d = new Date(value);
        if (!isNaN(d)) return d;
      }
      if (value instanceof Date) return value;
    } catch (e) {}
    return null;
  };

  const fmt = (val) => {
    const d = parseToDate(val);
    return d ? dayjs(d).format("DD MMM YYYY") : "-";
  };

  // load doctor record
  const loadDoctor = useCallback(async () => {
    setChecking(true);
    setMessage("");
    try {
      if (!user?.email) {
        setMessage("Not authenticated. Please login.");
        setDoctor(null);
        setLoading(false);
        setChecking(false);
        return null;
      }
      const ref = doc(adminDb, "DoctorsRegistered", user.email);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setMessage("No registration record found. Please complete registration.");
        setDoctor(null);
        return null;
      }
      const data = snap.data();
      setDoctor(data);
      // initialize form with editable values
      setForm({
        clinicName: data.clinicName || "",
        clinicAddress: data.clinicAddress || "",
        doctorAddress: data.doctorAddress || "",
        mobile: data.mobile || "",
      });
      return data;
    } catch (err) {
      console.error("Error loading doctor record:", err);
      setMessage("Failed to load data. See console.");
      return null;
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadDoctor();
  }, [loadDoctor]);

  // manual refresh (for activation check)
  const handleRefresh = async () => {
    setChecking(true);
    setMessage("Refreshing...");
    try {
      const data = await loadDoctor();
      if (data?.status === "Active") {
        setMessage("Activated — you can proceed to use the app.");
      } else if (data?.status === "Requested") {
        setMessage("Activation requested and pending admin approval.");
      } else {
        setMessage(`Status: ${data?.status || "Registered"}`);
      }
    } catch (err) {
      setMessage("Refresh failed. See console.");
    } finally {
      setChecking(false);
    }
  };

  // logout
  const handleLogout = async () => {
    try {
      await signOut(adminAuth);
      localStorage.clear();
      navigate("/doctor-login");
    } catch (err) {
      console.error("Logout failed:", err);
      setMessage("Logout failed. See console.");
    }
  };

  // start editing
  const startEdit = () => {
    if (!doctor) return;
    setForm({
      clinicName: doctor.clinicName || "",
      clinicAddress: doctor.clinicAddress || "",
      doctorAddress: doctor.doctorAddress || "",
      mobile: doctor.mobile || "",
    });
    setEditing(true);
    setMessage("");
  };

  const cancelEdit = () => {
    setEditing(false);
    setMessage("");
  };

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // simple mobile validation (10 digits)
  const validMobile = (m) => {
    if (!m) return false;
    const cleaned = m.replace(/\D/g, "");
    return cleaned.length >= 7 && cleaned.length <= 15; // flexible
  };

  // Save only editable profile fields (do NOT touch dates or doctorName/email)
  const handleSave = async () => {
    if (!user?.email) return setMessage("Not authenticated.");
    if (!validMobile(form.mobile)) return setMessage("Please enter a valid mobile number.");

    setSaving(true);
    setMessage("");
    try {
      const ref = doc(adminDb, "DoctorsRegistered", user.email);
      await updateDoc(ref, {
        clinicName: form.clinicName,
        clinicAddress: form.clinicAddress,
        doctorAddress: form.doctorAddress,
        mobile: form.mobile,
      });

      // update local state only for these fields
      setDoctor((prev) => ({ ...prev, ...{
        clinicName: form.clinicName,
        clinicAddress: form.clinicAddress,
        doctorAddress: form.doctorAddress,
        mobile: form.mobile,
      }}));
      setEditing(false);
      setMessage("Profile details saved.");
    } catch (err) {
      console.error("Save failed:", err);
      setMessage("Save failed. See console.");
    } finally {
      setSaving(false);
    }
  };

  // UI components for tabs
  const DashboardTab = () => (
    <div style={{ padding: 16 }}>
      <h3>Welcome{doctor?.doctorName ? `, Dr. ${doctor.doctorName}` : ""}</h3>
      <p style={{ color: "#555" }}>Quick summary:</p>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <div style={statCard}>
          <div style={statLabel}>Status</div>
          <div style={statValue}>{doctor?.status || "Registered"}</div>
        </div>
        <div style={statCard}>
          <div style={statLabel}>Registered</div>
          <div style={statValue}>{fmt(doctor?.registrationDate)}</div>
        </div>
        <div style={statCard}>
          <div style={statLabel}>Activation</div>
          <div style={statValue}>{fmt(doctor?.activationDate)}</div>
        </div>
        <div style={statCard}>
          <div style={statLabel}>Renewal</div>
          <div style={statValue}>{fmt(doctor?.expectedRenewalDate)}</div>
        </div>
      </div>
    </div>
  );

  const PatientsTab = () => (
    <div style={{ padding: 16 }}>
      <h3>My Patients</h3>
      <p style={{ color: "#666" }}>Patient list and visit history will appear here.</p>
    </div>
  );

  const RegistrationTab = () => (
    <div style={{ padding: 16 }}>
      <h3>Registration Details</h3>

      {loading ? (
        <p>Loading...</p>
      ) : !doctor ? (
        <p>No registration data found.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Doctor Name (read-only) */}
          <div style={detailCard}>
            <label style={label}>Doctor Name</label>
            <div style={value}>{doctor.doctorName || "-"}</div>
          </div>

          {/* Email (read-only) */}
          <div style={detailCard}>
            <label style={label}>Email</label>
            <div style={value}>{doctor.email || "-"}</div>
          </div>

          {/* Mobile (editable) */}
          <div style={detailCard}>
            <label style={label}>Mobile</label>
            {editing ? (
              <input style={input} value={form.mobile} onChange={(e) => onChange("mobile", e.target.value)} />
            ) : (
              <div style={value}>{doctor.mobile || "-"}</div>
            )}
          </div>

          {/* Clinic Name (editable) */}
          <div style={detailCard}>
            <label style={label}>Clinic Name</label>
            {editing ? (
              <input style={input} value={form.clinicName} onChange={(e) => onChange("clinicName", e.target.value)} />
            ) : (
              <div style={value}>{doctor.clinicName || "-"}</div>
            )}
          </div>

          {/* Clinic Address (editable, wide) */}
          <div style={{ ...detailCard, gridColumn: "1 / -1" }}>
            <label style={label}>Clinic Address</label>
            {editing ? (
              <textarea style={textarea} value={form.clinicAddress} onChange={(e) => onChange("clinicAddress", e.target.value)} />
            ) : (
              <div style={value}>{doctor.clinicAddress || "-"}</div>
            )}
          </div>

          {/* Doctor Address (editable, wide) */}
          <div style={{ ...detailCard, gridColumn: "1 / -1" }}>
            <label style={label}>Doctor Address</label>
            {editing ? (
              <textarea style={textarea} value={form.doctorAddress} onChange={(e) => onChange("doctorAddress", e.target.value)} />
            ) : (
              <div style={value}>{doctor.doctorAddress || "-"}</div>
            )}
          </div>

          {/* Dates — read only */}
          <div style={detailCard}>
            <label style={label}>Registration Date</label>
            <div style={value}>{fmt(doctor.registrationDate)}</div>
          </div>

          <div style={detailCard}>
            <label style={label}>Activation Date</label>
            <div style={value}>{fmt(doctor.activationDate)}</div>
          </div>

          <div style={detailCard}>
            <label style={label}>Expected Renewal</label>
            <div style={value}>{fmt(doctor.expectedRenewalDate)}</div>
          </div>

          <div style={detailCard}>
            <label style={label}>Status</label>
            <div style={value}>{doctor.status || "Registered"}</div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        {!editing ? (
          <>
            <button onClick={startEdit} style={btn}>Edit</button>
            <button onClick={handleRefresh} style={btn} disabled={checking}>{checking ? "Checking..." : "Refresh"}</button>
            <button onClick={handleLogout} style={btnDanger}>Logout</button>
          </>
        ) : (
          <>
            <button onClick={handleSave} style={btnPrimary} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
            <button onClick={cancelEdit} style={btn}>Cancel</button>
          </>
        )}
      </div>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );

  return (
    <div style={outer}>
      <div style={topBar}>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setActiveTab("dashboard")} style={tabButton(activeTab === "dashboard")}>Dashboard</button>
          <button onClick={() => setActiveTab("patients")} style={tabButton(activeTab === "patients")}>My Patients</button>
          <button onClick={() => setActiveTab("registration")} style={tabButton(activeTab === "registration")}>Registration Details</button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleRefresh} style={smallBtn} disabled={checking}>{checking ? "Checking..." : "Refresh"}</button>
          <button onClick={handleLogout} style={smallBtnDanger}>Logout</button>
        </div>
      </div>

      <div style={content}>
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "patients" && <PatientsTab />}
        {activeTab === "registration" && <RegistrationTab />}
      </div>
    </div>
  );
}

/* ---------- styles ---------- */
const outer = { fontFamily: "Segoe UI, sans-serif", background: "#f4f7fc", minHeight: "100vh" };
const topBar = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 30px", background: "#1565c0", color: "white" };
const content = { padding: 20 };
const tabButton = (active) => ({
  background: active ? "white" : "transparent",
  color: active ? "#1565c0" : "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: 6,
  cursor: "pointer",
  fontWeight: 600,
});
const btn = { background: "#eee", color: "#222", border: "none", padding: "8px 12px", borderRadius: 6, cursor: "pointer" };
const btnPrimary = { background: "#1976d2", color: "white", border: "none", padding: "8px 12px", borderRadius: 6, cursor: "pointer" };
const btnDanger = { background: "#ef5350", color: "white", border: "none", padding: "8px 12px", borderRadius: 6, cursor: "pointer" };
const smallBtn = { background: "white", color: "#1565c0", padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer" };
const smallBtnDanger = { background: "#ef5350", color: "white", padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer" };

const statCard = { background: "white", padding: 12, borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" };
const statLabel = { fontSize: 12, color: "#666" };
const statValue = { fontSize: 16, fontWeight: 700, marginTop: 6 };

const detailCard = { background: "white", padding: 12, borderRadius: 8, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" };
const label = { display: "block", fontSize: 12, color: "#666", marginBottom: 6 };
const value = { fontSize: 14, color: "#222" };

const input = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 };
const textarea = { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, minHeight: 70 };
