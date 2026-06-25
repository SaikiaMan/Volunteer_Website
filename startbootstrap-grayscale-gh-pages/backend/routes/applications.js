const express = require('express');
const { applyForEvent, getApplications, getApplicationsByEvent } = require('../controllers/applicationsController');

function createApplicationsRouter({ supabase }) {
    const router = express.Router();

    console.log('Applications router registered');

    router.get('/applications/list', (req, res) => {
        console.log('GET /applications/list hit');
        getApplications(req, res, supabase);
    });

    router.get('/applications/event/:eventId', (req, res) => {
        console.log(`GET /applications/event/${req.params.eventId} hit`);
        getApplicationsByEvent(req, res, supabase);
    });

    router.post('/applications/apply', (req, res) => {
        console.log('POST /applications/apply hit');
        applyForEvent(req, res, supabase);
    });

    return router;
}

module.exports = createApplicationsRouter;
