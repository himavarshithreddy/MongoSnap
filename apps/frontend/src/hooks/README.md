# Custom Hooks

This directory contains reusable custom hooks for the MongoSnap frontend application.

## useAuthActionButton

A custom hook that provides a configurable authentication action button with consistent styling and behavior across the application.

### Usage

```jsx
import { useAuthActionButton } from '../hooks/useAuthActionButton.jsx';

const MyComponent = () => {
    // Use with default configuration
    const getActionButton = useAuthActionButton();
    
    // Or use with custom configuration
    const getCustomButton = useAuthActionButton({
        authenticatedPath: '/dashboard',
        authenticatedText: 'View Dashboard',
        unauthenticatedPath: '/signup',
        unauthenticatedText: 'Sign Up Now',
        loadingText: 'Please wait...'
    });

    return (
        <div>
            {getActionButton()}
        </div>
    );
};
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `authenticatedPath` | string | `/connect` | Path to navigate when user is authenticated |
| `authenticatedText` | string | `'Go to Dashboard'` | Button text when user is authenticated |
| `unauthenticatedPath` | string | `/login` | Path to navigate when user is not authenticated |
| `unauthenticatedText` | string | `'Get Started'` | Button text when user is not authenticated |
| `loadingText` | string | `'Loading...'` | Button text when loading |

### Behavior

The hook automatically handles three states:

1. **Loading**: Shows a disabled button with a spinner
2. **Authenticated**: Shows a button that navigates to the authenticated path
3. **Unauthenticated**: Shows a button that navigates to the unauthenticated path

### Styling

The button uses consistent Tailwind CSS classes for styling:
- Primary brand colors (`bg-brand-quaternary`)
- Hover effects and transitions
- Responsive design
- Arrow icon with hover animation

### Migration from Duplicated Code

This hook was created to eliminate the duplicated `getActionButton` function that existed in multiple components:
- `About.jsx`
- `Contact.jsx` 
- `PublicHome.jsx`
- `PublicLayout.jsx`

To migrate existing components:

1. Import the hook: `import { useAuthActionButton } from '../hooks/useAuthActionButton.jsx';`
2. Replace the local `getActionButton` function: `const getActionButton = useAuthActionButton();`
3. Remove the old function definition
4. Remove unused imports (`ArrowRight`, `useUser` if not needed elsewhere) 