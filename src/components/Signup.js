// Signup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Signup.css";

function Signup() {
  const [role, setRole] = useState("user"); // 'user' or 'mechanic'
  const [name, setName] = useState("");
  const [garageName, setGarageName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // simple Indian 10-digit mobile validation (digits only)
  const isValidMobile = (m) => /^\d{10}$/.test(m);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // required fields check
    if (!name || !email || !mobile || !password || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (!isValidMobile(mobile)) {
      setError("Mobile number must be exactly 10 digits (numbers only).");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // if mechanic, also require garageName
    if (role === "mechanic" && !garageName) {
      setError("Garage name is required for mechanic registration.");
      return;
    }

    setLoading(true);

    const payload = {
      name,
      email,
      mobile, // send as plain 10-digit for backend to reformat if needed
      password,
      ...(role === "mechanic" ? { garageName } : {}),
    };

    const endpoint = role === "user" ? "/signup" : "/signup-mechanic";

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(data.message || "Signup successful! Redirecting to login...");
        // redirect after short delay
        setTimeout(() => navigate("/login"), 1500);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      setError("⚠️ Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <h2 className="signup-title">Create Account</h2>

        {/* role toggles */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 12 }}>
          <label style={{ cursor: "pointer" }}>
            <input
              type="radio"
              name="role"
              value="user"
              checked={role === "user"}
              onChange={() => setRole("user")}
            />
            <span style={{ marginLeft: 6 }}>Register as User</span>
          </label>
          <label style={{ cursor: "pointer" }}>
            <input
              type="radio"
              name="role"
              value="mechanic"
              checked={role === "mechanic"}
              onChange={() => setRole("mechanic")}
            />
            <span style={{ marginLeft: 6 }}>Register as Mechanic</span>
          </label>
        </div>

        {error && <p className="message error">{error}</p>}
        {success && <p className="message success">{success}</p>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              id="name"
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder=" "
            />
            <label htmlFor="name">Name</label>
          </div>

          {role === "mechanic" && (
            <div className="form-group">
              <input
                id="garageName"
                type="text"
                name="garageName"
                value={garageName}
                onChange={(e) => setGarageName(e.target.value)}
                required
                placeholder=" "
              />
              <label htmlFor="garageName">Garage Name</label>
            </div>
          )}

          <div className="form-group">
            <input
              id="email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder=" "
            />
            <label htmlFor="email">Email</label>
          </div>

          <div className="form-group">
            <input
              id="mobile"
              type="tel"
              name="mobile"
              value={mobile}
              onChange={(e) => {
                // allow only digits
                const digits = e.target.value.replace(/\D/g, "");
                setMobile(digits.slice(0, 10)); // limit to 10 digits
              }}
              required
              placeholder=" "
            />
            <label htmlFor="mobile">Mobile (10 digits)</label>
          </div>

          <div className="form-group">
            <input
              id="password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder=" "
            />
            <label htmlFor="password">Password</label>
          </div>

          <div className="form-group">
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder=" "
            />
            <label htmlFor="confirmPassword">Confirm Password</label>
          </div>

          <button type="submit" className="signup-btn" disabled={loading}>
            {loading ? "Please wait..." : "Sign Up"}
          </button>
        </form>

        <p className="login-redirect">
          Already have an account?{" "}
          <span className="link" onClick={() => navigate("/login")}>
            Login
          </span>
        </p>
      </div>
    </div>
  );
}

export default Signup;
