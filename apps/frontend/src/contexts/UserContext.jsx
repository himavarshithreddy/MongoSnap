import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const UserContext = createContext();

export const useUser = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    
    // Auth refresh logic
    const isRefreshing = useRef(false);
    const refreshPromise = useRef(null);

    // Cache keys
    const USER_CACHE_KEY = 'mongosnap_user_data';
    const CACHE_EXPIRY_KEY = 'mongosnap_user_cache_expiry';
    const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

    // Get cached user data
    const getCachedUser = () => {
        try {
            const cachedUser = localStorage.getItem(USER_CACHE_KEY);
            const cacheExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);
            
            if (cachedUser && cacheExpiry) {
                const expiryTime = parseInt(cacheExpiry);
                const now = Date.now();
                
                if (now < expiryTime) {
                    return JSON.parse(cachedUser);
                } else {
                    // Cache expired, remove it
                    localStorage.removeItem(USER_CACHE_KEY);
                    localStorage.removeItem(CACHE_EXPIRY_KEY);
                }
            }
        } catch (error) {
            console.error('Error reading cached user data:', error);
            localStorage.removeItem(USER_CACHE_KEY);
            localStorage.removeItem(CACHE_EXPIRY_KEY);
        }
        return null;
    };

    // Set cached user data
    const setCachedUser = (userData) => {
        try {
            const expiryTime = Date.now() + CACHE_DURATION;
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
            localStorage.setItem(CACHE_EXPIRY_KEY, expiryTime.toString());
        } catch (error) {
            console.error('Error caching user data:', error);
        }
    };

    // Clear cached user data
    const clearCachedUser = () => {
        localStorage.removeItem(USER_CACHE_KEY);
        localStorage.removeItem(CACHE_EXPIRY_KEY);
    };

    // Core fetchWithAuth function
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
            console.log('Token refresh failed:', err);
            logout();
            return null;
        }

        return doFetch(newToken);
    }, []);

    // Fetch user data from API
    const fetchUserData = async (useCache = true) => {
        // Check cache first if requested
        if (useCache) {
            const cachedUser = getCachedUser();
            if (cachedUser) {
                setUser(cachedUser);
                setLoading(false);
                return cachedUser;
            }
        }

        setLoading(true);
        setError('');
        
        try {
            const res = await fetchWithAuth('/api/me');
            if (!res) return null; // handled logout on refresh failure
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch user');
            
            const userData = data.user;
            setUser(userData);
            setCachedUser(userData);
            setError('');
            return userData;
        } catch (err) {
            console.error('Error fetching user data:', err);
            setError(err.message);
            setUser(null);
            clearCachedUser();
            return null;
        } finally {
            setLoading(false);
        }
    };

    // Login function
    const login = (token, userData = null) => {
        localStorage.setItem('token', token);
        if (userData) {
            setUser(userData);
            setCachedUser(userData);
        } else {
            // Fetch user data after login
            fetchUserData(false);
        }
    };

    // Logout function
    const logout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout API error:', error);
        } finally {
            localStorage.removeItem('token');
            clearCachedUser();
            setUser(null);
            setError('');
            navigate('/login');
        }
    };

    // Refresh user data
    const refreshUser = () => {
        return fetchUserData(false);
    };

    // Initialize user data on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchUserData(true);
        } else {
            setLoading(false);
        }
    }, []);

    const value = {
        user,
        loading,
        error,
        login,
        logout,
        refreshUser,
        fetchWithAuth,
        isAuthenticated: !!user
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}; 