import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useUser } from './useUser';

/**
 * Custom hook that provides a configurable authentication action button
 * @param {Object} config - Configuration object for the button
 * @param {string} config.authenticatedPath - Path to navigate when user is authenticated
 * @param {string} config.authenticatedText - Button text when user is authenticated
 * @param {string} config.unauthenticatedPath - Path to navigate when user is not authenticated
 * @param {string} config.unauthenticatedText - Button text when user is not authenticated
 * @param {string} config.loadingText - Button text when loading
 * @returns {Function} getActionButton function that returns the appropriate button JSX
 */
export const useAuthActionButton = (config = {}) => {
    const navigate = useNavigate();
    const { user, loading } = useUser();

    // Default configuration
    const {
        authenticatedPath = '/connect',
        authenticatedText = 'Go to Dashboard',
        unauthenticatedPath = '/login',
        unauthenticatedText = 'Get Started',
        loadingText = 'Loading...'
    } = config;

    const getActionButton = () => {
        if (loading) {
            return (
                <button className="px-8 py-4 bg-brand-quaternary/50 text-white rounded-lg font-semibold text-lg flex items-center justify-center gap-3 cursor-not-allowed">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    {loadingText}
                </button>
            );
        }

        if (user) {
            return (
                <button
                    onClick={() => navigate(authenticatedPath)}
                    className="px-8 py-4 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-3 group cursor-pointer"
                >
                    {authenticatedText}
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
            );
        }

        return (
            <button
                onClick={() => navigate(unauthenticatedPath)}
                className="px-8 py-4 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-semibold text-lg flex items-center justify-center gap-3 group cursor-pointer"
            >
                {unauthenticatedText}
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
        );
    };

    return getActionButton;
}; 