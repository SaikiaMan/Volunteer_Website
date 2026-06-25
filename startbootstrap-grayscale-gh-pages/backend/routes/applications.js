const express = require('express');
const { applyForEvent, getApplications, getApplicationById, updateApplicationStatus } = require('../controllers/applicationsController');

function createApplicationsRouter({ supabase }) {
    const router = express.Router();

    console.log('Applications router registered');

    router.get('/applications', (req, res) => {
        console.log('GET /applications hit', req.query);
        getApplications(req, res, supabase);
    });

    router.get('/applications/:id', (req, res) => {
        console.log(`GET /applications/${req.params.id} hit`);
        getApplicationById(req, res, supabase);
    });

    router.put('/applications/:id/status', (req, res) => {
        console.log(`PUT /applications/${req.params.id}/status hit`);
        updateApplicationStatus(req, res, supabase);
    });

    router.post('/applications/apply', (req, res) => {
        console.log('POST /applications/apply hit');
        applyForEvent(req, res, supabase);
    });

    return router;
}

module.exports = createApplicationsRouter;
