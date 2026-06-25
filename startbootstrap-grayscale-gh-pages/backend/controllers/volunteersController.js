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

function createVolunteersController({ supabase }) {
    return {
        async signup(req, res) {
            try {
                const {
                    fullName,
                    age,
                    email,
                    password,
                    phone,
                    experience,
                    description
                } = req.body;

                // Validate required fields
                if (!fullName || !email || !password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Full name, email, and password are required'
                    });
                }

                let photoUrl = null;

                // Handle photo upload if provided
                if (req.file) {
                    try {
                        const fileName = `volunteers/${Date.now()}_${req.file.originalname}`;

                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('volunteer_photos')
                            .upload(fileName, req.file.buffer, {
                                contentType: req.file.mimetype
                            });

                        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

                        // Get the public URL
                        const { data: publicData } = supabase.storage
                            .from('volunteer_photos')
                            .getPublicUrl(fileName);

                        photoUrl = publicData.publicUrl;
                    } catch (error) {
                        console.error('Photo upload error:', error);
                        // Continue without photo if upload fails
                    }
                }

                // Supabase signUp with user_metadata
                // If email confirmation is enabled in Supabase, this will NOT return a session
                const { data: authData, error: authError } = await getAuthClient().auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            age: parseInt(age) || null,
                            contact: phone || null,
                            'past experience': experience || null,
                            description: description || null,
                            photo_url: photoUrl,
                            role: 'volunteer'
                        }
                    }
                });

                if (authError) {
                    const msg = authError.message.toLowerCase();
                    
                    // If user exists, check if they are verified
                    if (msg.includes('already registered') || msg.includes('already been taken') || msg.includes('email already exists')) {
                        try {
                            // Try to sign in with dummy password to see if confirmation is the issue
                            const { error: signInError } = await supabase.auth.signInWithPassword({
                                email,
                                password: 'dummy-password-check'
                            });
                            
                            if (signInError && signInError.message.toLowerCase().includes('email not confirmed')) {
                                return res.status(400).json({
                                    success: false,
                                    error: 'EMAIL NOT VERIFIED'
                                });
                            }
                        } catch (e) {
                            console.error('Verification check failed:', e);
                        }
                        
                        return res.status(400).json({
                            success: false,
                            error: 'EMAIL NOT VERIFIED'
                        });
                    }

                    return res.status(400).json({
                        success: false,
                        error: authError.message
                    });
                }

                // Do NOT create the profile in the Volunteers table yet.
                // It will be created during the first successful login after email verification.

                res.json({
                    success: true,
                    message: 'Signup successful! Please check your email to verify your account before logging in.',
                    needsVerification: true
                });

            } catch (error) {
                console.error('Error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        },

        async login(req, res) {
            try {
                const { email, password } = req.body;

                if (!email || !password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Email and password are required'
                    });
                }

                const { data: authData, error: authError } = await getAuthClient().auth.signInWithPassword({
                    email,
                    password
                });

                if (authError) {
                    if (authError.message.toLowerCase().includes('email not confirmed') || authError.status === 400) {
                        return res.status(401).json({
                            success: false,
                            error: 'EMAIL NOT VERIFIED'
                        });
                    }
                    
                    return res.status(401).json({
                        success: false,
                        error: authError.message
                    });
                }

                // Check if volunteer profile exists
                let { data: volunteerData, error: volunteerError } = await supabase
                    .from('Volunteers')
                    .select('*')
                    .eq('user_id', authData.user.id)
                    .single();

                // FALLBACK: If user is verified but profile is missing, create it now!
                if (!volunteerData) {
                    console.log(`Backend: Verified user ${authData.user.email} logged in but profile was missing. Creating now...`);
                    const metadata = authData.user.user_metadata || {};
                    const formData = {
                        user_id: authData.user.id,
                        full_name: metadata.full_name || metadata.fullName || 'Volunteer',
                        age: metadata.age || null,
                        email: authData.user.email,
                        contact: metadata.contact || metadata.phone || null,
                        'past experience': metadata['past experience'] || metadata.experience || null,
                        description: metadata.description || null,
                        photo_url: metadata.photo_url || metadata.photoUrl || null,
                        submitted_at: new Date().toISOString(),
                        role: metadata.role || 'volunteer',
                        approval_status: 'pending'
                    };

                    const { data: inserted, error: insertError } = await supabase
                        .from('Volunteers')
                        .insert([formData])
                        .select();

                    if (!insertError) {
                        volunteerData = inserted[0];
                    } else {
                        console.error('Backend: Fallback profile creation failed:', insertError);
                    }
                }

                if (!volunteerData) {
                    return res.status(404).json({
                        success: false,
                        error: 'Volunteer profile not found. Please try refreshing or contact support.'
                    });
                }

                res.json({
                    success: true,
                    message: 'Login successful',
                    session: authData.session,
                    user: volunteerData
                });

            } catch (error) {
                console.error('Login error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        },

        async me(req, res) {
            try {
                const authHeader = req.headers.authorization;
                if (!authHeader) {
                    return res.status(401).json({ success: false, error: 'No token provided' });
                }

                const token = authHeader.replace('Bearer ', '');
                const { data: { user }, error: authError } = await getAuthClient().auth.getUser(token);

                if (authError || !user) {
                    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
                }

                // Check for profile
                let { data: volunteerData, error: volunteerError } = await supabase
                    .from('Volunteers')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (volunteerError || !volunteerData) {
                    return res.status(404).json({ success: false, error: 'Profile not found' });
                }

                res.json({
                    success: true,
                    user: volunteerData
                });

            } catch (error) {
                console.error('Me error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        },

        async createProfile(req, res) {
            try {
                const authHeader = req.headers.authorization;
                if (!authHeader) {
                    console.error('Profile Creation Error: No Authorization header');
                    return res.status(401).json({ success: false, error: 'No token provided' });
                }

                const token = authHeader.replace('Bearer ', '');
                const { data: { user }, error: authError } = await getAuthClient().auth.getUser(token);

                if (authError || !user) {
                    console.error('Profile Creation Error: Invalid token', authError);
                    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
                }

                console.log(`Backend: Attempting to create profile for verified user: ${user.email}`);

                // Check if profile already exists - Use .limit(1) to avoid .single() error when missing
                const { data: existing, error: checkError } = await supabase
                    .from('Volunteers')
                    .select('id')
                    .eq('user_id', user.id)
                    .limit(1);

                if (existing && existing.length > 0) {
                    console.log(`Backend: Profile already exists for ${user.email}, skipping creation.`);
                    return res.json({ success: true, user: existing[0], message: 'Profile already exists' });
                }

                const metadata = user.user_metadata || {};
                console.log('Backend: Extracted Metadata:', JSON.stringify(metadata));

                const formData = {
                    user_id: user.id,
                    full_name: metadata.full_name || metadata.fullName || 'Volunteer',
                    age: metadata.age || null,
                    email: user.email,
                    contact: metadata.contact || metadata.phone || null,
                    'past experience': metadata['past experience'] || metadata.experience || null,
                    description: metadata.description || null,
                    photo_url: metadata.photo_url || metadata.photoUrl || null,
                    submitted_at: new Date().toISOString(),
                    role: metadata.role || 'volunteer',
                    approval_status: 'pending'
                };

                console.log('Backend: DEBUG - Final Profile Data to be inserted:');
                console.log(JSON.stringify(formData, null, 2));

                console.log('Backend: Inserting into Volunteers table...');
                const { data: inserted, error: insertError } = await supabase
                    .from('Volunteers')
                    .insert([formData])
                    .select();

                if (insertError) {
                    console.error('Backend: Profile insertion failed!', insertError);
                    return res.status(500).json({ success: false, error: insertError.message });
                }

                console.log(`Backend: Profile SUCCESSFULLY created for ${user.email}`);
                res.json({ success: true, user: inserted[0] });
            } catch (error) {
                console.error('Backend: Unexpected createProfile error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        },

        async checkEmail(req, res) {
            try {
                const { email } = req.body;
                if (!email) {
                    return res.status(400).json({ success: false, error: 'Email is required' });
                }

                const cleanedEmail = String(email || '').trim();
                console.log('Checking email existence for:', cleanedEmail);

                // Check Volunteers table (profile)
                let profileExists = false;
                let profileRow = null;
                try {
                    const { data: vdata, error: verror } = await supabase
                        .from('Volunteers')
                        .select('*')
                        .ilike('email', cleanedEmail)
                        .limit(1);
                    if (!verror && Array.isArray(vdata) && vdata.length > 0) {
                        profileExists = true;
                        profileRow = vdata[0];
                    }
                } catch (e) {
                    console.error('Volunteers table check failed:', e);
                }

                // Check Auth user existence if admin API available
                let authExists = false;
                try {
                    if (supabase.auth && supabase.auth.admin && typeof supabase.auth.admin.getUserByEmail === 'function') {
                        const { data: authUser, error: authErr } = await supabase.auth.admin.getUserByEmail(cleanedEmail);
                        if (!authErr && authUser) authExists = true;
                    }
                } catch (e) {
                    console.error('Auth user check failed (non-fatal):', e && e.message ? e.message : e);
                }

                return res.json({ success: true, profileExists, authExists, user: profileRow });
            } catch (error) {
                console.error('Check email error:', error);
                return res.status(500).json({ success: false, error: error.message });
            }
        },

        async getMyApplications(req, res) {
            try {
                const volunteer = await getCurrentVolunteer(supabase, req);
                if (!volunteer) {
                    return res.status(401).json({ success: false, error: 'Authentication required' });
                }

                const { data, error } = await supabase
                    .from('Applications')
                    .select(`
                        status,
                        Events (title)
                    `)
                    .eq('volunteer_id', volunteer.id)
                    .order('applied_at', { ascending: false });

                if (error) throw error;

                const result = (data || []).map(app => ({
                    event: app.Events?.title || 'Unknown Event',
                    status: app.status
                }));

                res.json(result);
            } catch (error) {
                console.error('getMyApplications error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        },

        async update(req, res) {
            try {
                // Log what we received
                console.log('Raw request body:', JSON.stringify(req.body));
                console.log('Available fields:', Object.keys(req.body));

                const { volunteerId, email, fullName, age, phone, experience, description, photoUrl } = req.body;

                console.log('Extracted volunteerId:', volunteerId);
                console.log('Extracted email:', email);
                console.log('Extracted fullName:', fullName);

                // Convert volunteerId to integer if provided
                const idToFind = volunteerId ? (parseInt(volunteerId) || volunteerId) : null;
                console.log('Looking up volunteer with ID:', idToFind, 'Type:', typeof idToFind);

                // Handle photo upload if provided
                let updatedPhotoUrl = photoUrl;
                if (req.file) {
                    try {
                        const fileName = `volunteers/${Date.now()}_${req.file.originalname}`;

                        const { data, error: uploadError } = await supabase.storage
                            .from('volunteer_photos')
                            .upload(fileName, req.file.buffer, {
                                contentType: req.file.mimetype
                            });

                        if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

                        // Get the public URL
                        const { data: publicData } = supabase.storage
                            .from('volunteer_photos')
                            .getPublicUrl(fileName);

                        updatedPhotoUrl = publicData.publicUrl;
                    } catch (error) {
                        console.error('Photo upload error:', error);
                    }
                }

                // Prepare update data
                const updateData = {
                    full_name: fullName || undefined,
                    age: age ? parseInt(age) : undefined,
                    contact: phone || undefined,
                    'past experience': experience || undefined,
                    description: description || undefined
                };

                // Update email if provided
                if (email) {
                    updateData.email = email;
                }

                // Only add photo URL if it was updated
                if (updatedPhotoUrl) {
                    updateData.photo_url = updatedPhotoUrl;
                }

                // Remove undefined values
                Object.keys(updateData).forEach(key => 
                    updateData[key] === undefined && delete updateData[key]
                );

                // If an ID is provided, try update by ID first
                if (idToFind) {
                    console.log('Attempting update with ID:', idToFind);
                    let { data, error } = await supabase
                        .from('Volunteers')
                        .update(updateData)
                        .eq('id', idToFind)
                        .select();

                    console.log('Primary update response - Error:', error);
                    console.log('Primary update response - Data:', data);

                    if (error) {
                        console.error('Database error:', error);
                        throw new Error(`Database error: ${error.message}`);
                    }

                    if (data && data.length > 0) {
                        console.log('Successfully updated volunteer by ID:', data[0]);
                        return res.json({ success: true, message: 'Profile updated successfully', data: data[0] });
                    }

                    console.warn('No volunteer found by ID; will attempt fallback by email if provided');
                }

                // If email provided, attempt update by email
                if (email) {
                    console.log('Attempting fallback update by email:', email);
                    const fallbackResult = await supabase
                        .from('Volunteers')
                        .update(updateData)
                        .ilike('email', String(email).trim())
                        .select();

                    console.log('Fallback update response - Error:', fallbackResult.error);
                    console.log('Fallback update response - Data:', fallbackResult.data);

                    if (fallbackResult.error) {
                        console.error('Fallback database error:', fallbackResult.error);
                        throw new Error(`Database error: ${fallbackResult.error.message}`);
                    }

                    if (fallbackResult.data && fallbackResult.data.length > 0) {
                        console.log('Fallback update succeeded:', fallbackResult.data[0]);
                        return res.json({ success: true, message: 'Profile updated successfully', data: fallbackResult.data[0] });
                    }

                    console.error('No volunteer found with email:', email);
                    return res.status(404).json({ success: false, error: `No volunteer found with email: ${email}` });
                }

                // If neither ID nor email matched anything, return an error
                console.error('No volunteer found: no matching ID or email provided');
                return res.status(404).json({ success: false, error: 'No volunteer found with provided ID or email' });

            } catch (error) {
                console.error('Error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        }
    };
}

module.exports = createVolunteersController;
