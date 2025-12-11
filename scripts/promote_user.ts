
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const promoteToSuperAdmin = async () => {
    const email = 'laconeo@gmail.com';
    const targetDni = '190033385';

    console.log(`Promoting ${email} to SuperAdmin...`);

    // 1. Free up the DNI if it's held by someone else
    const { data: conflict } = await supabase.from('users').select('*').eq('dni', targetDni).neq('email', email);

    if (conflict && conflict.length > 0) {
        console.log('Found DNI conflict, renaming old user DNI...');
        await supabase.from('users')
            .update({ dni: `${targetDni}_old_${Date.now()}` })
            .eq('dni', targetDni);
    }

    // 2. Update the target user
    const { data, error } = await supabase
        .from('users')
        .update({
            role: 'superadmin',
            dni: targetDni,
            status: 'active'
        })
        .eq('email', email)
        .select();

    if (error) {
        console.error('Error promoting user:', error.message);
    } else if (data && data.length > 0) {
        console.log('Success! User promoted:', data[0]);
    } else {
        console.error('User not found with that email.');
    }
};

promoteToSuperAdmin();
