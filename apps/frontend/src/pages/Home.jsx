import React, { useEffect, useState } from 'react';

function Home() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchUser = async () => {
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('http://192.168.1.10:4000/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
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