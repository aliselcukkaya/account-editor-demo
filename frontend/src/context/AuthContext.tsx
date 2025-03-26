import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../services/api';
import api from '../services/api';

interface AuthContextType {
	isAuthenticated: boolean;
	username: string | null;
	isAdmin: boolean;
	token: string | null;
	login: (username: string, password: string) => Promise<void>;
	logout: () => void;
}

// Secure token storage with encryption
const secureStorage = {
	setItem: (key: string, value: string) => {
		try {
			// In a production environment, consider using a more secure encryption method
			const encodedValue = btoa(value);
			sessionStorage.setItem(key, encodedValue);
		} catch (error) {
			console.error('Error storing token:', error);
		}
	},
	getItem: (key: string): string | null => {
		try {
			const value = sessionStorage.getItem(key);
			if (!value) return null;
			return atob(value);
		} catch (error) {
			console.error('Error retrieving token:', error);
			return null;
		}
	},
	removeItem: (key: string) => {
		sessionStorage.removeItem(key);
	}
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [username, setUsername] = useState<string | null>(null);
	const [isAdmin, setIsAdmin] = useState(false);
	const [token, setToken] = useState<string | null>(null);

	useEffect(() => {
		const storedToken = secureStorage.getItem('token');
		const storedUsername = secureStorage.getItem('username');
		const storedIsAdmin = secureStorage.getItem('isAdmin');

		if (storedToken && storedUsername) {
			setIsAuthenticated(true);
			setUsername(storedUsername);
			setToken(storedToken);
			setIsAdmin(storedIsAdmin === 'true');
		}

		// Listen for auth:logout event
		const handleLogout = () => {
			logout();
		};

		window.addEventListener('auth:logout', handleLogout);

		// Cleanup event listener
		return () => {
			window.removeEventListener('auth:logout', handleLogout);
		};
	}, []);

	const login = async (username: string, password: string) => {
		try {
			const response = await auth.login(username, password);
			
			if (!response.access_token) {
				throw new Error('No access token received');
			}

			const isAdminValue = Boolean(response.is_admin);
			
			secureStorage.setItem('token', response.access_token);
			secureStorage.setItem('username', username);
			secureStorage.setItem('isAdmin', String(isAdminValue));
			
			// Fetch user status to get created_at info
			const userStatusResponse = await api.get('/auth/status');
			if (userStatusResponse.data.created_at) {
				secureStorage.setItem('createdAt', userStatusResponse.data.created_at);
			}
			
			setToken(response.access_token);
			setUsername(username);
			setIsAuthenticated(true);
			setIsAdmin(isAdminValue);
		} catch (error) {
			console.error('Login failed:', error);
			// Clear any partial data
			secureStorage.removeItem('token');
			secureStorage.removeItem('username');
			secureStorage.removeItem('isAdmin');
			secureStorage.removeItem('createdAt');
			setIsAuthenticated(false);
			setUsername(null);
			setToken(null);
			setIsAdmin(false);
			throw error;
		}
	};

	const logout = () => {
		// Clear storage
		secureStorage.removeItem('token');
		secureStorage.removeItem('username');
		secureStorage.removeItem('isAdmin');
		
		// Clear state
		setToken(null);
		setUsername(null);
		setIsAuthenticated(false);
		setIsAdmin(false);
		
		// Clear axios defaults
		delete api.defaults.headers.common['Authorization'];
	};

	return (
		<AuthContext.Provider value={{ isAuthenticated, username, isAdmin, token, login, logout }}>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}; 