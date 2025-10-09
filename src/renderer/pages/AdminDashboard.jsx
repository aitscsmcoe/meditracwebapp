// src/renderer/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { adminDb, adminAuth } from "../services/firebaseAdmin";
import DoctorRow from "../components/DoctorRow";
import { signOut } from "firebase/auth";

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // ---------------- fetch & auto-update ----------------
  useEffect(() => {
    const fetchDoctors = async () => {
      setLoading(true);
      try {
        const q = await getDocs(collection(adminDb, "DoctorsRegistered"));
        const list = q.docs.map((d, idx) => {
          const data = d.data() || {};
          return {
            id: d.id,
            sno: idx + 1,
            doctorName: data.doctorName || data.name || "",
            clinicName: data.clinicName || "",
            email: data.email || "",
            mobile: data.mobile || "",
            registrationDate: data.registrationDate || null,
            activationDate: data.activationDate || null,
            expectedRenewalDate: data.expectedRenewalDate || null,
            status: data.status || "Pending",
            raw: data,
          };
        });

        const today = new Date();

        // auto-expire check
        for (const d of list) {
          const rDate = getJsDate(d.expectedRenewalDate);
          if (d.status === "Active" && rDate && rDate < today) {
            await updateDoc(doc(adminDb, "DoctorsRegistered", d.id), {
              status: "Expired",
            });
            d.status = "Expired";
          }

          // ensure doctorId exists
          if (!d.raw.doctorId) {
            await updateDoc(doc(adminDb, "DoctorsRegistered", d.id), {
              doctorId: d.id,
            });
          }
        }

        setDoctors(list);
      } catch (err) {
        console.error("Error fetching doctors:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, [refreshKey]);

  const getJsDate = (d) => {
    if (!d) return null;
    if (typeof d === "object" && d.seconds)
      return new Date(d.seconds * 1000);
    const dt = new Date(d);
    return isNaN(dt) ? null : dt;
  };

  // ---------------- actions ----------------
  const doRefresh = () => setRefreshKey((k) => k + 1);

  const handleRenew = async (doctor) => {
    const confirmed = window.confirm(
      `Renew subscription for ${doctor.doctorName}?`
    );
    if (!confirmed) return;

    try {
      const now = new Date();
      const next = new Date();
      next.setFullYear(next.getFullYear() + 1);

      const ref = doc(adminDb, "DoctorsRegistered", doctor.id);
      await updateDoc(ref, {
        registrationDate:
          doctor.registrationDate || now.toISOString(), // only first time
        activationDate: now.toISOString(),
        expectedRenewalDate: next.toISOString(),
        status: "Active",
        renewedOn: serverTimestamp(),
      });

      alert(
        `Doctor renewed.\nActivation: ${now.toDateString()}\nNext Renewal: ${next.toDateString()}`
      );
      doRefresh();
    } catch (err) {
      console.error("Renew failed:", err);
      alert("Renew failed. Check console for details.");
    }
  };

  const handleRemove = async (doctor) => {
    const confirmed = window.confirm(
      `Deactivate ${doctor.doctorName}? This will block login.`
    );
    if (!confirmed) return;
    try {
      await updateDoc(doc(adminDb, "DoctorsRegistered", doctor.id), {
        status: "Removed",
        deactivationDate: new Date().toISOString(),
      });
      alert("Doctor removed.");
      doRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (doctor) => {
    const confirmed = window.confirm(
      `Permanently delete ${doctor.doctorName}?`
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(adminDb, "DoctorsRegistered", doctor.id));
      alert("Doctor deleted.");
      doRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleView = (doctor) => {
    const d = doctor.raw || {};
    alert(
      [
        `Name: ${doctor.doctorName}`,
        `Clinic: ${doctor.clinicName}`,
        `Email: ${doctor.email}`,
        `Mobile: ${doctor.mobile}`,
        `Status: ${doctor.status}`,
        `Registration Date: ${prettyDate(d.registrationDate)}`,
        `Activation Date: ${prettyDate(d.activationDate)}`,
        `Expected Renewal: ${prettyDate(d.expectedRenewalDate)}`,
      ].join("\n")
    );
  };

  const prettyDate = (d) => {
    if (!d) return "—";
    if (typeof d === "object" && d.seconds)
      d = new Date(d.seconds * 1000);
    const dt = new Date(d);
    return isNaN(dt) ? "—" : dt.toLocaleDateString();
  };

  const handleLogout = async () => {
    try {
      await signOut(adminAuth);
    } catch {}
    localStorage.clear();
    window.location.reload();
  };

  // ---------------- render ----------------
  return (
    <div style={outer}>
      <header style={header}>
        <h1 style={title}>MediTrac Admin Dashboard</h1>
        <div>
          <button onClick={doRefresh} style={btnLight}>
            ⟳ Refresh
          </button>
          <button onClick={handleLogout} style={btnLogout}>
            Logout
          </button>
        </div>
      </header>

      <section style={card}>
        <h2 style={subTitle}>Registered Doctors</h2>

        {loading ? (
          <p>Loading...</p>
        ) : doctors.length === 0 ? (
          <p>No records found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr style={thead}>
                  <th>#</th>
                  <th>Doctor</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Clinic</th>
                  <th>Registration</th>
                  <th>Activation</th>
                  <th>Expected Renewal</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((d) => (
                  <DoctorRow
                    key={d.id}
                    doctor={d}
                    onRenew={() => handleRenew(d)}
                    onRemove={() => handleRemove(d)}
                    onDelete={() => handleDelete(d)}
                    onView={() => handleView(d)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------- styles ----------------
const outer = {
  fontFamily: "Segoe UI, sans-serif",
  background: "#e8f0fe",
  minHeight: "100vh",
  padding: 20,
};

const header = {
  background: "linear-gradient(90deg, #1565c0, #42a5f5)",
  color: "white",
  padding: "12px 20px",
  borderRadius: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 3px 8px rgba(0,0,0,0.25)",
};

const title = {
  margin: 0,
  fontSize: 22,
  letterSpacing: 0.5,
};

const subTitle = {
  marginTop: 0,
  color: "#1565c0",
};

const card = {
  marginTop: 24,
  background: "white",
  borderRadius: 10,
  padding: 16,
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
};

const btnLight = {
  marginRight: 10,
  background: "rgba(255,255,255,0.2)",
  color: "white",
  border: "none",
  borderRadius: 6,
  padding: "6px 10px",
  cursor: "pointer",
};

const btnLogout = {
  background: "#ef5350",
  border: "none",
  borderRadius: 6,
  padding: "6px 10px",
  color: "white",
  cursor: "pointer",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  borderRadius: 8,
  overflow: "hidden",
};

const thead = {
  background: "#1976d2",
  color: "white",
};
