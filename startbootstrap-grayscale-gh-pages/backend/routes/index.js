const express = require('express');
const createPagesRouter = require('./pages');
const createVolunteersRouter = require('./volunteers');
const createEventsRouter = require('./events');
const createApplicationsRouter = require('./applications');

function createApiRouter({ supabase, upload }) {
    const router = express.Router();

    // Health check endpoint
    router.get('/health', (req, res) => {
        res.json({ status: 'ok', message: 'Backend API is running' });
    });

    router.use(createPagesRouter());
    router.use(createVolunteersRouter({ supabase, upload }));
    router.use(createEventsRouter({ supabase, upload }));
    router.use(createApplicationsRouter({ supabase }));

    return router;
}

module.exports = createApiRouter;
