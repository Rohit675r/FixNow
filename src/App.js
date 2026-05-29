import React from "react";
import Signup from "./components/Signup";
import Login from "./components/Login";
import Home from "./components/Home";
import Mhome from "./mechanic/Mhome";
import RequestPage from "./components/RequestPage.js";
import MechanicResponse from "./components/MechanicResponse"; 
import CompleteJobPage from "./mechanic/CompleteJobPage";
import RequestPopup from "./components/RequestPopup.js";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
// App.js (top)
import { io } from "socket.io-client";
import Mhistory from "./mechanic/Mhistory.js";
import Mreview from "./mechanic/Mreview.js";
import MEarning from "./mechanic/MEarning.js";
import AboutUs from "./components/AboutUs.js";
import History from "./components/History.js";
import ContactUs from "./components/ContactUs.js";

export const socket = io("http://localhost:5000");

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/request" element={<RequestPage />} />
        <Route path="/1request" element={<RequestPopup />} />
        <Route path="/mhome" element={<Mhome />} />
        <Route path="/about" element={<AboutUs />} />
         <Route path="/history1" element={<History />} />
          <Route path="/Contact" element={<ContactUs />} />
        <Route path="/mechanic-response" element={<MechanicResponse />} /> {/* New route */}
        <Route path="/complete-job/:id" element={<CompleteJobPage />} />
        <Route path="/history" element={<Mhistory />} />
        <Route path="/reviews" element={<Mreview />} />
        <Route path="/earn" element={<MEarning />} />
        
      </Routes>
    </Router>
    
  );
}

export default App;
