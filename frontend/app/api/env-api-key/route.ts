import { NextRequest, NextResponse } from 'next/server';

// GET handler to check environment variables
export async function GET(request: NextRequest) {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.GROQ_API_KEY || '';
    
    // Strip quotes and trim - exactly like in reference code
    const cleanApiKey = apiKey.replace(/^['"](.*)['"]$/, '$1').trim();
    
    // For debugging
    console.log('ENV API Key found:', cleanApiKey ? 'Yes (non-empty)' : 'No (empty)');
    
    return NextResponse.json({
      apiKey: cleanApiKey
    });
  } catch (error) {
    console.error('Error checking environment variables:', error);
    return NextResponse.json({ error: 'Failed to check environment variables' }, { status: 500 });
  }
} 