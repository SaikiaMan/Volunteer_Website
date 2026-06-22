const express = require('express');
const { getEvents, createEvent, getEventById } = require('../controllers/eventsController');

function createEventsRouter({ supabase }) {
    const router = express.Router();

    console.log('Events router registered');

    router.get('/events/list', (req, res) => {
        console.log('GET /events/list hit');
        getEvents(req, res, supabase);
    });

    router.get('/events/:id', (req, res) => {
        console.log(`GET /events/${req.params.id} hit`);
        getEventById(req, res, supabase);
    });

    router.post('/events/create', (req, res) => {
        console.log('POST /events/create hit');
        createEvent(req, res, supabase);
    });

    return router;
}

module.exports = createEventsRouter;
