import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../contexts/UserContext';
import { Check, Loader2, AlertCircle } from 'lucide-react';

const PaymentSuccess = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { fetchWithAuth, refreshUser } = useContext(UserContext);
    
    const [verificationStatus, setVerificationStatus] = useState('verifying'); // 'verifying', 'success', 'failed'
    const [paymentData, setPaymentData] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        // Extract payment parameters from URL
        const extractPaymentData = () => {
            const data = {};
            for (const [key, value] of searchParams.entries()) {
                data[key] = value;
            }
            return data;
        };

        const paymentParams = extractPaymentData();
        console.log('Payment success page - received params:', paymentParams);

        // CashFree returns order_id and payment_id in the URL
        if (paymentParams.order_id || paymentParams.payment_id) {
            setPaymentData(paymentParams);
            verifyPayment(paymentParams);
        } else {
            console.error('Missing required payment parameters');
            setError('Invalid payment response received');
            setVerificationStatus('failed');
        }
    }, [searchParams]);

    const verifyPayment = async (paymentParams) => {
        try {
            console.log('Verifying payment with backend...');

            const response = await fetchWithAuth('/api/payment/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cf_order_id: paymentParams.order_id,
                    cf_payment_id: paymentParams.payment_id,
                    payment_status: paymentParams.payment_status
                })
            });

            const result = await response.json();
            console.log('Payment verification result:', result);

            if (result.success && result.data.payment_status === 'SUCCESS') {
                setVerificationStatus('success');
                
                // Refresh user data to get updated subscription
                await refreshUser();
                
                // Store success data
                setPaymentData(result.data);
            } else {
                setVerificationStatus('failed');
                setError(result.message || 'Payment verification failed');
            }

        } catch (error) {
            console.error('Error verifying payment:', error);
            setVerificationStatus('failed');
            setError('Failed to verify payment. Please contact support.');
        }
    };

    const handleContinue = () => {
        if (verificationStatus === 'success') {
            navigate('/connect', { 
                state: { 
                    paymentSuccess: true,
                    subscriptionPlan: paymentData?.subscription_plan 
                }
            });
        } else {
            navigate('/pricing');
        }
    };

    const handleContactSupport = () => {
        navigate('/contact', { 
            state: { 
                subject: 'Payment Issue',
                message: `Payment verification failed for order: ${paymentData?.cf_order_id || 'N/A'}`
            }
        });
    };

    return (
        <div className="min-h-screen bg-brand-primary flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Verification Status Card */}
                <div className="bg-brand-secondary rounded-2xl p-8 border border-brand-quaternary shadow-2xl text-center">
                    
                    {/* Status Icon */}
                    <div className="mb-6">
                        {verificationStatus === 'verifying' && (
                            <div className="w-16 h-16 mx-auto bg-blue-600 rounded-full flex items-center justify-center">
                                <Loader2 size={32} className="text-white animate-spin" />
                            </div>
                        )}
                        
                        {verificationStatus === 'success' && (
                            <div className="w-16 h-16 mx-auto bg-green-600 rounded-full flex items-center justify-center">
                                <Check size={32} className="text-white" />
                            </div>
                        )}
                        
                        {verificationStatus === 'failed' && (
                            <div className="w-16 h-16 mx-auto bg-red-600 rounded-full flex items-center justify-center">
                                <AlertCircle size={32} className="text-white" />
                            </div>
                        )}
                    </div>

                    {/* Status Message */}
                    <div className="mb-6">
                        {verificationStatus === 'verifying' && (
                            <>
                                <h1 className="text-2xl font-bold text-white mb-2">
                                    Verifying Payment
                                </h1>
                                <p className="text-gray-300">
                                    Please wait while we confirm your payment...
                                </p>
                            </>
                        )}
                        
                        {verificationStatus === 'success' && (
                            <>
                                <h1 className="text-2xl font-bold text-white mb-2">
                                    Payment Successful! 🎉
                                </h1>
                                <p className="text-gray-300 mb-4">
                                    Welcome to MongoSnap SnapX! Your subscription is now active.
                                </p>
                                
                                {/* Payment Details */}
                                {paymentData && (
                                    <div className="bg-brand-tertiary/50 rounded-lg p-4 mb-4 text-left">
                                        <h3 className="text-sm font-semibold text-gray-300 mb-2">Payment Details</h3>
                                        <div className="space-y-1 text-sm text-gray-400">
                                            <div className="flex justify-between">
                                                <span>Order ID:</span>
                                                <span className="font-mono">{paymentData.cf_order_id}</span>
                                            </div>
                                            {paymentData.cf_payment_id && (
                                                <div className="flex justify-between">
                                                    <span>Payment ID:</span>
                                                    <span className="font-mono">{paymentData.cf_payment_id}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between">
                                                <span>Status:</span>
                                                <span className="capitalize text-green-400">{paymentData.payment_status}</span>
                                            </div>
                                            {paymentData.subscription_plan && (
                                                <div className="flex justify-between">
                                                    <span>Plan:</span>
                                                    <span className="capitalize">{paymentData.subscription_plan}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        
                        {verificationStatus === 'failed' && (
                            <>
                                <h1 className="text-2xl font-bold text-white mb-2">
                                    Payment Verification Failed
                                </h1>
                                <p className="text-gray-300 mb-4">
                                    {error || 'We couldn\'t verify your payment. Please try again or contact support.'}
                                </p>
                                
                                {/* Transaction Details for Failed Payment */}
                                {paymentData?.cf_order_id && (
                                    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                                        <p className="text-sm text-red-300">
                                            Order ID: <span className="font-mono">{paymentData.cf_order_id}</span>
                                        </p>
                                        <p className="text-xs text-red-400 mt-1">
                                            Please save this ID for support inquiries
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        {verificationStatus === 'success' && (
                            <button
                                onClick={handleContinue}
                                className="w-full px-6 py-3 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 font-semibold transition-all cursor-pointer"
                            >
                                Continue to Dashboard
                            </button>
                        )}
                        
                        {verificationStatus === 'failed' && (
                            <>
                                <button
                                    onClick={handleContactSupport}
                                    className="w-full px-6 py-3 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 font-semibold transition-all cursor-pointer"
                                >
                                    Contact Support
                                </button>
                                <button
                                    onClick={() => navigate('/pricing')}
                                    className="w-full px-6 py-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-all cursor-pointer"
                                >
                                    Back to Pricing
                                </button>
                            </>
                        )}
                        
                        {verificationStatus === 'verifying' && (
                            <button
                                disabled
                                className="w-full px-6 py-3 bg-gray-700 text-gray-400 rounded-lg cursor-not-allowed"
                            >
                                Please wait...
                            </button>
                        )}
                    </div>
                </div>

                {/* Additional Information */}
                <div className="mt-6 text-center">
                    <p className="text-gray-400 text-sm">
                        Need help?{' '}
                        <button
                            onClick={() => navigate('/contact')}
                            className="text-brand-quaternary hover:underline"
                        >
                            Contact our support team
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaymentSuccess; 