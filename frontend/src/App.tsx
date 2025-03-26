import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Action from './pages/Action';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Tasks from './pages/Tasks';
import Navbar from './components/Navbar';
import { Box, Container, Alert } from '@mui/material';

const theme = createTheme({
	palette: {
		mode: 'light',
		primary: {
			main: '#2196f3',
			light: '#64b5f6',
			dark: '#1976d2',
		},
		secondary: {
			main: '#f50057',
		},
		background: {
			default: '#f5f5f5',
		},
	},
	typography: {
		fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
		h4: {
			fontWeight: 600,
			marginBottom: '1rem',
		},
		h5: {
			fontWeight: 500,
			marginBottom: '0.5rem',
		},
		h6: {
			fontWeight: 500,
			fontSize: '1.25rem',
		},
	},
	components: {
		MuiButton: {
			styleOverrides: {
				root: {
					textTransform: 'none',
					borderRadius: 8,
				},
			},
		},
		MuiPaper: {
			styleOverrides: {
				root: {
					borderRadius: 12,
				},
			},
		},
		MuiCard: {
			styleOverrides: {
				root: {
					borderRadius: 12,
					boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
				},
			},
		},
		MuiCardHeader: {
			styleOverrides: {
				root: {
					padding: '16px 24px',
				},
				title: {
					fontSize: '1.25rem',
					fontWeight: 500,
				},
			},
		},
		MuiContainer: {
			styleOverrides: {
				root: {
					paddingLeft: 24,
					paddingRight: 24,
				},
			},
		},
	},
});

const ProtectedRoute = ({ children, requireAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean }) => {
	const { isAuthenticated, isAdmin } = useAuth();
	const location = useLocation();

	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location }} replace />;
	}

	if (requireAdmin && !isAdmin) {
		// Show not authorized message for non-admin users trying to access admin pages
		return (
			<PageContainer>
				<Box sx={{ p: 3 }}>
					<Alert severity="error">
						You do not have permission to access this page. This page requires admin privileges.
					</Alert>
				</Box>
			</PageContainer>
		);
	}

	return <>{children}</>;
};

// Auth route is for login page - no navbar needed
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
	return (
		<Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
			{children}
		</Box>
	);
};

// Protected pages need navbar
const PageContainer = ({ children }: { children: React.ReactNode }) => (
	<Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
		<Navbar />
		<Box 
			sx={{ 
				flex: 1, 
				width: '100%', 
				display: 'flex', 
				flexDirection: 'column'
			}}
		>
			<Container 
				maxWidth="lg" 
				sx={{ 
					flex: 1, 
					py: 3, 
					display: 'flex', 
					flexDirection: 'column'
				}}
			>
				{children}
			</Container>
		</Box>
	</Box>
);

function App() {
	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<AuthProvider>
				<Router>
					<Routes>
						<Route path="/login" element={
							<AuthRoute>
								<Login />
							</AuthRoute>
						} />

						<Route path="/action" element={
							<ProtectedRoute>
								<PageContainer>
									<Action />
								</PageContainer>
							</ProtectedRoute>
						} />

						<Route path="/settings" element={
							<ProtectedRoute>
								<PageContainer>
									<Settings />
								</PageContainer>
							</ProtectedRoute>
						} />
						
						<Route path="/admin" element={
							<ProtectedRoute requireAdmin={true}>
								<PageContainer>
									<Admin />
								</PageContainer>
							</ProtectedRoute>
						} />
						
						<Route path="/tasks" element={
							<ProtectedRoute>
								<PageContainer>
									<Tasks />
								</PageContainer>
							</ProtectedRoute>
						} />
						
						<Route path="/" element={<AuthRedirect />} />
					</Routes>
				</Router>
			</AuthProvider>
		</ThemeProvider>
	);
}

const AuthRedirect = () => {
	const { isAuthenticated } = useAuth();
	return <Navigate to={isAuthenticated ? "/action" : "/login"} replace />;
};

export default App;
