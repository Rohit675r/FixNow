// AboutUs.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

/**
 * AboutUs
 * Matches the UI style from your Home.css (the variables and classes you provided).
 */
export default function AboutUs() {
  const navigate = useNavigate();

  // Motion variants
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const fadeStagger = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
  };

  const btnTap = { scale: 0.97 };

  return (
    <AnimatePresence>
      <motion.div
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.3 } } }}
      >
        {/* Navbar */}
        <header className="nav">
          <div className="container nav__row" style={{ alignItems: "center" }}>
            <a className="nav__brand" href="#" onClick={(e) => e.preventDefault()}>
              <span className="nav__brand-logo" aria-hidden="true" />
              <span style={{ marginLeft: 8 }}>FixNow</span>
            </a>
            <nav className="nav__links" style={{ marginLeft: "auto" }}>
              <a className="nav__link" href="#" onClick={(e) => { e.preventDefault(); navigate("/home"); }}>Home</a>
              <a className="nav__link" href="#" onClick={(e) => e.preventDefault()}>Services</a>
              <a className="nav__link" href="#" onClick={(e) => e.preventDefault()}>Contact</a>
              <motion.button className="nav__cta" whileTap={btnTap} onClick={() => navigate("/")}>Sign in</motion.button>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <motion.section className="hero" style={{ paddingBottom: 8 }} variants={fadeUp} initial="hidden" animate="visible">
          <div className="container hero__grid" style={{ alignItems: "start" }}>
            <motion.div variants={fadeUp}>
              <h1 className="hero__title">About FixNow</h1>
              <p className="hero__subtitle">
                Fast, reliable roadside assistance — find trusted mechanics, get help on the road, and manage jobs with confidence.
              </p>

              <div className="home-actions">
                <motion.button className="home-btn" whileTap={btnTap} onClick={() => navigate("/request")}>
                  Request Help
                </motion.button>
                <motion.button
                  className="home-btn"
                  whileTap={btnTap}
                  style={{ marginLeft: 12, background: "linear-gradient(90deg,#22d3ee,#4f46e5)" }}
                  onClick={() => navigate("/signup")}
                >
                  Become a Mechanic
                </motion.button>
              </div>
            </motion.div>

            <motion.div style={{ minWidth: 300 }} variants={fadeUp}>
              <div className="panel" style={{ padding: 18 }}>
                <h3 style={{ marginTop: 0 }}>Our mission</h3>
                <p style={{ color: "var(--muted)", marginTop: 6 }}>
                  FixNow exists to provide immediate, trustworthy roadside assistance anywhere you are. We connect motorists with vetted mechanics, simplify payments, and keep both customers and mechanics focused on what matters — fixing the problem fast.
                </p>
                <ul style={{ marginTop: 10, color: "var(--muted)", paddingLeft: 18 }}>
                  <li>Real-time requests & notifications</li>
                  <li>Transparent pricing and easy payments</li>
                  <li>Verified mechanics in your area</li>
                </ul>
              </div>
            </motion.div>
          </div>
        </motion.section>

        <motion.main className="container layout" style={{ gridTemplateColumns: "1fr", gap: 20 }} initial="hidden" animate="visible" variants={fadeStagger}>
          <motion.section className="panel results" style={{ padding: 20 }} variants={fadeStagger}>
            <div style={{ display: "grid", gap: 18 }}>
              {/* How FixNow works */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
                <motion.div style={{ minWidth: 0 }} variants={fadeStagger}>
                  <h2 style={{ marginTop: 0 }}>How FixNow works</h2>
                  <p style={{ color: "var(--muted)" }}>
                    Using FixNow is simple: open the app, choose your vehicle type, describe the issue and request help — we broadcast your request to nearby mechanics and you can pick the one who accepts. After the job is done, you can review the mechanic and pay via cash or online UPI.
                  </p>

                  <motion.div style={{ display: "grid", gap: 12, marginTop: 12 }} variants={fadeStagger}>
                    {[
                      { step: "1", title: "Request Help", desc: "Tell us your problem and location — we notify nearby mechanics." },
                      { step: "2", title: "Mechanic Accepts", desc: "Mechanics respond in real-time. Choose who you want to accept the job." },
                      { step: "3", title: "Complete & Pay", desc: "Job completed, amount settled (cash or online). Leave a review to help future users." },
                    ].map((item) => (
                      <motion.div key={item.step} className="card" style={{ gridTemplateColumns: "48px 1fr", alignItems: "center" }} variants={fadeUp}>
                        <div className="card__avatar">{item.step}</div>
                        <div>
                          <strong>{item.title}</strong>
                          <div className="card__sub">{item.desc}</div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>

                <motion.aside style={{ minWidth: 0 }} variants={fadeUp}>
                  <div className="panel" style={{ padding: 14 }}>
                    <h4 style={{ marginTop: 0 }}>Safety & trust</h4>
                    <p style={{ color: "var(--muted)", marginBottom: 8 }}>
                      All mechanics are required to register with verified contact details. We provide in-app communication and rating history so you can choose with confidence.
                    </p>
                  </div>
                </motion.aside>
              </div>

              {/* Our story */}
              <motion.div variants={fadeUp}>
                <h3 style={{ marginTop: 0 }}>Our story</h3>
                <p style={{ color: "var(--muted)" }}>
                  FixNow started as a simple idea: make roadside help instant and simple. Over time we built a community of mechanics and drivers who trust the platform — our focus remains the same: speed, safety and fairness.
                </p>
              </motion.div>

              {/* Meet the team */}
              <motion.div variants={fadeUp}>
                <h3 style={{ marginTop: 14 }}>Meet the team</h3>
                <motion.div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12 }} variants={fadeStagger}>
                  {[
                    { name: "Rohit Choudhary", role: "Founder & CEO" },
                    { name: "Anisha Patel", role: "Head of Product" },
                    { name: "Vikram Singh", role: "Engineering" },
                  ].map((p) => (
                    <motion.div key={p.name} className="card" style={{ gridTemplateColumns: "64px 1fr", alignItems: "center" }} variants={fadeUp}>
                      <div className="card__avatar">{p.name.split(" ").map(n => n[0]).slice(0,2).join("")}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{p.name}</div>
                        <div style={{ color: "var(--muted)", fontSize: 13 }}>{p.role}</div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>

              {/* Get started */}
              <motion.div className="panel" style={{ padding: 16 }} variants={fadeUp}>
                <h3 style={{ marginTop: 0 }}>Get started</h3>
                <p style={{ color: "var(--muted)" }}>
                  Ready to get help or join as a mechanic? Use the buttons below to quickly create a request or register your garage.
                </p>
                <div style={{ marginTop: 12 }}>
                  <motion.button className="home-btn" whileTap={btnTap} onClick={() => navigate("/request")}>Request Help</motion.button>
                  <motion.button className="home-btn" whileTap={btnTap} style={{ marginLeft: 12, background: "linear-gradient(90deg,#22d3ee,#4f46e5)" }} onClick={() => navigate("/mechanic/signup")}>Mechanic Signup</motion.button>
                </div>
              </motion.div>
            </div>
          </motion.section>
        </motion.main>

        {/* Footer */}
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
