import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Database, CheckCircle, Clock, Calendar, Server, Home, ArrowLeft, Wifi, WifiOff, Power, RefreshCw, WifiIcon, ChevronDown, ChevronRight, FileText, Hash } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import Logo from '../components/Logo';

const sampleQueries = [
    'db.users.find({})',
    'db.users.findOne({"_id": ObjectId("..."), "status": "active"})',
    'db.users.insertOne({"name": "John", "email": "john@example.com"})',
    'db.users.updateOne({"_id": ObjectId("...")}, {"$set": {"status": "inactive"}})',
    'db.users.deleteOne({"_id": ObjectId("...")})',
    'db.users.countDocuments({"status": "active"})',
    'db.users.aggregate([{"$match": {"status": "active"}}, {"$group": {"_id": "$department", "count": {"$sum": 1}}}])'
];

function insertSampleQuery(sample, setQueryInput) {
    setQueryInput(sample);
}

function QueryConsole() {
    useEffect(() => {
        document.title = "MongoSnap - Query Console";
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
    const [queryInput, setQueryInput] = useState('db.collection.find({})');
    const [queryResult, setQueryResult] = useState(null);
    const [queryLoading, setQueryLoading] = useState(false);
    const [queryError, setQueryError] = useState('');
    const [schema, setSchema] = useState(null);
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [expandedCollections, setExpandedCollections] = useState(new Set());
    const connectionIdRef = useRef(null);

    useEffect(() => {
        // Get connection ID from URL parameters
        const urlParams = new URLSearchParams(location.search);
        const connectionId = urlParams.get('connectionId');
        
        if (connectionId) {
            // Fetch connection details securely from backend
            fetchConnectionDetails(connectionId);
        } else {
            // Try to get active connection
            fetchActiveConnection();
        }

        // Auto-disconnect when component unmounts or user navigates away
        return () => {
            if (connectionIdRef.current) {
                handleAutoDisconnect(connectionIdRef.current);
            }
        };
    }, [location.search]);

    // Add beforeunload event listener for page refresh/close
    useEffect(() => {
        const handleBeforeUnload = async () => {
            if (connectionIdRef.current) {
                try {
                    // Try to disconnect gracefully
                    await handleAutoDisconnect(connectionIdRef.current);
                } catch (error) {
                    console.error('Error during page unload disconnect:', error);
                }
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    // Auto-disconnect function
    const handleAutoDisconnect = async (connectionId = connectionIdRef.current) => {
        if (!connectionId) return;
        
        try {
            console.log('Auto-disconnecting from database on navigation');
            await fetchWithAuth(`/api/connection/${connectionId}/disconnect`, {
                method: 'POST'
            });
            console.log('Successfully auto-disconnected');
        } catch (error) {
            console.error('Error auto-disconnecting:', error);
        }
    };

    // Fetch connection details securely
    const fetchConnectionDetails = async (connectionId) => {
        try {
            const response = await fetchWithAuth(`/api/connection/${connectionId}/status`);
            if (response.ok) {
                const data = await response.json();
                setConnectionData(data.connection);
                setConnectionStatus(data.connection);
                connectionIdRef.current = data.connection._id; // Store in ref
            } else {
                setError('Connection not found or access denied.');
            }
        } catch (error) {
            console.error('Error fetching connection details:', error);
            setError('Failed to load connection details.');
        }
    };

    // Fetch active connection if no connection ID in URL
    const fetchActiveConnection = async () => {
        try {
            const response = await fetchWithAuth('/api/connection/active');
            if (response.ok) {
                const data = await response.json();
                setConnectionData(data.connection);
                setConnectionStatus(data.connection);
                connectionIdRef.current = data.connection._id; // Store in ref
                // Update URL with connection ID for consistency
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('connectionId', data.connection._id);
                window.history.replaceState({}, '', newUrl);
            } else {
                setError('No active connection found. Please connect to a database first.');
            }
        } catch (error) {
            console.error('Error fetching active connection:', error);
            setError('Failed to load active connection.');
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

    // Refresh connection status
    const refreshStatus = () => {
        if (connectionData?._id) {
            fetchConnectionStatus(connectionData._id);
        }
    };

    // Handle navigation with auto-disconnect
    const handleNavigation = async (path) => {
        if (connectionIdRef.current) {
            await handleAutoDisconnect(connectionIdRef.current);
            connectionIdRef.current = null; // Clear ref after disconnect
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

    // Handler for query submission
    const handleQuerySubmit = async (e) => {
        e.preventDefault();
        setQueryLoading(true);
        setQueryError('');
        setQueryResult(null);

        try {
            // Parse the MongoDB query
            const parsedQuery = parseMongoQuery(queryInput.trim());
            
            if (!parsedQuery) {
                setQueryError('Invalid query syntax. Use MongoDB syntax like: db.collection.find({})');
                setQueryLoading(false);
                return;
            }

            const response = await fetchWithAuth(`/api/connection/${connectionIdRef.current}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedQuery)
            });

            if (response.ok) {
                const data = await response.json();
                setQueryResult(data.result);
            } else {
                const errorData = await response.json();
                console.error('Backend error:', errorData);
                setQueryError(errorData.message || 'Query failed');
            }
        } catch (err) {
            setQueryError('Failed to execute query: ' + err.message);
        } finally {
            setQueryLoading(false);
        }
    };

    // Parse MongoDB query syntax
    const parseMongoQuery = (query) => {
        try {
            // Remove whitespace and semicolons
            query = query.trim().replace(/;$/, '');
            
            // Match db.collection.operation() pattern
            const dbPattern = /^db\.([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z]+)\s*\(\s*(.*?)\s*\)$/s;
            const match = query.match(dbPattern);
            
            if (!match) {
                return null;
            }

            const [, collection, operation, argsString] = match;
            
            // Parse arguments
            let args = [];
            if (argsString.trim()) {
                try {
                    args = parseArguments(argsString);
                } catch (e) {
                    throw new Error('Invalid arguments: ' + e.message);
                }
            }

            return {
                collection,
                operation,
                args
            };
        } catch (error) {
            throw new Error('Query parsing failed: ' + error.message);
        }
    };

    // Parse function arguments from string
    const parseArguments = (argsString) => {
        const args = [];
        let depth = 0;
        let current = '';
        let inString = false;
        let stringChar = '';
        
        for (let i = 0; i < argsString.length; i++) {
            const char = argsString[i];
            
            if (!inString && (char === '"' || char === "'")) {
                inString = true;
                stringChar = char;
                current += char;
            } else if (inString && char === stringChar && argsString[i-1] !== '\\') {
                inString = false;
                current += char;
            } else if (!inString && (char === '{' || char === '[')) {
                depth++;
                current += char;
            } else if (!inString && (char === '}' || char === ']')) {
                depth--;
                current += char;
            } else if (!inString && char === ',' && depth === 0) {
                if (current.trim()) {
                    args.push(parseValue(current.trim()));
                }
                current = '';
            } else {
                current += char;
            }
        }
        
        if (current.trim()) {
            args.push(parseValue(current.trim()));
        }
        
        return args;
    };

    // Parse individual values, handling ObjectId and other MongoDB types
    const parseValue = (value) => {
        value = value.trim();
        
        // Handle ObjectId calls first
        const objectIdMatch = value.match(/^ObjectId\(\s*"([^"]+)"\s*\)$/);
        if (objectIdMatch) {
            return { __type: 'ObjectId', value: objectIdMatch[1] };
        }
        
        const objectIdMatchUnquoted = value.match(/^ObjectId\(\s*([a-fA-F0-9]{24})\s*\)$/);
        if (objectIdMatchUnquoted) {
            return { __type: 'ObjectId', value: objectIdMatchUnquoted[1] };
        }
        
        // Convert MongoDB shell syntax to valid JSON
        const convertToJSON = (str) => {
            // First handle ObjectId() calls within the string
            str = str.replace(/ObjectId\(\s*"([^"]+)"\s*\)/g, '{"__type":"ObjectId","value":"$1"}');
            str = str.replace(/ObjectId\(\s*([a-fA-F0-9]{24})\s*\)/g, '{"__type":"ObjectId","value":"$1"}');
            
            // Then fix unquoted property names in objects
            // This regex finds property names like { key: value } and converts to { "key": value }
            str = str.replace(/(\{|\s|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
            
            return str;
        };
        
        const jsonValue = convertToJSON(value);
        
        return JSON.parse(jsonValue);
    };

    // Fetch database schema
    const fetchSchema = async () => {
        if (!connectionIdRef.current) return;
        
        setSchemaLoading(true);
        try {
            const response = await fetchWithAuth(`/api/connection/${connectionIdRef.current}/schema`);
            if (response.ok) {
                const data = await response.json();
                setSchema(data.schema);
            } else {
                console.error('Failed to fetch schema');
            }
        } catch (error) {
            console.error('Error fetching schema:', error);
        } finally {
            setSchemaLoading(false);
        }
    };

    // Fetch schema when connection is established
    useEffect(() => {
        if (connectionIdRef.current && connectionData) {
            fetchSchema();
        }
    }, [connectionIdRef.current, connectionData]);

    // Toggle collection expansion
    const toggleCollection = (collectionName) => {
        const newExpanded = new Set(expandedCollections);
        if (newExpanded.has(collectionName)) {
            newExpanded.delete(collectionName);
        } else {
            newExpanded.add(collectionName);
        }
        setExpandedCollections(newExpanded);
    };

    // Insert collection name into query
    const insertCollectionName = (collectionName) => {
        setQueryInput(`db.${collectionName}.find({})`);
    };

    // Enhanced field type icon with statistics
    const getTypeIcon = (type) => {
        switch (type) {
            case 'string': return '📝';
            case 'integer': case 'double': return '#️⃣';
            case 'boolean': return '✅';
            case 'date': return '📅';
            case 'objectId': return '🔑';
            case 'array': return '📋';
            case 'object': return '📂';
            case 'null': return '❌';
            case 'undefined': return '❓';
            default: return '❓';
        }
    };

    // Format percentage
    const formatPercentage = (value) => {
        if (value === null || value === undefined) return '0%';
        return `${(value * 100).toFixed(1)}%`;
    };

    // Format field statistics
    const formatFieldStats = (field) => {
        const stats = [];
        
        if (field.totalCount !== undefined) {
            stats.push(`${field.totalCount} total`);
        }
        
        if (field.nullCount !== undefined && field.nullCount > 0) {
            stats.push(`${field.nullCount} null (${formatPercentage(field.nullPercentage)})`);
        }
        
        if (field.uniqueCount !== undefined && field.uniqueCount > 0) {
            stats.push(`${field.uniqueCount} unique (${formatPercentage(field.uniquePercentage)})`);
        }
        
        if (field.avgLength !== undefined) {
            stats.push(`avg: ${field.avgLength.toFixed(1)} chars`);
        }
        
        if (field.avgValue !== undefined) {
            stats.push(`avg: ${field.avgValue.toFixed(2)}`);
        }
        
        return stats.join(', ');
    };

    // Format number with commas
    const formatNumber = (num) => {
        return new Intl.NumberFormat().format(num);
    };

    // Format bytes
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Schema Explorer */}
                    <div className="lg:col-span-1">
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

                        {/* Schema Explorer */}
                        <div className="bg-brand-secondary rounded-lg border border-brand-tertiary overflow-hidden">
                            <div className="px-6 py-4 border-b border-brand-tertiary flex justify-between items-center">
                                <h3 className="text-white text-lg font-semibold">Database Schema</h3>
                                <button
                                    onClick={fetchSchema}
                                    disabled={schemaLoading}
                                    className="flex items-center gap-2 px-3 py-2 bg-brand-tertiary text-white rounded-md hover:bg-opacity-80 transition-all duration-200 text-sm"
                                >
                                    <RefreshCw size={14} className={schemaLoading ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                            </div>
                            
                            <div className="p-4 max-h-96 overflow-y-auto">
                                {schemaLoading ? (
                                    <div className="text-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-quaternary mx-auto mb-2"></div>
                                        <p className="text-gray-400 text-sm">Loading schema...</p>
                                    </div>
                                ) : schema ? (
                                    <div className="space-y-2">
                                        <div className="text-gray-400 text-sm mb-4">
                                            Database: <span className="text-white font-medium">{schema.databaseName}</span>
                                        </div>
                                        
                                        {schema.collections.map((collection) => (
                                            <div key={collection.name} className="border border-gray-700 rounded-md">
                                                <div 
                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800"
                                                    onClick={() => toggleCollection(collection.name)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {expandedCollections.has(collection.name) ? 
                                                            <ChevronDown size={16} className="text-gray-400" /> : 
                                                            <ChevronRight size={16} className="text-gray-400" />
                                                        }
                                                        <FileText size={16} className="text-blue-400" />
                                                        <span 
                                                            className="text-white font-medium hover:text-brand-quaternary cursor-pointer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                insertCollectionName(collection.name);
                                                            }}
                                                        >
                                                            {collection.name}
                                                        </span>
                                                    </div>
                                                    <div className="text-gray-400 text-xs">
                                                        {formatNumber(collection.count)} docs
                                                    </div>
                                                </div>
                                                
                                                {expandedCollections.has(collection.name) && (
                                                    <div className="px-6 pb-3 space-y-2">
                                                        <div className="text-xs text-gray-400 grid grid-cols-2 gap-2">
                                                            <div>Size: {formatBytes(collection.size)}</div>
                                                            <div>Avg: {formatBytes(collection.avgObjSize)}</div>
                                                        </div>
                                                        
                                                        {collection.fields.length > 0 && (
                                                            <div>
                                                                <div className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                                                                    Fields:
                                                                    {collection.hasSchemaAnalysis && (
                                                                        <span className="text-green-400 text-xs bg-green-900/20 px-2 py-1 rounded">
                                                                            AI Analyzed
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                                                    {collection.fields.slice(0, 10).map((field, index) => (
                                                                        <div key={index} className="border border-gray-700 rounded p-2 text-xs">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <span className="text-lg">{getTypeIcon(field.type)}</span>
                                                                                <span className="text-gray-300 font-medium">{field.name}</span>
                                                                                <span className="text-gray-500">({field.type})</span>
                                                                            </div>
                                                                            
                                                                            {/* Show type distribution if available */}
                                                                            {field.types && field.types.length > 1 && (
                                                                                <div className="text-gray-400 mb-1">
                                                                                    Types: {field.types.map(t => 
                                                                                        `${t.type} (${formatPercentage(t.percentage)})`
                                                                                    ).join(', ')}
                                                                                </div>
                                                                            )}
                                                                            
                                                                            {/* Show field statistics */}
                                                                            {field.totalCount !== undefined && (
                                                                                <div className="text-gray-400 text-xs">
                                                                                    {formatFieldStats(field)}
                                                                                </div>
                                                                            )}
                                                                            
                                                                            {/* Show value ranges for numeric fields */}
                                                                            {field.minValue !== undefined && field.maxValue !== undefined && (
                                                                                <div className="text-gray-400 text-xs">
                                                                                    Range: {field.minValue} - {field.maxValue}
                                                                                </div>
                                                                            )}
                                                                            
                                                                            {/* Show length ranges for string fields */}
                                                                            {field.minLength !== undefined && field.maxLength !== undefined && (
                                                                                <div className="text-gray-400 text-xs">
                                                                                    Length: {field.minLength} - {field.maxLength}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                    {collection.fields.length > 10 && (
                                                                        <div className="text-xs text-gray-500 text-center py-2 border border-gray-700 rounded">
                                                                            +{collection.fields.length - 10} more fields
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {collection.indexes.length > 0 && (
                                                            <div>
                                                                <div className="text-xs text-gray-400 mb-2">Indexes:</div>
                                                                <div className="space-y-1">
                                                                    {collection.indexes.map((index, idx) => (
                                                                        <div key={idx} className="text-xs text-gray-300">
                                                                            {index.name} {index.unique && <span className="text-green-400">(unique)</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 text-gray-400 text-sm">
                                        No schema information available
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Right Column - Query Console */}
                    <div className="lg:col-span-2">
                        {/* Query Console UI */}
                        <div className="bg-brand-secondary rounded-lg border border-brand-tertiary overflow-hidden mt-8">
                            <div className="px-6 py-4 border-b border-brand-tertiary flex justify-between items-center">
                                <h3 className="text-white text-lg font-semibold">Query Console</h3>
                                <div className="flex gap-2">
                                    <select 
                                        className="px-3 py-1 rounded bg-gray-800 text-white border border-gray-700 text-sm"
                                        onChange={e => insertSampleQuery(e.target.value, setQueryInput)}
                                        value=""
                                    >
                                        <option value="">Sample Queries...</option>
                                        {sampleQueries.map((query, index) => (
                                            <option key={index} value={query}>
                                                {query.length > 50 ? query.substring(0, 47) + '...' : query}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <form className="p-6 space-y-4" onSubmit={handleQuerySubmit}>
                                <div>
                                    <label className="text-gray-400 text-sm">Query (MongoDB Syntax)</label>
                                    <textarea 
                                        className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-700 font-mono text-sm" 
                                        rows={6} 
                                        value={queryInput} 
                                        onChange={e => setQueryInput(e.target.value)} 
                                        placeholder="db.collection.find({})"
                                        required 
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Use MongoDB syntax like: db.collection.find(&#123;&#125;), db.collection.insertOne(&#123;...&#125;), etc.
                                    </p>
                                </div>
                                <button type="submit" className="bg-brand-quaternary text-white px-6 py-2 rounded-md hover:bg-opacity-80 transition-all duration-200" disabled={queryLoading}>
                                    {queryLoading ? 'Running...' : 'Execute Query'}
                                </button>
                                {queryError && <div className="text-red-400 text-sm">{queryError}</div>}
                            </form>
                            {queryResult && (
                                <div className="bg-gray-800 text-white p-4 mt-4 rounded overflow-x-auto text-sm max-h-96">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-400 text-xs">Result:</span>
                                        <span className="text-gray-400 text-xs">
                                            {Array.isArray(queryResult) ? `${queryResult.length} document(s)` : 'Single result'}
                                        </span>
                                    </div>
                                    <pre className="font-mono">{JSON.stringify(queryResult, null, 2)}</pre>
                                </div>
                            )}
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
            </div>
        </div>
    );
}

export default QueryConsole; 