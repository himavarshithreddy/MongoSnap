import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Calendar, User, Bug, AlertCircle, CheckCircle, Clock, X, Eye, Edit } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import { useNavigate } from 'react-router-dom';

const AdminBugReports = ({ isOpen, onClose }) => {
    const { fetchWithAuth } = useUser();
    const navigate = useNavigate();
    
    // Determine if this is being used as a modal or standalone page
    const isModal = isOpen !== undefined;
    const shouldRender = isModal ? isOpen : true;
    
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({});
    const [filters, setFilters] = useState({
        search: '',
        status: 'all',
        category: 'all',
        priority: 'all',
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc'
    });
    const [stats, setStats] = useState(null);
    const [selectedReport, setSelectedReport] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState({ message: '', type: '' }); // type: 'success' | 'error'

    // Fetch reports
    const fetchReports = useCallback(async () => {
        setLoading(true);
        setFeedback({ message: '', type: '' });
        try {
            const queryParams = new URLSearchParams(filters);
            const response = await fetchWithAuth(`/api/bug-report/admin/reports?${queryParams}`);
            
            if (response.ok) {
                const data = await response.json();
                setReports(data.data.reports);
                setPagination(data.data.pagination);
            } else {
                setFeedback({ message: 'Failed to fetch bug reports.', type: 'error' });
            }
        } catch {
            setFeedback({ message: 'Error fetching bug reports.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [filters, fetchWithAuth]);

    // Fetch statistics
    const fetchStats = useCallback(async () => {
        try {
            const response = await fetchWithAuth('/api/bug-report/admin/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data.data);
            } else {
                setFeedback({ message: 'Failed to fetch statistics.', type: 'error' });
            }
        } catch {
            setFeedback({ message: 'Error fetching statistics.', type: 'error' });
        }
    }, [fetchWithAuth]);

    // Fetch data when component mounts or filters change
    useEffect(() => {
        if (!isModal || isOpen) {
            fetchReports();
            fetchStats();
        }
    }, [isModal, isOpen, filters, fetchReports, fetchStats]);

    // Handle filter changes
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            page: key === 'page' ? value : 1 // Reset to page 1 unless changing page
        }));
    };

    // Handle status update
    const handleStatusUpdate = async (reportId, newStatus, resolution = '') => {
        setActionLoading(true);
        setFeedback({ message: '', type: '' });
        try {
            const response = await fetchWithAuth(`/api/bug-report/admin/reports/${reportId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    resolution: resolution
                })
            });

            if (response.ok) {
                setFeedback({ message: 'Status updated successfully.', type: 'success' });
                fetchReports();
                fetchStats();
                if (selectedReport && selectedReport.id === reportId) {
                    setSelectedReport(prev => ({
                        ...prev,
                        status: newStatus,
                        resolution: resolution
                    }));
                }
            } else {
                setFeedback({ message: 'Failed to update status.', type: 'error' });
            }
        } catch {
            setFeedback({ message: 'Error updating status.', type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    // View report details
    const viewReportDetails = async (reportId) => {
        try {
            const response = await fetchWithAuth(`/api/bug-report/admin/reports/${reportId}`);
            if (response.ok) {
                const data = await response.json();
                setSelectedReport(data.data);
                setShowDetails(true);
            }
        } catch (error) {
            console.error('Error fetching report details:', error);
        }
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    // Get priority color
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent': return 'text-orange-500 bg-orange-100';
            case 'high': return 'text-yellow-500 bg-yellow-100';
            case 'medium': return 'text-blue-500 bg-blue-100';
            case 'low': return 'text-gray-500 bg-gray-100';
            default: return 'text-gray-500 bg-gray-100';
        }
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return 'text-orange-500 bg-orange-100';
            case 'in_progress': return 'text-blue-500 bg-blue-100';
            case 'resolved': return 'text-brand-quaternary bg-brand-quaternary/10';
            case 'closed': return 'text-gray-500 bg-gray-100';
            case 'duplicate': return 'text-purple-500 bg-purple-100';
            default: return 'text-gray-500 bg-gray-100';
        }
    };

    const handleClose = () => {
        if (isModal && onClose) {
            onClose();
        } else {
            navigate(-1); // Go back to previous page
        }
    };

    if (!shouldRender) return null;

    const containerClasses = isModal
        ? "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        : "min-h-screen bg-brand-primary p-4";
        
    const modalClasses = isModal
        ? "bg-brand-secondary rounded-lg border border-brand-tertiary shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col custom-scrollbar"
        : "bg-brand-secondary rounded-lg border border-brand-tertiary shadow-xl w-full max-w-7xl mx-auto overflow-hidden flex flex-col custom-scrollbar min-h-[80vh]";

    return (
        <div className={containerClasses}>
            <div className={modalClasses}>
                {/* Feedback Banner */}
                {feedback.message && (
                    <div className={`flex items-center gap-3 px-6 py-4 border-b ${
                        feedback.type === 'success'
                            ? 'bg-brand-quaternary/20 border-brand-quaternary/50'
                            : 'bg-orange-500/20 border-orange-500/50'
                    }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            feedback.type === 'success' ? 'bg-brand-quaternary/30' : 'bg-orange-500/30'
                        }`}>
                            {feedback.type === 'success' ? (
                                <CheckCircle size={14} className="text-brand-quaternary" />
                            ) : (
                                <AlertCircle size={14} className="text-orange-400" />
                            )}
                        </div>
                        <div className="flex-1">
                            <p className={`text-sm font-medium ${
                                feedback.type === 'success' ? 'text-brand-quaternary' : 'text-orange-200'
                            }`}>
                                {feedback.type === 'success' ? 'Success!' : 'Error'}
                            </p>
                            <p className={`text-sm mt-1 ${
                                feedback.type === 'success' ? 'text-gray-300' : 'text-orange-300'
                            }`}>
                                {feedback.message}
                            </p>
                        </div>
                        <button
                            onClick={() => setFeedback({ message: '', type: '' })}
                            className="text-gray-400 hover:text-white transition-colors duration-200 text-xl cursor-pointer ml-2"
                            title="Dismiss"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-brand-tertiary">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-quaternary/20 rounded-full flex items-center justify-center">
                            <Bug size={16} className="text-brand-quaternary" />
                        </div>
                        <h2 className="text-white text-xl font-bold">Bug Reports Administration</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors duration-200 text-2xl cursor-pointer"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Stats Overview */}
                {stats && (
                    <div className="p-6 border-b border-brand-tertiary bg-brand-tertiary/20">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-brand-secondary rounded-lg p-4 border border-brand-tertiary">
                                <div className="text-2xl font-bold text-white">{stats.overview.totalReports}</div>
                                <div className="text-gray-400 text-sm">Total Reports</div>
                            </div>
                            <div className="bg-brand-secondary rounded-lg p-4 border border-brand-tertiary">
                                <div className="text-2xl font-bold text-blue-400">{stats.overview.recentReports}</div>
                                <div className="text-gray-400 text-sm">Recent ({stats.overview.timeframe})</div>
                            </div>
                            <div className="bg-brand-secondary rounded-lg p-4 border border-brand-tertiary">
                                <div className="text-2xl font-bold text-brand-quaternary">
                                    {stats.breakdowns.status.find(s => s._id === 'resolved')?.count || 0}
                                </div>
                                <div className="text-gray-400 text-sm">Resolved</div>
                            </div>
                            <div className="bg-brand-secondary rounded-lg p-4 border border-brand-tertiary">
                                <div className="text-2xl font-bold text-orange-400">
                                    {stats.breakdowns.status.find(s => s._id === 'open')?.count || 0}
                                </div>
                                <div className="text-gray-400 text-sm">Open</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="p-6 border-b border-brand-tertiary bg-brand-tertiary/10">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search reports..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-brand-tertiary border border-gray-500/30 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-brand-quaternary"
                            />
                        </div>

                        {/* Status Filter */}
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="w-full px-3 py-2 bg-brand-tertiary border border-gray-500/30 rounded-md text-white focus:outline-none focus:border-brand-quaternary"
                        >
                            <option value="all">All Status</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                            <option value="duplicate">Duplicate</option>
                        </select>

                        {/* Category Filter */}
                        <select
                            value={filters.category}
                            onChange={(e) => handleFilterChange('category', e.target.value)}
                            className="w-full px-3 py-2 bg-brand-tertiary border border-gray-500/30 rounded-md text-white focus:outline-none focus:border-brand-quaternary"
                        >
                            <option value="all">All Categories</option>
                            <option value="query_not_executing">Query Not Executing</option>
                            <option value="query_generation_failed">AI Generation Failed</option>
                            <option value="connection_issues">Connection Issues</option>
                            <option value="ui_bug">UI Bug</option>
                            <option value="performance_issue">Performance Issue</option>
                            <option value="feature_request">Feature Request</option>
                            <option value="data_display_error">Data Display Error</option>
                            <option value="authentication_problem">Auth Problem</option>
                            <option value="export_functionality">Export Issue</option>
                            <option value="schema_explorer_issue">Schema Explorer</option>
                            <option value="other">Other</option>
                        </select>

                        {/* Priority Filter */}
                        <select
                            value={filters.priority}
                            onChange={(e) => handleFilterChange('priority', e.target.value)}
                            className="w-full px-3 py-2 bg-brand-tertiary border border-gray-500/30 rounded-md text-white focus:outline-none focus:border-brand-quaternary"
                        >
                            <option value="all">All Priorities</option>
                            <option value="urgent">Urgent</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>

                        {/* Sort */}
                        <select
                            value={`${filters.sortBy}-${filters.sortOrder}`}
                            onChange={(e) => {
                                const [sortBy, sortOrder] = e.target.value.split('-');
                                handleFilterChange('sortBy', sortBy);
                                handleFilterChange('sortOrder', sortOrder);
                            }}
                            className="w-full px-3 py-2 bg-brand-tertiary border border-gray-500/30 rounded-md text-white focus:outline-none focus:border-brand-quaternary"
                        >
                            <option value="createdAt-desc">Newest First</option>
                            <option value="createdAt-asc">Oldest First</option>
                            <option value="updatedAt-desc">Recently Updated</option>
                            <option value="priority-desc">High Priority First</option>
                            <option value="status-asc">Status A-Z</option>
                        </select>
                    </div>
                </div>

                {/* Reports List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-quaternary"></div>
                            <span className="ml-3 text-gray-400">Loading reports...</span>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <Bug size={48} className="text-gray-500 mx-auto mb-4" />
                                <p className="text-gray-400">No bug reports found</p>
                            </div>
                        </div>
                    ) : (
                        <div className="divide-y divide-brand-tertiary">
                            {reports.map((report) => (
                                <div key={report.id} className="p-6 hover:bg-brand-tertiary/20 transition-colors duration-200">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h3 className="text-white font-medium text-lg">{report.title}</h3>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                                                            {report.status.replace('_', ' ')}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
                                                            {report.priority}
                                                        </span>
                                                    </div>
                                                    
                                                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">{report.description}</p>
                                                    
                                                    <div className="flex items-center gap-4 text-xs text-gray-400">
                                                        <span className="flex items-center gap-1">
                                                            <User size={12} />
                                                            {report.userInfo.name} ({report.userInfo.email})
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={12} />
                                                            {formatDate(report.createdAt)}
                                                        </span>
                                                        <span className="capitalize">{report.category.replace('_', ' ')}</span>
                                                        <span className="capitalize">{report.page}</span>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => viewReportDetails(report.id)}
                                                        className="p-2 text-gray-400 hover:text-brand-quaternary transition-colors duration-200 cursor-pointer"
                                                        title="View Details"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    
                                                    {report.status === 'open' && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(report.id, 'in_progress')}
                                                            disabled={actionLoading}
                                                            className="px-3 py-1 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors duration-200 cursor-pointer disabled:opacity-50"
                                                        >
                                                            Start Work
                                                        </button>
                                                    )}
                                                    
                                                    {(report.status === 'open' || report.status === 'in_progress') && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(report.id, 'resolved', 'Issue resolved')}
                                                            disabled={actionLoading}
                                                            className="px-3 py-1 bg-brand-quaternary text-white text-xs rounded-md hover:bg-brand-quaternary/80 transition-colors duration-200 cursor-pointer disabled:opacity-50"
                                                        >
                                                            Resolve
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="p-6 border-t border-brand-tertiary bg-brand-tertiary/10">
                        <div className="flex items-center justify-between">
                            <div className="text-gray-400 text-sm">
                                Showing {((pagination.currentPage - 1) * filters.limit) + 1} to {Math.min(pagination.currentPage * filters.limit, pagination.totalReports)} of {pagination.totalReports} reports
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleFilterChange('page', pagination.currentPage - 1)}
                                    disabled={!pagination.hasPrevPage}
                                    className="px-3 py-2 bg-brand-tertiary text-white rounded-md hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                                >
                                    Previous
                                </button>
                                
                                <span className="text-white px-4 py-2">
                                    Page {pagination.currentPage} of {pagination.totalPages}
                                </span>
                                
                                <button
                                    onClick={() => handleFilterChange('page', pagination.currentPage + 1)}
                                    disabled={!pagination.hasNextPage}
                                    className="px-3 py-2 bg-brand-tertiary text-white rounded-md hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Report Details Modal */}
            {showDetails && selectedReport && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-10">
                    <div className="bg-brand-secondary rounded-lg border border-brand-tertiary shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="p-6 border-b border-brand-tertiary">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white text-xl font-bold">Bug Report Details</h3>
                                <button
                                    onClick={() => setShowDetails(false)}
                                    className="text-gray-400 hover:text-white transition-colors duration-200 text-xl cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <h4 className="text-white font-medium mb-2">Basic Information</h4>
                                    <div className="space-y-2 text-sm">
                                        <div><span className="text-gray-400">Title:</span> <span className="text-white">{selectedReport.title}</span></div>
                                        <div><span className="text-gray-400">Category:</span> <span className="text-white">{selectedReport.category.replace('_', ' ')}</span></div>
                                        <div><span className="text-gray-400">Status:</span> <span className={`px-2 py-1 rounded ${getStatusColor(selectedReport.status)}`}>{selectedReport.status}</span></div>
                                        <div><span className="text-gray-400">Priority:</span> <span className={`px-2 py-1 rounded ${getPriorityColor(selectedReport.priority)}`}>{selectedReport.priority}</span></div>
                                        <div><span className="text-gray-400">Page:</span> <span className="text-white">{selectedReport.page}</span></div>
                                    </div>
                                </div>
                                
                                <div>
                                    <h4 className="text-white font-medium mb-2">User Information</h4>
                                    <div className="space-y-2 text-sm">
                                        <div><span className="text-gray-400">Name:</span> <span className="text-white">{selectedReport.userName}</span></div>
                                        <div><span className="text-gray-400">Email:</span> <span className="text-white">{selectedReport.userEmail}</span></div>
                                        <div><span className="text-gray-400">IP:</span> <span className="text-white">{selectedReport.ipAddress}</span></div>
                                        <div><span className="text-gray-400">Browser:</span> <span className="text-white">{selectedReport.browserInfo?.browserName} {selectedReport.browserInfo?.browserVersion}</span></div>
                                        <div><span className="text-gray-400">OS:</span> <span className="text-white">{selectedReport.browserInfo?.osName} {selectedReport.browserInfo?.osVersion}</span></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <h4 className="text-white font-medium mb-2">Description</h4>
                                <div className="bg-brand-tertiary rounded-lg p-4 text-gray-300">
                                    {selectedReport.description}
                                </div>
                            </div>
                            
                            {selectedReport.problematicQuery && (
                                <div>
                                    <h4 className="text-white font-medium mb-2">Problematic Query</h4>
                                    <pre className="bg-brand-tertiary rounded-lg p-4 text-gray-300 text-sm overflow-x-auto">
                                        {selectedReport.problematicQuery}
                                    </pre>
                                </div>
                            )}
                            
                            {selectedReport.resolution && (
                                <div>
                                    <h4 className="text-white font-medium mb-2">Resolution</h4>
                                    <div className="bg-brand-quaternary/20 border border-brand-quaternary/50 rounded-lg p-4 text-gray-300">
                                        {selectedReport.resolution}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminBugReports; 