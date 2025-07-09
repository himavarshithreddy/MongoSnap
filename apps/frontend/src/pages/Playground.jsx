import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Database, CheckCircle, Clock, Calendar, Server, Home, ArrowLeft, Wifi, WifiOff, Power, RefreshCw, WifiIcon, ChevronDown, ChevronRight, FileText, Hash, LogOut, Settings, BarChart3, Download } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import Logo from '../components/Logo';
import QueryInterface from '../components/QueryInterface';
import SchemaExplorer from '../components/SchemaExplorer';
import QueryHistory from '../components/QueryHistory';
import SettingsModal from '../components/Settings';

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
    const [queryInput, setQueryInput] = useState('');
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
    const [queryMode, setQueryMode] = useState('natural'); // 'natural' or 'query'
    const [historyLoading, setHistoryLoading] = useState(false);
    const [savedQueriesLoading, setSavedQueriesLoading] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [usageStats, setUsageStats] = useState(null);
    const [usageLoading, setUsageLoading] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportError, setExportError] = useState('');
    const [exportSuccess, setExportSuccess] = useState('');

    // Fetch query history from backend
    const fetchQueryHistory = async () => {
        if (!connectionIdRef.current) return;
        
        setHistoryLoading(true);
        try {
            const response = await fetchWithAuth(`/api/query/history?connectionId=${connectionIdRef.current}&limit=50`);
            if (response.ok) {
                const data = await response.json();
                setQueryHistory(data.data.history || []);
            } else {
                console.error('Failed to fetch query history');
            }
        } catch (error) {
            console.error('Error fetching query history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Fetch saved queries from backend
    const fetchSavedQueries = async () => {
        if (!connectionIdRef.current) return;
        
        setSavedQueriesLoading(true);
        try {
            const response = await fetchWithAuth(`/api/query/saved?connectionId=${connectionIdRef.current}`);
            if (response.ok) {
                const data = await response.json();
                setSavedQueries(data.data || []);
            } else {
                console.error('Failed to fetch saved queries');
            }
        } catch (error) {
            console.error('Error fetching saved queries:', error);
        } finally {
            setSavedQueriesLoading(false);
        }
    };

    // Fetch user usage statistics
    const fetchUsageStats = async () => {
        setUsageLoading(true);
        try {
            const response = await fetchWithAuth('/api/auth/usage-stats');
            if (response.ok) {
                const data = await response.json();
                setUsageStats(data.data);
            } else {
                console.error('Failed to fetch usage statistics');
            }
        } catch (error) {
            console.error('Error fetching usage statistics:', error);
        } finally {
            setUsageLoading(false);
        }
    };

    // Initialize data with real backend data
    useEffect(() => {
        if (connectionIdRef.current) {
            fetchQueryHistory();
            fetchSavedQueries();
        }
        // Fetch usage stats regardless of connection
        fetchUsageStats();
    }, [connectionIdRef.current]);

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

    // Add periodic connection health check
    useEffect(() => {
        if (!connectionIdRef.current) return;

        const healthCheckInterval = setInterval(async () => {
            try {
                const response = await fetchWithAuth(`/api/connection/${connectionIdRef.current}/status`);
                if (response.ok) {
                    const data = await response.json();
                    const connection = data.connection;
                    
                    // Update connection status based on health check
                    setConnectionStatus(prev => ({
                        ...prev,
                        isConnected: connection.isConnected,
                        isAlive: connection.isAlive
                    }));
                    
                    // If connection is not alive, try to reconnect
                    if (!connection.isAlive && connection.isConnected) {
                        console.log('Connection health check failed, attempting reconnect...');
                        await handleReconnect();
                    }
                }
            } catch (error) {
                console.error('Connection health check failed:', error);
            }
        }, 30000); // Check every 30 seconds

        return () => {
            clearInterval(healthCheckInterval);
        };
    }, [connectionIdRef.current, fetchWithAuth]);

    // Add beforeunload event listener for page close only
    useEffect(() => {
        let isPageClosing = false;
        
        const handleBeforeUnload = () => {
            if (connectionIdRef.current && !isPageClosing) {
                isPageClosing = true;
                console.log('Page closing, attempting to disconnect connection:', connectionIdRef.current);
                
                // Use sendBeacon for more reliable cleanup on page close
                const disconnectData = JSON.stringify({
                    connectionId: connectionIdRef.current,
                    action: 'disconnect'
                });
                
                // Try to send disconnect request using sendBeacon (more reliable than fetch)
                if (navigator.sendBeacon) {
                    // Create a Blob with proper Content-Type for JSON
                    const blob = new Blob([disconnectData], { type: 'application/json' });
                    const success = navigator.sendBeacon('/api/connection/disconnect-on-close', blob);
                    console.log('sendBeacon result:', success);
                }
                
                // Also try the regular disconnect as fallback
                try {
                    // Use synchronous XMLHttpRequest for immediate execution
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', `/api/connection/${connectionIdRef.current}/disconnect`, false); // synchronous
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
                    xhr.send();
                    console.log('XMLHttpRequest disconnect sent');
                } catch (error) {
                    console.error('Error during page unload disconnect:', error);
                }
            }
        };

        const handleVisibilityChange = () => {
            // Only disconnect when the page becomes hidden AND the user is actually leaving
            // This helps distinguish between tab switching and actual page close
            if (document.visibilityState === 'hidden') {
                // Set a flag to indicate the page might be closing
                isPageClosing = true;
            } else {
                // Page became visible again, reset the flag
                isPageClosing = false;
            }
        };

        // Only disconnect on actual page close, not tab switches
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
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
        // Keep connections alive when navigating - don't auto-disconnect
        // Only disconnect on actual page close
        navigate(path);
    };

    // Get first letter of username
    const getFirstLetter = (username) => {
        return username ? username.charAt(0).toUpperCase() : 'U';
    };

    // Get usage indicator color
    const getUsageIndicatorColor = () => {
        if (!usageStats) return null;
        
        const maxPercentage = Math.max(
            usageStats.queryExecution.daily.percentage || 0,
            usageStats.aiGeneration.daily.percentage || 0
        );
        
        if (maxPercentage >= 90) return 'bg-red-500';
        if (maxPercentage >= 70) return 'bg-yellow-500';
        return null; // No indicator for low usage
    };

    // Handle logout
    const handleLogout = async () => {
        // Disconnect from database before logging out
        if (connectionIdRef.current) {
            try {
                await fetchWithAuth(`/api/connection/${connectionIdRef.current}/disconnect`, {
                    method: 'POST'
                });
                console.log('Disconnected from database before logout');
            } catch (error) {
                console.error('Error disconnecting before logout:', error);
            }
        }
        
        await logout();
    };

    // Handle database export
    const handleExportDatabase = async () => {
        if (!connectionIdRef.current) return;
        
        setExportLoading(true);
        setExportError('');
        setExportSuccess('');
        
        try {
            console.log('Exporting database for connection:', connectionIdRef.current);
            
            const response = await fetchWithAuth(`/api/connection/${connectionIdRef.current}/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                // Get the ZIP file blob
                const blob = await response.blob();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // Extract filename from response headers or generate one
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = `${connectionData?.databaseName || 'database'}-export-${new Date().toISOString().split('T')[0]}.zip`;
                
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                    }
                }
                
                link.download = filename;
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                // Show success message
                setExportSuccess(`Database exported successfully as ${filename}. Large collections may be truncated - check metadata.json for details.`);
                
                // Clear success message after 10 seconds
                setTimeout(() => setExportSuccess(''), 10000);
                
                console.log('Database export successful');
            } else {
                const errorData = await response.json();
                console.error('Export error response:', errorData);
                
                // Handle different error types with user-friendly messages
                if (response.status === 429) {
                    // Rate limit error
                    const retryAfter = errorData.retryAfter ? Math.ceil(errorData.retryAfter / 60) : 60;
                    setExportError(`🕒 Export limit reached. You can export up to 2 databases per hour. Please try again in ${retryAfter} minutes.`);
                } else if (response.status === 404) {
                    setExportError('❌ Database connection not found. Please reconnect and try again.');
                } else if (response.status === 400) {
                    setExportError('⚠️ Database connection issue. Please check your connection and try again.');
                } else {
                    setExportError(`❌ Export failed: ${errorData.message || 'Unknown error occurred'}`);
                }
            }
        } catch (error) {
            console.error('Error exporting database:', error);
            
            if (error.name === 'AbortError') {
                setExportError('⏱️ Export was cancelled or timed out. Please try again.');
            } else if (error.message.includes('Failed to fetch')) {
                setExportError('🌐 Network error. Please check your connection and try again.');
            } else {
                setExportError(`❌ Export failed: ${error.message}`);
            }
        } finally {
            setExportLoading(false);
        }
    };

    // Handler for query submission
    const handleQuerySubmit = async (e, queryToExecute = null) => {
        e.preventDefault();
        setQueryLoading(true);
        setQueryError('');
        setQueryResult(null);

        try {
            let actualQuery = queryToExecute || queryInput.trim();
            let naturalLanguageContext = null;
            let generatedQueryContext = null;

            // If a specific query is provided (like from natural language generation)
            if (queryToExecute) {
                // We're executing a generated query, preserve the natural language context
                if (queryMode === 'natural') {
                    naturalLanguageContext = queryInput; // Keep the original natural language
                    generatedQueryContext = queryToExecute;
                    actualQuery = queryToExecute;
                }
            } else {
                // Normal execution flow
                if (queryMode === 'natural') {
                    const generatedQueryElement = document.querySelector('pre');
                    if (generatedQueryElement) {
                        actualQuery = generatedQueryElement.textContent.trim();
                        naturalLanguageContext = queryInput;
                        generatedQueryContext = actualQuery;
                    }
                }
            }

            if (!actualQuery) {
                setQueryError('Please enter a query');
                return;
            }

            console.log('Executing raw query:', actualQuery);

            // Use the new raw execution endpoint
            const response = await fetchWithAuth(`/api/connection/${connectionIdRef.current}/execute-raw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    queryString: actualQuery,
                    naturalLanguage: naturalLanguageContext,
                    generatedQuery: generatedQueryContext
                })
            });

            if (response.ok) {
                const data = await response.json();
                setQueryResult(data.result);
                console.log('Query executed successfully:', data.result);
                
                // Refresh query history and usage stats after successful execution
                fetchQueryHistory();
                fetchUsageStats();
            } else {
                const errorData = await response.json();
                
                // Handle usage limit errors (429 status)
                if (response.status === 429) {
                    let limitError = '🚫 Usage Limit Reached\n\n';
                    
                    if (errorData.limitType === 'daily_limit_exceeded') {
                        limitError += `You've reached your daily query limit. Your limit will reset tomorrow.\n\n`;
                    } else if (errorData.limitType === 'monthly_limit_exceeded') {
                        limitError += `You've reached your monthly query limit. Your limit will reset next month.\n\n`;
                    } else {
                        limitError += `${errorData.message}\n\n`;
                    }
                    
                    if (errorData.usage) {
                        limitError += `Current Usage:\n`;
                        limitError += `Daily: ${errorData.usage.daily.used}/${errorData.usage.daily.limit}\n`;
                        limitError += `Monthly: ${errorData.usage.monthly.used}/${errorData.usage.monthly.limit}`;
                    }
                    
                    setQueryError(limitError);
                    // Refresh usage stats to reflect current state
                    fetchUsageStats();
                    return;
                }
                
                // Enhanced error handling for read-only databases and permissions
                let userFriendlyError = errorData.message || 'Failed to execute query';
                
                // Check if this is a permission/read-only error
                if (errorData.details) {
                    const details = errorData.details.toLowerCase();
                    
                    // Detect read-only or permission errors
                    if (details.includes('not allowed') || details.includes('permission') || 
                        details.includes('unauthorized') || details.includes('forbidden')) {
                        
                        // Check if this is a sample database (from URL params)
                        const urlParams = new URLSearchParams(window.location.search);
                        const isSample = urlParams.get('isSample') === 'true';
                        
                        if (isSample || connectionData?.isSample || connectionData?.isReadOnly) {
                            // Sample database specific error
                            userFriendlyError = '🔒 Sample Database is Read-Only';
                            
                            // Add detailed explanation based on operation type
                            if (details.includes('insert')) {
                                userFriendlyError += '\n\nTried to insert data, but this demo database only allows read operations like find(), count(), and aggregate(). To test write operations, connect to your own MongoDB database.';
                            } else if (details.includes('update') || details.includes('modify')) {
                                userFriendlyError += '\n\nTried to update data, but this demo database only allows read operations like find(), count(), and aggregate(). To test write operations, connect to your own MongoDB database.';
                            } else if (details.includes('delete') || details.includes('remove')) {
                                userFriendlyError += '\n\nTried to delete data, but this demo database only allows read operations like find(), count(), and aggregate(). To test write operations, connect to your own MongoDB database.';
                            } else if (details.includes('drop')) {
                                userFriendlyError += '\n\nTried to drop collection/database, but this demo database only allows read operations like find(), count(), and aggregate(). To test admin operations, connect to your own MongoDB database.';
                            } else {
                                userFriendlyError += '\n\nThis demo database only allows read operations like find(), count(), and aggregate(). To test write operations, connect to your own MongoDB database.';
                            }
                        } else {
                            // Regular permission error for user's own database
                            userFriendlyError = '🚫 Permission Denied';
                            userFriendlyError += '\n\nYour database user doesn\'t have permission for this operation. Check your MongoDB user roles and permissions.';
                            
                            if (errorData.details) {
                                userFriendlyError += '\n\nDetails: ' + errorData.details;
                            }
                        }
                    } else if (details.includes('timeout') || details.includes('connection')) {
                        userFriendlyError = '⏱️ Connection Timeout\n\nThe query took too long to execute or connection was lost. Try a simpler query or check your connection.';
                    } else if (details.includes('syntax') || details.includes('invalid')) {
                        userFriendlyError = '❌ Query Syntax Error\n\nThere\'s an issue with your query syntax. Check for typos and ensure proper MongoDB query format.';
                        if (errorData.details) {
                            userFriendlyError += '\n\nDetails: ' + errorData.details;
                        }
                    } else {
                        // Include details for other errors
                        userFriendlyError = errorData.message || 'Failed to execute query';
                        if (errorData.details) {
                            userFriendlyError += '\n\nDetails: ' + errorData.details;
                        }
                    }
                }
                
                setQueryError(userFriendlyError);
                console.error('Query execution failed:', errorData);
            }
        } catch (error) {
            console.error('Error executing query:', error);
            setQueryError('Failed to execute query: ' + error.message);
        } finally {
            setQueryLoading(false);
        }
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

    const executeHistoryQuery = async (query) => {
        if (!query.trim() || !connectionIdRef.current) {
            return;
        }
        
        // Set the query in the input field
        setQueryInput(query);
        setActiveTab('query'); // Switch to query tab
        
        // Execute the query automatically
        try {
            setQueryLoading(true);
            setQueryError('');
            
            console.log('Executing history query:', query);

            // Use the raw execution endpoint
            const response = await fetchWithAuth(`/api/connection/${connectionIdRef.current}/execute-raw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    queryString: query
                })
            });

            if (response.ok) {
                const data = await response.json();
                setQueryResult(data.result);
                console.log('History query executed successfully:', data.result);
            } else {
                const errorData = await response.json();
                
                // Enhanced error handling for read-only databases and permissions
                let userFriendlyError = errorData.message || 'Failed to execute query';
                
                // Check if this is a permission/read-only error
                if (errorData.details) {
                    const details = errorData.details.toLowerCase();
                    
                    // Detect read-only or permission errors
                    if (details.includes('not allowed') || details.includes('permission') || 
                        details.includes('unauthorized') || details.includes('forbidden')) {
                        
                        // Check if this is a sample database (from URL params)
                        const urlParams = new URLSearchParams(window.location.search);
                        const isSample = urlParams.get('isSample') === 'true';
                        
                        if (isSample || connectionData?.isSample || connectionData?.isReadOnly) {
                            // Sample database specific error
                            userFriendlyError = '🔒 Sample Database is Read-Only';
                            
                            // Add detailed explanation based on operation type
                            if (details.includes('insert')) {
                                userFriendlyError += '\n\nTried to insert data, but this demo database only allows read operations like find(), count(), and aggregate(). To test write operations, connect to your own MongoDB database.';
                            } else if (details.includes('update') || details.includes('modify')) {
                                userFriendlyError += '\n\nTried to update data, but this demo database only allows read operations like find(), count(), and aggregate(). To test write operations, connect to your own MongoDB database.';
                            } else if (details.includes('delete') || details.includes('remove')) {
                                userFriendlyError += '\n\nTried to delete data, but this demo database only allows read operations like find(), count(), and aggregate(). To test write operations, connect to your own MongoDB database.';
                            } else if (details.includes('drop')) {
                                userFriendlyError += '\n\nTried to drop collection/database, but this demo database only allows read operations like find(), count(), and aggregate(). To test admin operations, connect to your own MongoDB database.';
                            } else {
                                userFriendlyError += '\n\nThis demo database only allows read operations like find(), count(), and aggregate(). To test write operations, connect to your own MongoDB database.';
                            }
                        } else {
                            // Regular permission error for user's own database
                            userFriendlyError = '🚫 Permission Denied';
                            userFriendlyError += '\n\nYour database user doesn\'t have permission for this operation. Check your MongoDB user roles and permissions.';
                            
                            if (errorData.details) {
                                userFriendlyError += '\n\nDetails: ' + errorData.details;
                            }
                        }
                    } else if (details.includes('timeout') || details.includes('connection')) {
                        userFriendlyError = '⏱️ Connection Timeout\n\nThe query took too long to execute or connection was lost. Try a simpler query or check your connection.';
                    } else if (details.includes('syntax') || details.includes('invalid')) {
                        userFriendlyError = '❌ Query Syntax Error\n\nThere\'s an issue with your query syntax. Check for typos and ensure proper MongoDB query format.';
                        if (errorData.details) {
                            userFriendlyError += '\n\nDetails: ' + errorData.details;
                        }
                    } else {
                        // Include details for other errors
                        userFriendlyError = errorData.message || 'Failed to execute query';
                        if (errorData.details) {
                            userFriendlyError += '\n\nDetails: ' + errorData.details;
                        }
                    }
                }
                
                setQueryError(userFriendlyError);
                console.error('History query execution failed:', errorData);
            }
        } catch (error) {
            console.error('Error executing history query:', error);
            setQueryError('Failed to execute query: ' + error.message);
        } finally {
            setQueryLoading(false);
        }
    };

    const copyToQueryInput = (query) => {
        // Copy query to clipboard
        navigator.clipboard.writeText(query).then(() => {
            // Optional: Show a brief success message
            console.log('Query copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy query to clipboard:', err);
        });
    };

    const deleteHistoryItem = async (id) => {
        try {
            const response = await fetchWithAuth(`/api/query/history/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Refresh query history
                fetchQueryHistory();
            } else {
                console.error('Failed to delete query history');
            }
        } catch (error) {
            console.error('Error deleting query history:', error);
        }
    };

    const handleSaveQuery = async (query) => {
        if (!query.trim() || !connectionIdRef.current) {
            return;
        }

        try {
            // Simple regex to extract collection and operation from query
            const collectionMatch = query.match(/db\.([a-zA-Z_][a-zA-Z0-9_]*)\./);
            const operationMatch = query.match(/\.([a-zA-Z]+)\(/);
            
            const collection = collectionMatch ? collectionMatch[1] : 'unknown';
            const operation = operationMatch ? operationMatch[1] : 'unknown';

            // Generate a default name based on the query
            const defaultName = `${collection}_${operation}_${Date.now()}`;

            const response = await fetchWithAuth('/api/query/saved', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connectionId: connectionIdRef.current,
                    name: defaultName,
                    description: `Saved query for ${collection}.${operation}`,
                    query: query,
                    result: queryResult, // Include the current query result
                    collection: collection,
                    operation: operation
                })
            });

            if (response.ok) {
                setSaveMessage('Query saved successfully!');
                // Refresh saved queries
                fetchSavedQueries();
            } else {
                const errorData = await response.json();
                if (errorData.message.includes('already exists')) {
                    setSaveMessage('Query already saved');
                } else {
                    setSaveMessage('Failed to save query');
                }
            }
        } catch (error) {
            console.error('Error saving query:', error);
            setSaveMessage('Failed to save query');
        }

        setTimeout(() => setSaveMessage(''), 2000);
    };

    const deleteSavedQuery = async (id) => {
        try {
            const response = await fetchWithAuth(`/api/query/saved/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Refresh saved queries
                fetchSavedQueries();
            } else {
                console.error('Failed to delete saved query');
            }
        } catch (error) {
            console.error('Error deleting saved query:', error);
        }
    };

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            // Cleanup function - disconnect when component unmounts
            if (connectionIdRef.current) {
                console.log('Component unmounting, cleaning up connection:', connectionIdRef.current);
                // Use the auto-disconnect function
                handleAutoDisconnect(connectionIdRef.current);
            }
        };
    }, []);

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
                            <div className='flex items-center gap-2'>
                            <p className='text-white text-sm font-medium'>{connectionData?.nickname}</p>
                                {(connectionData?.isSample || connectionData?.isReadOnly || new URLSearchParams(window.location.search).get('isSample') === 'true') && (
                                    <span className='text-xs bg-brand-quaternary/50 text-brand-quaternary px-1.5 py-0.5 rounded font-medium'>
                                        DEMO
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div>
                            <label className='text-gray-400 text-xs font-medium'>Database</label>
                            <p className='text-white text-sm'>{connectionData?.databaseName}</p>
                        </div>
                        
                        <div>
                            <label className='text-gray-400 text-xs font-medium'>Host</label>
                            <p className='text-white text-sm'>{connectionData?.host}</p>
                        </div>
                        
                        {/* Read-Only Warning for Sample Databases */}
                        {(connectionData?.isSample || connectionData?.isReadOnly || new URLSearchParams(window.location.search).get('isSample') === 'true') && (
                            <div className='bg-brand-quaternary/20 border border-brand-quaternary/30 rounded-lg p-3 mt-3'>
                                <div className='flex items-center gap-2 mb-2'>
                                    <span className='text-brand-quaternary text-lg'>🔒</span>
                                    <span className='text-brand-quaternary text-xs font-bold'>Read-Only Sample Database</span>
                                </div>
                                <p className='text-gray-300 text-xs leading-relaxed'>
                                    This demo database only allows read operations like find(), count(), and aggregate(). 
                                    To test write operations, connect to your own MongoDB database.
                                </p>
                            </div>
                        )}
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
                    
                    <div className="relative group">
                        <button
                            onClick={handleExportDatabase}
                            disabled={exportLoading || !connectionStatus?.isConnected}
                            className='w-full flex items-center gap-2 p-3 bg-brand-quaternary text-white rounded-lg hover:bg-opacity-80 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                            title={!connectionStatus?.isConnected ? 'Connect to database first' : 'Export all collections as ZIP file (hover for limits)'}
                        >
                            {exportLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Exporting...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    <span>Export Database</span>
                                </>
                            )}
                        </button>
                        
                        {/* Export limits tooltip - shows on hover */}
                        <div className='absolute left-0 bottom-full mb-2 w-full opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-10'>
                            <div className='bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg'>
                                <div className='flex items-start gap-2'>
                                    <span className='text-yellow-400 text-sm'>⚠️</span>
                                    <div>
                                        <h4 className='text-white text-xs font-medium mb-1'>Export Limits</h4>
                                        <ul className='text-gray-300 text-xs space-y-0.5'>
                                            <li>• Collections {'>'}100MB will be skipped</li>
                                            <li>• Max 50k documents per collection</li>
                                            <li>• Large collections may be truncated, check metadata.json for details</li>
                                            <li>• 2 exports per hour per user</li>
                                        </ul>
                                    </div>
                                </div>
                                {/* Arrow pointing down */}
                                <div className='absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900'></div>
                            </div>
                        </div>
                    </div>
                    
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

                {/* Export Status Messages */}
                {exportSuccess && (
                    <div className='bg-brand-secondary border border-green-500/50 rounded-lg p-3'>
                        <div className='flex items-start gap-3'>
                            <div className='w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'>
                                <span className='text-green-400 text-xs'>✓</span>
                            </div>
                            <div className='flex-1'>
                                <h4 className='text-white font-medium text-xs mb-1'>Export Successful</h4>
                                <p className='text-gray-300 text-xs leading-relaxed'>{exportSuccess}</p>
                            </div>
                            <button
                                onClick={() => setExportSuccess('')}
                                className='text-xs bg-brand-tertiary text-gray-300 px-2 py-1 rounded hover:text-white hover:bg-opacity-80 transition-colors cursor-pointer'
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}

                {exportError && (
                    <div className='bg-brand-secondary border border-red-500/50 rounded-lg p-3'>
                        <div className='flex items-start gap-3'>
                            <div className='w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5'>
                                <span className='text-red-400 text-xs'>⚠</span>
                            </div>
                            <div className='flex-1'>
                                <h4 className='text-white font-medium text-xs mb-1'>Export Failed</h4>
                                <p className='text-gray-300 text-xs leading-relaxed'>{exportError}</p>
                            </div>
                            <button
                                onClick={() => setExportError('')}
                                className='text-xs bg-brand-tertiary text-gray-300 px-2 py-1 rounded hover:text-white hover:bg-opacity-80 transition-colors cursor-pointer'
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}



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
                        <div className="relative">
                            <button
                                onClick={() => setShowProfileModal(!showProfileModal)}
                                className="w-10 h-10 cursor-pointer bg-brand-tertiary rounded-full flex items-center justify-center text-white font-semibold hover:bg-opacity-80 transition-all duration-200"
                                title="Profile"
                            >
                                {getFirstLetter(user.name)}
                            </button>
                            {/* Usage indicator dot */}
                            {getUsageIndicatorColor() && (
                                <div 
                                    className={`absolute -top-1 -right-1 w-3 h-3 ${getUsageIndicatorColor()} rounded-full border-2 border-gray-900`}
                                    title="High usage detected"
                                ></div>
                            )}
                        </div>
                        
                        {/* Profile Modal */}
                        {showProfileModal && (
                            <>
                                {/* Backdrop */}
                                <div 
                                    className="fixed inset-0 bg-black/50 z-20 cursor-pointer"
                                    onClick={() => setShowProfileModal(false)}
                                />
                                
                                {/* Modal */}
                                <div className="absolute top-12 right-0 bg-brand-secondary rounded-lg p-4 border border-brand-tertiary shadow-lg z-30 min-w-80 max-w-96">
                                    <div className="flex items-center gap-3 mb-4 pb-3 border-b border-brand-tertiary">
                                        <div className="w-8 h-8 bg-brand-quaternary rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                            {getFirstLetter(user.name)}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium text-sm">{user.name}</p>
                                            <p className="text-gray-400 text-xs">{user.email}</p>
                                        </div>
                                    </div>
                                    
                                    {/* Usage Statistics */}
                                    {usageStats && (
                                        <div className='mb-4 pb-3 border-b border-brand-tertiary'>
                                            <div className="flex items-center gap-2 mb-3">
                                                <BarChart3 size={16} className="text-brand-quaternary" />
                                                <h3 className='text-white text-sm font-semibold'>Usage Limits</h3>
                                            </div>
                                            
                                            {/* Query Execution Usage */}
                                            <div className='mb-4'>
                                                <div className='flex items-center justify-between mb-1'>
                                                    <span className='text-gray-400 text-xs font-medium'>Query Execution</span>
                                                    <span className='text-white text-xs'>
                                                        {usageStats.queryExecution.daily.used}/{usageStats.queryExecution.daily.limit}
                                                    </span>
                                                </div>
                                                <div className='w-full bg-brand-tertiary rounded-full h-2 mb-1'>
                                                    <div 
                                                        className={`h-2 rounded-full transition-all duration-300 ${
                                                            usageStats.queryExecution.daily.percentage >= 90 ? 'bg-red-500' :
                                                            usageStats.queryExecution.daily.percentage >= 70 ? 'bg-yellow-500' :
                                                            'bg-green-500'
                                                        }`}
                                                        style={{ width: `${Math.min(usageStats.queryExecution.daily.percentage, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <div className='flex justify-between text-xs text-gray-400'>
                                                    <span>Daily: {usageStats.queryExecution.daily.remaining} left</span>
                                                    <span>Monthly: {usageStats.queryExecution.monthly.used}/{usageStats.queryExecution.monthly.limit}</span>
                                                </div>
                                            </div>
                                            
                                            {/* AI Generation Usage */}
                                            <div className='mb-3'>
                                                <div className='flex items-center justify-between mb-1'>
                                                    <span className='text-gray-400 text-xs font-medium'>AI Generation</span>
                                                    <span className='text-white text-xs'>
                                                        {usageStats.aiGeneration.daily.used}/{usageStats.aiGeneration.daily.limit}
                                                    </span>
                                                </div>
                                                <div className='w-full bg-brand-tertiary rounded-full h-2 mb-1'>
                                                    <div 
                                                        className={`h-2 rounded-full transition-all duration-300 ${
                                                            usageStats.aiGeneration.daily.percentage >= 90 ? 'bg-red-500' :
                                                            usageStats.aiGeneration.daily.percentage >= 70 ? 'bg-yellow-500' :
                                                            'bg-green-500'
                                                        }`}
                                                        style={{ width: `${Math.min(usageStats.aiGeneration.daily.percentage, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <div className='flex justify-between text-xs text-gray-400'>
                                                    <span>Daily: {usageStats.aiGeneration.daily.remaining} left</span>
                                                    <span>Monthly: {usageStats.aiGeneration.monthly.used}/{usageStats.aiGeneration.monthly.limit}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Refresh button */}
                                            <button
                                                onClick={fetchUsageStats}
                                                disabled={usageLoading}
                                                className='w-full cursor-pointer flex items-center justify-center gap-2 p-2 bg-brand-tertiary text-gray-300 rounded-md hover:text-white hover:bg-opacity-80 transition-all duration-200 text-xs disabled:opacity-50'
                                            >
                                                {usageLoading ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand-quaternary"></div>
                                                        <span>Updating...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw size={12} />
                                                        <span>Refresh Usage</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    
                                    <button
                                        onClick={() => {
                                            setShowSettingsModal(true);
                                            setShowProfileModal(false);
                                        }}
                                        className="w-full flex items-center gap-2 text-gray-300 cursor-pointer transition-colors p-2 rounded-md hover:bg-brand-tertiary"
                                    >
                                        <Settings size={16} />
                                        <span className="text-sm">Settings</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowProfileModal(false);
                                            navigate('/pricing');
                                        }}
                                        className="w-full flex items-center gap-2 text-gray-300 cursor-pointer transition-colors p-2 rounded-md hover:bg-brand-tertiary"
                                    >
                                        <Star size={16} />
                                        <span className="text-sm">Pricing</span>
                                    </button>
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
                        historyLoading={historyLoading}
                        savedQueriesLoading={savedQueriesLoading}
                    />
                ) : (
                    <QueryInterface 
                        queryInput={queryInput}
                        setQueryInput={setQueryInput}
                        queryLoading={queryLoading}
                        queryError={queryError}
                        setQueryError={setQueryError}
                        queryResult={queryResult}
                        handleQuerySubmit={handleQuerySubmit}
                        onSaveQuery={handleSaveQuery}
                        saveMessage={saveMessage}
                        queryMode={queryMode}
                        setQueryMode={setQueryMode}
                        onUsageUpdate={fetchUsageStats}
                    />
                )}
            </div>
        </div>
            </div>
        
        {/* Settings Modal */}
        <SettingsModal 
            isOpen={showSettingsModal} 
            onClose={() => setShowSettingsModal(false)} 
        />
        </div>
    );
}

export default Playground;