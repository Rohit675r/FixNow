// Mhome.js
import { io } from "socket.io-client";
import React, { useEffect, useState, useRef } from "react";
import "../index.css";
import Mhistory from "./Mhistory"; // adjust path if needed
import Mreview from "./Mreview";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { useNavigate } from "react-router-dom";
import Mpricing from "./MEarning";

const socket = io("http://localhost:5000");
const GOOGLE_API_KEY =
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
  "AIzaSyBQDmsB1z60OSL8k4x3_xWhMB7Y7lmjjzo"; // dev fallback

const defaultCenter = { lat: 19.076, lng: 72.8777 };

export default function Mhome() {
  const navigate = useNavigate();
  const [mechanic, setMechanic] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("requests");

  const [requests, setRequests] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(defaultCenter);
  const [directions, setDirections] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const mapRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GOOGLE_API_KEY,
    libraries: ["places"],
  });

  // Load mechanic and register socket
  useEffect(() => {
    const stored = localStorage.getItem("loggedInUser");
    let mechKey = null;

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMechanic(parsed);
        if (parsed.lat && parsed.lng)
          setCurrentLocation({ lat: parsed.lat, lng: parsed.lng });
        mechKey = parsed.email || parsed._id;
      } catch (e) {
        console.error("Failed to parse loggedInUser", e);
      }
    }

    if (mechKey) {
      socket.emit("register", { role: "mechanic", id: mechKey });

      const handleNewRequest = ({ request }) => {
        setRequests((prev) =>
          prev.find((r) => r._id === request._id) ? prev : [request, ...prev]
        );
      };
      socket.on("new-request", handleNewRequest);

      return () => {
        socket.off("new-request", handleNewRequest);
      };
    }
  }, []);

  // Listen for claimed requests
  useEffect(() => {
    const handleRequestClaimed = ({ requestId }) => {
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
    };
    socket.on("request-claimed", handleRequestClaimed);
    return () => socket.off("request-claimed", handleRequestClaimed);
  }, []);

  // Load mechanic online status
  useEffect(() => {
    if (!mechanic) return;
    (async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/mechanic/status?mechanicId=${encodeURIComponent(
            mechanic._id || mechanic.email
          )}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.online === "boolean") setIsOnline(data.online);
      } catch (e) {
        console.warn("Failed to fetch garage status", e);
      }
    })();
  }, [mechanic]);

  // Get browser location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => {}
      );
    }
  }, []);

  // Fetch reviews
  useEffect(() => {
    if (!mechanic) return;
    if (activeTab === "reviews") fetchReviews();
  }, [mechanic, activeTab]);

  async function fetchReviews() {
    try {
      const res = await fetch(
        `http://localhost:5000/mechanic/reviews?mechanicId=${encodeURIComponent(
          mechanic._id || mechanic.email
        )}`
      );
      if (!res.ok) throw new Error("Failed to fetch reviews");
      const data = await res.json();
      setReviews(data || []);
    } catch (err) {
      console.error(err);
      setReviews([]);
    }
  }

  // Handle accept/decline
  async function respondToRequest(request, action) {
    if (action === "accept") {
      try {
        const res = await fetch(
          `http://localhost:5000/mechanic/requests/${request._id}/accept`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mechanicId: mechanic._id,
              mechanicEmail: mechanic.email,
            }),
          }
        );
        if (!res.ok) throw new Error("Failed to accept request");
        setActiveJob({ ...request, _id: request._id.toString() });
        setRequests((prev) => prev.filter((r) => r._id !== request._id));
      } catch (err) {
        console.error(err);
        alert("Failed to accept request. It may have already been taken.");
      }
    } else {
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
    }
  }

  function openDirectionsTo(lat, lng) {
    if (!isLoaded || !mapRef.current || !lat || !lng) return;
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route(
      {
        origin: currentLocation,
        destination: { lat, lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK") {
          setDirections(result);
          mapRef.current.panTo({ lat, lng });
        } else {
          console.warn("Directions failed", status);
        }
      }
    );
  }

  const toggleStatus = async () => {
    setIsOnline((s) => !s);
    try {
      await fetch(`http://localhost:5000/mechanic/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mechanicId: mechanic?._id || mechanic?.email,
          online: !isOnline,
        }),
      });
    } catch (e) {
      console.warn("Failed to persist status", e);
    }
  };

  const Logout = () => {
    localStorage.removeItem("loggedInUser");
    setMechanic(null);
    navigate("/login");
  };

  useEffect(() => {
    if (loadError) console.error("Google Maps failed to load:", loadError);
  }, [loadError]);

  return (
    <>
      {/* Navbar */}
      <header className="nav">
        <div className="container nav__row">
          <a className="nav__brand" href="#">
            FixNow
          </a>
          <nav
            className="nav__links"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <a
              className={`nav__link ${activeTab === "requests" ? "active" : ""}`}
              onClick={() => setActiveTab("requests")}
              style={{ cursor: "pointer" }}
            >
              Requests
            </a>
            <a
              className={`nav__link ${activeTab === "reviews" ? "active" : ""}`}
              onClick={() => setActiveTab("reviews")}
              style={{ cursor: "pointer" }}
            >
              Reviews
            </a>
            <a
              className={`nav__link ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
              style={{ cursor: "pointer" }}
            >
              History
            </a>

           <a
              className={`nav__link ${activeTab === "earn" ? "active" : ""}`}
              onClick={() => setActiveTab("earn")}
              style={{ cursor: "pointer" }}
            >
              Earnings
            </a>

            {mechanic ? (
              <div className="profile-wrapper" style={{ position: "relative", marginLeft: 8 }}>
                <button
                  className="profile-btn"
                  onClick={() => setProfileOpen(!profileOpen)}
                  style={{
                    background: "linear-gradient(135deg, var(--brand), var(--brand-2))",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    boxShadow: "0 0 10px rgba(34,211,238,0.4)",
                  }}
                >
                  <img
                    src={mechanic?.photo || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"}
                    alt="profile"
                    style={{ width: 24, height: 24, filter: "brightness(1.1) contrast(1.2)" }}
                  />
                </button>

                {profileOpen && (
                  <div
                    className="profile-dropdown"
                    style={{
                      position: "absolute",
                      top: "48px",
                      right: 0,
                      background: "linear-gradient(180deg, #1a1f35 0%, #101426 100%)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: 14,
                      minWidth: 220,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                      zIndex: 100,
                      color: "var(--text)",
                    }}
                  >
                    <div style={{ marginBottom: 10, fontWeight: "600", fontSize: "15px", color: "#fff", textAlign: "center" }}>
                      {mechanic?.garageName || mechanic?.name || mechanic?.email}
                    </div>
                    <button
                      onClick={Logout}
                      style={{
                        width: "100%",
                        padding: "8px 0",
                        border: "none",
                        borderRadius: 8,
                        background: "linear-gradient(90deg, var(--brand), var(--brand-2))",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="nav__cta" onClick={() => navigate("/login")}>
                Sign in
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="container hero__grid">
          <div>
            <h1 className="hero__title">
              {mechanic?.garageName ? `Welcome — ${mechanic.garageName}` : "Mechanic Dashboard"}
            </h1>
            <p className="hero__subtitle">
              Manage incoming requests, navigate to customers, and view reviews.
            </p>
          </div>
        </div>
      </section>

      {/* Main Layout */}
      <main className="container layout" style={{ display: "flex", gap: 20, height: "72vh" }}>
        {/* Left Panel */}
<section className="panel results" style={{ flex: 1, overflowY: "auto" }}>
  {activeJob ? (
    <div>
      <h3 style={{ padding: 12, background: "#18A058", color: "white", borderRadius: "8px" }}>
        Active Job
      </h3>
      <div
        className="card"
        style={{
          padding: 16,
          marginTop: 10,
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          background: "#0b1220ff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong style={{ fontSize: 16 }}>{activeJob.userName || "Customer"}</strong>
          <span
            style={{
              fontSize: 12,
              padding: "2px 8px",
              borderRadius: 8,
              background: "#18A058",
              color: "#fff",
              textTransform: "capitalize",
            }}
          >
            {activeJob.status || "Accepted"}
          </span>
        </div>

        <div style={{ marginTop: 8, fontSize: 13 }}>
          <p><strong>Vehicle:</strong> {activeJob.vehicleName || "N/A"}</p>
          <p><strong>Issue:</strong> {activeJob.issue}</p>
          <p><strong>Requested At:</strong> {new Date(activeJob.createdAt).toLocaleString()}</p>
    
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate(`/complete-job/${activeJob._id.toString()}`)}
            style={{
              padding: "10px 15px",
              border: "none",
              background: "#007bff",
              color: "white",
              cursor: "pointer",
              borderRadius: 8,
              flex: 1,
            }}
          >
            Complete Job
          </button>
          <button
            onClick={() => setActiveJob(null)}
            style={{
              padding: "10px 15px",
              border: "none",
              background: "#6c757d",
              color: "white",
              cursor: "pointer",
              borderRadius: 8,
              flex: 1,
            }}
          >
            Cancel Job
          </button>
        </div>
      </div>
    </div>
  ) : activeTab === "requests" ? (
    <div>
      <h3 style={{ padding: 12 }}>Incoming Requests</h3>
      {requests.length > 0 ? (
        requests.map((r) => (
          <div
            key={r._id}
            className="card"
            style={{
              marginBottom: 12,
              padding: 16,
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              background: "#0b1220ff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 16 }}>{r.userName || "Customer"}</strong>
                <span
                  style={{
                    fontSize: 12,
                    padding: "2px 8px",
                    borderRadius: 8,
                    background: r.status === "completed" ? "#18A058" : "#FFA500",
                    color: "#fff",
                    textTransform: "capitalize",
                  }}
                >
                  {r.status || "Pending"}
                </span>
              </div>

              <div style={{ fontSize: 13, marginTop: 6 }}>{r.issue}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Vehicle: {r.vehicleName || "N/A"}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Requested At: {new Date(r.createdAt).toLocaleString()}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginLeft: 12 }}>
              <button
                onClick={() => openDirectionsTo(r.location?.lat, r.location?.lng)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #007bff",
                  background: "#007bff",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Navigate
              </button>
              <button
                onClick={() => respondToRequest(r, "accept")}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#18A058",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Accept 
              </button>
              <button
                onClick={() => respondToRequest(r, "decline")}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#d9534f",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Decline
              </button>
            </div>
          </div>
        ))
      ) : (
        <p style={{ padding: 20, textAlign: "center", color: "#666" }}>
          No new requests. You will be notified in real-time.
        </p>
      )}
    </div>
  ) : activeTab === "reviews" ? (
    <Mreview mechanic={mechanic} /> 
  ) : activeTab === "history" ? (
    <Mhistory mechanic={mechanic} />
  ) : activeTab === "earn" ? (
    <Mpricing mechanic={mechanic} />
  ) :null}
</section>


        {/* Right Panel: Map + Garage Status */}
        <aside className="panel map" style={{ flex: 2, display: "flex", flexDirection: "column" }}>
          <div style={{ marginBottom: 12, textAlign: "center" }}>
            <span>Garage Status: </span>
            <button
              onClick={toggleStatus}
              style={{
                background: isOnline ? "#18A058" : "#888",
                color: "#fff",
                padding: "6px 12px",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              {isOnline ? "Online" : "Offline"}
            </button>
          </div>

          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ flex: 1, borderRadius: "12px", border: "1px solid #ccc" }}
              center={currentLocation}
              zoom={13}
              onLoad={(map) => (mapRef.current = map)}
            >
              <Marker
                position={currentLocation}
                label="You"
                icon={{ url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png" }}
              />
              {activeJob?.location && (
                <Marker
                  position={activeJob.location}
                  onClick={() => openDirectionsTo(activeJob.location.lat, activeJob.location.lng)}
                  icon={{ url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png" }}
                />
              )}
              {directions && <DirectionsRenderer directions={directions} />}
            </GoogleMap>
          ) : (
            <p>Loading map...</p>
          )}
        </aside>
      </main>
    </>
  );
}
