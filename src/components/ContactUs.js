// ContactUs.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function ContactUs() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: null }));
  }

  function validate() {
    const err = {};
    if (!form.name.trim()) err.name = "Please enter your name.";
    if (!form.email.trim()) err.email = "Please enter your email.";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) err.email = "Enter a valid email.";
    if (form.phone && !/^\d{10}$/.test(form.phone)) err.phone = "Phone must be 10 digits (optional).";
    if (!form.subject.trim()) err.subject = "Please enter a subject.";
    if (!form.message.trim() || form.message.trim().length < 10) err.message = "Please enter a message (min 10 characters).";
    return err;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);

    const err = validate();
    if (Object.keys(err).length > 0) {
      setErrors(err);
      return;
    }

    setSending(true);
    try {
      const res = await fetch("http://localhost:5000/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          subject: form.subject.trim(),
          message: form.message.trim(),
        }),
      });

      if (!res.ok) throw new Error(await res.text() || `Server returned ${res.status}`);

      setStatus({ type: "success", msg: "Thanks! Your message has been sent — we'll get back to you soon." });
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
      setErrors({});
    } catch (err) {
      setStatus({ type: "error", msg: err.message || "Failed to send message. Try again later." });
    } finally {
      setSending(false);
    }
  }

  // Framer Motion variants
  const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };
  const fadeStagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } } };
  const btnTap = { scale: 0.97 };

  return (
    <AnimatePresence>
      <motion.div initial="hidden" animate="visible" exit="hidden" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.3 } } }}>
        {/* Navbar */}
        <header className="nav">
          <div className="container nav__row" style={{ alignItems: "center" }}>
            <a className="nav__brand" href="#" onClick={(e) => e.preventDefault()}>
              <span className="nav__brand-logo" aria-hidden="true" />
              <span style={{ marginLeft: 8 }}>FixNow</span>
            </a>
            <nav className="nav__links" style={{ marginLeft: "auto" }}>
              <a className="nav__link" href="#" onClick={(e) => { e.preventDefault(); navigate("/home"); }}>Home</a>
              <a className="nav__link" href="#" onClick={(e) => { e.preventDefault(); navigate("/about"); }}>About us</a>
              <a className="nav__link" href="#" onClick={(e) => { e.preventDefault(); navigate("/history1"); }}>History</a>
              <motion.button className="nav__cta" whileTap={btnTap} onClick={() => navigate("/")}>Sign in</motion.button>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <motion.section className="hero" variants={fadeUp} initial="hidden" animate="visible">
          <div className="container hero__grid" style={{ alignItems: "center" }}>
            <motion.div variants={fadeUp}>
              <h1 className="hero__title">Contact FixNow</h1>
              <p className="hero__subtitle">Questions, feedback, or need support? Send us a message — we're here to help.</p>
            </motion.div>

            <motion.div className="panel" style={{ padding: 18 }} variants={fadeUp}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 12, background: "linear-gradient(135deg, rgba(79,70,229,.35), rgba(34,211,238,.35))", display: "grid", placeItems: "center" }}>💬</div>
                <div>
                  <div style={{ fontWeight: 700 }}>Need help now?</div>
                  <div style={{ color: "var(--muted)" }}>Call our helpline: <strong style={{ color: "#22d3ee" }}>+91 90000 00000</strong></div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Main */}
        <motion.main className="container layout" style={{ gridTemplateColumns: "1fr 420px", gap: 20 }} variants={fadeStagger} initial="hidden" animate="visible">
          <motion.section className="panel results" style={{ padding: 18 }} variants={fadeStagger}>
            <h3 style={{ marginTop: 0 }}>Send us a message</h3>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, marginTop: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Your name</div>
                  <input name="name" value={form.name} onChange={handleChange} placeholder="Full name" className="search__input" style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)" }} />
                  {errors.name && <div style={{ color: "#ef4444", marginTop: 6 }}>{errors.name}</div>}
                </label>
                <label>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Email</div>
                  <input name="email" value={form.email} onChange={handleChange} placeholder="you@domain.com" className="search__input" style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)" }} />
                  {errors.email && <div style={{ color: "#ef4444", marginTop: 6 }}>{errors.email}</div>}
                </label>
              </div>

              <label>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Phone (optional)</div>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="10-digit mobile" className="search__input" style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)" }} />
                {errors.phone && <div style={{ color: "#ef4444", marginTop: 6 }}>{errors.phone}</div>}
              </label>

              <label>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Subject</div>
                <input name="subject" value={form.subject} onChange={handleChange} placeholder="Short subject" className="search__input" style={{ padding: 10, borderRadius: 8, border: "1px solid var(--border)" }} />
                {errors.subject && <div style={{ color: "#ef4444", marginTop: 6 }}>{errors.subject}</div>}
              </label>

             <label>
  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>Message</div>
  <textarea
    name="message"
    value={form.message}
    onChange={handleChange}
    placeholder="Tell us what's going on..."
    rows={6}
    style={{
      width: "100%",
      padding: 12,
      borderRadius: 8,
      border: "1px solid var(--border)",
      resize: "vertical",
      background: "#e0f7fa",   // <-- Distinct background color
      color: "#000",           // text color for readability
    }}
  />
  {errors.message && <div style={{ color: "#ef4444", marginTop: 6 }}>{errors.message}</div>}
</label>


              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <motion.button type="submit" className="home-btn" whileTap={btnTap} style={{ background: sending ? "#888" : "linear-gradient(90deg,#22d3ee,#4f46e5)", cursor: sending ? "not-allowed" : "pointer" }}>
                  {sending ? "Sending..." : "Send message"}
                </motion.button>

                <motion.button type="button" className="home-btn" whileTap={btnTap} style={{ background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" }} onClick={() => { setForm({ name: "", email: "", phone: "", subject: "", message: "" }); setErrors({}); setStatus(null); }}>
                  Reset
                </motion.button>
              </div>

              {status && (
                <motion.div style={{ marginTop: 6 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ padding: 10, borderRadius: 6, background: status.type === "success" ? "#d3f9d8" : "#fee2e2", color: status.type === "success" ? "#12b76a" : "#b91c1c" }}>
                    {status.msg}
                  </div>
                </motion.div>
              )}
            </form>
          </motion.section>

          {/* Sidebar contact info */}
          <motion.aside className="panel" style={{ padding: 18 }} variants={fadeUp}>
            <h4 style={{ marginTop: 0 }}>Contact information</h4>
            <div style={{ color: "var(--muted)", marginBottom: 12 }}>
              <div><strong>Support email:</strong> <a href="mailto:support@fixnow.example" style={{ color: "#22d3ee" }}>support@fixnow.example</a></div>
              <div style={{ marginTop: 8 }}><strong>Helpline:</strong> +91 8779524640</div>
              <div style={{ marginTop: 8 }}><strong>Address:</strong> 123 FixNow Street, Mumbai, India</div>
            </div>

            <div style={{ marginTop: 8 }}>
              <h4 style={{ marginBottom: 8 }}>Business hours</h4>
              <div style={{ color: "var(--muted)" }}>Mon — Sun · 06:00 — 22:00</div>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Follow us</h4>
              <div style={{ display: "flex", gap: 8 }}>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--muted)" }}>Twitter</a>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--muted)" }}> · Facebook</a>
                <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--muted)" }}> · Instagram</a>
              </div>
            </div>
          </motion.aside>
        </motion.main>

        <footer className="footer">
          <div className="container footer__row">
            <div>© FixNow</div>
            <div>
              <a href="#" onClick={(e) => e.preventDefault()}>Terms</a> · <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
            </div>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
