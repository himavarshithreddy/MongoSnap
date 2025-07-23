import React, { useState, useContext } from 'react';
import { UserContext } from '../contexts/UserContext';
import ErrorNotification from './ErrorNotification';

const PayUPayment = ({ 
    subscriptionPlan = 'snapx', 
    onSuccess, 
    onFailure, 
    onClose,
    isVisible = false 
}) => {
    const { fetchWithAuth, refreshUser } = useContext(UserContext);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [phone, setPhone] = useState('');
    const [paymentFormData, setPaymentFormData] = useState(null);

    /**
     * Handle phone number input
     */
    const handlePhoneChange = (e) => {
        const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
        if (value.length <= 10) {
            setPhone(value);
        }
    };

    /**
     * Create PayU payment order
     */
    const createPaymentOrder = async () => {
        try {
            setIsLoading(true);
            setError('');

            // Validate phone number
            if (!phone || phone.length !== 10) {
                setError('Please enter a valid 10-digit phone number');
                return;
            }

            console.log('Creating PayU payment order...');

            const response = await fetchWithAuth('/api/payment/create-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscriptionPlan,
                    phone
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create payment order');
            }

            const data = await response.json();
            console.log('Payment order created:', data);

            if (data.success && data.data) {
                setPaymentFormData(data.data);
                // Submit form to PayU
                submitToPayU(data.data);
            } else {
                throw new Error('Invalid response from payment service');
            }

        } catch (error) {
            console.error('Error creating payment order:', error);
            setError(error.message || 'Failed to create payment order');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Submit payment form to PayU
     */
    const submitToPayU = (paymentData) => {
        try {
            console.log('Submitting to PayU:', paymentData.paymentUrl);

            // Create form element
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = paymentData.paymentUrl;
            form.target = '_self'; // Open in same window

            // Add form fields
            Object.keys(paymentData.formData).forEach(key => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = paymentData.formData[key];
                form.appendChild(input);
            });

            // Append form to body and submit
            document.body.appendChild(form);
            form.submit();

        } catch (error) {
            console.error('Error submitting to PayU:', error);
            setError('Failed to redirect to payment gateway');
        }
    };

    /**
     * Handle payment success (called from success page)
     */
    const handlePaymentSuccess = async (paymentData) => {
        try {
            console.log('Handling payment success:', paymentData);
            
            // Refresh user data to get updated subscription
            await refreshUser();
            
            if (onSuccess) {
                onSuccess(paymentData);
            }
        } catch (error) {
            console.error('Error handling payment success:', error);
        }
    };

    /**
     * Handle payment failure (called from failure page)
     */
    const handlePaymentFailure = (errorData) => {
        console.log('Handling payment failure:', errorData);
        
        if (onFailure) {
            onFailure(errorData);
        }
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-brand-secondary rounded-2xl p-8 max-w-md w-full border border-brand-quaternary shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Complete Payment</h2>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Subscription Details */}
                <div className="mb-6 p-4 bg-brand-tertiary/50 rounded-lg">
                    <h3 className="text-lg font-semibold text-white mb-2">MongoSnap SnapX</h3>
                    <div className="text-gray-300 space-y-1">
                        <p>Monthly Subscription</p>
                        <p className="text-2xl font-bold text-brand-quaternary">₹1</p>
                        <p className="text-sm">Includes all premium features</p>
                    </div>
                </div>

                {/* Phone Number Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Phone Number *
                    </label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="Enter 10-digit phone number"
                        className="w-full px-4 py-3 bg-brand-tertiary border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-brand-quaternary focus:ring-1 focus:ring-brand-quaternary"
                        disabled={isLoading}
                        maxLength={10}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Required for payment processing and order confirmation
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4">
                        <ErrorNotification
                            message={error}
                            onDismiss={() => setError('')}
                        />
                    </div>
                )}

                {/* Payment Security Info */}
                <div className="mb-6 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-9a2 2 0 00-2-2H6a2 2 0 00-2 2v9a2 2 0 002 2zm10-12V9a4 4 0 00-8 0v2m0 0V9a4 4 0 018 0v2" />
                        </svg>
                        <span className="text-sm font-medium text-blue-300">Secure Payment</span>
                    </div>
                    <p className="text-xs text-gray-300">
                        Powered by PayU - Your payment is processed securely with 256-bit SSL encryption
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="px-6 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={createPaymentOrder}
                        disabled={isLoading || !phone || phone.length !== 10}
                        className="px-6 py-2 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Processing...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                                Pay ₹359
                            </>
                        )}
                    </button>
                </div>

                {/* Terms */}
                <p className="text-xs text-gray-400 mt-4 text-center">
                    By proceeding, you agree to our{' '}
                    <a href="/terms-of-service" target="_blank" className="text-brand-quaternary hover:underline">
                        Terms of Service
                    </a>
                    {' '}and{' '}
                    <a href="/privacy-policy" target="_blank" className="text-brand-quaternary hover:underline">
                        Privacy Policy
                    </a>
                </p>
            </div>
        </div>
    );
};

export default PayUPayment; 