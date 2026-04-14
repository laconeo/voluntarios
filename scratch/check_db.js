
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Fetching events...');
    const { data: events, error: eError } = await supabase.from('events').select('id, nombre, slug').limit(5);
    if (eError) {
        console.error('Error fetching events:', eError);
        return;
    }
    
    if (events && events.length > 0) {
        const eventId = events[0].id; // event_1772583889355
        console.log('Checking bits for event:', events[0].nombre, eventId);
        
        const { count: pcCount, error: pcE } = await supabase.from('bitacora_uso').select('*', { count: 'exact', head: true }).eq('evento_id', eventId);
        console.log('PC sessions for this event:', pcCount);

        const { count: expCount, error: expE } = await supabase.from('experience_logs').select('*', { count: 'exact', head: true }).eq('evento_id', eventId);
        console.log('Experience logs for this event:', expCount);

        // Test RPC
        console.log('Testing RPC get_stand_metrics_summary with TEXT...');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_stand_metrics_summary', {
            p_event_id: eventId,
            p_since: null
        });
        
        if (rpcError) {
            console.error('RPC Error:', rpcError);
        } else {
            console.log('RPC Data:', rpcData);
        }
    }
}

checkData();
