const { createClient } = require('@supabase/supabase-js');

function getAuthClient() {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
}

async function getCurrentVolunteer(supabase, req) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await getAuthClient().auth.getUser(token);

        if (authError || !user) return null;

        const { data: volunteerData, error: volunteerError } = await supabase
            .from('Volunteers')
            .select('*')
            .eq('user_id', user.id)
            .limit(1);

        if (volunteerError || !Array.isArray(volunteerData) || volunteerData.length === 0) return null;

        return volunteerData[0];
    } catch (err) {
        console.error('getCurrentVolunteer error:', err);
        return null;
    }
}

async function getVolunteerByIdentifier(supabase, identifier) {
    if (!identifier) return null;

    try {
        const cleanedIdentifier = String(identifier).trim();

        // Try email
        const { data: byEmail, error: emailError } = await supabase
            .from('Volunteers')
            .select('*')
            .ilike('email', cleanedIdentifier)
            .limit(1);

        if (emailError) {
            console.error('getVolunteerByIdentifier email error:', emailError);
        } else if (Array.isArray(byEmail) && byEmail.length > 0) {
            return byEmail[0];
        }

        // Try numeric id
        const numericId = Number(cleanedIdentifier);
        if (!Number.isNaN(numericId)) {
            const { data: byId, error: idError } = await supabase
                .from('Volunteers')
                .select('*')
                .eq('id', numericId)
                .limit(1);

            if (idError) {
                console.error('getVolunteerByIdentifier id error:', idError);
            } else if (Array.isArray(byId) && byId.length > 0) {
                return byId[0];
            }
        }

        return null;
    } catch (err) {
        console.error('getVolunteerByIdentifier exception:', err);
        return null;
    }
}

async function applyForEvent(req, res, supabase) {
    try {
        const { event_id: eventId, eventId: bodyEventId, volunteer_id: volunteerId, applicant_email, applicant_id } = req.body;
        const targetEventId = eventId || bodyEventId;

        if (!targetEventId) {
            return res.status(400).json({
                success: false,
                error: 'event_id is required'
            });
        }

        let volunteer = null;

        // Prefer explicit volunteer_id from body
        if (volunteerId) {
            volunteer = await getVolunteerByIdentifier(supabase, volunteerId);
        }

        // Fallback to applicant_email or applicant_id
        if (!volunteer) {
            const identifier = applicant_email || applicant_id;
            if (identifier) {
                volunteer = await getVolunteerByIdentifier(supabase, identifier);
            }
        }

        // Fallback to authenticated user
        if (!volunteer) {
            volunteer = await getCurrentVolunteer(supabase, req);
        }

        if (!volunteer) {
            return res.status(404).json({
                success: false,
                error: 'Volunteer profile not found'
            });
        }

        const role = String(volunteer.role || '').toLowerCase();
        if (role !== 'volunteer') {
            return res.status(403).json({
                success: false,
                error: 'Only volunteers can apply for events'
            });
        }

        // Duplicate check: only (event_id + volunteer_id)
        const { data: existing, error: existingError } = await supabase
            .from('Applications')
            .select('id')
            .eq('event_id', Number(targetEventId))
            .eq('volunteer_id', volunteer.id)
            .limit(1);

        if (existingError) {
            console.error('Check existing application error:', existingError);
            throw existingError;
        }

        if (Array.isArray(existing) && existing.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'You have already applied for this event'
            });
        }

        const applicationData = {
            event_id: Number(targetEventId),
            volunteer_id: volunteer.id,
            user_id: volunteer.user_id || null,
            email: volunteer.email || null,
            status: 'pending'
        };

        const { data, error } = await supabase
            .from('Applications')
            .insert([applicationData])
            .select();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            data: data[0]
        });
    } catch (err) {
        console.error('applyForEvent error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function getApplications(req, res, supabase) {
    try {
        const { event_id: eventId, status } = req.query;

        let query = supabase
            .from('Applications')
            .select(`
                *,
                Volunteers (
                    full_name,
                    email,
                    contact,
                    photo_url,
                    description,
                    "past experience",
                    age
                )
            `)
            .order('applied_at', { ascending: false });

        if (eventId && !isNaN(Number(eventId))) {
            query = query.eq('event_id', Number(eventId));
        }

        if (status) {
            query = query.ilike('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data || []);
    } catch (err) {
        console.error('getApplications error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function getApplicationById(req, res, supabase) {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('Applications')
            .select(`
                *,
                Volunteers (
                    full_name,
                    email,
                    contact,
                    photo_url,
                    description,
                    "past experience",
                    age
                ),
                Events (title)
            `)
            .eq('id', id)
            .limit(1);

        if (error) throw error;

        if (!Array.isArray(data) || data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }

        res.json(data[0]);
    } catch (err) {
        console.error('getApplicationById error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function updateApplicationStatus(req, res, supabase) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ['accepted', 'waitlist', 'rejected', 'pending'];
        if (!status || !allowedStatuses.includes(status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Allowed: accepted, waitlist, rejected, pending'
            });
        }

        const normalizedStatus = status.toLowerCase();

        // Only authenticated volunteers/heads can change status
        const currentVolunteer = await getCurrentVolunteer(supabase, req);
        if (!currentVolunteer) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required to update application status'
            });
        }

        // Get the application
        const { data: applicationData, error: applicationError } = await supabase
            .from('Applications')
            .select('*')
            .eq('id', id)
            .limit(1);

        if (applicationError) throw applicationError;

        if (!Array.isArray(applicationData) || applicationData.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Application not found'
            });
        }

        const application = applicationData[0];
        const eventId = application.event_id;

        // Get event limits
        const { data: eventData, error: eventError } = await supabase
            .from('Events')
            .select('volunteer_limit, waitlist_limit')
            .eq('id', eventId)
            .limit(1);

        if (eventError) throw eventError;

        if (!Array.isArray(eventData) || eventData.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Event not found for this application'
            });
        }

        const event = eventData[0];

        // Enforce accepted limit
        if (normalizedStatus === 'accepted') {
            const { count: acceptedCount, error: countError } = await supabase
                .from('Applications')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('status', 'accepted')
                .neq('id', id);

            if (countError) throw countError;

            const volunteerLimit = event.volunteer_limit != null ? Number(event.volunteer_limit) : 0;

            if (volunteerLimit > 0 && acceptedCount >= volunteerLimit) {
                return res.status(400).json({
                    success: false,
                    error: 'Volunteer limit reached.'
                });
            }
        }

        // Enforce waitlist limit
        if (normalizedStatus === 'waitlist') {
            const { count: waitlistCount, error: countError } = await supabase
                .from('Applications')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', eventId)
                .eq('status', 'waitlist')
                .neq('id', id);

            if (countError) throw countError;

            const waitlistLimit = event.waitlist_limit != null ? Number(event.waitlist_limit) : 0;

            if (waitlistLimit > 0 && waitlistCount >= waitlistLimit) {
                return res.status(400).json({
                    success: false,
                    error: 'Waitlist full.'
                });
            }
        }

        const updateData = {
            status: normalizedStatus,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('Applications')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            message: `Application status updated to ${normalizedStatus}`,
            data: data[0]
        });
    } catch (err) {
        console.error('updateApplicationStatus error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

module.exports = {
    applyForEvent,
    getApplications,
    getApplicationById,
    updateApplicationStatus
};
