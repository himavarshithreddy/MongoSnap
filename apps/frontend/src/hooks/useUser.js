import { useContext } from 'react';
import { UserContext } from '../contexts/UserContext';

export const useUser = () => {
    return useContext(UserContext);
};

// Helper function to check subscription status
export const useSubscription = () => {
    const { user } = useContext(UserContext);
    
    // Get subscription info from backend user data
    const subscriptionPlan = user?.subscriptionPlan || 'snap';
    const subscriptionStatus = user?.subscriptionStatus || 'active';
    const subscriptionExpiresAt = user?.subscriptionExpiresAt;
    
    // Debug logging
    console.log('useSubscription - User data:', {
        subscriptionPlan,
        subscriptionStatus,
        subscriptionExpiresAt,
        backendIsSnapXUser: user?.isSnapXUser
    });
    
    // Determine if user has SnapX access
    const hasSnapXAccess = () => {
        // Must be on SnapX plan
        if (subscriptionPlan !== 'snapx') {
            console.log('useSubscription - Not SnapX plan:', subscriptionPlan);
            return false;
        }
        
        // If subscription is inactive, no access
        if (subscriptionStatus === 'inactive') {
            console.log('useSubscription - Inactive subscription');
            return false;
        }
        
        // Check if subscription has expired
        if (subscriptionExpiresAt && new Date() > new Date(subscriptionExpiresAt)) {
            console.log('useSubscription - Subscription expired:', subscriptionExpiresAt);
            return false;
        }
        
        // Active or cancelled subscriptions have access until expiration
        const hasAccess = subscriptionStatus === 'active' || subscriptionStatus === 'cancelled' || subscriptionStatus === 'trial';
        console.log('useSubscription - Has access:', hasAccess, 'Status:', subscriptionStatus);
        return hasAccess;
    };
    
    const isSnapXUser = hasSnapXAccess();
    
    const getFeatureAccess = () => {
        return {
            // SnapX-only features
            saveQueries: isSnapXUser,
            exportDatabase: isSnapXUser,
            uploadDatabase: isSnapXUser,
            unlimitedQueryHistory: isSnapXUser,
            unlimitedConnections: isSnapXUser,
            unlimitedExecutions: isSnapXUser,
            enhancedAI: isSnapXUser,
            
            // Free features
            basicQueries: true,
            schemaExplorer: true,
            limitedHistory: !isSnapXUser,
            sampleDatabase: true,
        };
    };
    
    return {
        isSnapXUser,
        isSnapUser: !isSnapXUser,
        subscriptionPlan,
        subscriptionStatus,
        subscriptionExpiresAt,
        features: getFeatureAccess(),
        planName: isSnapXUser ? 'SnapX' : 'Snap'
    };
}; 