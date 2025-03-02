import { NextResponse } from 'next/server';
import { getTemplateAnalysisPrompt } from '@/lib/utils/prompts';
import { AnthropicStream, StreamingTextResponse } from 'ai';

// Types for the request body
interface RequestBody {
  description: string;
  images: string[]; // Base64 encoded images
}

// Define types for Claude API
interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

type MessageContent = TextContent | ImageContent;

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { description, images } = (await req.json()) as RequestBody;
    console.log(`API: Received enhancement request with ${images.length} images`);
    console.log(`API: Description preview: ${description.substring(0, 50)}...`);

    // Construct the prompt with the description
    const systemPrompt = getTemplateAnalysisPrompt();
    
    // Format the user message text part
    const textContent = `Here is a meme template to analyze:

Description provided:
${description}

${images.length > 0 ? `I'm also providing ${images.length} example images of this template.` : 'No example images provided.'}`;

    // Prepare message content with text and images
    const messageContent: MessageContent[] = [
      { type: 'text', text: textContent }
    ];
    
    // Add image content if available
    if (images && images.length > 0) {
      console.log(`API: Processing ${images.length} images for Claude`);
      images.forEach((imageData, index) => {
        // Check if the image data is a base64 string
        if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
          try {
            // Extract media type and base64 content
            const [mediaTypePart, base64Content] = imageData.split(',');
            // Extract media type from the mediaTypePart (e.g. 'data:image/jpeg;base64' -> 'image/jpeg')
            const mediaType = mediaTypePart.split(':')[1].split(';')[0];
            
            console.log(`API: Added image ${index + 1} with type ${mediaType}`);
            
            // Add to message content
            messageContent.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Content
              }
            } as ImageContent);
          } catch (error) {
            console.error(`Error processing image ${index}:`, error);
          }
        }
      });
    }

    console.log('API: Sending request to Claude API');
    
    // Temporary non-streaming version for debugging
    // Use a simpler version to test if we get a response at all
    try {
      console.log('API: Using non-streaming response for debugging');
      
      const nonStreamingResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
        },
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-20250219',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: messageContent
            }
          ],
        }),
      });
      
      console.log(`API: Non-streaming response status: ${nonStreamingResponse.status}`);
      
      if (!nonStreamingResponse.ok) {
        const errorText = await nonStreamingResponse.text();
        console.error('Error response from non-streaming API:', errorText);
        throw new Error(`API error: ${nonStreamingResponse.status} - ${errorText}`);
      }
      
      const result = await nonStreamingResponse.json();
      console.log('API: Got response from Claude - status:', result.status);
      console.log('API: Response type:', typeof result);
      console.log('API: Response keys:', Object.keys(result));
      
      // Extract the actual content from the Claude response
      let enhancedText = '';
      if (result && result.content && result.content.length > 0) {
        // Find the text content in the response
        console.log('API: Content array length:', result.content.length);
        for (const content of result.content) {
          console.log('API: Content type:', content.type);
          if (content.type === 'text') {
            enhancedText += content.text;
          }
        }
      } else {
        console.error('API: Invalid response structure:', JSON.stringify(result).substring(0, 500));
        throw new Error('Invalid response structure from Claude API');
      }
      
      if (!enhancedText) {
        console.error('API: No text content found in response');
        throw new Error('No text content found in Claude API response');
      }
      
      console.log('API: Enhanced text length:', enhancedText.length);
      console.log('API: Enhanced text preview:', enhancedText.substring(0, 100) + '...');
      
      // Return the enhanced text directly
      return new Response(enhancedText);
    } catch (nonStreamingError) {
      console.error('Error with non-streaming request:', nonStreamingError);
      
      // Fallback to a simple enhancement
      const fallbackText = `# [FALLBACK RESPONSE - AI SERVICE UNAVAILABLE]

## ${description}

This is a fallback response because the AI service is currently unavailable. Please try again later.

### Visual Description
- The template shows a memorable visual moment
- It has clear emotional content that viewers can relate to
- The image/video timing is critical to the humor
- The subject's expression is the focal point

### Usage
- Use this template for situations where you want to express a strong emotional reaction
- Works well for relatable content
- Can be paired with captions about unexpected situations
- Effective for humor based on contrast between expectation and reality`;

      console.log('API: Using fallback text since the API call failed');
      return new Response(fallbackText);
    }
    
    // Original streaming implementation
    /*
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        stream: true,
      }),
    });

    console.log(`API: Claude response status: ${response.status}`);
    
    if (!response.ok) {
      console.error('Error status:', response.status);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // If we can't parse the JSON, just use the status
      }
      
      throw new Error(errorMessage);
    }

    console.log('API: Creating streaming response');
    
    // Create a stream from the response
    const stream = AnthropicStream(response);

    // Return the streaming response
    return new StreamingTextResponse(stream);
    */

  } catch (error) {
    console.error('Error in enhance-template API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enhance template description' },
      { status: 500 }
    );
  }
} 