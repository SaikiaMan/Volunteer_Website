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

        // Try user_id (UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(cleanedIdentifier)) {
            const { data: byUserId, error: userIdError } = await supabase
                .from('Volunteers')
                .select('*')
                .eq('user_id', cleanedIdentifier)
                .limit(1);

            if (userIdError) {
                console.error('getVolunteerByIdentifier user_id error:', userIdError);
            } else if (Array.isArray(byUserId) && byUserId.length > 0) {
                return byUserId[0];
            }
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

async function isVolunteer(supabase, identifier) {
    const volunteer = await getVolunteerByIdentifier(supabase, identifier);
    if (!volunteer) return false;
    const role = String(volunteer.role || '').toLowerCase();
    return role === 'volunteer';
}

async function applyForEvent(req, res, supabase) {
    try {
        const { event_id: eventId, eventId: bodyEventId, applicant_email, applicant_user_id, applicant_id } = req.body;

        const targetEventId = eventId || bodyEventId;
        const applicantIdentifier = applicant_email || applicant_user_id || applicant_id;

        if (!targetEventId || !applicantIdentifier) {
            return res.status(400).json({
                success: false,
                error: 'event_id and applicant identifier (email/user_id/id) are required'
            });
        }

        const volunteer = await getVolunteerByIdentifier(supabase, applicantIdentifier);

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

        // Check if already applied by volunteer id
        if (volunteer.id) {
            const { data: existingByVolunteerId, error: volunteerIdError } = await supabase
                .from('Applications')
                .select('id')
                .eq('event_id', targetEventId)
                .eq('volunteer_id', volunteer.id)
                .limit(1);

            if (volunteerIdError) {
                console.error('Check existing application by volunteer_id error:', volunteerIdError);
            } else if (Array.isArray(existingByVolunteerId) && existingByVolunteerId.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'You have already applied for this event'
                });
            }
        }

        // Check if already applied by user_id
        if (volunteer.user_id) {
            const { data: existingByUserId, error: userIdError } = await supabase
                .from('Applications')
                .select('id')
                .eq('event_id', targetEventId)
                .eq('user_id', volunteer.user_id)
                .limit(1);

            if (userIdError) {
                console.error('Check existing application by user_id error:', userIdError);
            } else if (Array.isArray(existingByUserId) && existingByUserId.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'You have already applied for this event'
                });
            }
        }

        // Check if already applied by email
        if (volunteer.email) {
            const { data: existingByEmail, error: emailError } = await supabase
                .from('Applications')
                .select('id')
                .eq('event_id', targetEventId)
                .ilike('email', volunteer.email)
                .limit(1);

            if (emailError) {
                console.error('Check existing application by email error:', emailError);
            } else if (Array.isArray(existingByEmail) && existingByEmail.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'You have already applied for this event'
                });
            }
        }

        const applicationData = {
            event_id: Number(targetEventId),
            volunteer_id: volunteer.id || null,
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
            .select('*')
            .order('applied_at', { ascending: false });

        if (eventId) {
            query = query.eq('event_id', eventId);
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

async function getApplicationsByEvent(req, res, supabase) {
    try {
        const { eventId } = req.params;

        const { data, error } = await supabase
            .from('Applications')
            .select('*')
            .eq('event_id', eventId)
            .order('applied_at', { ascending: false });

        if (error) throw error;

        res.json(data || []);
    } catch (err) {
        console.error('getApplicationsByEvent error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

module.exports = {
    applyForEvent,
    getApplications,
    getApplicationsByEvent
};
