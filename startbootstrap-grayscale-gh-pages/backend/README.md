# Backend API - Volunteer Management System

This backend handles all Supabase database operations for the volunteer management system.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Verify `.env` file** has your Supabase credentials:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (recommended for writes; otherwise RLS may block inserts)
   - `PORT` (defaults to 3001)

3. **Create the Events table in Supabase** by running:
   ```bash
   # Open backend/schema/events.sql in the Supabase SQL Editor and run it.
   ```

4. **Start the backend server:**
   ```bash
   npm start
   ```

   The server will run on `http://localhost:3001`

  CORS allows Vercel preview deployments; update the allowlist in `server.js` if needed.

## API Endpoints

### Health

#### GET `/api/health`
Health check endpoint.

```json
{
  "status": "ok",
  "message": "Backend API is running"
}
```

### Volunteers

#### POST `/api/volunteers/signup`
Submit a new volunteer registration with optional photo upload.

**Form Data:**
- `fullName` (required)
- `age`
- `email` (required)
- `password` (required)
- `phone`
- `experience`
- `description`
- `photoUpload` (file - optional)

**Response:**
```json
{
  "success": true,
  "message": "Volunteer signup successful",
  "user": { ... },
  "session": { ... }
}
```

#### POST `/api/volunteers/login`
Login a volunteer by email and password.

**Request Body:**
```json
{
  "email": "volunteer@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "session": { ... },
  "user": { ... }
}
```

#### POST `/api/volunteers/check-email`
Check whether a volunteer profile or auth user exists for an email.

**Request Body:**
```json
{
  "email": "volunteer@example.com"
}
```

#### POST `/api/volunteers/complete-profile`
Create a volunteer profile for an existing auth user.

#### PUT `/api/volunteers/update`
Update an existing volunteer profile.

### Events

#### GET `/api/events/list`
List all events, newest first.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Music Festival 2026",
    "description": "Stage setup and crowd management",
    "location": "Ludhiana",
    "event_date": "2026-07-15",
    "start_time": "10:00:00",
    "end_time": "18:00:00",
    "salary": 500,
    "volunteer_limit": 30,
    "waitlist_limit": 0,
    "accepted_count": 0,
    "waitlist_count": 0,
    "status": "upcoming",
    "image_url": "https://...",
    "created_at": "2026-06-22T06:05:08.640283+00:00",
    "updated_at": "2026-06-22T06:05:08.640283+00:00",
    "date": "2026-07-15",
    "slots": 30,
    "filledSlots": 0,
    "image": "https://..."
  }
]
```

#### GET `/api/events/:id`
Get a single event by ID.

#### POST `/api/events/create`
Create a new event.

**Request Body:**
```json
{
  "title": "Music Festival 2026",
  "description": "Stage setup and crowd management",
  "location": "Ludhiana",
  "event_date": "2026-07-15",
  "start_time": "10:00",
  "end_time": "18:00",
  "salary": 500,
  "volunteer_limit": 30,
  "waitlist_limit": 0,
  "status": "upcoming",
  "image_url": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

## Frontend Integration

The frontend at `../frontend/` calls these API endpoints from:
- `js/index.js` - landing page signup/login
- `app.html` inline script - events listing and volunteer dashboard
- `js/app.js` - legacy app logic (kept for compatibility)

Make sure the backend is running before using the frontend.

## Database

All data is stored in Supabase:
- **Table:** `Volunteers`
- **Table:** `Events`
- **Storage:** `volunteer_photos` (for photo uploads)

See `schema/events.sql` for the Events table definition.
