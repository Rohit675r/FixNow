// Mreview.js
import React, { useEffect, useState } from "react";

export default function Mreview({ mechanic }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mechanic) return;

    const fetchReviews = async () => {
      setLoading(true);
      setError(null);

      try {
        const mechId = mechanic._id || mechanic.email;
        const res = await fetch(
          `http://localhost:5000/mechanic/reviews?mechanicId=${encodeURIComponent(mechId)}`
        );

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Server returned ${res.status} ${res.statusText}. ${txt}`);
        }

        const data = await res.json();
        setReviews(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to fetch reviews");
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [mechanic]);

  if (!mechanic)
    return <p style={{ color: "#b00", padding: 12 }}>Mechanic not signed in.</p>;

  return (
    <div>
      <h3 style={{ padding: 12 }}>Customer Reviews</h3>

      {loading ? (
        <p style={{ padding: 12 }}>Loading reviews...</p>
      ) : error ? (
        <p style={{ padding: 12, color: "red" }}>{error}</p>
      ) : reviews.length === 0 ? (
        <p style={{ padding: 12 }}>No reviews available for your account.</p>
      ) : (
        reviews.map((rev, i) => (
          <div
            key={i}
            className="card"
            style={{
              marginBottom: 12,
              padding: 14,
              borderRadius: 8,
              background: "#1a1f35",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            {/* Name + Rating */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
             
              <span style={{ fontSize: 12, color: "#ffcc00", fontWeight: 500 }}>
                ⭐ {rev.rating ?? "-"}
              </span>
            </div>

            {/* Review text */}
            <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              {rev.text || rev.review}
            </div>

            {/* Date */}
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 8, textAlign: "right" }}>
              {rev.createdAt ? new Date(rev.createdAt).toLocaleString() : ""}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
