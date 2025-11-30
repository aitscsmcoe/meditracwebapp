// src/renderer/pages/DoctorProfileSetup.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  serverTimestamp,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import { adminDb, adminAuth } from "../services/firebaseAdmin";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { signOut } from "firebase/auth";

export default function DoctorProfileSetup() {
  const navigate = useNavigate();
  const user = adminAuth.currentUser;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    doctorName: "",
    clinicName: "",
    clinicAddress: "",
    doctorAddress: "",
    mobile: "",
    email: user?.email || "",
    degree: "",
    specialization: "",
    experienceYears: "",
    status: "Registered",
    registrationDate: null,
  });

  // helper parse date-like values
  const parseToDate = (val) => {
    if (!val) return null;
    if (val instanceof Timestamp) return val.toDate();
    if (typeof val === "object" && val?.seconds) return new Date(val.seconds * 1000);
    if (typeof val === "string") {
      const d = new Date(val);
      if (!isNaN(d)) return d;
    }
    if (val instanceof Date) return val;
    return null;
  };
  const fmt = (v) => {
    const d = parseToDate(v);
    return d ? dayjs(d).format("DD MMM YYYY") : "-";
  };

  // fetch or create doctor record
  const loadRecord = useCallback(async () => {
    setChecking(true);
    setMessage("");
    try {
      if (!user?.email) {
        setMessage("Not authenticated. Please login.");
        setLoading(false);
        setChecking(false);
        return null;
      }
      const ref = doc(adminDb, "DoctorsRegistered", user.email);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setForm((p) => ({
          ...p,
          doctorName: data.doctorName || "",
          clinicName: data.clinicName || "",
          clinicAddress: data.clinicAddress || "",
          doctorAddress: data.doctorAddress || "",
          mobile: data.mobile || "",
          degree: data.degree || "",
          specialization: data.specialization || "",
          experienceYears: data.experienceYears || "",
          status: data.status || "Registered",
          registrationDate: data.registrationDate || data.createdAt || null,
        }));
        return data;
      } else {
        // create minimal record (registered)
        await setDoc(ref, {
          email: user.email,
          status: "Registered",
          registrationDate: Timestamp.fromDate(new Date()),
          createdAt: serverTimestamp(),
        });
        setForm((p) => ({ ...p, status: "Registered", registrationDate: Timestamp.fromDate(new Date()) }));
        return null;
      }
    } catch (err) {
      console.error("loadRecord error:", err);
      setMessage("Error loading profile. See console.");
      return null;
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }, [user?.email]);

  useEffect(() => {
    loadRecord().then((data) => {
      // if already active, redirect to dashboard
      if (data?.status === "Active") {
        navigate("/doctor-dashboard");
      }
    });
  }, [loadRecord, navigate]);

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Save profile (only profile fields)
  const handleSaveProfile = async () => {
    if (!user?.email) return setMessage("Not authenticated.");
    setSaving(true);
    setMessage("");
    try {
      const ref = doc(adminDb, "DoctorsRegistered", user.email);
      await updateDoc(ref, {
        doctorName: form.doctorName,
        clinicName: form.clinicName,
        clinicAddress: form.clinicAddress,
        doctorAddress: form.doctorAddress,
        mobile: form.mobile,
        degree: form.degree,
        specialization: form.specialization,
        experienceYears: form.experienceYears,
      });
      setMessage("Profile saved successfully.");
    } catch (err) {
      console.error("SaveProfile:", err);
      setMessage("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  // Request activation
  const handleRequestActivation = async () => {
    if (!user?.email) return setMessage("Not authenticated.");
    if (!form.doctorName || !form.clinicName || !form.mobile || !form.degree || !form.specialization) {
      return setMessage("Please fill all professional and clinic details before requesting activation.");
    }
    setSaving(true);
    setMessage("");
    try {
      const docRef = doc(adminDb, "DoctorsRegistered", user.email);
      await updateDoc(docRef, {
        doctorName: form.doctorName,
        clinicName: form.clinicName,
        clinicAddress: form.clinicAddress,
        doctorAddress: form.doctorAddress,
        mobile: form.mobile,
        degree: form.degree,
        specialization: form.specialization,
        experienceYears: form.experienceYears,
        status: "Requested",
      });

      // add request in ActivationRequests collection
      const reqRef = doc(collection(adminDb, "ActivationRequests"));
      await setDoc(reqRef, {
        doctorEmail: user.email,
        doctorName: form.doctorName,
        clinicName: form.clinicName,
        mobile: form.mobile,
        degree: form.degree,
        specialization: form.specialization,
        experienceYears: form.experienceYears,
        requestedAt: Timestamp.fromDate(new Date()),
        status: "Pending",
      });

      setForm((p) => ({ ...p, status: "Requested" }));
      setMessage("Activation requested. Please contact admin for approval, <b>whatsapp only- 8830680737.</b>");
    } catch (err) {
      console.error("RequestActivation:", err);
      setMessage("Failed to request activation. See console.");
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setChecking(true);
    setMessage("Refreshing status...");
    try {
      const data = await loadRecord();
      if (data?.status === "Active") {
        setMessage("Activated — redirecting to dashboard...");
        setTimeout(() => navigate("/doctor-dashboard"), 700);
      } else if (data?.status === "Requested") {
        setMessage("Request is still pending. Please wait.");
      } else {
        setMessage(`Current status: ${data?.status || "Registered"}`);
      }
    } catch (err) {
      console.error("Refresh error:", err);
      setMessage("Refresh failed.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(adminAuth);
      localStorage.clear();
      navigate("/doctor-login");
    } catch (err) {
      console.error("Logout:", err);
      setMessage("Logout failed.");
    }
  };

  if (loading)
    return (
      <div style={outer}>
        <div style={card}>
          <h3>Loading profile...</h3>
        </div>
      </div>
    );

  return (
    <div style={outer}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Complete Profile</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleRefresh} style={btn} disabled={checking}>
              {checking ? "Checking..." : "Refresh"}
            </button>
            <button onClick={handleLogout} style={btnDanger}>Logout</button>
          </div>
        </div>

        <p style={{ color: "#444" }}>
          Fill clinic, professional & contact details before requesting activation.
        </p>

        <div style={{ display: "grid", gap: 8 }}>
          <input style={input} placeholder="Doctor Name" value={form.doctorName} onChange={(e) => onChange("doctorName", e.target.value)} />
          <input style={input} placeholder="Degree (e.g. MBBS, MD)" value={form.degree} onChange={(e) => onChange("degree", e.target.value)} />
          <input style={input} placeholder="Specialization (e.g. Pediatrics, Cardiology)" value={form.specialization} onChange={(e) => onChange("specialization", e.target.value)} />
          <input style={input} placeholder="Experience (Years)" type="number" value={form.experienceYears} onChange={(e) => onChange("experienceYears", e.target.value)} />
          <input style={input} placeholder="Clinic Name" value={form.clinicName} onChange={(e) => onChange("clinicName", e.target.value)} />
          <input style={input} placeholder="Clinic Address" value={form.clinicAddress} onChange={(e) => onChange("clinicAddress", e.target.value)} />
          <input style={input} placeholder="Doctor Address" value={form.doctorAddress} onChange={(e) => onChange("doctorAddress", e.target.value)} />
          <input style={input} placeholder="Mobile" value={form.mobile} onChange={(e) => onChange("mobile", e.target.value)} />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={handleSaveProfile} disabled={saving} style={btn}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
          <button
            onClick={handleRequestActivation}
            disabled={saving || form.status === "Requested"}
            style={btnPrimary}
          >
            {saving ? "Please wait..." : form.status === "Requested" ? "Requested" : "Request Activation"}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <p><b>Status:</b> <span style={{ fontWeight: 600 }}>{form.status}</span></p>
          <p><b>Registration Date:</b> {fmt(form.registrationDate)}</p>
        </div>

        {message && <p style={{ marginTop: 12 }}>{message}</p>}
      </div>
    </div>
  );
}

const outer = { fontFamily: "Segoe UI, sans-serif", background: "#f4f7fc", minHeight: "100vh", padding: 30 };
const card = { maxWidth: 820, margin: "20px auto", background: "white", padding: 20, borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,0.08)" };
const input = { width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14 };
const btn = { background: "#eee", border: "none", padding: "10px 14px", borderRadius: 6, cursor: "pointer" };
const btnPrimary = { background: "#1976d2", color: "white", border: "none", padding: "10px 14px", borderRadius: 6, cursor: "pointer" };
const btnDanger = { background: "#ef5350", color: "white", border: "none", padding: "10px 14px", borderRadius: 6, cursor: "pointer" };
