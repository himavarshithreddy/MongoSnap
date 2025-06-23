import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Helper to fetch with auto-refresh
    const fetchWithAuth = async (url, options = {}) => {
        let token = localStorage.getItem('token');
        
        if (!token) {
            navigate('/login');
            return null;
        }

        let res = await fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include', // send cookies for refresh
        });
        
        if (res.status === 401) {
            // Try to refresh token
            try {
                const refreshRes = await fetch('http://192.168.1.10:4000/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                });
                
                if (refreshRes.ok) {
                    const refreshData = await refreshRes.json();
                    localStorage.setItem('token', refreshData.token);
                    
                    // Retry original request with new token
                    token = refreshData.token;
                    res = await fetch(url, {
                        ...options,
                        headers: {
                            ...(options.headers || {}),
                            'Authorization': `Bearer ${token}`
                        },
                        credentials: 'include',
                    });
                } else {
                    // Refresh failed, force logout
                    localStorage.removeItem('token');
                    navigate('/login');
                    return null;
                }
            } catch {
                // Refresh failed, force logout
                localStorage.removeItem('token');
                navigate('/login');
                return null;
            }
        }
        return res;
    };

    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetchWithAuth('http://192.168.1.10:4000/me');
                if (!res) return; // handled by refresh logic
                
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.message || 'Failed to fetch user');
                }
                
                setUser(data.user);
            } catch (err) {
                setError(err.message);
                // Don't redirect on error, just show the error
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
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