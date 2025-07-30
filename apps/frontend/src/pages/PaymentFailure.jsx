import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

const PaymentFailure = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [paymentData, setPaymentData] = useState(null);
    const [errorReason, setErrorReason] = useState('');

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
        console.log('Payment failure page - received params:', paymentParams);
        
        setPaymentData(paymentParams);
        
        // Determine failure reason
        if (paymentParams.error_Message) {
            setErrorReason(paymentParams.error_Message);
        } else if (paymentParams.error) {
            setErrorReason(paymentParams.error);
        } else if (paymentParams.payment_status === 'FAILED') {
            setErrorReason('Payment was declined by your bank or payment provider');
        } else {
            setErrorReason('Payment could not be completed');
        }
    }, [searchParams]);

    const getFailureIcon = () => {
        if (paymentData?.payment_status === 'USER_DROPPED') {
            return <AlertTriangle size={32} className="text-yellow-400" />;
        }
        return <XCircle size={32} className="text-red-400" />;
    };

    const getFailureTitle = () => {
        if (paymentData?.payment_status === 'USER_DROPPED') {
            return 'Payment Cancelled';
        }
        return 'Payment Failed';
    };

    const getFailureMessage = () => {
        if (paymentData?.payment_status === 'USER_DROPPED') {
            return 'You have cancelled the payment process. No amount has been charged.';
        }
        return errorReason || 'Your payment could not be processed. Please try again.';
    };

    const getCommonFailureReasons = () => {
        return [
            'Insufficient funds in your account',
            'Card expired or invalid card details',
            'Bank declined the transaction',
            'Network connectivity issues',
            'Daily transaction limit exceeded',
            'OTP verification failed'
        ];
    };

    const handleRetryPayment = () => {
        navigate('/pricing', { 
            state: { 
                retryPayment: true,
                previousOrderId: paymentData?.order_id 
            }
        });
    };

    const handleContactSupport = () => {
        navigate('/contact', { 
            state: { 
                subject: 'Payment Failed',
                message: `Payment failed for order: ${paymentData?.order_id || 'N/A'}\nError: ${errorReason}`
            }
        });
    };

    return (
        <div className="min-h-screen bg-brand-primary flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Failure Status Card */}
                <div className="bg-brand-secondary rounded-2xl p-8 border border-red-500/30 shadow-2xl text-center">
                    
                    {/* Status Icon */}
                    <div className="mb-6">
                        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                            paymentData?.payment_status === 'USER_DROPPED' 
                                ? 'bg-yellow-600' 
                                : 'bg-red-600'
                        }`}>
                            {getFailureIcon()}
                        </div>
                    </div>

                    {/* Status Message */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-white mb-2">
                            {getFailureTitle()}
                        </h1>
                        <p className="text-gray-300 mb-4">
                            {getFailureMessage()}
                        </p>
                        
                        {/* Transaction Details */}
                        {paymentData?.order_id && (
                            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
                                <h3 className="text-sm font-semibold text-red-300 mb-2">Transaction Details</h3>
                                <div className="space-y-1 text-sm text-red-400">
                                    <div className="flex justify-between">
                                        <span>Order ID:</span>
                                        <span className="font-mono">{paymentData.order_id}</span>
                                    </div>
                                    {paymentData.amount && (
                                        <div className="flex justify-between">
                                            <span>Amount:</span>
                                            <span>₹{paymentData.amount}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span>Status:</span>
                                        <span className="capitalize">{paymentData.payment_status || 'Failed'}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-red-400 mt-2">
                                    Please save this Order ID for support inquiries
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3 mb-6">
                        <button
                            onClick={handleRetryPayment}
                            className="w-full px-6 py-3 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={16} />
                            Try Again
                        </button>
                        
                        <button
                            onClick={handleContactSupport}
                            className="w-full px-6 py-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-all cursor-pointer"
                        >
                            Contact Support
                        </button>
                        
                        <button
                            onClick={() => navigate('/pricing')}
                            className="w-full px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-all cursor-pointer"
                        >
                            Back to Pricing
                        </button>
                    </div>
                </div>

                {/* Troubleshooting Tips */}
                <div className="mt-6 bg-brand-secondary/50 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-3">Common Issues</h3>
                    <ul className="space-y-2 text-sm text-gray-300">
                        {getCommonFailureReasons().map((reason, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-brand-quaternary rounded-full mt-2 flex-shrink-0"></span>
                                <span>{reason}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Help Section */}
                <div className="mt-6 text-center">
                    <h4 className="text-white font-semibold mb-2">Need Help?</h4>
                    <div className="space-y-2 text-sm text-gray-400">
                        <p>
                            Contact your bank if the issue persists or{' '}
                            <button
                                onClick={handleContactSupport}
                                className="text-brand-quaternary hover:underline"
                            >
                                reach out to our support team
                            </button>
                        </p>
                        <p>
                            You can also try using a different payment method or card
                        </p>
                    </div>
                </div>

                {/* Security Note */}
                <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-9a2 2 0 00-2-2H6a2 2 0 00-2 2v9a2 2 0 002 2zm10-12V9a4 4 0 00-8 0v2m0 0V9a4 4 0 018 0v2" />
                        </svg>
                        <span className="text-sm font-medium text-blue-300">Secure & Safe</span>
                    </div>
                    <p className="text-xs text-gray-300">
                        No amount has been charged for this failed transaction. Your payment information is secure and protected.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PaymentFailure; 