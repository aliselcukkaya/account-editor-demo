import React, { useEffect, useState } from 'react';
import {
	Grid,
	Card,
	CardContent,
	CardHeader,
	Typography,
	Box,
	Avatar,
	TextField,
	Button,
	Alert,
	Container,
	IconButton,
	InputAdornment,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	FormControlLabel,
	Switch,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { automation, auth, type Settings } from '../services/api';

const validationSchema = yup.object({
	website_url: yup.string().url('Enter a valid URL').required('Panel URL is required'),
	api_key: yup.string().required('API Key is required'),
	auth_user: yup.string().required('Auth User is required'),
});

const Settings: React.FC = () => {
	const { username } = useAuth();
	const [success, setSuccess] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showPassword, setShowPassword] = useState(false);
	const [createdAt, setCreatedAt] = useState<string | null>(null);
	
	// State for auth credentials visibility
	const [showAuthFields, setShowAuthFields] = useState(false);
	const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
	const [passwordValue, setPasswordValue] = useState('');
	const [passwordError, setPasswordError] = useState('');
	const [simulationMode, setSimulationMode] = useState(false);

	const handleClickShowPassword = () => setShowPassword(!showPassword);

	const formik = useFormik({
		initialValues: {
			website_url: '',
			api_key: '',
			auth_user: '',
		},
		validationSchema,
		onSubmit: async (values, { setSubmitting }) => {
			try {
				// Check if simulation mode is enabled
				if (simulationMode) {
					values.api_key = 'test';
					values.auth_user = 'test';
				}
				
				const response = await automation.updateSettings(values);
				setSuccess(response.message || 'Settings updated successfully');
				setError(null);
			} catch (err: any) {
				setError(err.response?.data?.detail || 'Failed to update settings');
				setSuccess(null);
			} finally {
				setSubmitting(false);
			}
		},
	});

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const settings = await automation.getSettings();
				formik.setValues({
					website_url: settings.website_url || '',
					api_key: settings.api_key || '',
					auth_user: settings.auth_user || '',
				});
				
				// Check if in simulation mode
				setSimulationMode(settings.api_key === 'test' && settings.auth_user === 'test');

				// Get user account information for to set member since date in settings page
				try {
					const userResponse = await auth.getUserInfo();
					if (userResponse && userResponse.created_at) {
						setCreatedAt(userResponse.created_at);
					}
				} catch (error) {
					console.error('Failed to fetch user info:', error);
				}
			} catch (err: any) {
				console.error('Failed to load settings:', err);
			}
		};
		loadSettings();
	}, []);

	const handleVerifyClick = () => {
		setVerifyDialogOpen(true);
	};

	const handleVerifyClose = () => {
		setVerifyDialogOpen(false);
		setPasswordValue('');
		setPasswordError('');
	};

	const handleVerifyPassword = async () => {
		try {
			// Try to authenticate with current username and provided password
			await auth.login(username || '', passwordValue);
			
			// If successful, show auth fields
			setShowAuthFields(true);
			setVerifyDialogOpen(false);
			setPasswordValue('');
			setPasswordError('');
		} catch (error) {
			setPasswordError('Incorrect password. Please try again.');
		}
	};

	const toggleSimulationMode = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSimulationMode(event.target.checked);
		
		if (event.target.checked) {
			// Fill in test values and set demo panel URL
			formik.setFieldValue('api_key', 'test');
			formik.setFieldValue('auth_user', 'test');
			formik.setFieldValue('website_url', 'https://demo.test');
		}
	};

	return (
		<Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
			<Grid container spacing={3} justifyContent="center">
				<Grid item xs={12} md={4}>
					<Card>
						<CardContent sx={{ textAlign: 'center', py: 4 }}>
							<Avatar
								sx={{
									width: 80,
									height: 80,
									bgcolor: 'primary.main',
									fontSize: '2rem',
									margin: '0 auto 1rem',
								}}
							>
								{username?.[0]?.toUpperCase()}
							</Avatar>
							<Typography variant="h6" gutterBottom>
								{username}
							</Typography>
							<Typography variant="body2" color="textSecondary">
								Member since {createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A'}
							</Typography>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} md={8}>
					<Card>
						<CardHeader
							title="Account Settings"
							titletypography={{ variant: 'h6' }}
						/>
						<CardContent>
							{success && (
								<Alert severity="success" sx={{ mb: 2 }}>
									{success}
								</Alert>
							)}
							{error && (
								<Alert severity="error" sx={{ mb: 2 }}>
									{error}
								</Alert>
							)}
							<Box component="form" onSubmit={formik.handleSubmit}>
								<TextField
									fullWidth
									margin="normal"
									label="Panel URL"
									name="website_url"
									value={formik.values.website_url}
									onChange={formik.handleChange}
									error={formik.touched.website_url && Boolean(formik.errors.website_url)}
									helperText={formik.touched.website_url && formik.errors.website_url}
									disabled={formik.isSubmitting}
								/>
								
								{!showAuthFields ? (
									<Button
										variant="outlined"
										startIcon={<Lock />}
										onClick={handleVerifyClick}
										sx={{ mt: 2, mb: 1 }}
									>
										View Authentication Credentials
									</Button>
								) : (
									<>
										<TextField
											fullWidth
											margin="normal"
											label="API Key"
											name="api_key"
											value={formik.values.api_key}
											onChange={formik.handleChange}
											error={formik.touched.api_key && Boolean(formik.errors.api_key)}
											helperText={formik.touched.api_key && formik.errors.api_key}
											disabled={formik.isSubmitting || simulationMode}
											type={showPassword ? 'text' : 'password'}
											InputProps={{
												endAdornment: (
													<InputAdornment position="end">
														<IconButton
															aria-label="toggle api key visibility"
															onClick={handleClickShowPassword}
															edge="end"
														>
															{showPassword ? <VisibilityOff /> : <Visibility />}
														</IconButton>
													</InputAdornment>
												),
											}}
										/>
										<TextField
											fullWidth
											margin="normal"
											label="Auth User"
											name="auth_user"
											value={formik.values.auth_user}
											onChange={formik.handleChange}
											error={formik.touched.auth_user && Boolean(formik.errors.auth_user)}
											helperText={formik.touched.auth_user && formik.errors.auth_user}
											disabled={formik.isSubmitting || simulationMode}
											type={showPassword ? 'text' : 'password'}
											InputProps={{
												endAdornment: (
													<InputAdornment position="end">
														<IconButton
															aria-label="toggle auth user visibility"
															onClick={handleClickShowPassword}
															edge="end"
														>
															{showPassword ? <VisibilityOff /> : <Visibility />}
														</IconButton>
													</InputAdornment>
												),
											}}
										/>
										
										<FormControlLabel 
											control={
												<Switch 
													checked={simulationMode} 
													onChange={toggleSimulationMode} 
													color="primary"
												/>
											} 
											label="Enable Simulation Mode (for testing)"
											sx={{ mt: 2, display: 'block' }}
										/>
										
										{simulationMode && (
											<Alert severity="info" sx={{ mt: 1, mb: 2 }}>
												Simulation mode is enabled. API calls will return mock data.
											</Alert>
										)}
									</>
								)}
								
								<Button
									type="submit"
									variant="contained"
									fullWidth
									sx={{ mt: 3 }}
									disabled={formik.isSubmitting}
								>
									{formik.isSubmitting ? 'Saving...' : 'Save Settings'}
								</Button>
							</Box>
						</CardContent>
					</Card>
				</Grid>
			</Grid>
			
			{/* Password verification dialog */}
			<Dialog open={verifyDialogOpen} onClose={handleVerifyClose}>
				<DialogTitle>Verify Your Password</DialogTitle>
				<DialogContent>
					<Typography variant="body2" sx={{ mb: 2 }}>
						For security reasons, please enter your password to view authentication credentials.
					</Typography>
					<TextField
						autoFocus
						margin="dense"
						label="Password"
						type="password"
						fullWidth
						value={passwordValue}
						onChange={(e) => setPasswordValue(e.target.value)}
						error={!!passwordError}
						helperText={passwordError}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleVerifyClose}>Cancel</Button>
					<Button onClick={handleVerifyPassword} variant="contained">
						Verify
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
};

export default Settings; 