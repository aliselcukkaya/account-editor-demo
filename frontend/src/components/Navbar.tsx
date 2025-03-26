import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
	AppBar,
	Box,
	Toolbar,
	Typography,
	Button,
	Container,
	IconButton,
	Menu,
	MenuItem,
	ListItemIcon,
	ListItemText,
} from '@mui/material';
import {
	Dashboard,
	Settings as SettingsIcon,
	AccountCircle,
	Logout,
	AdminPanelSettings,
	History as HistoryIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
	const navigate = useNavigate();
	const { logout, isAdmin } = useAuth();
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

	const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
		setAnchorEl(event.currentTarget);
	};

	const handleClose = () => {
		setAnchorEl(null);
	};

	const handleLogout = () => {
		handleClose();
		logout();
		navigate('/login');
	};

	const menuItems = [
		{
			text: 'Settings',
			icon: <SettingsIcon />,
			onClick: () => {
				handleClose();
				navigate('/settings');
			},
		},
		{
			text: 'Task History',
			icon: <HistoryIcon />,
			onClick: () => {
				handleClose();
				navigate('/tasks');
			},
		},
		...(isAdmin ? [{
			text: 'Admin Panel',
			icon: <AdminPanelSettings />,
			onClick: () => {
				handleClose();
				navigate('/admin');
			},
		}] : []),
		{
			text: 'Logout',
			icon: <Logout />,
			onClick: handleLogout,
		},
	];

	return (
		<AppBar 
			position="sticky" 
			elevation={0}
			sx={{ 
				backgroundColor: 'white',
				borderBottom: '1px solid',
				borderColor: 'divider',
			}}
		>
			<Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
				<Container maxWidth="lg" sx={{ width: '100%' }}>
					<Toolbar 
						disableGutters 
						sx={{ 
							minHeight: 64,
							justifyContent: 'space-between',
							width: '100%',
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
							<Typography
								variant="h6"
								component="div"
								sx={{
									cursor: 'pointer',
									fontWeight: 'bold',
									color: 'primary.main',
								}}
								onClick={() => navigate('/action')}
							>
								Account Editor
							</Typography>

							<Button
								color="inherit"
								startIcon={<Dashboard />}
								onClick={() => navigate('/action')}
								sx={{ color: 'text.primary' }}
							>
								Action
							</Button>
						</Box>

						<Box>
							<IconButton
								size="large"
								onClick={handleMenu}
								color="inherit"
								sx={{ color: 'text.primary' }}
							>
								<AccountCircle />
							</IconButton>
							<Menu
								id="menu-appbar"
								anchorEl={anchorEl}
								anchorOrigin={{
									vertical: 'bottom',
									horizontal: 'right',
								}}
								keepMounted
								transformOrigin={{
									vertical: 'top',
									horizontal: 'right',
								}}
								open={Boolean(anchorEl)}
								onClose={handleClose}
							>
								{menuItems.map((item, index) => (
									<MenuItem key={index} onClick={item.onClick}>
										<ListItemIcon>{item.icon}</ListItemIcon>
										<ListItemText>{item.text}</ListItemText>
									</MenuItem>
								))}
							</Menu>
						</Box>
					</Toolbar>
				</Container>
			</Box>
		</AppBar>
	);
};

export default Navbar; 