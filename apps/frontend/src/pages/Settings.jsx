import React from 'react';
import { useNavigate } from 'react-router-dom';
import SettingsComponent from '../components/Settings';

function SettingsPage() {
    const navigate = useNavigate();

    const handleClose = () => {
        navigate(-1); // Go back to previous page
    };

    return (
        <SettingsComponent 
            isOpen={true} 
            onClose={handleClose}
            isStandalone={true}
        />
    );
}

export default SettingsPage; 