# Account Editor Frontend

This is the frontend application for the Account Editor built with React, TypeScript, and Material-UI.

## Tech Stack

- **React**: UI library
- **TypeScript**: Type-safe JavaScript
- **Material-UI**: Component library for faster UI development
- **Axios**: HTTP client with automatic retries
- **Formik & Yup**: Form validation
- **React Router**: Routing

## Development Setup

### Prerequisites

- Node.js 16 or higher
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/aliselcukkaya/account-editor-demo.git
cd account-editor-demo/frontend
```

2. Install dependencies
```bash
npm install
# or
yarn
```

3. Set up environment variables
Create a `.env` file in the root directory with:
```
VITE_API_URL=http://localhost:8080
```

4. Start the development server
```bash
npm run dev
# or
yarn dev
```

The application will be available at http://localhost:5173/

## Production Deployment

### Building for Production

```bash
npm run build
# or
yarn build
```

This will create optimized production files in the `dist` directory.

### Environment Variables for Production

Create an `.env.production` file with:
```
VITE_API_URL=https://api.yourproductionsite.com
```

### Deploying to Vercel

This project includes a `vercel.json` configuration file for easy deployment to Vercel:

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel
```

### Deploying to Netlify

1. Create a `netlify.toml` file:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

2. Deploy using Netlify CLI or connect your Git repository in the Netlify dashboard.
