import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin'; // Use the admin client

const DEFAULT_LIMIT = 12; // Default number of templates per page
const DEFAULT_REVIEW_LIMIT = 10; // Limit for unreviewed templates pagination

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
        // --- Fetch ONLY Unreviewed Templates with Pagination ---
        const pageParam = searchParams.get('page');
        const limitParam = searchParams.get('limit');

        const page = pageParam ? parseInt(pageParam, 10) : 1;
        const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_REVIEW_LIMIT;

        if (isNaN(page) || page < 1) {
            return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 });
        }
        if (isNaN(limit) || limit < 1) {
            return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 });
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        console.log(`Fetching unreviewed templates: page=${page}, limit=${limit}, range=[${from}-${to}]`);

        // Fetch templates for the page
        const { data: templates, error: fetchError } = await supabaseAdmin
          .from('meme_templates')
          .select('*')
          .neq('reviewed', true)
          .eq('is_duplicate', false)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (fetchError) {
          console.error('Error fetching unreviewed templates page:', fetchError);
          throw fetchError;
        }

        // Fetch total count of unreviewed templates
        const { count, error: countError } = await supabaseAdmin
            .from('meme_templates')
            .select('*', { count: 'exact', head: true })
            .neq('reviewed', true)
            .eq('is_duplicate', false);

         if (countError) {
            console.error('Error fetching unreviewed template count:', countError);
            // Return data without count if count fails, but log error
         }

        // Return object with templates and total count
        const response = NextResponse.json({ 
            templates: templates || [], 
            totalCount: count ?? 0
        }); 
        response.headers.set('Cache-Control', 'no-store, max-age=0');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;

    } else {
        // --- Original Logic: Fetch All Reviewed Templates with Pagination ---
        // (Keep existing logic for fetching reviewed templates here)
        const pageParam = searchParams.get('page');
        const limitParam = searchParams.get('limit');
        
        const page = pageParam ? parseInt(pageParam, 10) : 1;
        // Use a different default limit if needed for the main browser
        const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LIMIT; 
        
        if (isNaN(page) || page < 1) {
            return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 });
        }
        if (isNaN(limit) || limit < 1) {
            return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 });
        }

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        console.log(`Fetching reviewed templates: page=${page}, limit=${limit}, range=[${from}-${to}]`);
        
        const { data: templates, error: fetchError } = await supabaseAdmin
          .from('meme_templates')
          .select('*')
          .eq('reviewed', true) // Ensure we only fetch reviewed=true here
          .order('created_at', { ascending: false })
          .range(from, to); 

        if (fetchError) {
            console.error('Error fetching reviewed templates page:', fetchError);
            throw fetchError;
        }
        
        const { count, error: countError } = await supabaseAdmin
          .from('meme_templates')
          .select('*' , { count: 'exact', head: true })
          .eq('reviewed', true); // Ensure count is also for reviewed=true

        if (countError) {
          console.error('Error fetching reviewed template count:', countError);
        }

        const response = NextResponse.json({ 
            templates: templates || [], 
            totalCount: count ?? 0 
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