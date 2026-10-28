import { Navigate } from "react-router-dom";
import type { ReactElement } from "react";

export default function ProtectedRoute({ children }: { children: ReactElement }) {
  return localStorage.getItem("token") ? children : <Navigate to="/auth" replace />;
}