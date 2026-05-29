// History.js
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * History (user view)
 * Props:
 *   - user: { _id, id, email, name, ... }   (optional — falls back to localStorage)
 *
 * Backend: GET /user/history?userId=<id|email>
 */
export default function History({ user: userProp }) {
  const [user, setUser] = useState(userProp || null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  // keep local copy of user (fallback to localStorage if prop wasn't provided)
  useEffect(() => {
    if (userProp) {
      setUser(userProp);
      return;
    }
    try {
      const stored = localStorage.getItem("loggedInUser");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        console.debug("[History] loaded user from localStorage:", parsed);
      } else {
        setUser(null);
        console.debug("[History] no user prop and no loggedInUser in localStorage");
      }
    } catch (e) {
      console.warn("[History] failed to parse loggedInUser from localStorage", e);
      setUser(null);
    }
  }, [userProp]);

  useEffect(() => {
    // if user is available, fetch history
    if (!user) {
      setHistory([]);
      setError("Please sign in to view your history.");
      return;
    }
    fetchHistory();
  }, [user]);

  async function fetchHistory() {
    setLoading(true);
    setError(null);
    setHistory([]);

    try {
      const idCandidate = user._id ?? user.id ?? user.email ?? null;
      if (!idCandidate) throw new Error("Logged-in user object missing _id/id/email.");

      const mechParam = encodeURIComponent(idCandidate);
      const url = `http://localhost:5000/user/history?userId=${mechParam}`;
      console.debug("[History] fetching:", url);

      const res = await fetch(url, { method: "GET" });
      const text = await res.text();

      let data;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`Server returned non-JSON response: ${text}`);
      }

      if (!res.ok) {
        const msg = data?.error || data?.message || `Server returned ${res.status}`;
        throw new Error(msg);
      }

      const entries = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);
      setHistory(entries);
      console.debug("[History] fetched entries:", entries.length);
    } catch (err) {
      console.error("[History] fetchHistory error:", err);
      setError(err.message || "Failed to fetch history");
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  const fmtDate = (d) => {
    try {
      if (!d) return "-";
      const dt = new Date(d);
      return dt.toLocaleString();
    } catch {
      return d;
    }
  };

  return (
    <div>
      <h3 style={{ padding: 12 }}>Your Request History</h3>

      {loading ? (
        <p style={{ padding: 12 }}>Loading history...</p>
      ) : error ? (
        <p style={{ padding: 12, color: "red" }}>{error}</p>
      ) : history.length === 0 ? (
        <p style={{ padding: 12 }}>No history available for your account.</p>
      ) : (
        <div style={{ display: "grid", gap: 10, padding: 12 }}>
          <AnimatePresence>
            {history.map((h, i) => (
              <motion.div
                key={h._id || h.id}
                className="card"
                style={{
                  padding: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
                onClick={() => setSelected(h)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ display: "block" }}>{h.garageName || h.mechanic?.garageName || h.mechanic?.name || "Garage"}</strong>
                      <div style={{ fontSize: 13, color: "#666" }}>{h.vehicleName || h.vehicleType || "-"}</div>
                    </div>
                    <div style={{ textAlign: "right", marginLeft: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>₹ {Number(h.amount || 0).toLocaleString()}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{fmtDate(h.completedAt || h.createdAt)}</div>
                    </div>
                  </div>

                  <div style={{ marginTop: 8, color: "#444", fontSize: 14 }}>
                    {h.issue || h.description || "-"}
                  </div>
                </div>

                <div style={{ marginLeft: 12 }}>
                  <div style={{ fontSize: 12, color: h.status === "completed" ? "green" : "#666" }}>
                    {h.status ? h.status.charAt(0).toUpperCase() + h.status.slice(1) : (h.paymentStatus || "Completed")}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Details modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(2,6,23,0.6)",
              zIndex: 2000,
              padding: 20,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="panel"
              style={{
                width: "min(920px, 96%)",
                maxHeight: "90vh",
                overflowY: "auto",
                padding: 18,
                borderRadius: 12,
              }}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()} // prevent closing modal when clicking content
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ marginTop: 0 }}>{selected.garageName || selected.mechanic?.garageName || selected.mechanic?.name || "Garage details"}</h2>
                  <div style={{ color: "var(--muted)", marginBottom: 8 }}>
                    <strong>Vehicle:</strong> {selected.vehicleName || selected.vehicleType || "-"} &nbsp; • &nbsp;
                    <strong>Issue:</strong> {selected.issue || selected.description || "-"}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                    <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#999" }}>Requested At</div>
                      <div style={{ marginTop: 6 }}>{fmtDate(selected.createdAt)}</div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#999" }}>Completed At</div>
                      <div style={{ marginTop: 6 }}>{fmtDate(selected.completedAt)}</div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#999" }}>Amount</div>
                      <div style={{ marginTop: 6, fontWeight: 700 }}>₹ {Number(selected.amount || 0).toLocaleString()}</div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, color: "#999" }}>Payment</div>
                      <div style={{ marginTop: 6 }}>{selected.paymentMethod || "-"} {selected.paymentStatus ? `• ${selected.paymentStatus}` : ""}</div>
                    </div>
                  </div>

                  {/* Problems breakdown */}
                  {Array.isArray(selected.problemsBreakdown) && selected.problemsBreakdown.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <h4 style={{ margin: "8px 0" }}>Problems breakdown</h4>
                      <div style={{ display: "grid", gap: 8 }}>
                        {selected.problemsBreakdown.map((pb, idx) => (
                          <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: 10, background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                            <div>{pb.title || pb.name || "Item"}</div>
                            <div style={{ fontWeight: 700 }}>₹ {Number(pb.amount || pb.price || 0).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mechanic info */}
                  <div style={{ marginTop: 14 }}>
                    <h4 style={{ margin: "8px 0" }}>Mechanic</h4>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ width: 56, height: 56, borderRadius: 10, background: "linear-gradient(135deg, rgba(79,70,229,.35), rgba(34,211,238,.35))", display: "grid", placeItems: "center", fontWeight: 700 }}>
                        {selected.mechanic?.name ? selected.mechanic.name.split(" ").map(n => n[0]).slice(0,2).join("") : (selected.mechanic?.garageName ? selected.mechanic.garageName[0] : "G")}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{selected.mechanic?.name || selected.mechanic?.garageName || "Mechanic"}</div>
                        <div style={{ color: "var(--muted)", fontSize: 13 }}>{selected.mechanic?.email || selected.mechanic?.mobile || "-"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ width: 120, textAlign: "right" }}>
                  <button onClick={() => setSelected(null)} style={{ padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "var(--text)" }}>
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
