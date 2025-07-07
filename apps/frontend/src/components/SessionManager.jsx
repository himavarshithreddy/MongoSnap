import React, { useState, useEffect } from 'react';
import { useUser } from '../hooks/useUser';
import { Monitor, Shield, Activity, LogOut, RefreshCw, AlertTriangle, CheckCircle, Clock, Smartphone } from 'lucide-react';

const SessionManager = () => {
    const { fetchWithAuth } = useUser();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Fetch session data
    const fetchSessionData = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await fetchWithAuth('/api/auth/active-sessions');
            if (response.ok) {
                const data = await response.json();
                setSessions(data.sessions || []);
            } else {
                const errorData = await response.json();
                if (response.status === 404) {
                    setError('No sessions found. This might be a new login or OAuth session.');
                } else {
                    setError(errorData.message || 'Failed to load sessions');
                }
            }
        } catch (err) {
            console.error('Error fetching session data:', err);
            setError('Failed to load session data');
        } finally {
            setLoading(false);
        }
    };

    // Revoke specific session
    const revokeSession = async (sessionId) => {
        if (!confirm('Are you sure you want to revoke this session?\n\nNote: It may take up to 15 minutes for the session to fully expire.')) {
            return;
        }

        try {
            const response = await fetchWithAuth('/api/auth/revoke-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });

            if (response.ok) {
                await fetchSessionData();
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to revoke session');
            }
        } catch (err) {
            console.error('Error revoking session:', err);
            setError('Failed to revoke session');
        }
    };

    // Revoke all sessions and logout
    const revokeAllSessions = async () => {
        if (!confirm('Are you sure you want to logout from ALL devices? You will need to log in again.\n\nNote: It may take up to 15 minutes for all sessions to fully expire.')) {
            return;
        }

        try {
            // First revoke all sessions
            const revokeResponse = await fetchWithAuth('/api/auth/revoke-all-sessions', {
                method: 'POST'
            });

            if (revokeResponse.ok) {
                // Then logout the current user
                const logoutResponse = await fetchWithAuth('/api/auth/logout', {
                    method: 'POST'
                });

                if (logoutResponse.ok) {
                    // Clear local storage and redirect
                    localStorage.removeItem('token');
                    localStorage.removeItem('csrfToken');
                    window.location.href = '/login';
                } else {
                    // Even if logout fails, redirect to login since sessions are revoked
                    localStorage.removeItem('token');
                    localStorage.removeItem('csrfToken');
                    window.location.href = '/login';
                }
            } else {
                const errorData = await revokeResponse.json();
                setError(errorData.message || 'Failed to revoke all sessions');
            }
        } catch (err) {
            console.error('Error during logout all:', err);
            // Even if there's an error, clear tokens and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('csrfToken');
            window.location.href = '/login';
        }
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleString();
    };

    // Get device icon
    const getDeviceIcon = (userAgent) => {
        const agent = userAgent.toLowerCase();
        if (agent.includes('mobile') || agent.includes('android') || agent.includes('iphone')) {
            return <Smartphone size={16} />;
        }
        return <Monitor size={16} />;
    };

    // Load data on mount
    useEffect(() => {
        fetchSessionData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#11a15e]"></div>
                <span className="ml-2 text-gray-400">Loading sessions...</span>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#35c56a69] rounded-lg">
                        <Shield size={20} className="text-[#11a15e]" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Session Management</h3>
                        <p className="text-gray-400 text-sm">Manage your active sessions</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchSessionData}
                        className="px-3 py-2 text-sm bg-[#0f1611] text-gray-300 rounded-md hover:bg-[#1a2520] transition-colors cursor-pointer flex items-center gap-2"
                        title="Refresh sessions"
                    >
                        <RefreshCw size={14} />
                        <span>Refresh</span>
                    </button>
                    <button
                        onClick={revokeAllSessions}
                        className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-2"
                        title="Logout from all devices and revoke all sessions"
                    >
                        <LogOut size={14} />
                        <span>Logout All</span>
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-400" />
                        <span className="text-red-200 text-sm">{error}</span>
                    </div>
                </div>
            )}

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                    <div className="text-center py-8">
                                                 <div className="p-4 bg-[#0f1611] rounded-lg inline-block mb-4 cursor-default">
                             <Monitor size={32} className="text-gray-500" />
                         </div>
                        <p className="text-gray-400 text-sm">No active sessions found</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sessions.map(session => (
                            <div key={session.id} className="bg-[#0f1611] rounded-lg p-4 border border-gray-700 hover:bg-[#1a2520] transition-colors cursor-default">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                        <div className="p-2 bg-[#35c56a69] rounded-lg">
                                            {getDeviceIcon(session.deviceInfo.userAgent)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                                                             <h4 className="text-white font-medium text-sm truncate" title={session.deviceInfo.userAgent}>
                                                 {session.deviceInfo.userAgent}
                                             </h4>
                                                {session.isCurrent && (
                                                    <span className="px-2 py-0.5 text-xs bg-[#11a15e]/20 text-[#11a15e] rounded-full">
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                                                                         <p className="text-gray-400 text-xs mb-2" title={`IP Address: ${session.deviceInfo.ipAddress}`}>
                                                 IP: {session.deviceInfo.ipAddress}
                                             </p>
                                                                                         <div className="flex items-center gap-4 text-xs text-gray-500">
                                                 <div className="flex items-center gap-1" title={`Last activity: ${formatDate(session.lastUsedAt)}`}>
                                                     <Clock size={12} />
                                                     <span>Last used: {formatDate(session.lastUsedAt)}</span>
                                                 </div>
                                                 <div className="flex items-center gap-1" title={`Session status: ${session.isUsed ? 'Used' : 'Active'}`}>
                                                     <Activity size={12} />
                                                     <span>{session.isUsed ? 'Used' : 'Active'}</span>
                                                 </div>
                                             </div>
                                        </div>
                                    </div>
                                    {!session.isCurrent && (
                                        <button
                                            onClick={() => revokeSession(session.id)}
                                            className="px-3 py-1 text-sm bg-red-600/20 text-red-400 rounded-md hover:bg-red-600/30 transition-colors cursor-pointer"
                                            title={`Revoke session from ${session.deviceInfo.userAgent}`}
                                        >
                                            Revoke
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

                         {/* Footer Info */}
             <div className="mt-6 p-4 bg-[#0f1611] rounded-lg border border-gray-700 cursor-default">
                <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={16} className="text-[#11a15e]" />
                    <span className="text-white text-sm font-medium">Security Tips</span>
                </div>
                                 <ul className="text-gray-400 text-xs space-y-1">
                     <li>• Revoke sessions from devices you no longer use</li>
                     <li>• Your current session will remain active</li>
                     <li>• Sessions automatically expire after 7 days</li>
                     <li>• Revoked sessions may take up to 15 minutes to fully expire</li>
                     
                 </ul>
            </div>
        </div>
    );
};

export default SessionManager; 