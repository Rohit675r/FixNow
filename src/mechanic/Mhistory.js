import React, { useEffect, useState } from "react";

export default function Mhistory({ mechanic }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null); // For popup

  useEffect(() => {
    if (!mechanic) return;

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const mechId = mechanic._id;
        const res = await fetch(`http://localhost:5000/mechanic/history?mechanicId=${encodeURIComponent(mechId)}`);
        if (!res.ok) throw new Error(`Server returned ${res.status} ${res.statusText}`);
        const data = await res.json();
        setHistory(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to fetch history");
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [mechanic]);

  if (!mechanic) return <p style={{ color: "#b00", padding: 12 }}>Mechanic not signed in.</p>;

  return (
    <div style={{ padding: 12 }}>
      <h3>Request History</h3>
      {loading && <p>Loading history...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!loading && !error && history.length === 0 && <p>No history available.</p>}

      {history.map((h) => (
        <div
          key={h._id}
          style={{
            border: "1px solid #141e34ff",
            borderRadius: 6,
            marginBottom: 12,
            padding: 12,
            background: "#141e34ff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{h.userName || h.user?.name || "Customer"}</strong>
            <span style={{ fontSize: 12, color: "#666" }}>{h.status || "completed"}</span>
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>{h.issue || "-"}</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Vehicle: {h.vehicleName || "-"}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            At: {h.createdAt ? new Date(h.createdAt).toLocaleString() : "-"}
          </div>
          <button
            onClick={() => setSelectedRequest(h)}
            style={{ marginTop: 8, padding: "6px 12px", borderRadius: 6, cursor: "pointer" }}
          >
            View Request
          </button>
        </div>
      ))}

      {/* Popup */}
      {selectedRequest && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
          onClick={() => setSelectedRequest(null)}
        >
          <div
            style={{
              background: "#0b1220ff",
              borderRadius: 8,
              width: "90%",
              maxWidth: 500,
              padding: 20,
              maxHeight: "80%",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Request Details</h4>
            <p><strong>User:</strong> {selectedRequest.userName || selectedRequest.user?.name || "-"}</p>
            <p><strong>Vehicle:</strong> {selectedRequest.vehicleName || "-"}</p>
            <p><strong>Issue:</strong> {selectedRequest.issue || "-"}</p>
            <p><strong>Date/Time:</strong> {selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleString() : "-"}</p>
            <p><strong>Status:</strong> {selectedRequest.status || "-"}</p>
            <p><strong>Amount:</strong> ₹{selectedRequest.amount || 0}</p>
            <p><strong>Payment Status:</strong> {selectedRequest.paymentStatus || "-"}</p>
            <p><strong>Payment Method:</strong> {selectedRequest.paymentMethod || "-"}</p>

            {selectedRequest.problemsBreakdown && selectedRequest.problemsBreakdown.length > 0 && (
              <div>
                <strong>Problem Breakdown:</strong>
                <ul>
                  {selectedRequest.problemsBreakdown.map((p, idx) => (
                    <li key={idx}>
                      {p.title || p.problemId} - ₹{p.amount}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              style={{
                marginTop: 12,
                padding: "6px 12px",
                borderRadius: 6,
                cursor: "pointer",
              }}
              onClick={() => setSelectedRequest(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
