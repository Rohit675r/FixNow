// Lmechanic.js
import React from "react";
import "./Lmechanic.css";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Lmechanic popup component
 *
 * Props:
 * - mechanic: mechanic object
 * - onClose: function to close popup
 * - onDirection: function callback to open map directions
 */
export default function Lmechanic({ mechanic, onClose, onDirection }) {
  const navigate = useNavigate();
  if (!mechanic) return null;

  const normalizeMobile = (raw) => {
    if (!raw && raw !== 0) return null;
    const s = String(raw).replace(/\D/g, "");
    if (s.length === 12 && s.startsWith("91")) return s.slice(-10);
    if (s.length === 11 && s.startsWith("0")) return s.slice(-10);
    if (s.length === 10) return s;
    return null;
  };

  const handleCall = () => {
    const phone = normalizeMobile(mechanic.mobile || mechanic.phone || mechanic.contact);
    if (phone) window.location.href = `tel:${phone}`;
    else alert("Phone number not available");
  };

  const handleRequest = () => {
    navigate("/1request", { state: { mechanic } });
    onClose && onClose();
  };

  const handleDirection = () => {
    onClose && onClose();
    setTimeout(() => {
      onDirection && onDirection(mechanic);
    }, 80);
  };

  // Motion variants
  const overlayVariant = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.15 } },
  };

  const cardVariant = {
    hidden: { opacity: 0, scale: 0.75 },
    visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.75, transition: { duration: 0.15 } },
  };

  const btnTap = { scale: 0.97 };

  return (
    <AnimatePresence>
      <motion.div
        className="popup-overlay"
        variants={overlayVariant}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{
          position: "fixed",
          inset: 0,
          background: "#0a0f1a",
          zIndex: 2000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
        onClick={(e) => e.target === e.currentTarget && onClose && onClose()}
      >
        <motion.div
          className="popup-card"
          variants={cardVariant}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{
            width: "min(720px, 96%)",
            borderRadius: 12,
            background: "#121828",
            padding: 18,
            position: "relative",
            boxShadow: "0 20px 60px rgba(2,6,23,0.7)",
            color: "var(--text)",
            overflow: "hidden",
          }}
        >
          <button
            className="popup-close"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              fontSize: 18,
              cursor: "pointer",
              padding: 6,
            }}
          >
            ✕
          </button>

          <div className="popup-header" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {mechanic.photo ? (
              <motion.img
                src={mechanic.photo}
                alt={mechanic.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.28 }}
                style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" }}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.28 }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  background: "#2c2f4a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 28,
                  color: "#fff",
                }}
              >
                {(mechanic.name && mechanic.name[0]?.toUpperCase()) || "M"}
              </motion.div>
            )}

            <div style={{ flex: 1 }}>
              <h2 className="popup-title" style={{ margin: 0, fontSize: 20 }}>
                {mechanic.name || mechanic.garageName || "Mechanic"}
              </h2>
              <p className="popup-sub" style={{ margin: "6px 0 0 0", color: "#aaa" }}>
                {mechanic.address || mechanic.vicinity || "Address not available"}
              </p>
              {mechanic.rating && (
                <p className="popup-rating" style={{ margin: "6px 0 0 0", color: "#ffd166" }}>
                  ⭐ {mechanic.rating}
                </p>
              )}
            </div>
          </div>

          {mechanic.description && (
            <motion.p
              className="popup-desc"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.25 }}
              style={{ marginTop: 10, color: "#ccc" }}
            >
              {mechanic.description}
            </motion.p>
          )}

          <motion.div
            className="popup-actions"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.06 } },
            }}
            style={{ display: "flex", gap: 10, marginTop: 16 }}
          >
            <motion.button
              className="popup-btn direction"
              onClick={handleDirection}
              whileTap={btnTap}
              whileHover={{ scale: 1.02 }}
            >
              Get Directions
            </motion.button>

            <motion.button
              className="popup-btn call"
              onClick={handleCall}
              whileTap={btnTap}
              whileHover={{ scale: 1.02 }}
            >
              Call
            </motion.button>

            <motion.button
              className="popup-btn request"
              onClick={handleRequest}
              whileTap={btnTap}
              whileHover={{ scale: 1.02 }}
              style={{
                background: "linear-gradient(135deg, #4f46e5, #22d3ee)", // same as Get Directions
                color: "#fff",
              }}
            >
              Request
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
