// UserReviewPopup.js
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const socket = io("http://localhost:5000");

/**
 * Controlled + fallback review popup.
 * Props:
 *  - userId (string)           : id of the user (optional, used by fallback socket listener)
 *  - visible (boolean)         : if provided, controls visibility (preferred)
 *  - jobId (string)            : request/job id (optional)
 *  - mechanicId (string)       : mechanic id (optional)
 *  - onClose (function)        : callback to call when popup closed
 */
export default function UserReviewPopup({ userId, visible, jobId, mechanicId, onClose }) {
  const navigate = useNavigate();
  const [internalShow, setInternalShow] = useState(false); // fallback visibility
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fallback socket listener if parent doesn't control visibility
  useEffect(() => {
    if (typeof visible !== "undefined") return;

    const handler = (data) => {
      if (!data) return;
      const isVerified = data.status === "verified";
      const matchesJob = !jobId || data.requestId?.toString() === jobId?.toString();
      const matchesUser = !userId || data.userId === userId;
      if (isVerified && matchesJob && matchesUser) {
        setInternalShow(true);
      }
    };

    socket.on("payment-status", handler);
    socket.on("payment-verified", handler);

    return () => {
      socket.off("payment-status", handler);
      socket.off("payment-verified", handler);
    };
  }, [userId, jobId, visible]);

  const show = typeof visible !== "undefined" ? visible : internalShow;

  const close = () => {
    setInternalShow(false);
    if (onClose) onClose();
  };

  const handleSubmit = async () => {
    if (!rating || !review.trim()) return alert("Please give a rating and review");

    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:5000/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          mechanicId,
          userId,
          rating,
          review: review.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Thank you for your review!");
        close();
        navigate("/home");
      } else {
        alert("Failed to submit review: " + (data.message || JSON.stringify(data)));
      }
    } catch (err) {
      console.error("Error submitting review:", err);
      alert("Error submitting review. Check console for details.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="review-popup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="review-popup-content"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <h2 className="review-popup-title">Rate Your Mechanic</h2>
            <p className="review-popup-subtitle">Please provide a rating and review for the mechanic</p>

            <div className="review-rating-container">
              <label>Rating: </label>
              <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="review-select">
                {[5,4,3,2,1].map((n) => (
                  <option key={n} value={n}>{n} Star{n>1?"s":""}</option>
                ))}
              </select>
            </div>

            <div className="review-textarea-container">
              <textarea
                placeholder="Write your review..."
                value={review}
                onChange={(e) => setReview(e.target.value)}
                className="review-textarea"
              />
            </div>

            <div className="review-buttons-container">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="review-submit-btn"
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
              <button
                onClick={() => { close(); navigate("/home"); }}
                className="review-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
