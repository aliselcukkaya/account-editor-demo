import React, { useState, useEffect } from 'react';
import {
	Container,
	Grid,
	TextField,
	Button,
	Card,
	CardContent,
	CardHeader,
	Alert,
	CircularProgress,
	Box,
	MenuItem,
	Select,
	FormControl,
	InputLabel,
	IconButton,
	Typography,
} from '@mui/material';
import { Add as AddIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { automation } from '../services/api';

const packageDurations = [1, 3, 6, 12, 24];

// Package duration to package number mapping
const packageMapping: Record<number, number> = {
	1: 101,  // 1 month
	3: 103,  // 3 months
	6: 106,  // 6 months
	12: 112, // 12 months
	24: 124  // 24 months
};

// Generate random username (10 characters)
const generateRandomUsername = (): string => {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let username = '';
	for (let i = 0; i < 10; i++) {
		username += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return username;
};

// Generate random password (10 characters)
const generateRandomPassword = (): string => {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let password = '';
	for (let i = 0; i < 10; i++) {
		password += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return password;
};

interface CreateAccountFormValues {
	username: string;
	password: string;
	packageDuration: number;
}

interface ExtendPackageFormValues {
	username: string;
	packageDuration: number;
}

interface FindAccountFormValues {
	username: string;
}

interface Task {
	id?: number;
	ID?: number;
	status: string;
	result: string | null;
}

interface UserSettings {
	website_url: string;
	api_key: string;
	auth_user: string;
}

// Add a safe JSON parsing function with HTML detection
const safeParseJSON = (jsonString: string): any => {
	if (!jsonString) return {};
	
	// First, check if the string contains HTML content
	const containsHTML = (str: string): boolean => {
		return str.includes('<!DOCTYPE') || 
			   str.includes('<html') || 
			   str.includes('<body') ||
			   str.includes('<head');
	};
	
	// If the string already looks like an object and has error property with HTML
	if (typeof jsonString === 'object') {
		const objStr = JSON.stringify(jsonString);
		if (objStr.includes('<!DOCTYPE') || objStr.includes('<html')) {
			return {
				success: false,
				error: 'The panel URL appears to be incorrect. Please check your settings.'
			};
		}
		return jsonString;
	}
	
	// Check if the raw string contains HTML
	if (containsHTML(jsonString)) {
		return {
			success: false,
			error: 'The panel URL appears to be incorrect. Please check your settings.'
		};
	}
	
	// Normal JSON parsing
	try {
		// Trim whitespace and check if it's a valid JSON string
		const trimmed = jsonString.trim();
		if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
			return { 
				success: false,
				error: "Invalid response format" 
			};
		}
		
		const parsed = JSON.parse(trimmed);
		
		// If the parsed result contains HTML in an error field, sanitize it
		if (parsed.error && containsHTML(parsed.error)) {
			return {
				success: false,
				error: 'The panel URL appears to be incorrect. Please check your settings.'
			};
		}
		
		return parsed;
	} catch (e) {
		console.error("Error parsing JSON:", e);
		return { 
			success: false,
			error: "Failed to parse result data" 
		};
	}
};

// Standardized output formatter for all actions
const formatOutput = (data: any): string => {
	let output = '';
	
	// Username and password are common to all responses
	if (data.username) output += `Username: ${data.username}\n`;
	if (data.password) output += `Password: ${data.password}\n`;
	
	// Package and expiration info
	if (data.expire_at) {
		// Format the date in a more user-friendly way
		const expireDate = new Date(data.expire_at);
		output += `Package: ${data.package || 1} months\n`;
		output += `Expire At: ${expireDate.toLocaleDateString('en-GB', {
			day: '2-digit', 
			month: '2-digit',
			year: 'numeric'
		})}, ${expireDate.toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		})}\n`;
	}
	
	return output;
};

const Action: React.FC = () => {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [outputText, setOutputText] = useState('');
	const [settings, setSettings] = useState<UserSettings>({ website_url: '', api_key: '', auth_user: '' });
	const [successMessage, setSuccessMessage] = useState('');
	const [settingsConfigured, setSettingsConfigured] = useState(false);

	// Fetch user settings when component mounts
	useEffect(() => {
		const fetchSettings = async () => {
			try {
				const userSettings = await automation.getSettings();
				setSettings(userSettings);
				
				// Check if panel URL is configured
				setSettingsConfigured(!!userSettings.website_url);
			} catch (err) {
				console.error("Error fetching settings:", err);
				// Don't show an error to the user, just use default empty values
				setSettingsConfigured(false);
			}
		};
		
		fetchSettings();
	}, []);

	const handleCopyOutput = () => {
		navigator.clipboard.writeText(outputText);
	};

	// Polls every 2 seconds from server to see if the task is finished
	const pollTaskCompletion = async (
		taskId: number | undefined,
		formatOutput: (data: any) => string,
		errorMessage: string,
		successMessageText: string
	) => {
		console.log(`Starting to poll for task ${taskId}`);
		if (!taskId || isNaN(Number(taskId))) {
			setError(`Invalid task ID: ${taskId}`);
			return;
		}

		const pollInterval = setInterval(async () => {
			try {
				console.log(`Polling task ${taskId}...`);
				const updatedTask = await automation.getTask(Number(taskId)) as Task;
				console.log(`Task ${taskId} status:`, updatedTask.status);
				
				if (updatedTask.status === 'completed') {
					clearInterval(pollInterval);
					try {
						// Use the safe parse function
						const resultStr = updatedTask.result || "{}";
						console.log("Raw result:", resultStr);
						
						// Handle both string and object results
						const response = typeof resultStr === 'string' 
							? safeParseJSON(resultStr) 
							: resultStr;
						
						console.log("Parsed result:", response);
						
						if (response.success) {
							const outputText = formatOutput(response.data);
							setOutputText(outputText);
							setError('');
							
							// Show success message
							setSuccessMessage(successMessageText);
						} else {
							// Check if error contains HTML or non-JSON error message
							const errorMsg = response.error || errorMessage;
							if (errorMsg.includes('<!DOCTYPE') || 
								errorMsg.includes('<html') || 
								errorMsg.includes('non-JSON error response')) {
								setError('The panel URL appears to be incorrect. Please check your settings.');
							} else {
								setError(errorMsg);
							}
						}
					} catch (e) {
						console.error('Error processing task result:', e);
						setError(`Error processing result: ${e instanceof Error ? e.message : String(e)}`);
					}
				} else if (updatedTask.status === 'failed') {
					clearInterval(pollInterval);
					try {
						// Use the safe parse function
						const resultStr = updatedTask.result || "{}";
						console.log("Raw failed result:", resultStr);
						
						// Handle both string and object results
						const response = typeof resultStr === 'string' 
							? safeParseJSON(resultStr) 
							: resultStr;
							
						console.log("Parsed failed result:", response);
						
						// Check if error contains HTML or non-JSON error message
						const errorMsg = response.error || 'Task failed';
						if (errorMsg.includes('<!DOCTYPE') || 
							errorMsg.includes('<html') || 
							errorMsg.includes('non-JSON error response')) {
							setError('The panel URL appears to be incorrect. Please check your settings.');
						} else {
							setError(errorMsg);
						}
					} catch (e) {
						console.error('Error parsing failed task result:', e);
						setError('Task failed with invalid result format');
					}
				}
			} catch (error) {
				console.error(`Error polling task ${taskId}:`, error);
				if (error instanceof Error) {
					const errorMsg = error.message;
					if (errorMsg.includes('<!DOCTYPE') || 
						errorMsg.includes('<html') || 
						errorMsg.includes('non-JSON error response')) {
						setError('The panel URL appears to be incorrect. Please check your settings.');
					} else {
						setError(`Error checking task status: ${errorMsg}`);
					}
				} else {
					setError('Error checking task status');
				}
				clearInterval(pollInterval);
			}
		}, 2000);

		// Clear interval after 5 minutes (timeout)
		setTimeout(() => {
			clearInterval(pollInterval);
			setError('Task timed out');
		}, 300000);
	};

	const createAccountFormik = useFormik<CreateAccountFormValues>({
		initialValues: {
			username: '',
			password: '',
			packageDuration: 1,
		},
		validationSchema: yup.object({
			// Username and password are optional for account creation
			username: yup.string(),
			password: yup.string(),
			packageDuration: yup.number().required('Package duration is required')
		}),
		onSubmit: async (values) => {
			setLoading(true);
			setError('');
			
			// Generate username and password if not provided
			let finalUsername = values.username;
			let finalPassword = values.password;
			
			if (!finalUsername) {
				finalUsername = generateRandomUsername();
				console.log("Generated random username:", finalUsername);
			}
			
			if (!finalPassword) {
				finalPassword = generateRandomPassword();
				console.log("Generated random password:", finalPassword);
			}
			
			try {
				const task = await automation.createTask({
					name: 'create_account',
					status: 'pending',
					result: '{}',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					user_id: 1,
					target_website: settings.website_url || '',
					username: finalUsername,
					password: finalPassword,
					package: packageMapping[values.packageDuration]
				});

				console.log("Created task:", task); // Debug log
				if (task && (task.id || task.ID)) {
					await pollTaskCompletion(
						task.id || task.ID,
						(data) => formatOutput({
							...data,
							package: values.packageDuration
						}),
						'Failed to create account',
						'Account created successfully!'
					);
				} else {
					setError("No task ID returned from server");
				}
			} catch (err: any) {
				// Handle specific error cases
				handleApiError(err, 'Failed to create account');
			} finally {
				setLoading(false);
			}
		}
	});

	const extendPackageFormik = useFormik<ExtendPackageFormValues>({
		initialValues: {
			username: '',
			packageDuration: 1,
		},
		validationSchema: yup.object({
			username: yup.string().required('Username is required'),
			packageDuration: yup.number().required('Package duration is required')
		}),
		onSubmit: async (values) => {
			setLoading(true);
			setError('');
			try {
				const task = await automation.createTask({
					name: 'extend_package',
					status: 'pending',
					result: '{}',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					user_id: 1,
					target_website: settings.website_url || '',
					username: values.username,
					package: packageMapping[values.packageDuration]
				});

				console.log("Created task:", task); // Debug log
				if (task && (task.id || task.ID)) {
					await pollTaskCompletion(
						task.id || task.ID,
						(data) => formatOutput({
							...data,
							package: values.packageDuration
						}),
						'Failed to extend package',
						'Package extended successfully!'
					);
				} else {
					setError("No task ID returned from server");
				}
			} catch (err: any) {
				// Handle specific error cases
				handleApiError(err, 'Failed to extend package');
			} finally {
				setLoading(false);
			}
		}
	});

	const findAccountFormik = useFormik<FindAccountFormValues>({
		initialValues: {
			username: '',
		},
		validationSchema: yup.object({
			username: yup.string().required('Username is required')
		}),
		onSubmit: async (values) => {
			setLoading(true);
			setError('');
			try {
				const task = await automation.createTask({
					name: 'find_account',
					status: 'pending',
					result: '{}',
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					user_id: 1,
					target_website: settings.website_url || '',
					username: values.username
				});

				console.log("Created task:", task); // Debug log
				if (task && (task.id || task.ID)) {
					await pollTaskCompletion(
						task.id || task.ID,
						(lines) => {
							// If we have multiple lines, just take the first one for consistent display
							const line = Array.isArray(lines) && lines.length > 0 ? lines[0] : lines;
							return formatOutput(line);
						},
						'Failed to find account',
						'Account found successfully!'
					);
				} else {
					setError("No task ID returned from server");
				}
			} catch (err: any) {
				// Handle specific error cases
				handleApiError(err, 'Failed to find account');
			} finally {
				setLoading(false);
			}
		}
	});

	// Centralized error handling for API calls
	const handleApiError = (err: any, defaultMessage: string) => {
		console.log('Handling API error:', err);
		
		// Check if this is an HTML response or non-JSON error
		const isHtmlError = typeof err.message === 'string' && (
			err.message.includes('non-JSON error response') || 
			err.message.includes('<!DOCTYPE')
		);
		
		if (isHtmlError) {
			// This is likely a wrong URL error
			setError('The panel URL appears to be incorrect. Please verify your settings and try again.');
			return;
		}
		
		// Check for structured error responses
		if (err.response?.data?.error) {
			// Handle common backend validation error with more user-friendly message
			const errorMsg = err.response.data.error;
			
			if (errorMsg.includes("TargetWebsite") && errorMsg.includes("required")) {
				setError('Panel URL is not configured. Please go to Settings and configure your Panel URL first.');
				return;
			}
			
			// Handle connection error for wrong URL with more user-friendly message
			if (errorMsg.includes("connection error") && errorMsg.includes("status 404")) {
				setError('The Panel URL you configured appears to be incorrect. Please check your settings and make sure the URL is valid.');
				return;
			}
			
			setError(errorMsg);
			return;
		}
		
		// Handle specific status codes
		if (err.response?.status === 401) {
			setError('Your session has expired. Please log in again.');
		} else if (err.response?.status === 404) {
			setError('The service endpoint was not found. Please check your panel URL in settings.');
		} else if (err.response?.status === 500) {
			setError('The server encountered an error. Please try again later.');
		} else if (err.response?.status === 502 || err.response?.status === 503 || err.response?.status === 504) {
			setError('The service is currently unavailable. Please try again later.');
		} else if (!err.response) {
			// Network error (no response from server)
			setError('Could not connect to the server. Please check your internet connection and panel URL.');
		} else {
			// Fallback to a generic error message or the error message if available
			setError(err instanceof Error ? err.message : defaultMessage);
		}
	};

	return (
		<Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
			{/* Centralized error display */}
			{error && (
				<Alert severity="error" sx={{ mb: 3 }}>
					{error}
				</Alert>
			)}
			
			{/* Success message display */}
			{successMessage && (
				<Alert severity="success" sx={{ mb: 3 }}>
					{successMessage}
				</Alert>
			)}
			
			{/* Settings not configured warning */}
			{!settingsConfigured && (
				<Alert severity="warning" sx={{ mb: 3 }}>
					Panel URL is not configured. Please go to the <Button color="inherit" href="/settings" sx={{ p: 0, textTransform: 'none', fontWeight: 'bold' }}>Settings</Button> page to configure your Panel URL before performing any actions.
				</Alert>
			)}
			
			<Grid container spacing={3}>
				<Grid item xs={12} md={6}>
					<Card>
						<CardHeader
							title={<Typography variant="h6">Create New Account</Typography>}
						/>
						<CardContent>
							<Box component="form" onSubmit={createAccountFormik.handleSubmit}>
								<TextField
									fullWidth
									margin="normal"
									name="username"
									label="Username (Optional - will be generated if empty)"
									value={createAccountFormik.values.username}
									onChange={createAccountFormik.handleChange}
									error={createAccountFormik.touched.username && Boolean(createAccountFormik.errors.username)}
									helperText={createAccountFormik.touched.username && createAccountFormik.errors.username}
									disabled={createAccountFormik.isSubmitting}
								/>
								<TextField
									fullWidth
									margin="normal"
									name="password"
									label="Password (Optional - will be generated if empty)"
									type="password"
									value={createAccountFormik.values.password}
									onChange={createAccountFormik.handleChange}
									error={createAccountFormik.touched.password && Boolean(createAccountFormik.errors.password)}
									helperText={createAccountFormik.touched.password && createAccountFormik.errors.password}
									disabled={createAccountFormik.isSubmitting}
								/>
								<FormControl fullWidth margin="normal">
									<InputLabel>Package Duration (months)</InputLabel>
									<Select
										name="packageDuration"
										value={createAccountFormik.values.packageDuration}
										onChange={createAccountFormik.handleChange}
										label="Package Duration (months)"
									>
										{packageDurations.map((duration) => (
											<MenuItem key={duration} value={duration}>
												{duration}
											</MenuItem>
										))}
									</Select>
								</FormControl>
								<Button
									type="submit"
									variant="contained"
									fullWidth
									startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
									disabled={loading || createAccountFormik.isSubmitting || !settingsConfigured}
									sx={{ mt: 2 }}
								>
									{loading ? 'Creating Account...' : 'Create Account'}
								</Button>
							</Box>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} md={6}>
					<Card>
						<CardHeader
							title={<Typography variant="h6">Extend Package</Typography>}
						/>
						<CardContent>
							<Box component="form" onSubmit={extendPackageFormik.handleSubmit}>
								<TextField
									fullWidth
									margin="normal"
									name="username"
									label="Username"
									value={extendPackageFormik.values.username}
									onChange={extendPackageFormik.handleChange}
									error={extendPackageFormik.touched.username && Boolean(extendPackageFormik.errors.username)}
									helperText={extendPackageFormik.touched.username && extendPackageFormik.errors.username}
									disabled={extendPackageFormik.isSubmitting}
									required
								/>
								<FormControl fullWidth margin="normal">
									<InputLabel>Package Duration (months)</InputLabel>
									<Select
										name="packageDuration"
										value={extendPackageFormik.values.packageDuration}
										onChange={extendPackageFormik.handleChange}
										label="Package Duration (months)"
									>
										{packageDurations.map((duration) => (
											<MenuItem key={duration} value={duration}>
												{duration}
											</MenuItem>
										))}
									</Select>
								</FormControl>
								<Button
									type="submit"
									variant="contained"
									fullWidth
									disabled={loading || extendPackageFormik.isSubmitting || !settingsConfigured}
									sx={{ mt: 2 }}
								>
									Extend Package
								</Button>
							</Box>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} md={6}>
					<Card>
						<CardHeader
							title={<Typography variant="h6">Find Account</Typography>}
						/>
						<CardContent>
							<Box component="form" onSubmit={findAccountFormik.handleSubmit}>
								<TextField
									fullWidth
									margin="normal"
									name="username"
									label="Username"
									value={findAccountFormik.values.username}
									onChange={findAccountFormik.handleChange}
									error={findAccountFormik.touched.username && Boolean(findAccountFormik.errors.username)}
									helperText={findAccountFormik.touched.username && findAccountFormik.errors.username}
									disabled={findAccountFormik.isSubmitting}
									required
								/>
								<Button
									type="submit"
									variant="contained"
									fullWidth
									disabled={loading || findAccountFormik.isSubmitting || !settingsConfigured}
									sx={{ mt: 2 }}
								>
									Find Account
								</Button>
							</Box>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} md={6}>
					<Card>
						<CardHeader
							title={<Typography variant="h6">Output</Typography>}
							action={
								<IconButton onClick={handleCopyOutput} size="small" disabled={!outputText}>
									<CopyIcon />
								</IconButton>
							}
						/>
						<CardContent>
							<TextField
								fullWidth
								multiline
								rows={4}
								value={outputText}
								onChange={(e) => setOutputText(e.target.value)}
								placeholder="Output will appear here..."
								inputProps={{ readOnly: true }}
							/>
						</CardContent>
					</Card>
				</Grid>
			</Grid>
		</Container>
	);
};

export default Action; 