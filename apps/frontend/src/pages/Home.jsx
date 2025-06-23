import React, { useEffect, useState } from 'react';

function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Helper to fetch with auto-refresh
    const fetchWithAuth = async (url, options = {}) => {
        let token = localStorage.getItem('token');
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
            const refreshRes = await fetch('http://192.168.1.10:4000/api/auth/refresh', {
                method: 'POST',
                credentials: 'include',
            });
            const refreshData = await refreshRes.json();
            if (refreshRes.ok && refreshData.token) {
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
                window.location.href = '/login';
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
                if (!res.ok) throw new Error(data.message || 'Failed to fetch user');
                setUser(data.user);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, []);

    if (loading) return <div>Loading user info...</div>;
    if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
    if (!user) return <div>No user info found.</div>;

    return (
        <div>
            <h2>Welcome, {user.name}!</h2>
            <p>Email: {user.email}</p>
            <p>User ID: {user._id}</p>
        </div>
    );
}

export default Home