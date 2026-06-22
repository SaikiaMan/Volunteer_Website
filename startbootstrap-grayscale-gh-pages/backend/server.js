const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');
const createApiRouter = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const localAllowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5500'
];

const productionAllowedOrigins = [
    'https://volunteer-website-mu.vercel.app',
    'https://eventease.in',
    'https://www.eventease.in'
];

const envAllowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
    : [];

const allowedOrigins = Array.from(new Set([
    ...localAllowedOrigins,
    ...productionAllowedOrigins,
    ...envAllowedOrigins
]));

function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (allowedOrigins.includes(origin)) return true;
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
    return /^https:\/\/([a-z0-9-]+\.)?eventease\.in$/i.test(origin);
}

const corsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env file');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is not set; writes may be blocked by RLS');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Debug: Log all registered API requests (must be registered before API routes)
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`API Request: ${req.method} ${req.path}`);
    }
    next();
});

app.use('/api', createApiRouter({ supabase, upload }));

// Catch 404 for debugging
app.use((req, res) => {
    console.log(`404 Not Found: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Route not found', path: req.path, method: req.method });
});

// Start server
app.listen(PORT, HOST, () => {
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
    if (railwayDomain) {
        console.log(`Server running on https://${railwayDomain}`);
    } else {
        console.log(`Server running on http://localhost:${PORT}`);
    }
});
