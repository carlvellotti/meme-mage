import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin'; // Use the admin client

const DEFAULT_LIMIT = 12; // Default number of templates per page

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = request.nextUrl.searchParams;
    const reviewedParam = searchParams.get('reviewed');

    // --- TODO: Security Check - Ensure user is admin/editor ---
    // Example: const { isAdmin, error: authError } = await checkUserPermissions(request);
    // if (authError || !isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    if (reviewedParam === 'false') {
        // --- Fetch ONLY Unreviewed Templates ---
        console.log('Fetching unreviewed templates...');
        const { data, error } = await supabaseAdmin
          .from('meme_templates')
          .select('*') // Select all columns for review
          .neq('reviewed', true) // Filter where reviewed is not TRUE (catches FALSE and NULL)
          .order('created_at', { ascending: true }); // Order oldest first

        if (error) {
          console.error('Error fetching unreviewed templates:', error);
          throw error;
        }

        // Return the array directly, not nested in an object
        const response = NextResponse.json(data || []); 
        // Add headers to prevent caching
        response.headers.set('Cache-Control', 'no-store, max-age=0');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;

    } else {
        // --- Original Logic: Fetch All Templates with Pagination ---
        const pageParam = searchParams.get('page');
        const limitParam = searchParams.get('limit');
        
        const page = pageParam ? parseInt(pageParam, 10) : 1;
        const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT;
        
        if (isNaN(page) || page < 1) {
            return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 });
        }
        if (isNaN(limit) || limit < 1) {
            return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 });
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;
        // --- End Pagination Parameters ---

        console.log(`Fetching all templates: page=${page}, limit=${limit}, range=[${from}-${to}]`);
        
        // --- Fetch Templates for the Page ---
        const { data: templates, error: fetchError } = await supabaseAdmin // Use supabaseAdmin
          .from('meme_templates')
          .select('*') // Selects all columns, including poster_url
          .order('created_at', { ascending: false })
          .range(from, to); // Apply pagination range

        if (fetchError) {
            console.error('Error fetching templates page:', fetchError);
            throw fetchError; // Throw error to be caught by outer catch block
        }
        // --- End Fetch Templates ---
        
        // --- Fetch Total Count --- 
        // We run this separately to get the total count efficiently
        const { count, error: countError } = await supabaseAdmin // Use supabaseAdmin
          .from('meme_templates')
          .select('*' , { count: 'exact', head: true }); // Get only count

        if (countError) {
          console.error('Error fetching template count:', countError);
          // Decide if you want to fail the request or return data without count
          // For robustness, let's return what we have but log the error
          // throw countError; 
        }
        // --- End Fetch Total Count ---

        // Add headers to prevent caching
        const response = NextResponse.json({ 
            templates: templates || [], // Return empty array if data is null
            totalCount: count ?? 0 // Return 0 if count is null
        });
        response.headers.set('Cache-Control', 'no-store, max-age=0');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        
        return response;
    }
  } catch (error) {
    console.error('Error in GET /api/templates:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch templates';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
} 