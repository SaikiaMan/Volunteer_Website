const express = require('express');
const { getEvents, createEvent, getEventById, uploadEventImage, updateEvent, deleteEvent } = require('../controllers/eventsController');

function createEventsRouter({ supabase, upload }) {
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

    router.post('/events/upload-image', upload.single('imageFile'), (req, res) => {
        console.log('POST /events/upload-image hit');
        uploadEventImage(req, res, supabase);
    });

    router.put('/events/update/:id', (req, res) => {
        console.log(`PUT /events/update/${req.params.id} hit`);
        updateEvent(req, res, supabase);
    });

    router.delete('/events/delete/:id', (req, res) => {
        console.log(`DELETE /events/delete/${req.params.id} hit`);
        deleteEvent(req, res, supabase);
    });

    return router;
}

module.exports = createEventsRouter;
