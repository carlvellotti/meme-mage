// scripts/setup-background-videos-bucket.js
// Run with: node --env-file=.env.local scripts/setup-background-videos-bucket.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function setupBackgroundVideosBucket() {
  try {
    console.log('Setting up background-videos storage bucket...');
    
    // Create the background-videos bucket
    const { data, error } = await supabase.storage.createBucket('background-videos', {
      public: true,
      allowedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/avi'],
      fileSizeLimit: 52428800 // 50MB in bytes
    });

    if (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ background-videos bucket already exists');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Created background-videos bucket successfully');
    }

    // List buckets to confirm
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;

    console.log('\n📁 Available storage buckets:');
    buckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });

    console.log('\n🎉 Setup complete! Background videos can now be uploaded.');

  } catch (error) {
    console.error('❌ Error setting up bucket:', error);
    process.exit(1);
  }
}

setupBackgroundVideosBucket(); 