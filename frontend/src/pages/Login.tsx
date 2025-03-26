import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as yup from 'yup';
import {
	Container,
	Box,
	Typography,
	TextField,
	Button,
	Alert,
	Paper,
	IconButton,
	InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const validationSchema = yup.object({
	username: yup.string().required('Username is required'),
	password: yup.string().required('Password is required'),
});

const Login: React.FC = () => {
	const navigate = useNavigate();
	const { login, isAuthenticated } = useAuth();
	const [error, setError] = React.useState<string | null>(null);
	const [showPassword, setShowPassword] = React.useState(false);

	React.useEffect(() => {
	if (isAuthenticated) {
		navigate('/action');
	}
	}, [isAuthenticated, navigate]);

	const handleClickShowPassword = () => setShowPassword(!showPassword);

	const formik = useFormik({
	initialValues: {
		username: '',
		password: '',
	},
	validationSchema,
	onSubmit: async (values, { setSubmitting }) => {
		setError(null);
		try {
		await login(values.username, values.password);
		navigate('/action');
		} catch (err: any) {
		if (err.response?.data?.error) {
			setError(err.response.data.error);
		} else if (err.message) {
			setError(err.message);
		} else {
			setError('Login failed. Please check your credentials.');
		}
		setSubmitting(false);
		}
	},
	});

	return (
	<Box 
		sx={{ 
		minHeight: '100vh',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'background.default',
		py: 4,
		px: 2,
		}}
	>
		<Container maxWidth="xs" sx={{ display: 'flex', justifyContent: 'center' }}>
		<Paper
			elevation={3}
			sx={{
			p: 4,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			borderRadius: 2,
			width: '100%',
			maxWidth: 400,
			}}
		>
			<Typography component="h1" variant="h5" gutterBottom>
			Sign in
			</Typography>

			{error && (
			<Alert severity="error" sx={{ mb: 2, width: '100%' }}>
				{error}
			</Alert>
			)}

			<Box component="form" onSubmit={(e) => {
			e.preventDefault();
			formik.handleSubmit(e);
			}} sx={{ width: '100%' }}>
			<TextField
				margin="normal"
				fullWidth
				id="username"
				name="username"
				label="Username"
				autoComplete="username"
				value={formik.values.username}
				onChange={formik.handleChange}
				error={formik.touched.username && Boolean(formik.errors.username)}
				helperText={formik.touched.username && formik.errors.username}
				disabled={formik.isSubmitting}
			/>
			<TextField
				margin="normal"
				fullWidth
				id="password"
				name="password"
				label="Password"
				type={showPassword ? 'text' : 'password'}
				autoComplete="current-password"
				value={formik.values.password}
				onChange={formik.handleChange}
				error={formik.touched.password && Boolean(formik.errors.password)}
				helperText={formik.touched.password && formik.errors.password}
				disabled={formik.isSubmitting}
				InputProps={{
				endAdornment: (
					<InputAdornment position="end">
					<IconButton
						aria-label="toggle password visibility"
						onClick={handleClickShowPassword}
						edge="end"
					>
						{showPassword ? <VisibilityOff /> : <Visibility />}
					</IconButton>
					</InputAdornment>
				),
				}}
			/>
			<Button
				type="submit"
				fullWidth
				variant="contained"
				sx={{ mt: 3 }}
				disabled={formik.isSubmitting}
			>
				{formik.isSubmitting ? 'Signing in...' : 'Sign In'}
			</Button>
			</Box>
		</Paper>
		</Container>
	</Box>
	);
};

export default Login; 