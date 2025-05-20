import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // Load environment variables from .env.local file

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is not defined in environment variables.');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

const analyzeExampleMarker = '**Analyze Provided Example:**';
const captionRegex = /\*\*Caption:\*\*\s*"(.*?)"/sm; 

interface MemeTemplate {
  id: string;
  instructions: string | null;
  scraped_example_caption: string | null;
}

async function backfillCaptions() {
  console.log('Starting backfill process for scraped_example_caption...');

  let errorCount = 0;
  let successCount = 0;
  let processedCount = 0;
  const batchSize = 100; // Process in batches to avoid overloading
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching batch starting at offset ${offset}...`);
    const { data: templates, error: fetchError } = await supabase
      .from('meme_templates')
      .select('id, instructions, scraped_example_caption')
      .is('scraped_example_caption', null) // Only fetch rows where it's NULL
      // You could add more filters, e.g., .not('instructions', 'is', null)
      .range(offset, offset + batchSize - 1);

    if (fetchError) {
      console.error('Error fetching templates:', fetchError);
      errorCount++;
      break; // Stop if there's a major fetch error
    }

    if (!templates || templates.length === 0) {
      console.log('No more templates to process or initial fetch empty.');
      hasMore = false;
      break;
    }

    console.log(`Processing ${templates.length} templates in this batch...`);

    for (const template of templates as MemeTemplate[]) {
      processedCount++;
      if (!template.instructions) {
        console.log(`Template ID ${template.id} has no instructions, skipping.`);
        continue;
      }

      let parsedCaption: string | null = null;
      const instructionsText = template.instructions;
      
      const analyzeExampleIndex = instructionsText.indexOf(analyzeExampleMarker);

      if (analyzeExampleIndex !== -1) {
        const relevantInstructionsSubstring = instructionsText.substring(analyzeExampleIndex);
        console.log(`Template ID ${template.id}: Marker found. Substring start: "${relevantInstructionsSubstring.substring(0,100)}..."`); 
        const match = relevantInstructionsSubstring.match(captionRegex);
        console.log(`Template ID ${template.id}: Match result on substring:`, match); 

        if (match && match[1]) {
          parsedCaption = match[1].trim();
        }
      }

      if (parsedCaption) {
        // console.log(`Template ID ${template.id}: Found caption: "${parsedCaption.substring(0, 50)}..."`);
        const { error: updateError } = await supabase
          .from('meme_templates')
          .update({ scraped_example_caption: parsedCaption })
          .eq('id', template.id);

        if (updateError) {
          console.error(`Failed to update template ID ${template.id}:`, updateError);
          errorCount++;
        } else {
          // console.log(`Successfully updated template ID ${template.id}`);
          successCount++;
        }
      } else {
        // Log details if instructions exist but no caption was parsed
        if (template.instructions) { 
          console.log(`Template ID ${template.id}: No caption parsed. Index of marker: ${analyzeExampleIndex}. Instructions start: "${template.instructions.substring(0, 150)}..."`);
        }
      }
    }
    offset += templates.length;
    if (templates.length < batchSize) {
        hasMore = false; // Last batch was smaller than batchSize
    }
  }

  console.log('\n--- Backfill Summary ---');
  console.log(`Total templates checked (where scraped_example_caption was NULL): ${processedCount}`);
  console.log(`Successfully updated with parsed caption: ${successCount}`);
  console.log(`Errors encountered during updates/fetches: ${errorCount}`);
  console.log('Backfill process complete.');
}

backfillCaptions().catch(err => {
  console.error('Unhandled error during backfill script execution:', err);
  process.exit(1);
}); 