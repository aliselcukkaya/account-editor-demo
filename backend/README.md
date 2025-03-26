# Account Editor API - Backend

This is the Backend of the Account Editor API. It provides endpoints for user authentication and web automation tasks.

## Setup

### Prerequisites

- Go 1.20 or higher
- SQLite

### Development Installation

1. Clone the repository:
```
git clone https://github.com/aliselcukkaya/account-editor-demo.git
cd account-editor-demo/backend
```

2. Install dependencies:
```
go mod tidy
```

3. Build the application:
```
go build -o account-editor ./cmd
```

4. Run the server:
```
./account-editor
```

The server will start on port 8080. Access the API at http://localhost:8080.

### Default Credentials

On first run, a default admin user is created:
- Username: admin
- Password: admin

Use these credentials to log in and create additional users.

## Production Deployment

### Environment Variables

For production deployment, consider setting these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT token generation | "your-secret-key" |
| `DB_PATH` | Path to SQLite database file | "./sql_app.db" |
| `PORT` | HTTP server port | "8080" |

### Docker Deployment

1. Build the Docker image
```bash
docker build -t account-editor-backend .
```

2. Run the container
```bash
docker run -p 8080:8080 \
  -e JWT_SECRET=your_secure_jwt_secret \
  -e DB_PATH=/data/sql_app.db \
  -v /path/to/data:/data \
  account-editor-backend
```

## API Endpoints

### Authentication

- `POST /auth/token` - Login and get a token
- `GET /auth/status` - Get the status of the current user

### Admin Operations

- `POST /admin/users` - Create a new user (admin only)
- `GET /admin/users` - List all users (admin only)
- `PUT /admin/users/:id` - Update a user (admin only)
- `DELETE /admin/users/:id` - Delete a user (admin only)

### Automation

- `POST /automation/tasks` - Create a new automation task
- `GET /automation/tasks` - Get all tasks for the current user
- `GET /automation/tasks/:id` - Get a specific task
- `PUT /automation/settings` - Update automation settings
- `GET /automation/settings` - Get automation settings
