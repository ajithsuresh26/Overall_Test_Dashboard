// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import ClientDashboard from './components/ClientDashboard';

const NavigationGatekeeper = () => {
    const { user, logout } = useAuth();

    useEffect(() => {
        // Guard: If a session exists but lacks the desktop client tracking parameters,
        // force a logout to reset the interface state.
        if (user && !user.client_id) {
            console.warn("Session found lacks a valid client_id. Flushing legacy tokens...");
            logout();
        }
    }, [user, logout]);

    // Secure conditional layout branching based on authentication status
    if (!user || !user.client_id) {
        return <Login />;
    }

    return <ClientDashboard />;
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <NavigationGatekeeper />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;