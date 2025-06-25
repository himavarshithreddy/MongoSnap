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

    // Cache key (no expiry key needed anymore)
    const USER_CACHE_KEY = 'mongosnap_user_data';

    // Get cached user data (no expiry check)
    const getCachedUser = () => {
        try {
            const cachedUser = localStorage.getItem(USER_CACHE_KEY);
            if (cachedUser) {
                return JSON.parse(cachedUser);
            }
        } catch (error) {
            console.error('Error reading cached user data:', error);
            localStorage.removeItem(USER_CACHE_KEY);
        }
        return null;
    };

    // Set cached user data (no expiry)
    const setCachedUser = (userData) => {
        try {
            localStorage.setItem(USER_CACHE_KEY, JSON.stringify(userData));
        } catch (error) {
            console.error('Error caching user data:', error);
        }
    };

    // Clear cached user data
    const clearCachedUser = () => {
        localStorage.removeItem(USER_CACHE_KEY);
    };

    // Fetch user data from API and update cache
    const fetchAndCacheUserData = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return null;

            const res = await fetch('/api/me', {
                headers: {
                    Authorization: `Bearer ${token}`
                },
                credentials: 'include'
            });
            
            if (!res.ok) {
                throw new Error('Failed to fetch user data');
            }
            
            const data = await res.json();
            const userData = data.user;
            
            // Update both state and cache
            setUser(userData);
            setCachedUser(userData);
            setError('');
            
            return userData;
        } catch (err) {
            console.error('Error fetching user data:', err);
            throw err;
        }
    };

    // Core fetchWithAuth function with user data refresh on token refresh
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
                try {
                    const refreshRes = await fetch('/api/auth/refresh', {
                        method: 'POST',
                        credentials: 'include'
                    });
                    
                    if (!refreshRes.ok) throw new Error('Refresh failed');
                    
                    const { token: newToken } = await refreshRes.json();
                    localStorage.setItem('token', newToken);
                    
                    // Fetch fresh user data after token refresh
                    await fetchAndCacheUserData();
                    
                    isRefreshing.current = false;
                    return newToken;
                } catch (err) {
                    isRefreshing.current = false;
                    throw err;
                }
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

    // Fetch user data from API (used for initial load or manual refresh)
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
            const userData = await fetchAndCacheUserData();
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

    // Refresh user data (force fetch from API)
    const refreshUser = () => {
        return fetchUserData(false);
    };

    // Initialize user data on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            // Try cache first, only fetch if no cache exists
            const cachedUser = getCachedUser();
            if (cachedUser) {
                setUser(cachedUser);
                setLoading(false);
            } else {
                // No cache, fetch from API
                fetchUserData(false);
            }
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