import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Database, CheckCircle, Clock, Calendar, Server, Home, ArrowLeft, Wifi, WifiOff, Power, RefreshCw, WifiIcon, ChevronDown, ChevronRight, FileText, Hash, LogOut } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import Logo from '../components/Logo';
import QueryInterface from '../components/QueryInterface';
import SchemaExplorer from '../components/SchemaExplorer';
import QueryHistory from '../components/QueryHistory';

function Playground() {
    useEffect(() => {
        document.title = "MongoSnap - Playground";
    }, []);

    const location = useLocation();
    const navigate = useNavigate();
    const { user, loading: userLoading, error: userError, logout, fetchWithAuth } = useUser();
    
    const [connectionData, setConnectionData] = useState(null);
    const [error, setError] = useState('');
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [queryInput, setQueryInput] = useState('db.collection.find({})');
    const [queryResult, setQueryResult] = useState(null);
    const [queryLoading, setQueryLoading] = useState(false);
    const [queryError, setQueryError] = useState('');
    const [schema, setSchema] = useState(null);
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [expandedCollections, setExpandedCollections] = useState(new Set());
    const connectionIdRef = useRef(null);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [activeTab, setActiveTab] = useState('query'); // 'query', 'schema', 'history'
    const [showConnectionConfirm, setShowConnectionConfirm] = useState(false);
    const [queryHistory, setQueryHistory] = useState([]);
    const [savedQueries, setSavedQueries] = useState([]);
    const [saveMessage, setSaveMessage] = useState('');
    
    // Mock query history data
    const mockQueryHistory = [
        {
            id: 1,
            query: 'db.users.find({"status": "active"})',
            result: '5 documents returned',
            timestamp: '2024-01-15T10:30:00Z',
            status: 'success'
        },
        {
            id: 2,
            query: 'db.products.insertOne({"name": "New Product", "price": 29.99})',
            result: 'Document inserted successfully',
            timestamp: '2024-01-15T10:25:00Z',
            status: 'success'
        },
        {
            id: 3,
            query: 'db.users.updateOne({"_id": ObjectId("...")}, {"$set": {"lastLogin": new Date()}})',
            result: '1 document modified',
            timestamp: '2024-01-15T10:20:00Z',
            status: 'success'
        },
        {
            id: 4,
            query: 'db.invalid_collection.find({})',
            result: 'Collection not found',
            timestamp: '2024-01-15T10:15:00Z',
            status: 'error'
        },
        {
            id: 5,
            query: 'db.orders.aggregate([{"$match": {"status": "pending"}}, {"$group": {"_id": "$customerId", "total": {"$sum": "$amount"}}}])',
            result: '3 documents returned',
            timestamp: '2024-01-15T10:10:00Z',
            status: 'success'
        }
    ];

    // Mock saved queries data - simplified structure
    const mockSavedQueries = [
        {
            id: 1,
            query: 'db.users.find({"status": "active", "verified": true})',
            timestamp: '2024-01-14T15:30:00Z'
        },
        {
            id: 2,
            query: 'db.orders.aggregate([{"$match": {"date": {"$gte": new Date("2024-01-01")}}}, {"$group": {"_id": "$productId", "totalSales": {"$sum": "$amount"}, "orderCount": {"$sum": 1}}}, {"$sort": {"totalSales": -1}}])',
            timestamp: '2024-01-13T09:15:00Z'
        },
        {
            id: 3,
            query: 'db.comments.find({"createdAt": {"$gte": new Date(Date.now() - 7*24*60*60*1000)}}).sort({"createdAt": -1})',
            timestamp: '2024-01-12T14:20:00Z'
        }
    ];

    // Initialize data with mock data
    useEffect(() => {
        setQueryHistory(mockQueryHistory);
        setSavedQueries(mockSavedQueries);
    }, []);

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

    // Handle navigation
    const handleNavigation = async (path) => {
        // Auto-disconnect when navigating away
        if (connectionIdRef.current) {
            await handleAutoDisconnect(connectionIdRef.current);
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
                addToQueryHistory(queryInput, null, 'error', 'Invalid query syntax');
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
                addToQueryHistory(queryInput, data.result, 'success');
            } else {
                const errorData = await response.json();
                console.error('Backend error:', errorData);
                const errorMessage = errorData.message || 'Query failed';
                setQueryError(errorMessage);
                addToQueryHistory(queryInput, null, 'error', errorMessage);
            }
        } catch (err) {
            const errorMessage = 'Failed to execute query: ' + err.message;
            setQueryError(errorMessage);
            addToQueryHistory(queryInput, null, 'error', errorMessage);
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

    // Query History Functions
    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleString();
    };

    const executeHistoryQuery = (query) => {
        setQueryInput(query);
        setActiveTab('query');
        // Optionally auto-execute the query
        // handleQuerySubmit();
    };

    const copyToQueryInput = (query) => {
        setQueryInput(query);
        setActiveTab('query');
    };

    const deleteHistoryItem = (index) => {
        setQueryHistory(prev => prev.filter((_, i) => i !== index));
    };

    const addToQueryHistory = (query, result, status, error = null) => {
        const historyItem = {
            id: Date.now(),
            query,
            result: status === 'success' ? 
                (Array.isArray(result) ? `${result.length} document(s) returned` : 'Query executed successfully') :
                (error || 'Query failed'),
            timestamp: new Date().toISOString(),
            status
        };
        setQueryHistory(prev => [historyItem, ...prev.slice(0, 9)]); // Keep last 10 items
    };

    // Simplified save query function
    const handleSaveQuery = (query) => {
        // Check if query already exists
        const queryExists = savedQueries.some(saved => saved.query === query);
        
        if (queryExists) {
            setSaveMessage('Query already saved!');
            setTimeout(() => setSaveMessage(''), 2000);
            return;
        }

        const savedQuery = {
            id: Date.now(),
            query: query,
            timestamp: new Date().toISOString()
        };
        
        setSavedQueries(prev => [savedQuery, ...prev]);
        setSaveMessage('Query saved successfully!');
        setTimeout(() => setSaveMessage(''), 2000);
    };

    // Delete saved query
    const deleteSavedQuery = (index) => {
        setSavedQueries(prev => prev.filter((_, i) => i !== index));
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
        <div className="min-h-screen w-full flex">
        {/* Mobile View - Show message to use desktop */}
        <div className="md:hidden min-h-screen w-full bg-brand-primary flex flex-col items-center justify-center px-6 text-center">
            <div className='flex items-center mb-8'>
                <Logo size="large" />
                <h1 className='text-3xl font-bold text-white tracking-wide'>Mongo<span className='text-brand-quaternary'>Snap</span></h1>
            </div>
            
            <div className='bg-brand-secondary rounded-2xl p-8 border border-brand-tertiary max-w-sm'>
                <div className='mb-6'>
                    <h2 className='text-white text-xl font-bold mb-2'>Desktop Required</h2>
                    <p className='text-gray-300 text-sm leading-relaxed'>
                        Database playground requires a desktop or PC environment for optimal security and functionality.
                    </p>
                </div>
                
                <div className='bg-brand-tertiary rounded-lg p-4 mb-6'>
                    <h3 className='text-white font-semibold mb-2 text-sm'>Please use:</h3>
                    <ul className='text-gray-300 text-xs space-y-1 text-left'>
                        <li>• Desktop computer</li>
                        <li>• Laptop</li>
                        <li>• Tablet in desktop mode</li>
                    </ul>
                </div>
                
                <button
                    onClick={() => navigate('/login')}
                    className='w-full bg-brand-tertiary text-white py-2 px-4 rounded-md font-medium hover:bg-opacity-90 transition-all duration-200'
                >
                    Back to Login
                </button>
            </div>
        </div>

        {/* Desktop View - Original content */}
        <div className="hidden md:flex min-h-screen w-full">
          <div className="w-[20%] min-h-screen flex flex-col bg-brand-secondary">
            <div className='flex items-center mb-6 p-4 border-b border-brand-tertiary'>
                <Logo size="default" />
                <h1 className='md:text-3xl text-3xl font-bold text-white tracking-wide'>Mongo<span className='text-brand-quaternary'>Snap</span></h1>
            </div>
            
            <div className='flex flex-col gap-4 px-4 flex-1 overflow-hidden'>
                <div className='flex items-center justify-between'>
                    <h2 className='text-white text-lg font-semibold'>Connection Details</h2>
                </div>
                
                {/* Connection Status */}
                <div className='bg-brand-tertiary rounded-lg p-4 border border-brand-quaternary'>
                    <div className='flex items-center gap-2 mb-3'>
                        {isReconnecting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-quaternary"></div>
                                <span className="text-brand-quaternary text-sm font-medium">Reconnecting...</span>
                            </>
                        ) : isDisconnecting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                                <span className="text-red-400 text-sm font-medium">Disconnecting...</span>
                            </>
                        ) : connectionStatus?.isConnected ? (
                            <>
                                <Wifi className="text-green-400" size={16} />
                                <span className="text-green-400 text-sm font-medium">Connected</span>
                            </>
                        ) : (
                            <>
                                <WifiOff className="text-red-400" size={16} />
                                <span className="text-red-400 text-sm font-medium">Disconnected</span>
                            </>
                        )}
                    </div>
                    
                    <div className='space-y-3'>
                        <div>
                            <label className='text-gray-400 text-xs font-medium'>Connection Name</label>
                            <p className='text-white text-sm font-medium'>{connectionData?.nickname}</p>
                        </div>
                        
                        <div>
                            <label className='text-gray-400 text-xs font-medium'>Database</label>
                            <p className='text-white text-sm'>{connectionData?.databaseName}</p>
                        </div>
                        
                        <div>
                            <label className='text-gray-400 text-xs font-medium'>Host</label>
                            <p className='text-white text-sm'>{connectionData?.host}</p>
                        </div>
                    </div>
                </div>

                {/* Connection Actions */}
                <div className='space-y-2'>
                    <button
                        onClick={handleReconnect}
                        disabled={isReconnecting}
                        className='w-full flex items-center gap-2 p-3 bg-brand-quaternary text-white rounded-lg hover:bg-opacity-80 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                    >
                        {isReconnecting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Reconnecting...</span>
                            </>
                        ) : (
                            <>
                                <RefreshCw size={16} />
                                <span>Reconnect</span>
                            </>
                        )}
                    </button>
                    
                    <button
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className='w-full flex items-center gap-2 p-3 bg-gray-600 text-white rounded-lg hover:bg-red-800 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                    >
                        {isDisconnecting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Disconnecting...</span>
                            </>
                        ) : (
                            <>
                                <Power size={16} />
                                <span>Disconnect</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Navigation */}
                <div className='space-y-2'>
                    {!showConnectionConfirm ? (
                        <button
                            onClick={() => setShowConnectionConfirm(true)}
                            className='w-full flex items-center gap-2 p-3 bg-brand-tertiary text-white rounded-lg hover:bg-opacity-80 transition-all duration-200 text-sm cursor-pointer'
                        >
                            <Server size={16} />
                            Change Connection
                        </button>
                    ) : (
                        <div className='bg-[#2d4c38] rounded-lg p-3 border border-gray-700'>
                            <div className='flex items-center gap-2 mb-3'>
                                <Server size={14} className="text-gray-400" />
                                <span className='text-gray-300 text-sm font-medium'>Change Connection</span>
                            </div>
                            <p className='text-gray-400 text-xs mb-3 leading-relaxed'>
                                This will disconnect you from the current database and redirect to the connection page.
                            </p>
                            <div className='flex gap-2'>
                                <button
                                    onClick={() => {
                                        setShowConnectionConfirm(false);
                                        handleNavigation('/connect');
                                    }}
                                    className='flex-1 px-4 py-2.5 bg-brand-quaternary text-white rounded-md text-sm font-medium hover:bg-opacity-80 transition-all duration-200 cursor-pointer'
                                >
                                    Continue
                                </button>
                                <button
                                    onClick={() => setShowConnectionConfirm(false)}
                                    className='flex-1 px-4 py-2.5 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-opacity-80 transition-all duration-200 cursor-pointer'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        <div className="w-[80%] min-h-screen flex justify-center items-center flex-col gap-10 relative">
            {/* Profile Icon - Top Right Corner */}
            <div className="absolute top-6 right-6 z-10">
                {userLoading ? (
                    <div className="w-10 h-10 bg-brand-tertiary rounded-full flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-brand-quaternary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : userError ? (
                    <button
                        onClick={() => navigate('/login')}
                        className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white font-semibold hover:bg-red-600 transition-all duration-200"
                        title="Login Required"
                    >
                        !
                    </button>
                ) : user ? (
                    <>
                        <button
                            onClick={() => setShowProfileModal(!showProfileModal)}
                            className="w-10 h-10 cursor-pointer bg-brand-tertiary rounded-full flex items-center justify-center text-white font-semibold hover:bg-opacity-80 transition-all duration-200"
                            title="Profile"
                        >
                            {getFirstLetter(user.name)}
                        </button>
                        
                        {/* Profile Modal */}
                        {showProfileModal && (
                            <>
                                {/* Backdrop */}
                                <div 
                                    className="fixed inset-0 bg-black/50 z-20 cursor-pointer"
                                    onClick={() => setShowProfileModal(false)}
                                />
                                
                                {/* Modal */}
                                <div className="absolute top-12 right-0 bg-brand-secondary rounded-lg p-4 border border-brand-tertiary shadow-lg z-30 min-w-64">
                                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-brand-tertiary">
                                        <div className="w-8 h-8 bg-brand-quaternary rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                            {getFirstLetter(user.name)}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium text-sm">{user.name}</p>
                                            <p className="text-gray-400 text-xs">{user.email}</p>
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 text-gray-300 hover:text-red-400 cursor-pointer transition-colors p-2 rounded-md hover:bg-brand-tertiary"
                                    >
                                        <LogOut size={16} />
                                        <span className="text-sm">Logout</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <button
                        onClick={() => navigate('/login')}
                        className="w-10 h-10 bg-brand-tertiary rounded-full flex items-center justify-center text-white font-semibold hover:bg-opacity-80 transition-all duration-200"
                        title="Login"
                    >
                        ?
                    </button>
                )}
            </div>
          
            <h1 className='text-white text-4xl font-bold mt-5'>MongoSnap <span className='text-brand-quaternary'>Playground</span></h1>
            
            {/* Main Playground Content */}
            <div className='w-[80%] bg-brand-secondary rounded-4xl flex flex-col gap-7 justify-center px-10 py-8'>
                {/* Horizontal Tabs */}
                <div className='flex justify-center'>
                    <div className='flex bg-brand-tertiary rounded-lg p-1 gap-1'>
                        <button
                            onClick={() => setActiveTab('query')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm cursor-pointer ${
                                activeTab === 'query' 
                                    ? 'bg-brand-quaternary text-white shadow-md' 
                                    : 'text-gray-300 hover:text-white hover:bg-brand-secondary'
                            }`}
                        >
                            <Database size={16} />
                            Query Interface
                        </button>
                        
                        <button
                            onClick={() => {
                                setActiveTab('schema');
                                if (!schema) {
                                    fetchSchema();
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm cursor-pointer ${
                                activeTab === 'schema' 
                                    ? 'bg-brand-quaternary text-white shadow-md' 
                                    : 'text-gray-300 hover:text-white hover:bg-brand-secondary'
                            }`}
                        >
                            <FileText size={16} />
                            Schema Explorer
                        </button>
                        
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm cursor-pointer ${
                                activeTab === 'history' 
                                    ? 'bg-brand-quaternary text-white shadow-md' 
                                    : 'text-gray-300 hover:text-white hover:bg-brand-secondary'
                            }`}
                        >
                            <Clock size={16} />
                            Query History
                        </button>
                    </div>
                </div>
                
                {activeTab === 'schema' ? (
                    <SchemaExplorer 
                        schema={schema}
                        schemaLoading={schemaLoading}
                        expandedCollections={expandedCollections}
                        toggleCollection={toggleCollection}
                        insertCollectionName={insertCollectionName}
                        fetchSchema={fetchSchema}
                        getTypeIcon={getTypeIcon}
                        formatPercentage={formatPercentage}
                        formatFieldStats={formatFieldStats}
                        formatNumber={formatNumber}
                        formatBytes={formatBytes}
                    />
                ) : activeTab === 'history' ? (
                    <QueryHistory 
                        queryHistory={queryHistory}
                        savedQueries={savedQueries}
                        executeHistoryQuery={executeHistoryQuery}
                        copyToQueryInput={copyToQueryInput}
                        deleteHistoryItem={deleteHistoryItem}
                        deleteSavedQuery={deleteSavedQuery}
                        formatTimestamp={formatTimestamp}
                    />
                ) : (
                    <QueryInterface 
                        queryInput={queryInput}
                        setQueryInput={setQueryInput}
                        queryLoading={queryLoading}
                        queryError={queryError}
                        queryResult={queryResult}
                        handleQuerySubmit={handleQuerySubmit}
                        onSaveQuery={handleSaveQuery}
                        saveMessage={saveMessage}
                    />
                )}
            </div>
        </div>
            </div>
        </div>
    );
}

export default Playground;