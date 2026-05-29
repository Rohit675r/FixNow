// src/components/RequestPopup.js
import { io } from "socket.io-client";
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Initialize socket outside the component
const socket = io("http://localhost:5000", { autoConnect: false });

export default function RequestPopup() {
  const navigate = useNavigate();
  const location = useLocation();
  const mechanicFromState = location.state?.mechanic || null; // Mechanic passed in state
  const defaultType = location.state?.defaultType || "car";

  const [vehicleType, setVehicleType] = useState(defaultType);
  const [vehicleName, setVehicleName] = useState("");
  const [issue, setIssue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({ lat: 19.076, lng: 72.8777 });

  // garageName will be used to find mechanic(s). Default to mechanicFromState's place/name when available.
  const [garageName, setGarageName] = useState("");
  // optional local request preview/state
  const [requestPreview, setRequestPreview] = useState(null);

  // Prefill garageName when mechanicFromState is present
  useEffect(() => {
    if (mechanicFromState) {
      // use the google place name if available, otherwise fallback to displayed name
      setGarageName(mechanicFromState.googleplacename || mechanicFromState.name || "");
    }
  }, [mechanicFromState]);

  // Get user geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  // Disconnect socket on unmount
  useEffect(() => {
    return () => {
      if (socket && socket.connected) socket.disconnect();
    };
  }, []);

  const handleSubmit = async () => {
    if (!vehicleName.trim()) return alert("Please enter your vehicle name/model");
    if (!issue.trim()) return alert("Please describe the issue");
    if (!garageName.trim() && !mechanicFromState) return alert("Garage name missing");

    const stored = localStorage.getItem("loggedInUser");
    const user = stored ? JSON.parse(stored) : null;
    const userEmail = user?.email || user?.mobile || "anonymous@" + Date.now();

    // Build the request payload base (we'll add mechanic-specific fields per-mechanic)
    const baseRequest = {
      userId: user?._id || null,
      userName: user?.name || "Anonymous User",
      userEmail,
      vehicleType,
      vehicleName,
      issue,
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      createdAt: new Date(),
    };

    try {
      setSubmitted(true);

      // Determine mechanics to send to:
      // 1) If mechanicFromState exists, use it directly
      // 2) Otherwise, query backend for mechanics that match garageName
      let targetMechanics = [];

      if (mechanicFromState) {
        targetMechanics = [mechanicFromState];
      } else {
        const resMechanic = await fetch(
          `http://localhost:5000/mechanics?googleplacename=${encodeURIComponent(garageName)}`
        );
        if (!resMechanic.ok) {
          const err = await resMechanic.text();
          throw new Error("Failed to lookup mechanics: " + err);
        }
        const mechanicData = await resMechanic.json();
        if (!mechanicData || mechanicData.length === 0) {
          alert("No mechanic found for this garage");
          setSubmitted(false);
          return;
        }
        targetMechanics = mechanicData;
      }

      // Prepare all POST requests for each mechanic
      const postPromises = targetMechanics.map((m) => {
        const requestDataForMechanic = { ...baseRequest, mechanicId: m._id };
        // Save request to backend
        return fetch("http://localhost:5000/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestDataForMechanic),
        }).then(async (res) => {
          const json = await res.json().catch(() => null);
          if (!res.ok) {
            throw new Error(json?.error || `Failed to create request for mechanic ${m._id}`);
          }
          // Also emit via socket
          if (!socket.connected) {
            socket.connect();
          }
          socket.emit("send-to-mechanic", { mechanicId: m._id, request: requestDataForMechanic });
          return { mechanic: m, request: requestDataForMechanic, response: json };
        });
      });

      const results = await Promise.all(postPromises);

      // Keep a preview of the first request for UI/navigation
      setRequestPreview(results[0]);

      // Ensure socket is registered as user (only once)
      if (!socket.connected) {
        socket.connect();
        socket.once("connect", () => {
          socket.emit("register", { role: "user", id: userEmail });
        });
      } else {
        socket.emit("register", { role: "user", id: userEmail });
      }

      // Listen for acceptance (navigate to mechanic-response when accepted)
      socket.once("request-accepted", (payload) => {
        navigate("/mechanic-response", { state: payload });
      });

      socket.on("connect_error", (err) => console.error("Socket connection error:", err));
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to send request");
      setSubmitted(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 920, margin: "24px auto" }}>
      <button
        onClick={() => navigate(-1)}
        style={{
          marginBottom: 16,
          background: "transparent",
          border: "1px solid #eee",
          padding: "8px 12px",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      <div
        style={{
          background: "#0f1724",
          color: "#fff",
          borderRadius: 12,
          padding: 18,
          boxShadow: "0 10px 30px rgba(2,6,23,0.6)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20 }}>
          {mechanicFromState ? `Request Help from ${mechanicFromState.name}` : "Request Help"}
        </h2>
        <p style={{ marginTop: 8, color: "#cbd5e1" }}>
          {mechanicFromState ? mechanicFromState.address || "" : "Provide the garage name below to find mechanics."}
        </p>

        {mechanicFromState && mechanicFromState.photo && (
          <div style={{ marginTop: 10 }}>
            <img src={mechanicFromState.photo} alt={mechanicFromState.name} style={{ width: 100, borderRadius: 8 }} />
          </div>
        )}

        {!submitted ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {["bike", "car", "truck", "van", "suv"].map((t) => (
                <button
                  key={t}
                  onClick={() => setVehicleType(t)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: vehicleType === t ? "2px solid #60a5fa" : "1px solid rgba(255,255,255,0.06)",
                    background: vehicleType === t ? "linear-gradient(90deg,#60a5fa,#7c3aed)" : "transparent",
                    color: vehicleType === t ? "#fff" : "#e6eef8",
                    cursor: "pointer",
                  }}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Garage name input (prefilled from mechanic state if available) */}
            <input
              type="text"
              placeholder="Garage name (used to find mechanics)"
              value={garageName}
              onChange={(e) => setGarageName(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
                color: "#e6eef8",
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />

            <input
              type="text"
              placeholder="Vehicle name/model (e.g. Honda Activa, Swift)"
              value={vehicleName}
              onChange={(e) => setVehicleName(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
                color: "#e6eef8",
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />

            <textarea
              placeholder="Describe the issue (flat tyre, won't start, etc.)"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              style={{
                width: "100%",
                minHeight: 120,
                padding: 12,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(255,255,255,0.02)",
                color: "#e6eef8",
                boxSizing: "border-box",
                marginBottom: 12,
              }}
            />

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handleSubmit}
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(90deg,#ff6b00,#ff8a3d)",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Submit Request
              </button>

              <button
                onClick={() => navigate("/home")}
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.06)",
                  background: "transparent",
                  color: "#e6eef8",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: 18,
              background: "#0b1220",
              padding: 16,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
            role="status"
            aria-live="polite"
          >
            <div
              style={{
                fontSize: 26,
                padding: 8,
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              ✅
            </div>

            <div>
              <div style={{ fontWeight: 700, color: "#e6fff2" }}>Request sent!</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, color: "#cfe8ff" }}>
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "3px solid rgba(255,255,255,0.12)",
                    borderTopColor: "#fff",
                    animation: "rp-spin 1s linear infinite",
                    display: "inline-block",
                  }}
                  aria-hidden="true"
                />
                <span>Waiting for the mechanic to accept your request...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes rp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
