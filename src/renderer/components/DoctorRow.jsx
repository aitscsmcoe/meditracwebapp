// src/renderer/components/DoctorRow.jsx
import React from "react";

export default function DoctorRow({ doctor, onRenew, onRemove, onDelete, onView }) {
  const color = {
    Active: "#2e7d32",
    Expired: "#f57c00",
    Pending: "#1976d2",
    Removed: "#c62828",
  }[doctor.status] || "#757575";

  const pretty = (d) => {
    if (!d) return "—";
    if (typeof d === "object" && d.seconds)
      d = new Date(d.seconds * 1000);
    const dt = new Date(d);
    return isNaN(dt) ? String(d) : dt.toLocaleDateString();
  };

  const badge = {
    display: "inline-block",
    background: color + "22",
    border: `1px solid ${color}`,
    borderRadius: 8,
    color,
    fontWeight: 600,
    padding: "2px 8px",
  };

  const actionBtn = (bg) => ({
    padding: "5px 8px",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    color: "white",
    background: bg,
    fontSize: 12,
  });

  return (
    <tr style={{ background: "#fff", borderBottom: "1px solid #eee" }}>
      <td style={td}>{doctor.sno}</td>
      <td style={td}>{doctor.doctorName}</td>
      <td style={td}>{doctor.email}</td>
      <td style={td}>{doctor.mobile}</td>
      <td style={td}>{doctor.clinicName}</td>
      <td style={td}>{pretty(doctor.registrationDate)}</td>
      <td style={td}>{pretty(doctor.activationDate)}</td>
      <td style={td}>{pretty(doctor.expectedRenewalDate)}</td>
      <td style={{ ...td, textAlign: "center" }}>
        <span style={badge}>{doctor.status}</span>
      </td>
      <td style={td}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          <button style={actionBtn("#1565c0")} onClick={onView}>
            View
          </button>
          {doctor.status !== "Removed" && (
            <button style={actionBtn("#2e7d32")} onClick={onRenew}>
              Renew
            </button>
          )}
          {doctor.status !== "Removed" && (
            <button style={actionBtn("#f57c00")} onClick={onRemove}>
              Remove
            </button>
          )}
          <button style={actionBtn("#b71c1c")} onClick={onDelete}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

const td = {
  padding: "10px 12px",
  fontSize: 14,
  textAlign: "center",
};
