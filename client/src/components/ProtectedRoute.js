import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../UserContext";

const ProtectedRoute = ({ children }) => {
  const { session, loading } = useUser();

  // Gate on `session`, not `user`: a route should be reachable once
  // authenticated even if the profile fetch is still in flight or
  // failed - conflating "authenticated" with "profile loaded" would be
  // wrong here.
  if (loading) return null;

  if (!session) return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedRoute;
