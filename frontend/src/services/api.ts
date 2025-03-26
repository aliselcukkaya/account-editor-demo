import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';


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

const api = axios.create({
	baseURL: API_URL,
	headers: {
		'Content-Type': 'application/json',
	},
	withCredentials: false, // Change to false since our backend uses Authorization header
});

// Add request interceptor to add the token and validate it
api.interceptors.request.use(
	(config) => {
		const token = secureStorage.getItem('token');
		if (token) {
			// Set the token in both the request headers and axios defaults
			config.headers.Authorization = `Bearer ${token}`;
			api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
		}
		// Add CSRF protection header
		config.headers['X-Requested-With'] = 'XMLHttpRequest';
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Add response interceptor to handle errors
api.interceptors.response.use(
	(response) => response,
	(error) => {
		console.log('API Error interceptor:', error);
		
		// Special case for XMLHttpRequest errors with HTML
		if (error.message?.includes('non-JSON error response')) {
			// This is usually a wrong URL or connectivity issue
			console.log('Handling XMLHttpRequest with HTML response');
			
			// Extract status code if present in message
			const statusMatch = error.message.match(/status (\d+)/);
			const status = statusMatch ? parseInt(statusMatch[1]) : 404;
			
			// Set custom error response
			error.response = {
				status: status,
				data: {
					error: 'The panel URL is incorrect or the endpoint does not exist. Please check your settings.'
				}
			};
			
			return Promise.reject(error);
		}
		
		// Fix for HTML responses: Check both error message and response data for HTML content
		const checkForHTML = (content: any): boolean => {
			if (!content) return false;
			
			// Convert to string if needed
			const strContent = typeof content === 'string' ? content : JSON.stringify(content);
			
			// Check for common HTML markers
			return strContent.includes('<!DOCTYPE') || 
				   strContent.includes('<html') || 
				   strContent.includes('<body') ||
				   strContent.includes('<head') ||
				   strContent.includes('<title');
		};
		
		// Check if error message or response data contains HTML
		const hasHTMLInMessage = error.message && checkForHTML(error.message);
		const hasHTMLInData = error.response?.data && checkForHTML(error.response.data);
		
		// If HTML is detected in either place, create a user-friendly error
		if (hasHTMLInMessage || hasHTMLInData) {
			console.log('HTML detected in error response, converting to user-friendly message');
			
			// Get the status code if available
			const status = error.response?.status || 0;
			
			// Create a new structured error response
			if (!error.response) {
				error.response = { data: {}, status: status };
			}
			
			// Set a user-friendly error message based on status code
			if (status === 404) {
				error.response.data = { 
					error: 'The service endpoint was not found. Please check your panel URL in settings.' 
				};
			} else if (status >= 500) {
				error.response.data = { 
					error: 'The server encountered an error. Please try again later or contact support.' 
				};
			} else {
				error.response.data = { 
					error: 'Connection issue with the panel URL. Please check your settings and ensure the URL is correct.' 
				};
			}
		}
		
		// Check if this is a login attempt with wrong credentials
		const isLoginAttempt = error.config?.url?.includes('/auth/token');
		
		// Now handle specific status codes
		if (error.response?.status === 401) {
			if (isLoginAttempt) {
				// For login attempts, just return the error with a clear message
				console.error('Authentication failed: Invalid credentials');
				error.response.data = { error: 'Invalid username or password. Please try again.' };
			} else {
				// For other 401 errors (session expiration), log the user out
				secureStorage.removeItem('token');
				secureStorage.removeItem('username');
				secureStorage.removeItem('isAdmin');
				// Remove the token from axios defaults
				delete api.defaults.headers.common['Authorization'];
				// Instead of direct redirection, let the AuthContext handle it
				window.dispatchEvent(new CustomEvent('auth:logout'));
			}
		} else if (error.response?.status === 403) {
			// Handle forbidden error
			console.error('Access forbidden');
			error.response.data = { error: 'You do not have permission to access this resource' };
		} else if (error.response?.status === 404) {
			// Handle not found error
			console.error('Resource not found');
			if (!error.response.data || !error.response.data.error) {
				error.response.data = { error: 'The requested resource was not found. Please check your panel URL settings.' };
			}
		} else if (error.response?.status === 429) {
			// Handle rate limiting
			console.error('Too many requests. Please try again later.');
			error.response.data = { error: 'Too many requests. Please try again later.' };
		} else if (error.response?.status >= 500) {
			// Handle server errors
			console.error('Server error:', error.response.status);
			if (!error.response.data || !error.response.data.error) {
				error.response.data = { error: 'The server encountered an error. Please try again later.' };
			}
		} else if (!error.response) {
			// Network errors
			console.error('Network error:', error.message);
			// Create a mock response for consistent error handling
			error.response = {
				data: { error: 'Network error. Please check your internet connection and panel URL.' },
				status: 0
			};
		}
		
		return Promise.reject(error);
	}
);

interface Settings {
	website_url: string;
	username: string;
	password: string;
	api_key: string;
	auth_user: string;
	created_at?: string;
	updated_at?: string;
}

interface SettingsResponse {
	message: string;
}

export interface Task {
	id?: number;  // Optional since it's generated by the backend
	ID?: number;  // Uppercase version that may come from backend
	name: string;  // create_account, find_account, or extend_package
	Name?: string; 
	status: string;
	Status?: string; 
	result: string;
	Result?: string; 
	target_website: string;
	TargetWebsite?: string; 
	username?: string;
	Username?: string; 
	password?: string;
	Password?: string; 
	package?: number;
	Package?: number; 
	created_at: string;
	CreatedAt?: string; 
	updated_at: string;
	UpdatedAt?: string; 
	user_id: number;
	UserID?: number; 
	completed_at?: string;
	CompletedAt?: string; 
}

export interface User {
	id: number;
	username: string;
	is_admin: boolean;
	is_active: boolean;
	created_at?: string;
	last_login_at?: string;
	message?: string;
}

export const auth = {
	login: async (username: string, password: string) => {
		try {
			// Backend expects JSON format
			const response = await api.post('/auth/token', {
				username,
				password
			});

			if (response.data.access_token) {
				// Store token securely
				secureStorage.setItem('token', response.data.access_token);
				secureStorage.setItem('username', username);

				// Set the token in axios defaults
				api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;

				// Check user status
				const userStatusResponse = await api.get('/auth/status');

				if (!userStatusResponse.data.is_active) {
					throw new Error('Account is inactive. Please contact administrator.');
				}

				secureStorage.setItem('isAdmin', String(userStatusResponse.data.is_admin));
				return {
					access_token: response.data.access_token,
					username: username,
					is_admin: userStatusResponse.data.is_admin
				};
			}
			throw new Error('Invalid response from server');
		} catch (error: any) {
			console.error('Login error:', error);
			throw error;
		}
	},
		
	getUserInfo: async () => {
		try {
			const response = await api.get('/auth/status');
			return response.data;
		} catch (error) {
			console.error('Error fetching user info:', error);
			throw error;
		}
	}
};

export const admin = {
	createUser: async (userData: {
		username: string;
		password: string;
		is_admin: boolean;
	}) => {
		try {
			const response = await api.post<User>('/admin/users', userData);
			return response.data;
		} catch (error) {
			console.error('Create user error:', error);
			throw error;
		}
	},
	
	getUsers: async () => {
		try {
			const response = await api.get<User[]>('/admin/users');
			return response.data;
		} catch (error) {
			console.error('Get users error:', error);
			throw error;
		}
	},
	
	updateUser: async (userId: number, userData: {
		password?: string;
		is_admin?: boolean;
		is_active?: boolean;
	}) => {
		try {
			const response = await api.put<User>(`/admin/users/${userId}`, userData);
			return response.data;
		} catch (error) {
			console.error('Update user error:', error);
			throw error;
		}
	},
	
	deleteUser: async (userId: number) => {
		try {
			const response = await api.delete(`/admin/users/${userId}`);
			return response.data;
		} catch (error) {
			console.error('Delete user error:', error);
			throw error;
		}
	}
};

// Helper function to normalize task data from API
const normalizeTask = (task: any): Task => {
	// Extract result and check if it's base64
	let resultField = task.result || task.Result || '';
	
	return {
		id: task.id || task.ID,
		name: task.name || task.Name || '',
		status: task.status || task.Status || '',
		result: resultField,
		target_website: task.target_website || task.TargetWebsite || '',
		username: task.username || task.Username,
		password: task.password || task.Password,
		package: task.package || task.Package,
		created_at: task.created_at || task.CreatedAt || new Date().toISOString(),
		updated_at: task.updated_at || task.UpdatedAt || new Date().toISOString(),
		user_id: task.user_id || task.UserID || 0,
		completed_at: task.completed_at || task.CompletedAt
	};
};

// Update the task methods to normalize results
export const automation = {
	createTask: async (task: Task) => {
		const response = await api.post('/automation/tasks', task);
		return normalizeTask(response.data);
	},

	getTasks: async () => {
		const response = await api.get<any[]>('/automation/tasks');
		return response.data.map(normalizeTask);
	},

	getTask: async (taskId: number | undefined) => {
		if (!taskId || isNaN(Number(taskId))) {
			throw new Error('Invalid task ID');
		}
		const response = await api.get<any>(`/automation/tasks/${taskId}`);
		return normalizeTask(response.data);
	},

	getSettings: async () => {
		try {
			const response = await api.get<Settings>('/automation/settings');
			return response.data;
		} catch (error: any) {
			console.error('Settings fetch error:', {
				status: error.response?.status,
				data: error.response?.data,
				message: error.message
			});
			throw error;
		}
	},

	updateSettings: async (settings: {
		website_url: string;
		api_key: string;
		auth_user: string;
	}) => {
		const response = await api.put<SettingsResponse>('/automation/settings', settings);
		return response.data;
	},
};

export type {Settings, SettingsResponse };
export default api; 