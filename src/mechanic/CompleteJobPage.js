// src/pages/CompleteJobPage.js
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";

// Persist socket across renders; ensure server URL matches your backend
const socket = io("http://localhost:5000", { autoConnect: false });

const CompleteJobPage = () => {
  const { id } = useParams(); // job id
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [problems, setProblems] = useState([]); // preset problems from server
  const [selected, setSelected] = useState({}); // map problemId -> true
  const [otherEntries, setOtherEntries] = useState([]); // { title, amount }
  const [job, setJob] = useState(null);

  // payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash"); // "cash" | "online"
  const [paymentStatus, setPaymentStatus] = useState(null); // null | "pending" | "verified" | "failed"

  // Connect socket once (and listen for payment events)
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const onPaymentStatus = (payload) => {
      if (!payload || !payload.requestId) return;
      if (payload.requestId.toString() !== id.toString()) return;
      setPaymentStatus(payload.status);
      if (payload.status === "verified") setMessage("✅ Payment verified.");
      else if (payload.status === "pending") setMessage("⏳ Payment pending.");
      else if (payload.status === "failed") setMessage("❌ Payment failed.");
    };

    socket.on("payment-status", onPaymentStatus);
    socket.on("payment-verified", onPaymentStatus);

    return () => {
      socket.off("payment-status", onPaymentStatus);
      socket.off("payment-verified", onPaymentStatus);
    };
  }, [id]);

  // Navigate to mhome automatically after payment verification
  useEffect(() => {
    if (paymentStatus === "verified") {
      const timer = setTimeout(() => {
        setPaymentModalOpen(false);
        navigate("/mhome");
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus, navigate]);

  // Fetch job details and problems
  useEffect(() => {
    (async () => {
      try {
        const jobRes = await axios.get(`http://localhost:5000/requests/${id}`).catch(() => null);
        if (jobRes && jobRes.data && jobRes.data.request) {
          setJob(jobRes.data.request);
          const vt = jobRes.data.request.vehicleType || "car";
          const p = await axios.get(`http://localhost:5000/problems?vehicleType=${encodeURIComponent(vt)}`);
          if (p.data && p.data.problems) setProblems(p.data.problems);
          return;
        }
        const p = await axios.get(`http://localhost:5000/problems?vehicleType=car`);
        if (p.data && p.data.problems) setProblems(p.data.problems);
      } catch (err) {
        console.error("Failed to load problems:", err);
      }
    })();
  }, [id]);

  const togglePreset = (pid) => {
    setSelected((prev) => {
      const copy = { ...prev };
      if (copy[pid]) delete copy[pid];
      else copy[pid] = true;
      return copy;
    });
  };

  const addOther = () => setOtherEntries((s) => [...s, { title: "", amount: "" }]);
  const updateOther = (index, field, val) => {
    setOtherEntries((s) => {
      const copy = [...s];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };
  const removeOther = (index) => setOtherEntries((s) => s.filter((_, i) => i !== index));

  const computeTotal = () => {
    let t = 0;
    for (const p of problems) {
      if (selected[p._id]) t += Number(p.amount || 0);
    }
    for (const o of otherEntries) {
      const amt = Number(o.amount);
      if (!isNaN(amt) && isFinite(amt)) t += amt;
    }
    return t;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    const chosen = [];

    for (const p of problems) {
      if (selected[p._id]) chosen.push({ type: "preset", problemId: p._id.toString() });
    }

    for (const o of otherEntries) {
      if (o.title && o.title.trim() && o.amount !== "") {
        const amt = Number(o.amount);
        if (!isFinite(amt) || amt < 0) {
          return setMessage("Invalid amount entered for custom item.");
        }
        chosen.push({ type: "other", title: o.title.trim(), amount: amt });
      }
    }

    if (chosen.length === 0) return setMessage("Select or add at least one problem.");

    setLoading(true);
    try {
      const res = await axios.post(`http://localhost:5000/api/complete-job/${id}`, { problems: chosen });
      if (res.data && res.data.success) {
        setMessage("✅ Job completed and amount saved.");
        setPaymentModalOpen(true);
        setPaymentStatus("pending");
      } else {
        setMessage("❌ Failed to complete job: " + (res.data?.message || "Unknown"));
      }
    } catch (err) {
      console.error("Error completing job:", err);
      if (err.response) setMessage(`⚠️ Server Error: ${err.response.status} - ${err.response.data?.message || JSON.stringify(err.response.data)}`);
      else setMessage("⚠️ Error while completing job.");
    } finally {
      setLoading(false);
    }
  };

  const total = computeTotal();

  const markAsPaidCash = () => {
    socket.emit("payment-verified", { requestId: id, status: "verified", method: "cash" });
    setPaymentStatus("verified");
    setMessage("✅ Payment verified (marked as cash-paid).");
  };

  const closeModal = () => {
    setPaymentModalOpen(false);
    setPaymentMethod("cash");
    setPaymentStatus(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0b1220,#101826)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 700, background: "#1a2238", borderRadius: 12, padding: 24 }}>
        <h2 style={{ textAlign: "center", marginBottom: 18 }}>Complete Job</h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <strong>Choose standard fixes:</strong>
            <div style={{ marginTop: 10 }}>
              {problems.length === 0 ? (
                <p style={{ color: "#ccc" }}>No preset problems available for this vehicle type.</p>
              ) : (
                problems.map((p) => (
                  <label key={p._id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <input type="checkbox" checked={!!selected[p._id]} onChange={() => togglePreset(p._id)} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{p.title}</div>
                      <div style={{ fontSize: 13, color: "#9aa" }}>₹{p.amount}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <strong>Other fixes (add custom):</strong>
            <div style={{ marginTop: 8 }}>
              {otherEntries.map((o, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <input
                    placeholder="Problem description"
                    value={o.title}
                    onChange={(e) => updateOther(i, "title", e.target.value)}
                    style={{ flex: 2, padding: 8, borderRadius: 6, border: "1px solid #333", background: "#0f172a", color: "#fff" }}
                  />
                  <input
                    placeholder="Amount"
                    type="number"
                    value={o.amount}
                    onChange={(e) => updateOther(i, "amount", e.target.value)}
                    style={{ width: 120, padding: 8, borderRadius: 6, border: "1px solid #333", background: "#0f172a", color: "#fff" }}
                  />
                  <button type="button" onClick={() => removeOther(i)} style={{ padding: 8, borderRadius: 6, background: "#d9534f", border: "none", color: "#fff" }}>
                    Remove
                  </button>
                </div>
              ))}
              <div>
                <button type="button" onClick={addOther} style={{ padding: "8px 12px", borderRadius: 6, background: "#007bff", border: "none", color: "#fff", marginTop: 6 }}>
                  + Add custom fix
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 18, textAlign: "right", fontSize: 18 }}>
            <strong>Total: </strong> <span style={{ color: "#28a745", fontWeight: 700 }}>₹{total}</span>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", background: "linear-gradient(90deg,#007bff,#00c6ff)", color: "#fff", fontWeight: 600 }}
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>

          {message && (
            <p style={{ marginTop: 14, color: message.startsWith("✅") ? "#0f0" : "#ffb86b", fontWeight: 600 }}>{message}</p>
          )}
        </form>
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", zIndex: 9999 }}>
          <div style={{ width: 560, background: "#fff", color: "#000", borderRadius: 12, padding: 18 }}>
            <h3>Waiting for user to pay</h3>
            <p>Total: <strong>₹{total}</strong></p>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setPaymentMethod("cash")} style={{ flex: 1, padding: 10, borderRadius: 8, border: paymentMethod === "cash" ? "2px solid #007bff" : "1px solid #ddd" }}>
                Cash
              </button>
              <button onClick={() => setPaymentMethod("online")} style={{ flex: 1, padding: 10, borderRadius: 8, border: paymentMethod === "online" ? "2px solid #007bff" : "1px solid #ddd" }}>
                Online (UPI)
              </button>
            </div>

            {paymentMethod === "cash" && (
              <>
                <p>Mechanic: mark the payment as received once the user gives cash.</p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={markAsPaidCash} style={{ padding: "10px 14px", background: "#28a745", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                    Mark as Paid (User paid cash)
                  </button>
                  <button onClick={closeModal} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}>
                    Close
                  </button>
                </div>
                {paymentStatus === "pending" && <p style={{ marginTop: 8, color: "#7a5a00" }}>Waiting for user to pay...</p>}
                {paymentStatus === "verified" && <p style={{ marginTop: 8, color: "#0b9e3b" }}>Payment verified ✅</p>}
              </>
            )}

            {paymentMethod === "online" && (
              <>
                <p>User will pay via UPI. Awaiting confirmation...</p>
                {paymentStatus === "pending" && <p style={{ marginTop: 8, color: "#7a5a00" }}>Waiting for payment...</p>}
                {paymentStatus === "verified" && <p style={{ marginTop: 8, color: "#0b9e3b" }}>Payment verified ✅</p>}
                <div style={{ marginTop: 12 }}>
                  <button onClick={closeModal} style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompleteJobPage;
