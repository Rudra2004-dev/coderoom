import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Room from "./pages/Room";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import InterviewDetail from "./pages/InterviewDetail";
import NotFound from "./pages/NotFound";

// Public landing for visitors, personal home for logged-in users
function Root() {
  return localStorage.getItem("token") ? <Home /> : <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/room/:slug" element={<ProtectedRoute><Room /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/dashboard/:slug" element={<ProtectedRoute><InterviewDetail /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}