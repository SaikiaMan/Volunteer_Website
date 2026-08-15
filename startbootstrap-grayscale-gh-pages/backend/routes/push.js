const express = require('express');
const createPushController = require('../controllers/pushController');

function createPushRouter({ supabase }) {
    const router = express.Router();

    const push = createPushController({ supabase });

    router.get('/push/public-key', (req, res) => {
        res.json({
            success: true,
            publicKey: process.env.VAPID_PUBLIC_KEY
        });
    });

    router.post('/push/subscribe', push.subscribe);

    return router;
}

module.exports = createPushRouter;