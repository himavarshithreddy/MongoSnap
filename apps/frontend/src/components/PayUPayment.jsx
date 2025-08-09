import React, { useState, useContext, useEffect, useRef } from 'react';
import { UserContext } from '../contexts/UserContext';
import ErrorNotification from './ErrorNotification';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const PayUPayment = ({ 
    subscriptionPlan = 'snapx', 
    onClose,
    isVisible = false 
}) => {
    const { fetchWithAuth } = useContext(UserContext);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [phone, setPhone] = useState('');
    const hasLoadedSdk = useRef(false);

    useEffect(() => {
        if (!isVisible) return;
        if (hasLoadedSdk.current) return;
        // Ensure Cashfree SDK is available (added in index.html for Vite apps)
        if (!window.Cashfree) {
            const script = document.createElement('script');
            script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
            script.async = true;
            script.onload = () => { hasLoadedSdk.current = true; };
            script.onerror = () => { setError('Failed to load payment SDK'); };
            document.body.appendChild(script);
        } else {
            hasLoadedSdk.current = true;
        }
    }, [isVisible]);

    /**
     * Create PayU payment order
     */
    const createPaymentOrder = async () => {
        try {
            setIsLoading(true);
            setError('');

            // Robust Indian phone validation
            let normalized = (phone || '').toString().replace(/[^\d+]/g, '');
            console.log('Phone input:', phone, 'Normalized:', normalized);
            let valid = false;
            if (normalized.startsWith('+91') && /^\+91\d{10}$/.test(normalized)) {
                valid = true;
            } else {
                if (normalized.startsWith('+91')) normalized = normalized.slice(3);
                else if (normalized.startsWith('91')) normalized = normalized.slice(2);
                if (/^\d{10}$/.test(normalized)) valid = true;
            }
            if (!valid) {
                setError('Valid 10-digit phone number is required');
                return;
            }

            console.log('Creating Cashfree payment order...');

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

            if (data.success && data.data?.gateway === 'cashfree') {
                await submitToCashfree(data.data);
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

    // Submit to Cashfree checkout
    const submitToCashfree = async (paymentData) => {
        try {
            if (!window.Cashfree) throw new Error('Payment SDK not loaded');
            const cashfree = window.Cashfree({ mode: import.meta.env.PROD ? 'production' : 'sandbox' });
            await cashfree.checkout({
                paymentSessionId: paymentData.paymentSessionId,
                redirectTarget: '_self'
            });
        } catch (error) {
            console.error('Error submitting to Cashfree:', error);
            setError('Failed to open payment checkout');
        }
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 pointer-events-auto">
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
                    <PhoneInput
                        international
                        defaultCountry="IN"
                        value={phone}
                        onChange={setPhone}
                        disabled={isLoading}
                        className="[&_.PhoneInput]:w-full [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:px-4 [&_.PhoneInputInput]:py-3 [&_.PhoneInputInput]:bg-brand-tertiary [&_.PhoneInputInput]:border [&_.PhoneInputInput]:border-gray-600 [&_.PhoneInputInput]:rounded-lg [&_.PhoneInputInput]:text-white [&_.PhoneInputInput]:placeholder-gray-400 [&_.PhoneInputInput]:focus:outline-none [&_.PhoneInputInput]:focus:border-brand-quaternary [&_.PhoneInputInput]:focus:ring-1 [&_.PhoneInputInput]:focus:ring-brand-quaternary [&_.PhoneInputCountrySelect]:bg-brand-tertiary [&_.PhoneInputCountrySelect]:border-gray-600 [&_.PhoneInputCountrySelect]:rounded-lg [&_.PhoneInputCountrySelect]:text-white [&_.PhoneInputCountrySelect]:focus:border-brand-quaternary [&_.PhoneInputCountrySelect]:focus:ring-1 [&_.PhoneInputCountrySelect]:focus:ring-brand-quaternary"
                        inputComponent="input"
                        placeholder="Enter phone number"
                        autoComplete="tel"
                        limitMaxLength
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Required for payment processing and order confirmation. Include your country code.
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
                        disabled={isLoading || !phone || (() => { let n = (phone || '').toString().replace(/[^\d+]/g, ''); if (n.startsWith('+91') && /^\+91\d{10}$/.test(n)) return false; if (n.startsWith('+91')) n = n.slice(3); else if (n.startsWith('91')) n = n.slice(2); return !/^\d{10}$/.test(n); })()}
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