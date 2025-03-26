import React, { useState, useEffect } from 'react';
import {
	Container,
	Card,
	CardContent,
	CardHeader,
	Button,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	FormControlLabel,
	Switch,
	Chip,
	Box,
	Alert,
	Paper,
	Typography,
} from '@mui/material';
import {
	Add as AddIcon,
	Refresh as RefreshIcon,
	Edit as EditIcon,
	Delete as DeleteIcon,
	Check as ActiveIcon,
	Close as InactiveIcon,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { admin, User } from '../services/api';

const Admin: React.FC = () => {
	const [users, setUsers] = useState<User[]>([]);
	const [openCreate, setOpenCreate] = useState(false);
	const [openEdit, setOpenEdit] = useState(false);
	const [openDelete, setOpenDelete] = useState(false);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [formData, setFormData] = useState({
		username: '',
		password: '',
		is_admin: false,
	});
	const [editData, setEditData] = useState({
		password: '',
		is_admin: false,
		is_active: true,
	});
	const { isAdmin } = useAuth();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		// Redirect to main page if it's not admin
		if (!isAdmin) {
			navigate('/');
			return;
		}
		loadUsers();
	}, [isAdmin, navigate]);

	const loadUsers = async () => {
		setLoading(true);
		setError(null);
		try {
			const users = await admin.getUsers();
			setUsers(users);
			if (users.length === 0) {
				setSuccess("No users found. You can create users below.");
			} else {
				setSuccess(null);
			}
		} catch (error: any) {
			setError('Failed to load users: ' + (error.response?.data?.error || error.message));
			setUsers([]);
		} finally {
			setLoading(false);
		}
	};

	const handleCreateUser = async () => {
		try {
			if (!formData.username || !formData.password) {
				setError('Username and password are required');
				return;
			}
			await admin.createUser({
				username: formData.username,
				password: formData.password,
				is_admin: formData.is_admin
			});
			setOpenCreate(false);
			setFormData({ username: '', password: '', is_admin: false });
			setSuccess('User created successfully!');
			setError(null);
			loadUsers();
		} catch (error: any) {
			setError(error.response?.data?.error || 'Failed to create user');
		}
	};

	const handleEditClick = (user: User) => {
		setSelectedUser(user);
		setEditData({
			password: '',
			is_admin: user.is_admin,
			is_active: user.is_active,
		});
		setOpenEdit(true);
	};

	const handleDeleteClick = (user: User) => {
		setSelectedUser(user);
		setOpenDelete(true);
	};

	const handleUpdateUser = async () => {
		if (!selectedUser) return;
		
		try {
			const updateData: {
				password?: string;
				is_admin?: boolean;
				is_active?: boolean;
			} = {};
			
			if (editData.password) {
				updateData.password = editData.password;
			}
			
			updateData.is_admin = editData.is_admin;
			updateData.is_active = editData.is_active;
			
			await admin.updateUser(selectedUser.id, updateData);
			setOpenEdit(false);
			setSuccess('User updated successfully!');
			loadUsers();
		} catch (error: any) {
			setError(error.response?.data?.error || 'Failed to update user');
		}
	};

	const handleDeleteUser = async () => {
		if (!selectedUser) return;
		
		try {
			await admin.deleteUser(selectedUser.id);
			setOpenDelete(false);
			setSuccess('User deleted successfully!');
			loadUsers();
		} catch (error: any) {
			setError(error.response?.data?.error || 'Failed to delete user');
		}
	};

	if (!isAdmin) {
		return (
			<Container maxWidth="sm" sx={{ mt: 4 }}>
				<Alert severity="error">You don't have permission to access this page.</Alert>
			</Container>
		);
	}

	return (
		<Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
			{error && (
				<Alert severity="error" sx={{ mb: 3 }}>
					{error}
				</Alert>
			)}
			{success && (
				<Alert severity="success" sx={{ mb: 3 }}>
					{success}
				</Alert>
			)}
			<Card>
				<CardHeader
					title="User Management"
					action={
						<Box sx={{ display: 'flex', gap: 1 }}>
							<Button
								variant="outlined"
								startIcon={<RefreshIcon />}
								onClick={loadUsers}
								disabled={loading}
							>
								Refresh
							</Button>
							<Button
								variant="contained"
								startIcon={<AddIcon />}
								onClick={() => setOpenCreate(true)}
							>
								Add User
							</Button>
						</Box>
					}
				/>
				<CardContent>
					{users.length > 0 ? (
						<TableContainer component={Paper}>
							<Table>
								<TableHead>
									<TableRow>
										<TableCell>ID</TableCell>
										<TableCell>Username</TableCell>
										<TableCell>Role</TableCell>
										<TableCell>Status</TableCell>
										<TableCell>Last Login</TableCell>
										<TableCell>Actions</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{users.map((user) => (
										<TableRow key={user.id}>
											<TableCell>{user.id}</TableCell>
											<TableCell>{user.username}</TableCell>
											<TableCell>
												<Chip 
													label={user.is_admin ? "Admin" : "User"} 
													color={user.is_admin ? "primary" : "default"}
													size="small"
												/>
											</TableCell>
											<TableCell>
												<Chip 
													icon={user.is_active ? <ActiveIcon /> : <InactiveIcon />}
													label={user.is_active ? "Active" : "Inactive"} 
													color={user.is_active ? "success" : "error"}
													size="small"
												/>
											</TableCell>
											<TableCell>
												{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Never"}
											</TableCell>
											<TableCell>
												<IconButton 
													size="small" 
													color="primary" 
													onClick={() => handleEditClick(user)}
													title="Edit User"
												>
													<EditIcon />
												</IconButton>
												<IconButton 
													size="small" 
													color="error" 
													onClick={() => handleDeleteClick(user)}
													title="Delete User"
												>
													<DeleteIcon />
												</IconButton>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					) : (
						<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
							<Typography variant="body1" color="text.secondary">
								{loading ? 'Loading users...' : 'No users found. Create a new user to get started.'}
							</Typography>
						</Box>
					)}
				</CardContent>
			</Card>

			{/* Create User Dialog */}
			<Dialog open={openCreate} onClose={() => setOpenCreate(false)}>
				<DialogTitle>Create New User</DialogTitle>
				<DialogContent>
					<TextField
						fullWidth
						margin="normal"
						label="Username"
						value={formData.username}
						onChange={(e) => setFormData({ ...formData, username: e.target.value })}
						required
					/>
					<TextField
						fullWidth
						margin="normal"
						label="Password"
						type="password"
						value={formData.password}
						onChange={(e) => setFormData({ ...formData, password: e.target.value })}
						required
					/>
					<FormControlLabel
						control={
							<Switch
								checked={formData.is_admin}
								onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
							/>
						}
						label="Admin Access"
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOpenCreate(false)}>Cancel</Button>
					<Button onClick={handleCreateUser} variant="contained">
						Create
					</Button>
				</DialogActions>
			</Dialog>

			{/* Edit User Dialog */}
			<Dialog open={openEdit} onClose={() => setOpenEdit(false)}>
				<DialogTitle>Edit User: {selectedUser?.username}</DialogTitle>
				<DialogContent>
					<TextField
						fullWidth
						margin="normal"
						label="New Password (leave blank to keep current)"
						type="password"
						value={editData.password}
						onChange={(e) => setEditData({ ...editData, password: e.target.value })}
					/>
					<FormControlLabel
						control={
							<Switch
								checked={editData.is_admin}
								onChange={(e) => setEditData({ ...editData, is_admin: e.target.checked })}
							/>
						}
						label="Admin Access"
					/>
					<FormControlLabel
						control={
							<Switch
								checked={editData.is_active}
								onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
							/>
						}
						label="Active Account"
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOpenEdit(false)}>Cancel</Button>
					<Button onClick={handleUpdateUser} variant="contained">
						Update
					</Button>
				</DialogActions>
			</Dialog>

			{/* Delete User Confirmation Dialog */}
			<Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
				<DialogTitle>Delete User</DialogTitle>
				<DialogContent>
					<Typography>
						Are you sure you want to delete user "{selectedUser?.username}"? This action cannot be undone.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOpenDelete(false)}>Cancel</Button>
					<Button onClick={handleDeleteUser} variant="contained" color="error">
						Delete
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
};

export default Admin;