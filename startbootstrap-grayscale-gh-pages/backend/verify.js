const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function main() {
    try {
        const { data, error } = await supabase.from('Events').select('*');
        if (error) {
            console.error('Error fetching with ANON key:', error);
        } else {
            console.log('ANON key select count:', data.length);
        }

        const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const { data: adminData, error: adminError } = await supabaseAdmin.from('Events').select('*');
        if (adminError) {
            console.error('Error fetching with SERVICE ROLE key:', adminError);
        } else {
            console.log('SERVICE ROLE key select count:', adminData.length);
            console.log('Events retrieved:', JSON.stringify(adminData, null, 2));
        }
    } catch (err) {
        console.error('Exception:', err);
    }
}

main();
