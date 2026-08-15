const { createClient } = require('@supabase/supabase-js');

function getAuthClient() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    );
}

function createPushController({ supabase }) {
    return {
        async subscribe(req, res) {
            try {
                const authHeader = req.headers.authorization;

                if (!authHeader) {
                    return res.status(401).json({
                        success: false,
                        error: 'No token provided'
                    });
                }

                const token = authHeader.replace('Bearer ', '').trim();

                if (!token) {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid token'
                    });
                }

                const {
                    data: { user },
                    error: authError
                } = await getAuthClient().auth.getUser(token);

                if (authError || !user) {
                    return res.status(401).json({
                        success: false,
                        error: 'Invalid or expired token'
                    });
                }

                const { endpoint, keys } = req.body;

                if (!endpoint || !keys?.p256dh || !keys?.auth) {
                    return res.status(400).json({
                        success: false,
                        error: 'Invalid push subscription'
                    });
                }

                const subscriptionData = {
                    user_id: user.id,
                    endpoint,
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                    updated_at: new Date().toISOString()
                };

                const { data, error } = await supabase
                    .from('push_subscriptions')
                    .upsert(subscriptionData, {
                        onConflict: 'endpoint'
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('Push subscription database error:', error);

                    return res.status(500).json({
                        success: false,
                        error: error.message
                    });
                }

                res.json({
                    success: true,
                    message: 'Push subscription saved',
                    data
                });

            } catch (error) {
                console.error('Push subscription error:', error);

                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    };
}

module.exports = createPushController;