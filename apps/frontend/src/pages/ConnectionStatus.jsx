import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Database, CheckCircle, Clock, Calendar, Server, Home, ArrowLeft, Wifi, WifiOff, Power, RefreshCw, WifiIcon } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import Logo from '../components/Logo';

function ConnectionStatus() {
    useEffect(() => {
        document.title = "MongoSnap - Connection Status";
    }, []);

    const location = useLocation();
    const navigate = useNavigate();
    const { user, loading: userLoading, error: userError, logout, fetchWithAuth } = useUser();
    
    const [connectionData, setConnectionData] = useState(null);
    const [error, setError] = useState('');
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);

    useEffect(() => {
        // Get connection data from URL parameters
        const urlParams = new URLSearchParams(location.search);
        const dataParam = urlParams.get('data');
        
        if (dataParam) {
            try {
                const decodedData = JSON.parse(decodeURIComponent(dataParam));
                setConnectionData(decodedData);
                // Fetch real-time status
                fetchConnectionStatus(decodedData._id);
            } catch (parseError) {
                console.error('Error parsing connection data:', parseError);
                setError('Invalid connection data. Please connect to a database first.');
            }
        } else {
            setError('No connection data found. Please connect to a database first.');
        }

        // Auto-disconnect when component unmounts or user navigates away
        return () => {
            if (connectionData?._id) {
                handleAutoDisconnect();
            }
        };
    }, [location.search]);

    // Auto-disconnect function
    const handleAutoDisconnect = async () => {
        if (!connectionData?._id) return;
        
        try {
            console.log('Auto-disconnecting from database on navigation');
            await fetchWithAuth(`/api/connection/${connectionData._id}/disconnect`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Error auto-disconnecting:', error);
        }
    };

    // Fetch real-time connection status
    const fetchConnectionStatus = async (connectionId) => {
        if (!connectionId) return;
        
        setStatusLoading(true);
        try {
            const response = await fetchWithAuth(`/api/connection/${connectionId}/status`);
            if (response.ok) {
                const data = await response.json();
                setConnectionStatus(data.connection);
            } else {
                console.error('Failed to fetch connection status');
            }
        } catch (error) {
            console.error('Error fetching connection status:', error);
        } finally {
            setStatusLoading(false);
        }
    };

    // Disconnect from database
    const handleDisconnect = async () => {
        if (!connectionData?._id) return;
        
        setIsDisconnecting(true);
        try {
            const response = await fetchWithAuth(`/api/connection/${connectionData._id}/disconnect`, {
                method: 'POST'
            });
            
            if (response.ok) {
                setConnectionStatus(prev => ({
                    ...prev,
                    isActive: false,
                    isConnected: false,
                    isAlive: false
                }));
                setConnectionData(prev => ({
                    ...prev,
                    isActive: false
                }));
            } else {
                const errorData = await response.json();
                setError('Failed to disconnect: ' + (errorData.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error disconnecting:', error);
            setError('Failed to disconnect from database');
        } finally {
            setIsDisconnecting(false);
        }
    };

    // Reconnect to database
    const handleReconnect = async () => {
        if (!connectionData?._id) return;
        
        setIsReconnecting(true);
        setError('');
        try {
            const response = await fetchWithAuth(`/api/connection/${connectionData._id}/reconnect`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const data = await response.json();
                setConnectionStatus(prev => ({
                    ...prev,
                    isActive: true,
                    isConnected: true,
                    isAlive: true
                }));
                setConnectionData(prev => ({
                    ...prev,
                    isActive: true,
                    lastUsed: data.connection.lastUsed
                }));
            } else {
                const errorData = await response.json();
                setError('Failed to reconnect: ' + (errorData.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error reconnecting:', error);
            setError('Failed to reconnect to database');
        } finally {
            setIsReconnecting(false);
        }
    };

    // Refresh connection status
    const refreshStatus = () => {
        if (connectionData?._id) {
            fetchConnectionStatus(connectionData._id);
        }
    };

    // Handle navigation with auto-disconnect
    const handleNavigation = async (path) => {
        if (connectionData?._id) {
            await handleAutoDisconnect();
        }
        navigate(path);
    };

    // Get first letter of username
    const getFirstLetter = (username) => {
        return username ? username.charAt(0).toUpperCase() : 'U';
    };

    // Handle logout
    const handleLogout = async () => {
        await logout();
    };

    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Format relative time
    const formatRelativeTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
        return `${Math.floor(diffInMinutes / 1440)} days ago`;
    };

    if (userLoading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-quaternary mx-auto mb-4"></div>
                    <p className="text-white text-lg">Loading...</p>
                </div>
            </div>
        );
    }

    if (userError || !user) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-400 text-lg mb-4">Authentication Error</div>
                    <p className="text-gray-400 mb-4">{userError || 'Please log in to continue'}</p>
                    <button 
                        onClick={() => navigate('/login')}
                        className="bg-brand-quaternary text-white px-6 py-2 rounded-md hover:bg-opacity-80 transition-all duration-200"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="text-red-400 text-lg mb-4">Connection Error</div>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <div className="flex gap-4 justify-center">
                        <button 
                            onClick={() => navigate('/connect')}
                            className="bg-brand-quaternary text-white px-6 py-3 rounded-md hover:bg-opacity-80 transition-all duration-200 flex items-center gap-2"
                        >
                            <ArrowLeft size={16} />
                            Back to Connect
                        </button>
                        <button 
                            onClick={() => navigate('/')}
                            className="bg-brand-tertiary text-white px-6 py-3 rounded-md hover:bg-opacity-80 transition-all duration-200 flex items-center gap-2"
                        >
                            <Home size={16} />
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!connectionData) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-quaternary mx-auto mb-4"></div>
                    <p className="text-white text-lg">Loading connection details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            {/* Header */}
            <div className="bg-brand-secondary border-b border-brand-tertiary">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center">
                            <Logo size="default" />
                            <h1 className="text-2xl font-bold text-white tracking-wide ml-2">
                                Mongo<span className="text-brand-quaternary">Snap</span>
                            </h1>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => handleNavigation('/')}
                                className="bg-brand-tertiary text-white px-4 py-2 rounded-md hover:bg-opacity-80 transition-all duration-200 flex items-center gap-2"
                            >
                                <Home size={16} />
                                Home
                            </button>
                            
                            <div className="relative">
                                <button
                                    onClick={() => handleNavigation('/connect')}
                                    className="bg-brand-quaternary text-white px-4 py-2 rounded-md hover:bg-opacity-80 transition-all duration-200 flex items-center gap-2"
                                >
                                    <Database size={16} />
                                    Connect
                                </button>
                            </div>
                            
                            <button
                                onClick={handleLogout}
                                className="w-10 h-10 bg-brand-tertiary rounded-full flex items-center justify-center text-white font-semibold hover:bg-opacity-80 transition-all duration-200"
                                title="Logout"
                            >
                                {getFirstLetter(user.name)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Success Message */}
                <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-6 mb-8">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="text-green-400" size={24} />
                        <div>
                            <h2 className="text-green-400 text-xl font-semibold">Successfully Connected!</h2>
                            <p className="text-green-300 text-sm mt-1">
                                Your MongoDB database is now connected and ready to use.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Connection Details */}
                <div className="bg-brand-secondary rounded-lg border border-brand-tertiary overflow-hidden">
                    <div className="px-6 py-4 border-b border-brand-tertiary flex justify-between items-center">
                        <h3 className="text-white text-lg font-semibold">Connection Details</h3>
                        <button
                            onClick={refreshStatus}
                            disabled={statusLoading}
                            className="flex items-center gap-2 px-3 py-2 bg-brand-tertiary text-white rounded-md hover:bg-opacity-80 transition-all duration-200 text-sm"
                            title="Refresh Connection Status"
                        >
                            <RefreshCw size={14} className={statusLoading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>
                    
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-gray-400 text-sm font-medium">Connection Name</label>
                                    <p className="text-white text-lg font-semibold">{connectionData.nickname}</p>
                                </div>
                                
                                <div>
                                    <label className="text-gray-400 text-sm font-medium">Database Name</label>
                                    <p className="text-white text-lg">{connectionData.databaseName}</p>
                                </div>
                                
                                <div>
                                    <label className="text-gray-400 text-sm font-medium">Host</label>
                                    <p className="text-white text-lg">{connectionData.host}</p>
                                </div>
                            </div>
                            
                            {/* Status Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-gray-400 text-sm font-medium">Connection Status</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        {statusLoading ? (
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand-quaternary"></div>
                                        ) : connectionStatus?.isConnected ? (
                                            <Wifi className="text-green-400" size={16} />
                                        ) : (
                                            <WifiOff className="text-red-400" size={16} />
                                        )}
                                        <span className={`text-sm font-medium ${
                                            connectionStatus?.isConnected ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            {connectionStatus?.isConnected ? 'Connected' : 'Disconnected'}
                                        </span>
                                        {connectionStatus?.isConnected && (
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                connectionStatus?.isAlive ? 'bg-green-900/50 text-green-300' : 'bg-yellow-900/50 text-yellow-300'
                                            }`}>
                                                {connectionStatus?.isAlive ? 'Live' : 'Testing...'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="text-gray-400 text-sm font-medium">Database Status</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`w-3 h-3 rounded-full ${
                                            connectionData.isActive ? 'bg-green-400' : 'bg-red-400'
                                        }`}></div>
                                        <span className={`text-sm font-medium ${
                                            connectionData.isActive ? 'text-green-400' : 'text-red-400'
                                        }`}>
                                            {connectionData.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="text-gray-400 text-sm font-medium">Last Connected</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Clock size={14} className="text-gray-500" />
                                        <span className="text-white text-sm">{formatRelativeTime(connectionData.lastUsed)}</span>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="text-gray-400 text-sm font-medium">Created</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Calendar size={14} className="text-gray-500" />
                                        <span className="text-white text-sm">{formatDate(connectionData.createdAt)}</span>
                                    </div>
                                </div>
                                
                                {connectionData.isNewConnection && (
                                    <div className="bg-blue-900/20 border border-blue-500/50 rounded-md p-3">
                                        <p className="text-blue-300 text-sm">
                                            <strong>New Connection:</strong> This connection was just created and saved to your account.
                                        </p>
                                    </div>
                                )}
                                
                                {/* Connection Actions */}
                                <div className="flex gap-2 pt-2">
                                    {!connectionStatus?.isConnected && (
                                        <button
                                            onClick={handleReconnect}
                                            disabled={isReconnecting}
                                            className="flex items-center gap-2 px-3 py-2 bg-brand-quaternary text-white rounded-md hover:bg-opacity-80 transition-all duration-200 text-sm"
                                            title="Reconnect to Database"
                                        >
                                            <WifiIcon size={14} />
                                            {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
                                        </button>
                                    )}
                                    
                                    {connectionStatus?.isConnected && (
                                        <button
                                            onClick={handleDisconnect}
                                            disabled={isDisconnecting}
                                            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-200 text-sm"
                                            title="Disconnect from Database"
                                        >
                                            <Power size={14} />
                                            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 mt-8 justify-center">
                    <button
                        onClick={() => handleNavigation('/connect')}
                        className="bg-brand-quaternary text-white px-6 py-3 rounded-md hover:bg-opacity-80 transition-all duration-200 flex items-center gap-2"
                    >
                        <Database size={16} />
                        Connect Another Database
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConnectionStatus; 