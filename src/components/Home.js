// Home.js
import "../index.css";
import Lmechanic from "./Lmechanic";

import { useNavigate } from "react-router-dom";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { useState, useEffect, useRef } from "react";


 
const defaultCenter = { lat: 19.076, lng: 72.8777 }; // Mumbai

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: "AIzaSyBQDmsB1z60OSL8k4x3_xWhMB7Y7lmjjzo",
    libraries: ["places"],
  });

  const [currentLocation, setCurrentLocation] = useState(defaultCenter);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedType, setSelectedType] = useState("car");
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [directions, setDirections] = useState(null);

  const mapRef = useRef(null);

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("loggedInUser");
    if (storedUser) setUser(JSON.parse(storedUser));
  }, []);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => setCurrentLocation(defaultCenter)
      );
    }
  }, []);

  const getLatLng = (loc) => {
    if (!loc) return null;
    const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
    const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
    return { lat, lng };
  };

  // Search mechanics
  const handleSearch = async () => {
    if (!isLoaded || !mapRef.current) return;

    const wantsNearby =
      !query.trim() ||
      /near me|nearby|mechanic/i.test(query.trim().toLowerCase());

    const service = new window.google.maps.places.PlacesService(mapRef.current);

    if (wantsNearby) {
      let keyword =
        selectedType === "bike"
          ? "bike repair mechanic"
          : selectedType === "towing"
          ? "towing service"
          : selectedType === "truck"
          ? "truck repair mechanic"
          : selectedType === "van"
          ? "van repair mechanic"
          : selectedType === "suv"
          ? "SUV repair mechanic"
          : "car mechanic";

      const req = {
        location: currentLocation,
        radius: 5000,
        type: "car_repair",
        keyword,
      };

      service.nearbySearch(req, (res, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          const simplified = res.map((p) => {
            const pos = getLatLng(p.geometry?.location);
            return {
              place_id: p.place_id,
              name: p.name,
              address: p.vicinity || p.formatted_address || "",
              lat: pos?.lat,
              lng: pos?.lng,
              rating: p.rating,
            };
          });
          setResults(simplified);
        } else {
          setResults([]);
          alert("No nearby services found");
        }
      });
    } else {
      const req = { query, location: currentLocation, radius: 5000 };
      service.textSearch(req, (res, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          const simplified = res.map((p) => {
            const pos = getLatLng(p.geometry?.location);
            return {
              place_id: p.place_id,
              name: p.name,
              address: p.formatted_address || p.vicinity || "",
              lat: pos?.lat,
              lng: pos?.lng,
              rating: p.rating,
            };
          });
          setResults(simplified);
        } else {
          setResults([]);
          alert("No results found");
        }
      });
    }
  };

  // Fetch full mechanic details when clicked
  const handleCardClick = (place) => {
    if (!mapRef.current) return;
    const service = new window.google.maps.places.PlacesService(mapRef.current);

    service.getDetails(
      {
        placeId: place.place_id,
        fields: [
          "name",
          "formatted_address",
          "formatted_phone_number",
          "geometry",
          "types",
          "rating",
          "reviews",
          "editorial_summary",
          "photos",
        ],
      },
      (details, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          const description =
            details.editorial_summary?.overview ||
            (details.reviews && details.reviews[0]?.text) ||
            details.types?.join(", ") ||
            "No description available";

          const photoUrl = details.photos?.[0]?.getUrl({ maxWidth: 400 }) || null;

          const fullPlace = {
            ...place,
            description,
            phone: details.formatted_phone_number || null,
            lat: details.geometry.location.lat(),
            lng: details.geometry.location.lng(),
            photo: photoUrl,
          };
          setSelectedMechanic(fullPlace);
        } else {
          setSelectedMechanic(place);
        }
      }
    );
  };

  const handleDirection = (m) => {
    if (!isLoaded || !mapRef.current || !m.lat || !m.lng) return;

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: currentLocation,
        destination: { lat: m.lat, lng: m.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK || status === "OK") {
          setDirections(result);
          mapRef.current.panTo({ lat: m.lat, lng: m.lng });
        }
      }
    );
  };

 

  

  const Logout = () => {
    localStorage.removeItem("loggedInUser");
    setUser(null);
    navigate("/login");
  };

  return (
    <>
      {/* Navbar */}
      <header className="nav">
        <div className="container nav__row">
          <a className="nav__brand" href="#">FixNow</a>
          <nav className="nav__links">
            <a className="nav__link" href="#" onClick={(e) => { e.preventDefault(); navigate("/about"); }}>
    About us
  </a>
            <a className="nav__link" href="#"onClick={(e) => { e.preventDefault(); navigate("/history1"); }}>History</a>
            <a className="nav__link" href="#"onClick={(e) => { e.preventDefault(); navigate("/contact"); }}>Contact us</a>

            {user ? (
              <div className="profile-wrapper" style={{ position: "relative" }}>
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
                    src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
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
                      minWidth: 180,
                      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                      zIndex: 100,
                      color: "var(--text)",
                      animation: "fadeIn 0.25s ease",
                    }}
                  >
                    <div
                      style={{
                        marginBottom: 10,
                        fontWeight: "600",
                        fontSize: "15px",
                        color: "#fff",
                        textAlign: "center",
                      }}
                    >
                      {user.name || user.email}
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
                        transition: "opacity 0.2s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
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
              Stuck on the road? Find trusted mechanics around you.
            </h1>
            <p className="hero__subtitle">
              For breakdowns. Car, bike, tow, battery—get help fast.
            </p>

            <div style={{ margin: "14px 0 8px 0", color: "#fff9f9ff" }}>
              <strong>Need immediate help?</strong>
              <div style={{ fontSize: 14, color: "#ffffffff", marginTop: 6 }}>
                Tap <strong>Request Help</strong> to broadcast your problem to nearby
                mechanics — they can accept your request and come to your location.
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() =>
                  navigate("/request", { state: { defaultType: selectedType } })
                }
                style={{
                  background: "#ff6b00",
                  color: "#fff",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  marginRight: 10,
                }}
              >
                Request Help
              </button>
            </div>

            {/* Vehicle selection */}
            <div className="vehicle-options" style={{ marginBottom: "15px", display: "flex", gap: 8 }}>
              {["bike", "car", "towing", "truck", "van", "suv"].map((t) => (
                <button
                  key={t}
                  className={`vehicle-btn ${selectedType === t ? "active" : ""}`}
                  onClick={() => setSelectedType(t)}
                  
                  whileHover={{ scale: 1.02 }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: selectedType === t ? "2px solid #210af1ff" : "1px solid #ccc",
                    background: selectedType === t ? "#2f00ffff" : "#fff",
                    color: selectedType === t ? "#fff" : "#333",
                    cursor: "pointer",
                    fontWeight: 500,
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="search hero__search">
              <input
                className="search__input"
                placeholder="Enter mechanic name or 'mechanic near me'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button className="search__btn" onClick={handleSearch}>
                Search now
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Layout */}
      <main className="container layout" style={{ display: "flex", gap: 20, height: "80vh" }}>
        {/* Results */}
        <section className="panel results" style={{ flex: 1, overflowY: "auto" }}>
          {results.length > 0 ? (
            results.map((place) => (
              <div
                key={place.place_id}
                className="card"
                onClick={() => handleCardClick(place)}
                style={{ cursor: "pointer" }}
              >
                <div className="card__avatar">M</div>
                <div>
                  <h3 className="card__title">{place.name}</h3>
                  <p className="card__sub">{place.address}</p>
                  <p style={{ color: "#555", marginTop: 6 }}>
                    Rating: {place.rating ?? "N/A"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p style={{ padding: 20 }}>Search for mechanics to see results</p>
          )}
        </section>

        {/* Map */}
        <aside className="panel map" style={{ flex: 2 }}>
          <div className="map__canvas" style={{ height: "100%" }}>
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%", borderRadius: "18px" }}
                center={currentLocation}
                zoom={14}
                onLoad={(map) => (mapRef.current = map)}
              >
                <Marker position={currentLocation} label="You" />
                {results.map((r) => (
                  <Marker
                    key={r.place_id}
                    position={{ lat: r.lat, lng: r.lng }}
                    onClick={() => setSelected(r)}
                    title={r.name}
                  />
                ))}

                {selected && (
                  <InfoWindow
                    position={{ lat: selected.lat, lng: selected.lng }}
                    onCloseClick={() => setSelected(null)}
                  >
                    <div style={{ maxWidth: 220 }}>
                      <strong>{selected.name}</strong>
                      <div style={{ fontSize: 13 }}>{selected.address}</div>
                      <div>Rating: {selected.rating ?? "N/A"}</div>
                    </div>
                  </InfoWindow>
                )}

                {directions && <DirectionsRenderer directions={directions} />}
              </GoogleMap>
            ) : (
              <p style={{ padding: 20 }}>Loading map...</p>
            )}
          </div>
        </aside>
      </main>

      {/* Mechanic detail popup */}
      <Lmechanic
        mechanic={selectedMechanic}
        onClose={() => setSelectedMechanic(null)}
        onDirection={handleDirection}
        
      />

      
      {/* Footer */}
      <footer className="footer">
        <div className="container footer__row">
          <div>© FixNow</div>
          <div>
            <a href="#">Terms</a> · <a href="#">Privacy</a>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Home;
  
