import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useUser } from '../hooks/useUser';
import Logo from './Logo';

const PublicLayout = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, loading } = useUser();

    const navItems = [
        { name: 'Home', path: '/', exact: true },
        { name: 'About', path: '/about' },
        { name: 'Contact', path: '/contact' },
        { name: 'Pricing', path: '/pricing' }
    ];

    const isActiveRoute = (path, exact = false) => {
        if (exact) {
            return location.pathname === path;
        }
        return location.pathname.startsWith(path);
    };

    // Dynamic button based on authentication status
    const getActionButton = () => {
        if (loading) {
            return (
                <button className="px-6 py-2 bg-brand-quaternary/50 text-white rounded-lg font-medium cursor-not-allowed">
                    Loading...
                </button>
            );
        }

        if (user) {
            return (
                <button
                    onClick={() => navigate('/connect')}
                    className="px-6 py-2 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-medium flex items-center gap-2 cursor-pointer"
                >
                    Dashboard
                    <ArrowRight size={16} />
                </button>
            );
        }

        return (
            <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-brand-quaternary text-white rounded-lg hover:bg-brand-quaternary/90 transition-all duration-200 font-medium flex items-center gap-2 cursor-pointer"
            >
                Get Started
                <ArrowRight size={16} />
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-brand-primary">
            {/* Header */}
            <header className="bg-brand-secondary/80 backdrop-blur-sm border-b border-brand-tertiary/50 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
                            <Logo size="default" />
                            <h1 className="text-2xl font-bold text-white tracking-wide">
                                Mongo<span className="text-brand-quaternary">Snap</span>
                            </h1>
                        </Link>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center space-x-8">
                            {navItems.map((item) => (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`text-sm font-medium transition-colors duration-200 cursor-pointer ${
                                        isActiveRoute(item.path, item.exact)
                                            ? 'text-brand-quaternary'
                                            : 'text-gray-300 hover:text-white'
                                    }`}
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </nav>

                        {/* CTA Button */}
                        <div className="hidden md:block">
                            {getActionButton()}
                        </div>

                        {/* Mobile menu button */}
                        <button
                            className="md:hidden text-gray-300 hover:text-white cursor-pointer"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-brand-secondary border-t border-brand-tertiary/50">
                        <div className="px-4 py-6 space-y-4">
                            {navItems.map((item) => (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`block text-base font-medium transition-colors duration-200 cursor-pointer ${
                                        isActiveRoute(item.path, item.exact)
                                            ? 'text-brand-quaternary'
                                            : 'text-gray-300 hover:text-white'
                                    }`}
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    {item.name}
                                </Link>
                            ))}
                            <div className="pt-4 border-t border-brand-tertiary/50">
                                {getActionButton()}
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main>
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-brand-secondary border-t border-brand-tertiary/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {/* Brand Column */}
                        <div className="md:col-span-1">
                            <div className="flex items-center gap-3 mb-4">
                                <Logo size="default" />
                                <h3 className="text-xl font-bold text-white">
                                    Mongo<span className="text-brand-quaternary">Snap</span>
                                </h3>
                            </div>
                            <p className="text-gray-400 text-sm leading-relaxed">
                                AI-powered MongoDB query generation and database management made simple.
                            </p>
                        </div>

                        {/* Quick Links */}
                        <div>
                            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
                            <ul className="space-y-2">
                                {navItems.map((item) => (
                                    <li key={item.name}>
                                        <Link
                                            to={item.path}
                                            className="text-gray-400 hover:text-brand-quaternary text-sm transition-colors duration-200 cursor-pointer"
                                        >
                                            {item.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Support */}
                        <div>
                            <h4 className="text-white font-semibold mb-4">Support</h4>
                            <ul className="space-y-2">
                                <li>
                                    <a
                                        href="mailto:support@mongosnap.live"
                                        className="text-gray-400 hover:text-brand-quaternary text-sm transition-colors duration-200 cursor-pointer"
                                    >
                                        Help Center
                                    </a>
                                </li>
                                <li>
                                    <Link
                                        to="/contact"
                                        className="text-gray-400 hover:text-brand-quaternary text-sm transition-colors duration-200 cursor-pointer"
                                    >
                                        Contact Us
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Contact Info */}
                        <div>
                            <h4 className="text-white font-semibold mb-4">Contact</h4>
                            <div className="space-y-2 text-sm">
                                <p className="text-gray-400">
                                    <a
                                        href="mailto:support@mongosnap.live"
                                        className="hover:text-brand-quaternary transition-colors duration-200 cursor-pointer"
                                    >
                                        support@mongosnap.live
                                    </a>
                                </p>
                                <p className="text-gray-400">
                                    Maruthi Nagar<br />
                                    Hyderabad, Telangana
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className="border-t border-brand-tertiary/50 mt-8 pt-8">
                        <div className="flex flex-col md:flex-row justify-between items-center">
                            <p className="text-gray-400 text-sm">
                                © 2025 MongoSnap. All rights reserved.
                            </p>
                            <div className="flex space-x-6 mt-4 md:mt-0">
                                <a
                                    href="#"
                                    className="text-gray-400 hover:text-brand-quaternary text-sm transition-colors duration-200 cursor-pointer"
                                >
                                    Privacy Policy
                                </a>
                                <a
                                    href="#"
                                    className="text-gray-400 hover:text-brand-quaternary text-sm transition-colors duration-200 cursor-pointer"
                                >
                                    Terms of Service
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PublicLayout; 