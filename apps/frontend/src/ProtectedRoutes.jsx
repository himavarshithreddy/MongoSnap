import React from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;

  try {
    const { exp } = jwtDecode(token);
    if (Date.now() >= exp * 1000) {
      // Token expired
      localStorage.removeItem('token');
      return <Navigate to="/login" replace />;
    }
  } catch {
    // Invalid token
    localStorage.removeItem('token');
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;