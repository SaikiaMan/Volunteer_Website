const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    try {
        console.log('Testing select * from users...');
        const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('*')
            .limit(1);
        if (usersError) {
            console.log('users table error:', usersError.message);
        } else {
            console.log('users table data:', usersData);
        }
    } catch (e) {
        console.error(e);
    }
}
main();
