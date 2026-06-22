async function isHeadUser(supabase, identifier) {
    if (!identifier) return false;

    try {
        const cleanedIdentifier = String(identifier).trim();

        // Try matching by email first
        const { data: byEmail, error: emailError } = await supabase
            .from('Volunteers')
            .select('role')
            .ilike('role', 'head')
            .ilike('email', cleanedIdentifier)
            .limit(1);

        if (emailError) {
            console.error('isHeadUser email check error:', emailError);
        } else if (Array.isArray(byEmail) && byEmail.length > 0) {
            return true;
        }

        // Try matching by user_id (UUID) only if identifier looks like a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(cleanedIdentifier)) {
            const { data: byUserId, error: userIdError } = await supabase
                .from('Volunteers')
                .select('role')
                .ilike('role', 'head')
                .eq('user_id', cleanedIdentifier)
                .limit(1);

            if (userIdError) {
                console.error('isHeadUser user_id check error:', userIdError);
            } else if (Array.isArray(byUserId) && byUserId.length > 0) {
                return true;
            }
        }

        // Try matching by numeric id
        const numericId = Number(cleanedIdentifier);
        if (!Number.isNaN(numericId)) {
            const { data: byId, error: idError } = await supabase
                .from('Volunteers')
                .select('role')
                .ilike('role', 'head')
                .eq('id', numericId)
                .limit(1);

            if (idError) {
                console.error('isHeadUser id check error:', idError);
            } else if (Array.isArray(byId) && byId.length > 0) {
                return true;
            }
        }

        return false;
    } catch (err) {
        console.error('isHeadUser exception:', err);
        return false;
    }
}

function normalizeEvent(event) {
    if (!event || typeof event !== 'object') {
        return event;
    }

    // Map database columns to frontend-friendly names while preserving originals.
    return {
        ...event,
        id: event.id,
        title: event.title || 'Untitled Event',
        description: event.description || '',
        location: event.location || 'Location TBD',
        date: event.event_date || event.date || null,
        event_date: event.event_date || event.date || null,
        start_time: event.start_time || null,
        end_time: event.end_time || null,
        salary: event.salary != null ? Number(event.salary) : 0,
        slots: event.volunteer_limit != null ? Number(event.volunteer_limit) : 0,
        volunteer_limit: event.volunteer_limit != null ? Number(event.volunteer_limit) : 0,
        waitlist_limit: event.waitlist_limit != null ? Number(event.waitlist_limit) : 0,
        filledSlots: event.accepted_count != null ? Number(event.accepted_count) : 0,
        accepted_count: event.accepted_count != null ? Number(event.accepted_count) : 0,
        waitlist_count: event.waitlist_count != null ? Number(event.waitlist_count) : 0,
        image: event.image_url || event.image || 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80&auto=format&fit=crop',
        image_url: event.image_url || event.image || 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80&auto=format&fit=crop',
        status: event.status || 'upcoming',
        created_at: event.created_at || null,
        updated_at: event.updated_at || null
    };
}

async function getEvents(req, res, supabase) {
    try {
        const { data, error } = await supabase
            .from('Events')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const events = Array.isArray(data) ? data.map(normalizeEvent) : [];
        res.json(events);
    } catch (err) {
        console.error('getEvents error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function createEvent(req, res, supabase) {
    try {
        const {
            title,
            description,
            location,
            event_date,
            date,
            start_time,
            end_time,
            salary,
            volunteer_limit,
            slots,
            waitlist_limit,
            accepted_count,
            filledSlots,
            waitlist_count,
            status,
            image_url,
            image,
            created_by_email,
            created_by_user_id,
            created_by
        } = req.body;

        // Validation
        if (!title || !location || !(event_date || date)) {
            return res.status(400).json({
                success: false,
                error: 'Title, location, and event_date are required'
            });
        }

        // Authorization: only Head users can create events
        const headIdentifier = created_by_email || created_by_user_id || created_by;
        const isHead = await isHeadUser(supabase, headIdentifier);

        if (!isHead) {
            return res.status(403).json({
                success: false,
                error: 'Only Head users can create events'
            });
        }

        const eventData = {
            title,
            description: description || '',
            location,
            event_date: event_date || date,
            start_time: start_time || null,
            end_time: end_time || null,
            salary: salary != null ? Number(salary) : 0,
            volunteer_limit: volunteer_limit != null ? Number(volunteer_limit) : (slots != null ? Number(slots) : 0),
            waitlist_limit: waitlist_limit != null ? Number(waitlist_limit) : 0,
            accepted_count: accepted_count != null ? Number(accepted_count) : (filledSlots != null ? Number(filledSlots) : 0),
            waitlist_count: waitlist_count != null ? Number(waitlist_count) : 0,
            status: status || 'upcoming',
            image_url: image_url || image || 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&q=80&auto=format&fit=crop'
        };

        const { data, error } = await supabase
            .from('Events')
            .insert([eventData])
            .select();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: normalizeEvent(data[0])
        });
    } catch (err) {
        console.error('createEvent error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

async function getEventById(req, res, supabase) {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('Events')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'Event not found'
            });
        }

        res.json({
            success: true,
            data: normalizeEvent(data)
        });
    } catch (err) {
        console.error('getEventById error:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
}

module.exports = {
    getEvents,
    createEvent,
    getEventById
};
