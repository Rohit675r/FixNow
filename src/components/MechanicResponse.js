// MechanicResponse.js
import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import QRCode from "react-qr-code";
import UserReviewPopup from "./UserReviewPopup";

const socket = io("http://localhost:5000");

const formatINR = (n) =>
  typeof n === "number"
    ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : n;

const MechanicResponse = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const mapRef = useRef(null);

  const mechanicAccepted = state?.mechanicAccepted || {};
  const userRequest = state?.userRequest || {};

  const [finalAmount, setFinalAmount] = useState(mechanicAccepted.amount ?? null);
  const [breakdown, setBreakdown] = useState(userRequest.problemsBreakdown || []);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [upiCopied, setUpiCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [showReviewPopup, setShowReviewPopup] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const DEFAULT_UPI_ID =
    mechanicAccepted.upiId || mechanicAccepted.contactUpi || "rohitchoudhary9323@oksbi";

  const mechanicLat = mechanicAccepted.lat || 19.076;
  const mechanicLng = mechanicAccepted.lng || 72.8777;
  const userLat = userRequest.location?.lat || userRequest.lat || 19.076;
  const userLng = userRequest.location?.lng || userRequest.lng || 72.8777;

  const computedTotal =
    finalAmount ??
    (Array.isArray(breakdown)
      ? breakdown.reduce((s, it) => s + Number(it.amount || 0), 0)
      : null);

  // Load Google Maps script dynamically
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBQDmsB1z60OSL8k4x3_xWhMB7Y7lmjjzo`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
    return () => document.head.removeChild(script);
  }, []);

  // Render map with directions
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: (mechanicLat + userLat) / 2, lng: (mechanicLng + userLng) / 2 },
      zoom: 13,
    });

    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({ map });

    new window.google.maps.Marker({ position: { lat: mechanicLat, lng: mechanicLng }, map, label: "🔧" });
    new window.google.maps.Marker({ position: { lat: userLat, lng: userLng }, map, label: "🏠" });

    directionsService.route(
      {
        origin: { lat: userLat, lng: userLng },
        destination: { lat: mechanicLat, lng: mechanicLng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK") directionsRenderer.setDirections(result);
        else console.error("Directions request failed: " + status);
      }
    );
  }, [mapLoaded, mechanicLat, mechanicLng, userLat, userLng]);

  // Socket listeners
  useEffect(() => {
    if (!userRequest._id) return;

    const handleJobCompleted = (data) => {
      if (data.requestId?.toString() === userRequest._id.toString()) {
        setFinalAmount(Number(data.amount || 0));
        if (Array.isArray(data.breakdown)) setBreakdown(data.breakdown);
        alert(`🔔 Service completed! Payable amount: ${formatINR(Number(data.amount || 0))}`);
      }
    };

    const handlePaymentUpdate = (payload) => {
      if (payload.requestId?.toString() !== userRequest._id?.toString()) return;
      setPaymentStatus(payload.status);
      if (payload.status === "verified") {
        setMessage("✅ Payment verified successfully!");
        setTimeout(() => setPaymentModalOpen(false), 800);
        setTimeout(() => setShowReviewPopup(true), 600);
      } else if (payload.status === "failed") {
        setMessage("❌ Payment failed.");
      }
    };

    socket.on("job-completed", handleJobCompleted);
    socket.on("payment-status", handlePaymentUpdate);
    socket.on("payment-verified", handlePaymentUpdate);

    return () => {
      socket.off("job-completed", handleJobCompleted);
      socket.off("payment-status", handlePaymentUpdate);
      socket.off("payment-verified", handlePaymentUpdate);
    };
  }, [userRequest._id]);

  if (!state || !state.mechanicAccepted || !state.userRequest) {
    navigate("/");
    return null;
  }

  const handleUserPaidCash = () => {
    if (!userRequest._id) return;
    setPaymentMethod("cash");
    setPaymentStatus("pending");
    socket.emit("cash-paid", { requestId: userRequest._id, amount: computedTotal });
    setMessage("💬 Waiting for mechanic to verify payment...");
  };

  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(
    DEFAULT_UPI_ID
  )}&pn=${encodeURIComponent(
    mechanicAccepted.garageName || mechanicAccepted.name || "FixNow Mechanic"
  )}&am=${encodeURIComponent(computedTotal || "")}&cu=INR`;

  const handleInitiateOnline = () => {
    setPaymentMethod("online");
    setPaymentStatus("pending");
    socket.emit("online-payment-initiated", {
      requestId: userRequest._id,
      amount: computedTotal,
      upi: DEFAULT_UPI_ID,
    });
    window.open(upiDeepLink, "_blank");
    setMessage("💸 Waiting for UPI payment confirmation...");
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 1500);
    } catch {
      alert("Failed to copy UPI ID");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header style={{ padding: 20, background: "#007bff", color: "#fff" }}>
        <h1>Mechanic Accepted Your Request</h1>
      </header>

      <main style={{ display: "flex", flex: 1 }}>
        {/* Left Panel */}
        <div style={{ flex: 1, padding: 20, borderRight: "1px solid #ddd", display: "flex", flexDirection: "column", gap: 10 }}>
          <h2>Mechanic Details</h2>
          <p><strong>Name:</strong> {mechanicAccepted.name || "-"}</p>
          <p><strong>Garage:</strong> {mechanicAccepted.garageName || "-"}</p>
          <p><strong>Address:</strong> {mechanicAccepted.address || "-"}</p>

          <h3>Your Request</h3>
          <p><strong>Vehicle Type:</strong> {userRequest.vehicleType || "-"}</p>
          <p><strong>Vehicle Name/Model:</strong> {userRequest.vehicleName || "-"}</p>
          <p><strong>Issue:</strong> {userRequest.issue || "-"}</p>

          <h3>Itemized Breakdown</h3>
          {Array.isArray(breakdown) && breakdown.length > 0 ? (
            <div style={{ borderRadius: 8, padding: 12, background: "#0b1220ff" }}>
              {breakdown.map((b, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < breakdown.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.title || b.name || "Custom item"}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{b.type === "preset" ? "Service" : "Other"}</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{formatINR(Number(b.amount || 0))}</div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 16 }}>
                <div style={{ fontWeight: 800 }}>Total</div>
                <div style={{ fontWeight: 900, color: "#0b9e3b" }}>{formatINR(computedTotal)}</div>
              </div>
            </div>
          ) : (
            <p style={{ color: "#b56500" }}>{finalAmount ? `Total Amount: ${formatINR(finalAmount)}` : "Awaiting mechanic to complete job..."}</p>
          )}

          <div style={{ marginTop: 10 }}>
            <button onClick={() => { setPaymentModalOpen(true); setPaymentMethod(null); setPaymentStatus(null); }} disabled={!computedTotal} style={{ padding: 12, background: "#007bff", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: computedTotal ? "pointer" : "not-allowed" }}>
              Pay {computedTotal ? formatINR(computedTotal) : ""}
            </button>
          </div>
          {message && <div style={{ marginTop: 12, color: "#444" }}>{message}</div>}
        </div>

        {/* Right Panel - Map */}
        <div ref={mapRef} style={{ flex: 1, minHeight: "400px" }} />
      </main>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ width: 520, borderRadius: 12, background: "#fff", color: "#000", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Pay {formatINR(computedTotal)}</h3>
              <button onClick={() => setPaymentModalOpen(false)} style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ color: "#444" }}>Choose a payment method. You can pay in cash or via UPI.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setPaymentMethod("cash")} style={{ flex: 1, padding: 10, borderRadius: 8, border: paymentMethod === "cash" ? "2px solid #007bff" : "1px solid #ccc", background: paymentMethod === "cash" ? "#e6f0ff" : "#fff" }}>Cash</button>
              <button onClick={() => setPaymentMethod("online")} style={{ flex: 1, padding: 10, borderRadius: 8, border: paymentMethod === "online" ? "2px solid #007bff" : "1px solid #ccc", background: paymentMethod === "online" ? "#e6f0ff" : "#fff" }}>Online (UPI)</button>
            </div>
            {paymentMethod === "cash" && (
              <div style={{ marginTop: 14 }}>
                <p>Pay <strong>{formatINR(computedTotal)}</strong> directly to the mechanic and then click below:</p>
                <button onClick={handleUserPaidCash} style={{ padding: "10px 14px", borderRadius: 8, background: "#28a745", color: "#fff", border: "none", cursor: "pointer" }}>I have paid (notify mechanic)</button>
                {paymentStatus === "pending" && <p style={{ color: "#7a5a00", marginTop: 10 }}>Waiting for mechanic confirmation...</p>}
                {paymentStatus === "verified" && <p style={{ color: "#0b9e3b", marginTop: 10 }}>Payment verified ✅</p>}
              </div>
            )}
            {paymentMethod === "online" && (
              <div style={{ marginTop: 14 }}>
                <p>Pay via UPI to: <strong>{DEFAULT_UPI_ID}</strong></p>
                <button onClick={() => copyToClipboard(DEFAULT_UPI_ID)} style={{ padding: 6, borderRadius: 6, background: "#007bff", color: "#fff", border: "none" }}>{upiCopied ? "Copied!" : "Copy UPI ID"}</button>
                <div style={{ marginTop: 10, textAlign: "center" }}><QRCode value={upiDeepLink} size={160} /><p style={{ fontSize: 13, color: "#555" }}>Scan to pay</p></div>
                <button onClick={handleInitiateOnline} style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#28a745", color: "#fff", border: "none", cursor: "pointer" }}>I have paid via UPI</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Popup */}
      {showReviewPopup && <UserReviewPopup userId={userRequest.userId} visible={showReviewPopup} jobId={userRequest._id} mechanicId={mechanicAccepted._id} onClose={() => setShowReviewPopup(false)} />}
    </div>
  );
};

export default MechanicResponse;
