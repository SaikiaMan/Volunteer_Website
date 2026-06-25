const express = require('express');
const createVolunteersController = require('../controllers/volunteersController');

function createVolunteersRouter({ supabase, upload }) {
    const router = express.Router();
    const volunteers = createVolunteersController({ supabase });

    router.post('/volunteers/signup', upload.single('photoUpload'), volunteers.signup);
    router.get('/volunteers/me', volunteers.me);
    router.post('/volunteers/create-profile', volunteers.createProfile);
    router.post('/volunteers/login', volunteers.login);
    router.post('/volunteers/check-email', volunteers.checkEmail);
    router.get('/volunteers/applications', volunteers.getMyApplications);
    router.put('/volunteers/update', upload.single('photoUpload'), volunteers.update);

    return router;
}

module.exports = createVolunteersRouter;
