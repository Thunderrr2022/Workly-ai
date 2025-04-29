import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;
    
    if (!apiKey) {
      return NextResponse.json({ valid: false, message: 'API key is required' }, { status: 400 });
    }
    
    // Clean the API key (remove quotes if present)
    const cleanApiKey = apiKey.replace(/^['"](.*)['"]$/, '$1').trim();
    
    if (!cleanApiKey) {
      return NextResponse.json({ valid: false, message: 'API key is empty after cleaning' });
    }
    
    // For debugging
    console.log('Validating API key (length):', cleanApiKey.length);
    
    // Try a different Groq API endpoint - chat completions endpoint is more reliable
    try {
      // Make a minimal request that will validate the API key without consuming tokens
      const response = await axios({
        method: 'post',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${cleanApiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          model: 'llama3-8b-8192', // Use a valid model
          messages: [
            { role: 'system', content: 'Test message to validate API key only.' }
          ],
          max_tokens: 1 // Minimal response to save tokens
        },
        // Timeout after 5 seconds to not hang
        timeout: 5000
      });
      
      // If we get here, the key is valid
      console.log('API key validation successful');
      return NextResponse.json({ valid: true, message: 'API key is valid!' });
      
    } catch (error: any) {
      // Check for auth errors which confirm the endpoint is working but key is invalid
      if (error.response) {
        const status = error.response.status;
        console.log('Error response status:', status);
        
        // If we get a 401/403, the key is invalid but the endpoint is working
        if (status === 401 || status === 403) {
          return NextResponse.json({ 
            valid: false, 
            message: 'Invalid API key: authentication failed' 
          });
        }
        
        // If we get a 404, the endpoint might be wrong, but still return invalid
        if (status === 404) {
          console.log('Endpoint not found error');
          return NextResponse.json({
            valid: false,
            message: 'API endpoint not found. Please check your API key format.'
          });
        }

        // If we get a 400, it might be valid but with bad parameters
        if (status === 400) {
          // Check response for error details
          if (error.response.data && error.response.data.error) {
            const errorMsg = error.response.data.error.message;
            if (errorMsg.includes('model')) {
              // If it's a model error, the key might be valid
              console.log('Model error but API key might be valid');
              return NextResponse.json({ valid: true, message: 'API key appears valid (model error)' });
            }
          }
        }
      }
      
      // Generic error
      console.error('Error detail:', error.message);
      return NextResponse.json({ 
        valid: false, 
        message: 'Failed to validate API key. Please try again with a valid Groq API key.' 
      });
    }
  } catch (error) {
    console.error('Error validating API key:', error);
    return NextResponse.json({ 
      valid: false, 
      message: 'Server error validating API key' 
    }, { status: 500 });
  }
} 