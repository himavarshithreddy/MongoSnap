import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    useEffect(() => {
        document.title = "MongoSnap - Home";
    }, []);
    // Helper to fetch with auto-refresh
   // A flag and a promise for the refresh-in-progress
  const isRefreshing = useRef(false);
  const refreshPromise = useRef(null);

  // Core fetchWithAuth with queue/mutex logic
  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const getToken = () => localStorage.getItem('token');

    const doFetch = async (token) => {
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`
        },
        credentials: 'include'
      });
    };

    let token = getToken();
    let res = await doFetch(token);

    if (res.status !== 401) {
      return res;
    }

    // Got 401: need to refresh
    if (!isRefreshing.current) {
      // start the refresh only once
      isRefreshing.current = true;
      refreshPromise.current = (async () => {
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });
        if (!refreshRes.ok) throw new Error('Refresh failed');
        const { token: newToken } = await refreshRes.json();
        localStorage.setItem('token', newToken);
        isRefreshing.current = false;
        return newToken;
      })();
    }

    let newToken;
    try {
      newToken = await refreshPromise.current;
    } catch (err) {
        console.log(err);
      // Refresh failed: clear and redirect
      localStorage.removeItem('token');
      navigate('/login');
      return null;
    }

    // Retry original request with new token
    return doFetch(newToken);
  }, [navigate]);

  useEffect(() => {
    document.title = 'MongoSnap – Home';

    const fetchUser = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetchWithAuth('/api/me');
        if (!res) return;             // handled logout on refresh failure
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch user');
        setUser(data.user);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [navigate, fetchWithAuth]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } finally {
      localStorage.removeItem('token');
      navigate('/login');
    }
  };
    

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-lg">Loading user info...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-red-600 text-lg mb-4">Error Loading User</div>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button 
                        onClick={handleLogout}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 mr-2"
                    >
                        Logout
                    </button>
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-gray-600 text-lg mb-4">No user info found</div>
                    <button 
                        onClick={handleLogout}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user.name}!</h1>
                        <button 
                            onClick={handleLogout}
                            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                        >
                            Logout
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold mb-2">User Information</h3>
                            <p><strong>Email:</strong> {user.email}</p>
                            <p><strong>User ID:</strong> {user._id}</p>
                            <p><strong>Verified:</strong> {user.isVerified ? 'Yes' : 'No'}</p>
                            {user.oauthProvider && (
                                <p><strong>OAuth Provider:</strong> {user.oauthProvider}</p>
                            )}
                            <p><strong>Member since:</strong> {new Date(user.createdAt).toLocaleDateString()}</p>
                        </div>
                        
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="text-lg font-semibold mb-2">Account Status</h3>
                            <p className="text-green-600">✅ Successfully authenticated</p>
                            <p className="text-sm text-gray-600 mt-2">
                                You are now logged in and can access protected features.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;