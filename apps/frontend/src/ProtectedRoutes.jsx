import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const ProtectedRoute = ({ children }) => {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      let token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        setAuthChecked(true);
        return;
      }
      try {
        const { exp } = jwtDecode(token);
        if (Date.now() >= exp * 1000) {
          // Try to refresh
          const res = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.token);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('token');
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(true);
        }
      } catch {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  if (!authChecked) return null; // or a loading spinner

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;