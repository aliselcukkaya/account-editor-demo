import React, { useState, useEffect } from 'react';
import {
	Container,
	Typography,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Card,
	CardHeader,
	CardContent,
	Chip,
	Button,
	Box,
	Alert,
	CircularProgress,
	Tooltip,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
} from '@mui/material';
import {
	Refresh as RefreshIcon,
	CheckCircle as SuccessIcon,
	Error as ErrorIcon,
	Pending as PendingIcon,
	Info as InfoIcon,
	Close as CloseIcon,
} from '@mui/icons-material';
import { automation, Task } from '../services/api';

// Helper function to decode base64 to string
const decodeBase64 = (str: string): string => {
	try {
		// Check if the string is base64 encoded
		if (/^[A-Za-z0-9+/=]+$/.test(str)) {
			return atob(str);
		}
		return str;
	} catch (e) {
		console.error('Failed to decode base64:', e);
		return str;
	}
};

// Helper function to format JSON
const formatJSON = (jsonStr: string): string => {
	try {
		const parsed = JSON.parse(jsonStr);
		return JSON.stringify(parsed, null, 2);
	} catch (e) {
		return jsonStr;
	}
};

const Tasks: React.FC = () => {
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedTask, setSelectedTask] = useState<Task | null>(null);
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [resultText, setResultText] = useState<string>('');

	// Format task name to be more readable
	const formatTaskName = (name: string) => {
		return name
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	};

	// Get status chip based on task status
	const getStatusChip = (status: string) => {
		switch (status.toLowerCase()) {
			case 'completed':
				return <Chip icon={<SuccessIcon />} label="Completed" color="success" size="small" />;
			case 'failed':
				return <Chip icon={<ErrorIcon />} label="Failed" color="error" size="small" />;
			case 'in_progress':
			case 'pending':
				return <Chip icon={<PendingIcon />} label={status === 'in_progress' ? 'In Progress' : 'Pending'} color="warning" size="small" />;
			default:
				return <Chip label={status} size="small" />;
		}
	};

	// Format website name to be more readable
	const formatWebsiteName = (name: string) => {
		// If it's a URL, return it directly
		if (name.includes('http://') || name.includes('https://')) {
			// Extract domain from URL for cleaner display if possible
			try {
				const url = new URL(name);
				return url.hostname; // Will return just the domain (e.g., example.com)
			} catch (e) {
				// If we can't parse the URL, just return the name
				return name;
			}
		}
		
		// If the website name is empty, use a fallback
		if (!name) {
			return "Not specified";
		}
	};

	// Load tasks from the API
	const loadTasks = async () => {
		setLoading(true);
		setError(null);
		try {
			const tasksData = await automation.getTasks();
			setTasks(tasksData);
		} catch (err: any) {
			setError(err.response?.data?.error || 'Failed to load tasks');
			console.error('Failed to load tasks:', err);
		} finally {
			setLoading(false);
		}
	};

	// Process and display result
	const showTaskDetails = (task: Task) => {
		setSelectedTask(task);
		
		let resultStr = task.result || task.Result || '';
		if (resultStr) {
			// Try to decode if it's base64
			resultStr = decodeBase64(resultStr);
			
			// Try to format if it's JSON
			resultStr = formatJSON(resultStr);
			
			// Set the result text
			setResultText(resultStr);
		} else {
			setResultText('No result data available');
		}
		
		setDetailsOpen(true);
	};

	const closeDetails = () => {
		setDetailsOpen(false);
		setSelectedTask(null);
	};

	// Load tasks on component mount
	useEffect(() => {
		loadTasks();
	}, []);

	return (
		<Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
			{error && (
				<Alert severity="error" sx={{ mb: 3 }}>
					{error}
				</Alert>
			)}

			<Card>
				<CardHeader
					title="Task History"
					action={
						<Button
							variant="outlined"
							startIcon={<RefreshIcon />}
							onClick={loadTasks}
							disabled={loading}
						>
							Refresh
						</Button>
					}
				/>
				<CardContent>
					{loading ? (
						<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
							<CircularProgress />
						</Box>
					) : tasks.length > 0 ? (
						<TableContainer component={Paper}>
							<Table>
								<TableHead>
									<TableRow>
										<TableCell>ID</TableCell>
										<TableCell>Task</TableCell>
										<TableCell>Panel URL</TableCell>
										<TableCell>Status</TableCell>
										<TableCell>Created</TableCell>
										<TableCell>Completed</TableCell>
										<TableCell>Details</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{tasks.map((task) => (
										<TableRow key={task.id || task.ID}>
											<TableCell>{task.id || task.ID}</TableCell>
											<TableCell>{formatTaskName(task.name || task.Name || '')}</TableCell>
											<TableCell>
												{formatWebsiteName(task.target_website || task.TargetWebsite || '')}
											</TableCell>
											<TableCell>{getStatusChip(task.status || task.Status || '')}</TableCell>
											<TableCell>
												{new Date(task.created_at || task.CreatedAt || new Date().toISOString()).toLocaleString()}
											</TableCell>
											<TableCell>
												{(task.completed_at || task.CompletedAt) ? 
													new Date(task.completed_at || task.CompletedAt || '').toLocaleString() : 
													'Not completed'
												}
											</TableCell>
											<TableCell>
												<Tooltip title="View Result Details">
													<IconButton 
														size="small" 
														color="primary" 
														onClick={() => showTaskDetails(task)}
													>
														<InfoIcon />
													</IconButton>
												</Tooltip>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					) : (
						<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
							<Typography variant="body1" color="text.secondary">
								No tasks found. Tasks will appear here when you perform automation actions.
							</Typography>
						</Box>
					)}
				</CardContent>
			</Card>

			{/* Task Details Dialog */}
			<Dialog 
				open={detailsOpen} 
				onClose={closeDetails}
				maxWidth="md"
				fullWidth
			>
				<DialogTitle>
					{selectedTask && 
						`${formatTaskName(selectedTask.name || selectedTask.Name || '')} Result`
					}
					<IconButton
						aria-label="close"
						onClick={closeDetails}
						sx={{
							position: 'absolute',
							right: 8,
							top: 8,
						}}
					>
						<CloseIcon />
					</IconButton>
				</DialogTitle>
				<DialogContent dividers>
					<pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
						{resultText}
					</pre>
				</DialogContent>
				<DialogActions>
					<Button onClick={closeDetails}>Close</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
};

export default Tasks; 