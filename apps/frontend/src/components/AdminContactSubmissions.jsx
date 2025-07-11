import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Calendar, User, Mail, AlertCircle, CheckCircle, Clock, X, Eye, Edit, MessageSquare } from 'lucide-react';
import { useUser } from '../hooks/useUser';
import { useNavigate } from 'react-router-dom';

const AdminContactSubmissions = ({ isOpen, onClose }) => {
    const { fetchWithAuth } = useUser();
    const navigate = useNavigate();
    
    // Determine if this is being used as a modal or standalone page
    const isModal = isOpen !== undefined;
    const shouldRender = isModal ? isOpen : true;
    
    const [contacts, setContacts] = useState([]);
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
    const [selectedContact, setSelectedContact] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState({ message: '', type: '' });

    // Fetch contacts
    const fetchContacts = useCallback(async () => {
        setLoading(true);
        setFeedback({ message: '', type: '' });
        try {
            const queryParams = new URLSearchParams(filters);
            const response = await fetchWithAuth(`/api/contact/admin/contacts?${queryParams}`);
            
            if (response.ok) {
                const data = await response.json();
                setContacts(data.data.contacts);
                setPagination(data.data.pagination);
            } else {
                setFeedback({ message: 'Failed to fetch contact submissions.', type: 'error' });
            }
        } catch (error) {
            console.error('Error fetching contact submissions:', error);
            setFeedback({ message: 'Error fetching contact submissions.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [filters, fetchWithAuth]);

    // Fetch statistics
    const fetchStats = useCallback(async () => {
        try {
            const response = await fetchWithAuth('/api/contact/admin/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data.data);
            } else {
                setFeedback({ message: 'Failed to fetch statistics.', type: 'error' });
            }
        } catch (error) {
            console.error('Error fetching statistics:', error);
            setFeedback({ message: 'Error fetching statistics.', type: 'error' });
        }
    }, [fetchWithAuth]);

    // Fetch data when component mounts or filters change
    useEffect(() => {
        if (!isModal || isOpen) {
            fetchContacts();
            fetchStats();
        }
    }, [isModal, isOpen, filters, fetchContacts, fetchStats]);

    // Handle filter changes
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value,
            page: key === 'page' ? value : 1
        }));
    };

    // Handle status update
    const handleStatusUpdate = async (contactId, newStatus, priority, response = '') => {
        setActionLoading(true);
        setFeedback({ message: '', type: '' });
        try {
            const response = await fetchWithAuth(`/api/contact/admin/contacts/${contactId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: newStatus,
                    priority: priority,
                    response: response
                })
            });

            if (response.ok) {
                setFeedback({ message: 'Status updated successfully.', type: 'success' });
                fetchContacts();
                fetchStats();
                if (showDetails && selectedContact && selectedContact._id === contactId) {
                    setSelectedContact(prev => ({
                        ...prev,
                        status: newStatus,
                        priority: priority,
                        response: response
                    }));
                }
            } else {
                setFeedback({ message: 'Failed to update status.', type: 'error' });
            }
        } catch (error) {
            console.error('Error updating status:', error);
            setFeedback({ message: 'Error updating status.', type: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    // View contact details
    const viewContactDetails = async (contactId) => {
        try {
            const response = await fetchWithAuth(`/api/contact/admin/contacts/${contactId}`);
            if (response.ok) {
                const data = await response.json();
                setSelectedContact(data.data);
                setShowDetails(true);
            }
        } catch (error) {
            console.error('Error fetching contact details:', error);
        }
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    // Get priority color
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'urgent': return 'text-red-500 bg-red-100';
            case 'high': return 'text-orange-500 bg-orange-100';
            case 'medium': return 'text-blue-500 bg-blue-100';
            case 'low': return 'text-gray-500 bg-gray-100';
            default: return 'text-gray-500 bg-gray-100';
        }
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'new': return 'text-blue-500 bg-blue-100';
            case 'in_progress': return 'text-yellow-500 bg-yellow-100';
            case 'responded': return 'text-green-500 bg-green-100';
            case 'closed': return 'text-gray-500 bg-gray-100';
            case 'spam': return 'text-red-500 bg-red-100';
            default: return 'text-gray-500 bg-gray-100';
        }
    };

    const handleClose = () => {
        if (isModal && onClose) {
            onClose();
        } else {
            navigate(-1);
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
                            ? 'bg-green-500/20 border-green-500/50'
                            : 'bg-red-500/20 border-red-500/50'
                    }`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            feedback.type === 'success' ? 'bg-green-500/30' : 'bg-red-500/30'
                        }`}>
                            {feedback.type === 'success' ? (
                                <CheckCircle size={14} className="text-green-500" />
                            ) : (
                                <AlertCircle size={14} className="text-red-500" />
                            )}
                        </div>
                        <span className={`text-sm ${
                            feedback.type === 'success' ? 'text-green-400' : 'text-red-400'
                        }`}>
                            {feedback.message}
                        </span>
                        <button
                            onClick={() => setFeedback({ message: '', type: '' })}
                            className="ml-auto text-gray-400 hover:text-white cursor-pointer"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-brand-tertiary">
                    <div className="flex items-center gap-3">
                        <MessageSquare className="text-brand-quaternary" size={24} />
                        <h1 className="text-2xl font-bold text-white">Contact Submissions</h1>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white cursor-pointer"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 border-b border-brand-tertiary">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">{stats.total}</div>
                            <div className="text-sm text-gray-400">Total</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-400">{stats.byStatus.new}</div>
                            <div className="text-sm text-gray-400">New</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-400">{stats.byStatus.inProgress}</div>
                            <div className="text-sm text-gray-400">In Progress</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-green-400">{stats.byStatus.responded}</div>
                            <div className="text-sm text-gray-400">Responded</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-gray-400">{stats.byStatus.closed}</div>
                            <div className="text-sm text-gray-400">Closed</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="p-6 border-b border-brand-tertiary">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="w-full px-3 py-2 bg-brand-primary border border-brand-tertiary rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-quaternary"
                            />
                        </div>
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="px-3 py-2 bg-brand-primary border border-brand-tertiary rounded-lg text-white focus:outline-none focus:border-brand-quaternary"
                        >
                            <option value="all">All Status</option>
                            <option value="new">New</option>
                            <option value="in_progress">In Progress</option>
                            <option value="responded">Responded</option>
                            <option value="closed">Closed</option>
                            <option value="spam">Spam</option>
                        </select>
                        <select
                            value={filters.category}
                            onChange={(e) => handleFilterChange('category', e.target.value)}
                            className="px-3 py-2 bg-brand-primary border border-brand-tertiary rounded-lg text-white focus:outline-none focus:border-brand-quaternary"
                        >
                            <option value="all">All Categories</option>
                            <option value="general">General</option>
                            <option value="technical">Technical</option>
                            <option value="billing">Billing</option>
                            <option value="partnership">Partnership</option>
                            <option value="feedback">Feedback</option>
                            <option value="bug">Bug Report</option>
                        </select>
                        <select
                            value={filters.priority}
                            onChange={(e) => handleFilterChange('priority', e.target.value)}
                            className="px-3 py-2 bg-brand-primary border border-brand-tertiary rounded-lg text-white focus:outline-none focus:border-brand-quaternary"
                        >
                            <option value="all">All Priorities</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-quaternary"></div>
                        </div>
                    ) : (
                        <div className="h-full overflow-y-auto">
                            {contacts.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    No contact submissions found
                                </div>
                            ) : (
                                <div className="p-6 space-y-4">
                                    {contacts.map((contact) => (
                                        <div
                                            key={contact._id}
                                            className="bg-brand-primary rounded-lg p-4 border border-brand-tertiary hover:border-brand-quaternary/50 transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="text-lg font-semibold text-white">
                                                            {contact.subject}
                                                        </h3>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(contact.status)}`}>
                                                            {contact.status.replace('_', ' ')}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(contact.priority)}`}>
                                                            {contact.priority}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                                                        <span className="flex items-center gap-1">
                                                            <User size={14} />
                                                            {contact.name}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Mail size={14} />
                                                            {contact.email}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={14} />
                                                            {formatDate(contact.createdAt)}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-300 text-sm line-clamp-2">
                                                        {contact.message}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 ml-4">
                                                    <button
                                                        onClick={() => viewContactDetails(contact._id)}
                                                        className="p-2 text-gray-400 hover:text-brand-quaternary cursor-pointer"
                                                        title="View Details"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between p-6 border-t border-brand-tertiary">
                        <div className="text-sm text-gray-400">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} contacts
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleFilterChange('page', pagination.page - 1)}
                                disabled={!pagination.hasPrev}
                                className="px-3 py-1 bg-brand-primary border border-brand-tertiary rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-brand-quaternary cursor-pointer"
                            >
                                Previous
                            </button>
                            <span className="text-white">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => handleFilterChange('page', pagination.page + 1)}
                                disabled={!pagination.hasNext}
                                className="px-3 py-1 bg-brand-primary border border-brand-tertiary rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-brand-quaternary cursor-pointer"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Contact Details Modal */}
            {showDetails && selectedContact && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-brand-secondary rounded-lg border border-brand-tertiary shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-brand-tertiary">
                            <h2 className="text-xl font-bold text-white">Contact Details</h2>
                            <button
                                onClick={() => setShowDetails(false)}
                                className="text-gray-400 hover:text-white cursor-pointer"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-2">{selectedContact.subject}</h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                                        <span>From: {selectedContact.name} ({selectedContact.email})</span>
                                        <span>Category: {selectedContact.category}</span>
                                        <span>Date: {formatDate(selectedContact.createdAt)}</span>
                                    </div>
                                    <div className="bg-brand-primary rounded-lg p-4">
                                        <p className="text-gray-300 whitespace-pre-wrap">{selectedContact.message}</p>
                                    </div>
                                </div>

                                {selectedContact.response && (
                                    <div>
                                        <h4 className="text-md font-semibold text-white mb-2">Response</h4>
                                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                            <p className="text-gray-300 whitespace-pre-wrap">{selectedContact.response}</p>
                                            <div className="text-sm text-gray-400 mt-2">
                                                Responded by: {selectedContact.respondedBy?.name || 'Admin'} on {formatDate(selectedContact.respondedAt)}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedContact.adminNotes && selectedContact.adminNotes.length > 0 && (
                                    <div>
                                        <h4 className="text-md font-semibold text-white mb-2">Admin Notes</h4>
                                        <div className="space-y-3">
                                            {selectedContact.adminNotes.map((note, index) => (
                                                <div key={index} className="bg-brand-primary rounded-lg p-3">
                                                    <p className="text-gray-300 text-sm">{note.note}</p>
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        {note.addedBy?.name || 'Admin'} - {formatDate(note.addedAt)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminContactSubmissions; 