
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

const createSuperAdmin = async () => {
    const email = 'laconeo@gmail.com';
    const password = 'SuperAdmin2026!';
    const dni = '190033385';

    console.log(`Creating SuperAdmin... Email: ${email}`);

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) {
        console.error('Auth Error:', authError.message);
        // If user already exists, try to get ID? We can't easily via Anon key unless we sign in.
        // Let's try signing in.
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (loginError) {
            console.error('Could not create or login:', loginError.message);
            return;
        }

        console.log('User already exists, logged in to update profile.');
        if (loginData.user) {
            await upsertProfile(loginData.user.id, email, dni);
        }
        return;
    }

    if (authData.user) {
        console.log('Auth User Created:', authData.user.id);
        await upsertProfile(authData.user.id, email, dni);
    }
};

const upsertProfile = async (id: string, email: string, dni: string) => {
    const { error } = await supabase.from('users').upsert({
        id: id,
        dni: dni,
        email: email,
        full_name: 'Super Administrador',
        role: 'superadmin',
        status: 'active'
    });

    if (error) {
        console.error('Profile Error:', error.message);
    } else {
        console.log('SuperAdmin Profile created successfully!');
    }
};

createSuperAdmin();
