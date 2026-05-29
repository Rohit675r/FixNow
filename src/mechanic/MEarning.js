// MEarnings.js
import React, { useEffect, useState } from "react";

/**
 * MEarnings
 * Props:
 *  - mechanic: { _id, email, ... }
 *
 * Filters:
 *  - filter: 'day' | 'week' | 'month' | 'year' | 'range'
 *  - date: yyyy-mm-dd (for day/week)
 *  - month: yyyy-mm (for month)
 *  - year: yyyy (for year)
 *  - startDate / endDate: yyyy-mm-dd for custom range
 */
export default function MEarnings({ mechanic }) {
  const [filter, setFilter] = useState("day");
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 7); // yyyy-mm
  });
  const [year, setYear] = useState(() => new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationMsg, setValidationMsg] = useState(""); // validation error message
  const [error, setError] = useState(null);
  const [entries, setEntries] = useState([]); // array of requests
  const [total, setTotal] = useState(0);

  // helpers to parse and compare with "today"
  const todayUTCStart = () => {
    const t = new Date();
    return new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0));
  };

  const parseDateStringToUTCStart = (yyyyMmDd) => {
    if (!yyyyMmDd) return null;
    const parts = yyyyMmDd.split("-");
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map((x) => Number(x));
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  };

  const parseMonthToUTCRange = (yyyyMm) => {
    if (!yyyyMm) return null;
    const parts = yyyyMm.split("-");
    if (parts.length !== 2) return null;
    const [y, m] = parts.map((x) => Number(x));
    if (!y || !m) return null;
    const start = new Date(Date.UTC(y, m - 1, 0 + 1, 0, 0, 0)); // 1st
    const end = new Date(Date.UTC(y, m, 0 + 1, 0, 0, 0)); // 1st of next month
    return { start, end };
  };

  const parseYearToUTCRange = (yyyy) => {
    if (!yyyy) return null;
    const y = Number(yyyy);
    if (!y) return null;
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0));
    return { start, end };
  };

  // validation: ensure no selected date is in the future and ranges are valid
  function validateSelection() {
    const todayStart = todayUTCStart();

    if (filter === "day" || filter === "week") {
      const sel = parseDateStringToUTCStart(date);
      if (!sel) return "Please select a valid date.";
      if (sel > todayStart) return "Cannot select a future date.";
      return ""; // valid
    }

    if (filter === "month") {
      const rng = parseMonthToUTCRange(month);
      if (!rng) return "Please select a valid month.";
      // end is start of next month; last day of selected month is end - 1ms
      if (rng.start > todayStart) return "Cannot select a future month.";
      // if start <= today < end then allowed; if start <= todayStart check covered
      if (rng.end.getTime() - 1 > todayStart.getTime() && rng.start.getTime() > todayStart.getTime()) return "Cannot select a future month.";
      return "";
    }

    if (filter === "year") {
      const rng = parseYearToUTCRange(year);
      if (!rng) return "Please enter a valid year.";
      if (rng.start > todayStart) return "Cannot select a future year.";
      return "";
    }

    if (filter === "range") {
      const s = parseDateStringToUTCStart(startDate);
      const e = parseDateStringToUTCStart(endDate);
      if (!s || !e) return "Please select both start and end dates.";
      if (s > e) return "Start date must be before or equal to end date.";
      if (s > todayStart) return "Start date cannot be in the future.";
      // end date inclusive - allow end equal to today
      if (e > todayStart) return "End date cannot be in the future.";
      return "";
    }

    return "";
  }

  // Build query string for backend
  function buildQuery() {
    const mechId = mechanic._id || mechanic.email;
    const params = new URLSearchParams();
    params.append("mechanicId", mechId);
    params.append("filter", filter);

    if (filter === "day") {
      params.append("date", date);
    } else if (filter === "week") {
      params.append("date", date);
    } else if (filter === "month") {
      params.append("month", month);
    } else if (filter === "year") {
      params.append("year", year);
    } else if (filter === "range") {
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
    }
    return params.toString();
  }

  // Fetch earnings only when selection valid
  async function fetchEarnings() {
    if (!mechanic) return;
    const v = validateSelection();
    setValidationMsg(v);
    if (v) {
      // invalid — do not fetch
      setEntries([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);
    setEntries([]);
    setTotal(0);

    try {
      const qs = buildQuery();
      const res = await fetch(`http://localhost:5000/mechanic/earnings?${qs}`);
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Server returned ${res.status} ${res.statusText}. ${txt}`);
      }
      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      console.error("MEarnings fetch error:", err);
      setError(err.message || "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch when relevant parameters change — but only if valid
  useEffect(() => {
    if (!mechanic) return;
    const v = validateSelection();
    setValidationMsg(v);
    if (!v) fetchEarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanic, filter, date, month, year, startDate, endDate]);

  // Small helper to format currency
  const fmt = (v) =>
    typeof v === "number" ? v.toLocaleString(undefined, { minimumFractionDigits: 0 }) : v;

  // Whether current selection is valid (used to enable/disable Refresh button)
  const selectionValid = validationMsg === "";

  return (
    <div>
      <h3 style={{ padding: 12 }}>Earnings</h3>

      {!mechanic && <p style={{ color: "#b00", padding: 12 }}>Mechanic not signed in.</p>}

      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 12 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" name="f" checked={filter === "day"} onChange={() => setFilter("day")} /> Day
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" name="f" checked={filter === "week"} onChange={() => setFilter("week")} /> Week
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" name="f" checked={filter === "month"} onChange={() => setFilter("month")} /> Month
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" name="f" checked={filter === "year"} onChange={() => setFilter("year")} /> Year
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="radio" name="f" checked={filter === "range"} onChange={() => setFilter("range")} /> Range
        </label>
      </div>

      <div style={{ padding: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {filter === "day" && (
          <label>
            Date: <input type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
        {filter === "week" && (
          <label>
            Week date (any date in week):{" "}
            <input type="date" value={date} max={new Date().toISOString().slice(0,10)} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
        {filter === "month" && (
          <label>
            Month: <input type="month" value={month} max={new Date().toISOString().slice(0,7)} onChange={(e) => setMonth(e.target.value)} />
          </label>
        )}
        {filter === "year" && (
          <label>
            Year:{" "}
            <input
              type="number"
              min="2000"
              max={new Date().getFullYear()}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              style={{ width: 100 }}
            />
          </label>
        )}
        {filter === "range" && (
          <>
            <label>
              From: <input type="date" value={startDate} max={new Date().toISOString().slice(0,10)} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label>
              To: <input type="date" value={endDate} max={new Date().toISOString().slice(0,10)} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </>
        )}

        <button
          onClick={fetchEarnings}
          style={{ padding: "8px 12px", borderRadius: 6, background: selectionValid ? "#007bff" : "#888", color: "#fff", border: "none", cursor: selectionValid ? "pointer" : "not-allowed" }}
          disabled={!selectionValid}
        >
          Refresh
        </button>
      </div>

      <div style={{ padding: 12 }}>
        {validationMsg && <p style={{ color: "red", marginTop: 6 }}>{validationMsg}</p>}

        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p style={{ color: "red" }}>{error}</p>
        ) : (
          <>
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Entries ({entries.length})</strong>
              <div style={{ fontSize: 18 }}>
                Total: ₹ {fmt(total)}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {entries.length === 0 && <p style={{ color: "#666" }}>No earnings for this selection.</p>}
              {entries.map((e) => (
                <div key={e._id} className="card" style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{e.userName || e.userEmail || "Customer"}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>{e.issue || ""}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{e.when ? new Date(e.when).toLocaleString() : (e.completedAt ? new Date(e.completedAt).toLocaleString() : (e.createdAt ? new Date(e.createdAt).toLocaleString() : ""))}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>₹ {fmt(Number(e.amount || 0))}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{e.paymentStatus || e.paymentMethod || ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
