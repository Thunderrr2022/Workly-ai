import { NextRequest, NextResponse } from 'next/server';

// Groq API key
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Extracts core skills and eligible roles from resume data using Groq
 */
export async function POST(request: NextRequest) {
  try {
    const { resumeData } = await request.json();
    
    if (!resumeData) {
      return NextResponse.json({ error: 'Resume data is required' }, { status: 400 });
    }

    // Call Groq API to extract skills and roles
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant that analyzes resume data to extract:
1. Technical skills and expertise
2. Job titles/roles the candidate is eligible for based on their experience

Return a JSON object with two arrays:
- "skills": relevant technical skills from the resume
- "eligibleRoles": job titles the candidate would be qualified for based on their experience

Focus on specific technical roles related to the candidate's skills and experience. Be precise with job titles.`
          },
          {
            role: 'user',
            content: `Extract skills and eligible roles from this resume data: ${JSON.stringify(resumeData)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      console.error('Failed to extract skills and roles:', await response.text());
      return NextResponse.json({ error: 'Failed to extract skills and roles' }, { status: 500 });
    }

    const result = await response.json();
    
    try {
      // Parse the response to extract the skills and roles
      const content = result.choices[0].message.content;
      let skills = [];
      let eligibleRoles = [];
      
      if (content.includes('{') && content.includes('}')) {
        // Extract JSON object from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedContent = JSON.parse(jsonMatch[0]);
          skills = parsedContent.skills || [];
          eligibleRoles = parsedContent.eligibleRoles || [];
        }
      } else {
        // Handle case where the model doesn't return structured JSON
        // Just parse skills for backward compatibility
        const parts = content.split(/skills:|eligible roles:/i);
        if (parts.length > 1) {
          skills = parts[1].split(',').map((s: string) => s.trim());
        }
        if (parts.length > 2) {
          eligibleRoles = parts[2].split(',').map((r: string) => r.trim());
        }
      }
      
      return NextResponse.json({ 
        skills,
        eligibleRoles
      });
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      return NextResponse.json({
        error: 'Failed to parse skills and roles from response',
        rawResponse: result.choices[0].message.content
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error extracting skills and roles:', error);
    return NextResponse.json({ error: 'Failed to extract skills and roles' }, { status: 500 });
  }
} 