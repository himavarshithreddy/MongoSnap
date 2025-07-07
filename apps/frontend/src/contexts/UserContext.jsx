import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [csrfToken, setCsrfToken] = useState(null);
    const navigate = useNavigate();
    
    // Auth refresh logic
    const isRefreshing = useRef(false);
    const refreshPromise = useRef(null);

    // Cache keys
    const USER_CACHE_KEY = 'mongosnap_user_data';
    const CSRF_TOKEN_KEY = 'mongosnap_csrf_token';

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

    // CSRF token management
    const getCachedCSRFToken = () => {
        try {
            return localStorage.getItem(CSRF_TOKEN_KEY);
        } catch (error) {
            console.error('Error reading cached CSRF token:', error);
            localStorage.removeItem(CSRF_TOKEN_KEY);
        }
        return null;
    };

    const setCachedCSRFToken = (token) => {
        try {
            localStorage.setItem(CSRF_TOKEN_KEY, token);
            setCsrfToken(token);
        } catch (error) {
            console.error('Error caching CSRF token:', error);
        }
    };

    const clearCachedCSRFToken = () => {
        localStorage.removeItem(CSRF_TOKEN_KEY);
        setCsrfToken(null);
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
            
            // Handle CSRF token if provided in response headers
            const newCSRFToken = res.headers.get('X-CSRF-Token');
            if (newCSRFToken) {
                setCachedCSRFToken(newCSRFToken);
            }
            
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
        const getCurrentCSRFToken = () => csrfToken || getCachedCSRFToken();

        const doFetch = async (token, csrfTokenToUse = null) => {
            const headers = {
                ...(options.headers || {}),
                Authorization: `Bearer ${token}`
            };

            // Add CSRF token for state-changing requests
            const method = (options.method || 'GET').toUpperCase();
            if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
                const tokenToInclude = csrfTokenToUse || getCurrentCSRFToken();
                if (tokenToInclude) {
                    headers['X-CSRF-Token'] = tokenToInclude;
                }
            }

            return fetch(url, {
                ...options,
                headers,
                credentials: 'include'
            });
        };

        let token = getToken();
        let res = await doFetch(token);

        // Handle CSRF token from response headers
        const handleCSRFToken = (response) => {
            const newCSRFToken = response.headers.get('X-CSRF-Token');
            if (newCSRFToken) {
                setCachedCSRFToken(newCSRFToken);
            }
        };

        // Handle successful response
        if (res && res.ok) {
            handleCSRFToken(res);
            return res;
        }

        // Handle CSRF token errors
        if (res && res.status === 403) {
            try {
                const errorData = await res.clone().json();
                if (errorData.code === 'CSRF_TOKEN_MISSING' || errorData.code === 'CSRF_TOKEN_INVALID') {
                    // Try to get a fresh CSRF token
                    try {
                        const csrfRes = await fetch('/api/auth/csrf-token', {
                            headers: {
                                Authorization: `Bearer ${token}`
                            },
                            credentials: 'include'
                        });
                        
                        if (csrfRes.ok) {
                            const csrfData = await csrfRes.json();
                            setCachedCSRFToken(csrfData.csrfToken);
                            
                            // Retry original request with new CSRF token
                            return doFetch(token, csrfData.csrfToken);
                        }
                    } catch (csrfError) {
                        console.error('Failed to get fresh CSRF token:', csrfError);
                    }
                }
            } catch {
                // If we can't parse the error, continue with normal flow
            }
        }

        // Handle authentication errors (401)
        if (res && res.status === 401) {
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
                    
                        const refreshData = await refreshRes.json();
                        const newToken = refreshData.token;
                    localStorage.setItem('token', newToken);
                        
                        // Handle new CSRF token from refresh
                        if (refreshData.csrfToken) {
                            setCachedCSRFToken(refreshData.csrfToken);
                        }
                    
                    // Fetch fresh user data after token refresh
                    await fetchAndCacheUserData();
                    
                    isRefreshing.current = false;
                        return { token: newToken, csrfToken: refreshData.csrfToken };
                } catch (err) {
                    isRefreshing.current = false;
                    throw err;
                }
            })();
        }

            let refreshResult;
        try {
                refreshResult = await refreshPromise.current;
        } catch (err) {
            console.log('Token refresh failed:', err);
            logout();
            return null;
        }

            // Retry with new tokens
            return doFetch(refreshResult.token, refreshResult.csrfToken);
        }

        // For other responses, still try to extract CSRF token
        if (res) {
            handleCSRFToken(res);
        }

        return res;
    }, [csrfToken]);

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
    const login = (token, userData = null, newCSRFToken = null) => {
        localStorage.setItem('token', token);
        
        // Handle CSRF token if provided
        if (newCSRFToken) {
            setCachedCSRFToken(newCSRFToken);
        }
        
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
            clearCachedCSRFToken();
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
        
        // Load CSRF token from cache
        const cachedCSRF = getCachedCSRFToken();
        if (cachedCSRF) {
            setCsrfToken(cachedCSRF);
        }
        
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
        csrfToken,
        login,
        logout,
        refreshUser,
        fetchWithAuth,
        isAuthenticated: !!user,
        // Helper functions for CSRF token management
        getCSRFToken: () => csrfToken || getCachedCSRFToken(),
        clearTokens: () => {
            localStorage.removeItem('token');
            clearCachedUser();
            clearCachedCSRFToken();
            setUser(null);
            setError('');
        }
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

export { UserContext }; 