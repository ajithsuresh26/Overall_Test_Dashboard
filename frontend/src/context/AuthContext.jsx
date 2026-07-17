import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try { 
        setUser(JSON.parse(savedUser)); 
      } catch (e) { 
        localStorage.clear(); 
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      /**
       * CRITICAL: FastAPI OAuth2PasswordRequestForm expects 
       * 'username' and 'password' form parameters over standard JSON payloads.
       */
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      // Maps perfectly to your local Software Backend proxy route: http://127.0.0.1:5001/auth/login
      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { access_token, user_data, role } = response.data;
      const userRole = role || user_data?.role;

      // ── 🛑 FRONTEND SECURITY GUARD: RESTRICT ADMINISTRATIVE PROFILES ──
      if (userRole === 'admin' || userRole === 'superadmin') {
        console.warn(`🛑 Access Denied: Administrative profile [${email}] restricted from client terminal.`);
        throw {
          response: {
            data: {
              detail: "ACCESS DENIED: Administrative profiles are restricted from logging into localized Client Software terminals."
            }
          }
        };
      }

      const sessionUser = {
        ...(user_data || {}),
        role: userRole
      };

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(sessionUser));

      setUser(sessionUser);
      return true;
    } catch (error) {
      // Gracefully captures the thrown backend detail error string or the custom manual guard message above
      const errorMsg = error.response?.data?.detail || "Login failed"; 
      
      // ── FIXED: Changed from print() to console.error() to stop opening the print dialog box ──
      console.error("Login error:", errorMsg);
      throw new Error(errorMsg); 
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};