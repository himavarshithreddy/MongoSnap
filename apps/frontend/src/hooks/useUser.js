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
    
  
    
    // Determine if user has SnapX access
    const hasSnapXAccess = () => {
        // Must be on SnapX plan
        if (subscriptionPlan !== 'snapx') {
            console.log('useSubscription - Not SnapX plan:', subscriptionPlan);
            return false;
        }
        
        // If subscription is inactive or cancelled, no access
        if (subscriptionStatus === 'inactive' || subscriptionStatus === 'cancelled') {
            console.log('useSubscription - Inactive or cancelled subscription:', subscriptionStatus);
            return false;
        }
        
        // Check if subscription has expired
        if (subscriptionExpiresAt && new Date() > new Date(subscriptionExpiresAt)) {
            console.log('useSubscription - Subscription expired:', subscriptionExpiresAt);
            return false;
        }
        
        // Check if subscription has expired
        if (subscriptionExpiresAt) {
            try {
                const expiryDate = new Date(subscriptionExpiresAt);
                if (isNaN(expiryDate.getTime())) {
                    console.error('Invalid subscription expiry date:', subscriptionExpiresAt);
                    return false;
                }
                if (new Date() > expiryDate) {
                    console.log('useSubscription - Subscription expired:', subscriptionExpiresAt);
                    return false;
                }
            } catch (error) {
                console.error('Error parsing subscription expiry date:', error);
                return false;
            }
        }
        
        return true;
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
        planName: subscriptionPlan === 'snapx' ? 'SnapX' : 'Snap'
    };
}; 
