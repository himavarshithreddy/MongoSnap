import React, { useState, useEffect } from 'react';
import { Bug, X, AlertCircle, CheckCircle, Send, ChevronDown } from 'lucide-react';
import { useUser } from '../hooks/useUser';

const BugReport = ({ 
    isOpen, 
    onClose, 
    page = 'unknown',
    connectionId = null,
    problematicQuery = '',
    collectionName = ''
}) => {
    const { fetchWithAuth } = useUser();
    
    const [formData, setFormData] = useState({
        category: '',
        customCategory: '',
        title: '',
        description: '',
        problematicQuery: problematicQuery || ''
    });
    
    const [categories, setCategories] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitMessage, setSubmitMessage] = useState('');
    const [submitType, setSubmitType] = useState(''); // 'success' or 'error'
    const [errors, setErrors] = useState({});
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    // Fetch categories when component mounts
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetchWithAuth('/api/bug-report/categories');
                if (response.ok) {
                    const data = await response.json();
                    setCategories(data.data || []);
                }
            } catch (error) {
                console.error('Error fetching bug report categories:', error);
            }
        };

        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen, fetchWithAuth]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setFormData({
                category: '',
                customCategory: '',
                title: '',
                description: '',
                problematicQuery: problematicQuery || ''
            });
            setErrors({});
            setSubmitMessage('');
            setSubmitType('');
        }
    }, [isOpen, problematicQuery]);

    // Auto-expand description textarea
    useEffect(() => {
        const textarea = document.querySelector('textarea[name="description"]');
        if (textarea && formData.description) {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    }, [formData.description]);

    // Validate form
    const validateForm = () => {
        const newErrors = {};

        if (!formData.category) {
            newErrors.category = 'Please select an issue category';
        }

        if (formData.category === 'other' && !formData.customCategory.trim()) {
            newErrors.customCategory = 'Please specify the issue type';
        }

        if (!formData.title.trim()) {
            newErrors.title = 'Please provide a brief title';
        } else if (formData.title.length > 200) {
            newErrors.title = 'Title must be 200 characters or less';
        }

        if (!formData.description.trim()) {
            newErrors.description = 'Please describe the issue';
        } else if (formData.description.length > 2000) {
            newErrors.description = 'Description must be 2000 characters or less';
        }

        if (formData.problematicQuery && formData.problematicQuery.length > 5000) {
            newErrors.problematicQuery = 'Query must be 5000 characters or less';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle input changes
    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    // Handle category selection
    const handleCategorySelect = (categoryValue) => {
        handleInputChange('category', categoryValue);
        setShowCategoryDropdown(false);
        
        // Auto-suggest title based on category
        if (categoryValue && !formData.title) {
            const selectedCategory = categories.find(cat => cat.value === categoryValue);
            if (selectedCategory) {
                handleInputChange('title', selectedCategory.label);
            }
        }
    };

    // Get browser/screen information
    const getBrowserInfo = () => {
        const screenResolution = `${window.screen.width}x${window.screen.height}`;
        return { screenResolution };
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        setSubmitMessage('');
        setSubmitType('');

        try {
            const browserInfo = getBrowserInfo();
            
            const requestBody = {
                category: formData.category,
                customCategory: formData.category === 'other' ? formData.customCategory : undefined,
                title: formData.title,
                description: formData.description,
                page: page,
                problematicQuery: formData.problematicQuery || undefined,
                connectionId: connectionId || undefined,
                collectionName: collectionName || undefined,
                screenResolution: browserInfo.screenResolution
            };

            const response = await fetchWithAuth('/api/bug-report/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (response.ok) {
                setSubmitType('success');
                setSubmitMessage(data.message || 'Bug report submitted successfully!');
                
                // Close modal after 2 seconds
                setTimeout(() => {
                    onClose();
                }, 2000);
            } else {
                setSubmitType('error');
                setSubmitMessage(data.message || 'Failed to submit bug report. Please try again.');
            }

        } catch (error) {
            console.error('Error submitting bug report:', error);
            setSubmitType('error');
            setSubmitMessage('Network error. Please check your connection and try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Get selected category details
    const selectedCategory = categories.find(cat => cat.value === formData.category);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                {/* Modal */}
                <div className="bg-brand-secondary rounded-lg border border-brand-tertiary shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-brand-tertiary">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-brand-quaternary/20 rounded-full flex items-center justify-center">
                                <Bug size={16} className="text-brand-quaternary" />
                            </div>
                            <h2 className="text-white text-xl font-bold">Report Bug/Issue</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-white transition-colors duration-200 text-2xl cursor-pointer"
                            disabled={isSubmitting}
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Success/Error Messages */}
                    {submitMessage && (
                        <div className={`mx-6 mt-4 p-4 rounded-lg border ${
                            submitType === 'success' 
                                ? 'bg-brand-quaternary/20 border-brand-quaternary/50' 
                                : 'bg-orange-500/20 border-orange-500/50'
                        }`}>
                            <div className="flex items-start gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    submitType === 'success' ? 'bg-brand-quaternary/30' : 'bg-orange-500/30'
                                }`}>
                                    {submitType === 'success' ? (
                                        <CheckCircle size={14} className="text-brand-quaternary" />
                                    ) : (
                                        <AlertCircle size={14} className="text-orange-400" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-medium ${
                                        submitType === 'success' ? 'text-brand-quaternary' : 'text-orange-200'
                                    }`}>
                                        {submitType === 'success' ? 'Success!' : 'Error'}
                                    </p>
                                    <p className={`text-sm mt-1 ${
                                        submitType === 'success' ? 'text-gray-300' : 'text-orange-300'
                                    }`}>
                                        {submitMessage}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Category Selection */}
                        <div className="space-y-2">
                            <label className="text-gray-300 text-sm font-medium flex items-center gap-1">
                                <span>Issue Category</span>
                                <span className="text-orange-400">*</span>
                            </label>
                            
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                    className={`w-full h-12 px-4 bg-brand-secondary border rounded-md text-white text-left flex items-center justify-between cursor-pointer hover:bg-brand-secondary/90 focus:ring-2 focus:ring-brand-quaternary/40 transition-all duration-200 ${
                                        errors.category ? 'border-orange-500' : 'border-gray-500/30 focus:border-brand-quaternary'
                                    }`}
                                    disabled={isSubmitting}
                                >
                                    <span className={formData.category ? 'text-white' : 'text-gray-400'}>
                                        {selectedCategory ? selectedCategory.label : 'Select issue category...'}
                                    </span>
                                    <ChevronDown size={16} className={`transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {/* Dropdown */}
                                {showCategoryDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-brand-secondary border border-gray-600 rounded-md shadow-2xl z-10 max-h-60 overflow-y-auto custom-scrollbar">
                                        {categories.map((category) => (
                                            <button
                                                key={category.value}
                                                type="button"
                                                onClick={() => handleCategorySelect(category.value)}
                                                className="w-full px-4 py-3 text-left hover:bg-blue-900/30 focus:bg-blue-900/40 transition-colors duration-150 cursor-pointer border-b border-gray-700 last:border-b-0"
                                            >
                                                <div className="text-white text-sm font-medium">{category.label}</div>
                                                <div className="text-gray-400 text-xs mt-1">{category.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {errors.category && <span className="text-orange-400 text-xs">{errors.category}</span>}
                            
                            {/* Selected category description */}
                            {selectedCategory && (
                                <div className="bg-brand-tertiary/50 rounded-md p-3 border border-gray-500/20">
                                    <p className="text-gray-300 text-sm">{selectedCategory.description}</p>
                                </div>
                            )}
                        </div>

                        {/* Custom Category (if "Other" is selected) */}
                        {formData.category === 'other' && (
                            <div className="space-y-2">
                                <label className="text-gray-300 text-sm font-medium flex items-center gap-1">
                                    <span>Specify Issue Type</span>
                                    <span className="text-orange-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.customCategory}
                                    onChange={(e) => handleInputChange('customCategory', e.target.value)}
                                    placeholder="e.g., Mobile responsiveness, Accessibility issue"
                                    className={`w-full h-12 px-4 bg-brand-tertiary border rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-brand-quaternary transition-all duration-200 ${
                                        errors.customCategory ? 'border-orange-500' : 'border-gray-500/30'
                                    }`}
                                    disabled={isSubmitting}
                                />
                                {errors.customCategory && <span className="text-orange-400 text-xs">{errors.customCategory}</span>}
                            </div>
                        )}

                        {/* Title */}
                        <div className="space-y-2">
                            <label className="text-gray-300 text-sm font-medium flex items-center gap-1">
                                <span>Brief Title</span>
                                <span className="text-orange-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                                placeholder="e.g., Query execution fails with timeout error"
                                className={`w-full h-12 px-4 bg-brand-tertiary border rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-brand-quaternary transition-all duration-200 ${
                                    errors.title ? 'border-orange-500' : 'border-gray-500/30'
                                }`}
                                disabled={isSubmitting}
                                maxLength={200}
                            />
                            <div className="flex justify-between items-center">
                                {errors.title && <span className="text-orange-400 text-xs">{errors.title}</span>}
                                <span className="text-gray-400 text-xs">{formData.title.length}/200</span>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="text-gray-300 text-sm font-medium flex items-center gap-1">
                                <span>Detailed Description</span>
                                <span className="text-orange-400">*</span>
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={(e) => handleInputChange('description', e.target.value)}
                                placeholder="Please describe the issue in detail. Include:&#10;• What you were trying to do&#10;• What happened instead&#10;• Steps to reproduce the issue&#10;• Any error messages you saw"
                                className={`w-full min-h-32 px-4 py-3 bg-brand-tertiary border rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-brand-quaternary transition-all duration-200 resize-none overflow-hidden ${
                                    errors.description ? 'border-orange-500' : 'border-gray-500/30'
                                }`}
                                disabled={isSubmitting}
                                maxLength={2000}
                                style={{
                                    height: 'auto',
                                    minHeight: '8rem'
                                }}
                                rows={4}
                                onInput={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                            />
                            <div className="flex justify-between items-center">
                                {errors.description && <span className="text-orange-400 text-xs">{errors.description}</span>}
                                <span className="text-gray-400 text-xs">{formData.description.length}/2000</span>
                            </div>
                        </div>

                        {/* Problematic Query (Optional) */}
                        <div className="space-y-2">
                            <label className="text-gray-300 text-sm font-medium">
                                Problematic Query (Optional)
                            </label>
                            <textarea
                                value={formData.problematicQuery}
                                onChange={(e) => handleInputChange('problematicQuery', e.target.value)}
                                placeholder="If the issue is related to a specific query, paste it here..."
                                className={`w-full h-24 px-4 py-3 bg-brand-tertiary border rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-brand-quaternary transition-all duration-200 resize-none font-mono text-sm ${
                                    errors.problematicQuery ? 'border-orange-500' : 'border-gray-500/30'
                                }`}
                                disabled={isSubmitting}
                                maxLength={5000}
                            />
                            <div className="flex justify-between items-center">
                                {errors.problematicQuery && <span className="text-orange-400 text-xs">{errors.problematicQuery}</span>}
                                <span className="text-gray-400 text-xs">{formData.problematicQuery.length}/5000</span>
                            </div>
                        </div>

                        {/* Helpful Tips */}
                        <div className="bg-brand-tertiary/50 rounded-lg p-4 border border-gray-500/20">
                            <div className="flex items-start gap-3">
                                <div className="w-5 h-5 bg-blue-500/30 rounded-full flex items-center justify-center mt-0.5">
                                    <span className="text-blue-400 text-sm">💡</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-white font-medium text-sm mb-2">Helpful Suggestions</h4>
                                    <ul className="text-gray-300 text-sm space-y-1">
                                        <li>• If a query is not executing properly, include the exact query and error message</li>
                                        <li>• For UI issues, describe which browser you're using and your screen size</li>
                                        <li>• For connection problems, mention your database type and hosting provider</li>
                                        <li>• Include steps to reproduce the issue if possible</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 h-12 rounded-md bg-gray-600 text-white font-medium hover:bg-gray-700 transition-all duration-200 cursor-pointer"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || !formData.category || !formData.title || !formData.description}
                                className="flex-1 h-12 rounded-md bg-brand-quaternary text-white font-medium hover:bg-brand-quaternary/80 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Submitting...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        <span>Submit Report</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default BugReport; 