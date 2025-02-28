import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getMemeSystemPrompt } from '@/lib/utils/prompts';

// Add interface at the top of the file
interface TemplateDetail {
  number: number;
  name: string;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: Request) {
  try {
    // Add more detailed API key checking
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY is missing in environment');
      return new Response(
        JSON.stringify({ 
          error: 'ANTHROPIC_API_KEY is not configured',
          details: 'Please check environment variables configuration'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Test API key format
    if (!process.env.ANTHROPIC_API_KEY.startsWith('sk-')) {
      console.error('ANTHROPIC_API_KEY appears to be invalid');
      return new Response(
        JSON.stringify({ 
          error: 'Invalid API key format',
          details: 'The API key does not match the expected format'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { messages, model = 'claude-3-7-sonnet-20250219' } = await req.json();
    
    // Map frontend model IDs to the correct Anthropic model IDs
    const modelMap: Record<string, string> = {
      'claude-3-5-sonnet-20240620': 'claude-3-5-sonnet-20241022', // Update to the correct model ID
      'claude-3-7-sonnet-20250219': 'claude-3-7-sonnet-20250219'
    };
    
    // Use the mapped model ID or fallback to the provided model
    const anthropicModel = modelMap[model] || model;
    
    const lastMessage = messages[messages.length - 1];
    const audience = lastMessage.audience || 'general audience';

    const systemPrompt = getMemeSystemPrompt(audience);

    // Extract template numbers and names for debugging
    const templateMatches = lastMessage.content.match(/(\d+)\.\s+([^\n]+)/g);
    const templateDetails = templateMatches?.map((match: string) => {
      const matchResult = match.match(/(\d+)\.\s+(.+)/);
      const [_, number, name] = matchResult || ['', '', ''];
      return { number: parseInt(number || '0'), name: name || '' };
    });

    // Define the tool for Claude to use
    const tools = [
      {
        name: "generate_template_response",
        description: "Generate a properly formatted template selection with captions",
        input_schema: {
          type: "object" as const,
          properties: {
            template1_number: {
              type: "integer" as const,
              description: "The number of the first selected template (must match a template number from the provided list)"
            },
            template1_captions: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "Array of exactly three captions for the first template"
            },
            template2_number: {
              type: "integer" as const,
              description: "The number of the second selected template (must match a template number from the provided list)"
            },
            template2_captions: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "Array of exactly three captions for the second template"
            }
          },
          required: ["template1_number", "template1_captions", "template2_number", "template2_captions"]
        }
      }
    ];

    console.log('=== DEBUG: Attempting Tool-Based Template Selection ===');
    console.log('Using system prompt:', systemPrompt.substring(0, 100) + '...');
    console.log('Using model:', anthropicModel); // Log the actual model being used

    // Get a tool-using response with multiple captions
    const toolResponse = await anthropic.messages.create({
      model: anthropicModel, // Use the mapped model ID
      messages: [{
        role: 'user',
        content: `Given these templates:
${lastMessage.content}

Select TWO best templates that would work well for this meme concept and write THREE different captions for each template. Use the generate_template_response tool to structure your response.`
      }],
      stream: false,
      max_tokens: 1024,
      temperature: 0.7,
      system: systemPrompt,
      tools
    });

    console.log('=== DEBUG: Template Selection with Tool Use ===');
    console.log('Response content types:', toolResponse.content.map(item => item.type));
    
    // Extract the tool use from the response
    const toolCalls = toolResponse.content
      .filter(item => item.type === 'tool_use')
      .map(item => item.type === 'tool_use' ? item : null)
      .filter(Boolean);
    
    console.log('Tool calls found:', toolCalls.length);
    
    if (toolCalls.length === 0) {
      // Log the full response to see what we got instead of tool calls
      console.error('No tool calls found in response. Full response content:', 
        toolResponse.content.map(item => {
          if (item.type === 'text') {
            return { type: 'text', text: item.text.substring(0, 100) + '...' };
          }
          return { type: item.type };
        })
      );
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to generate template selection',
          details: 'No tool calls found in response'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const toolCall = toolCalls[0];
    if (toolCall?.type !== 'tool_use') {
      console.error('Invalid tool call type');
      return new Response(
        JSON.stringify({ 
          error: 'Failed to generate template selection',
          details: 'Invalid tool call type'
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Define the expected input structure
    interface ToolInput {
      template1_number: number;
      template1_captions: string[];
      template2_number: number;
      template2_captions: string[];
    }
    
    const input = toolCall.input as ToolInput;
    console.log('Tool call input:', input);
    
    // Format the results
    const results = [
      {
        template: input.template1_number,
        captions: input.template1_captions
      },
      {
        template: input.template2_number,
        captions: input.template2_captions
      }
    ];

    console.log('Final results:', results);

    return new Response(JSON.stringify({
      templates: results
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // Enhanced error logging
    console.error('Anthropic API error details:', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      apiKeyExists: !!process.env.ANTHROPIC_API_KEY,
      apiKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0
    });

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        details: 'Check server logs for more information'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 