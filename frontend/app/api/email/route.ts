import { NextRequest, NextResponse } from 'next/server';
import { Groq } from 'groq-sdk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobDetails, portfolio, apiKey, emailLength } = body;

    if (!jobDetails || !portfolio || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: jobDetails, portfolio, and apiKey are required' }, 
        { status: 400 }
      );
    }

    // Validate API key
    const groq = new Groq({ apiKey });

    // Prepare the job details
    const { role, company, experience, skills, description, url } = jobDetails;
    
    // Normalize emailLength
    const normalizedLength = emailLength || 'medium';
    
    // Construct the prompt similar to the reference implementation
    const prompt = `
### TASK: WRITE A COLD EMAIL TO APPLY FOR A JOB POSTING

### ABOUT THE SENDER:
${portfolio}

### JOB DETAILS:
Role: ${role || 'Software Developer'}
${company ? `Company: ${company}` : ''}
${experience ? `Experience Required: ${experience}` : ''}
Skills: ${Array.isArray(skills) ? skills.join(', ') : skills || 'Software Development'}
${description ? `Job Description: ${description}` : ''}
Job URL: ${url || 'Not provided'}

### INSTRUCTIONS:
Write a professional cold email to apply for this job. The email should be well-structured with:
1. A personalized greeting (using "Dear Hiring Manager" if no specific name is available)
2. An attention-grabbing introduction that showcases enthusiasm for the role
3. A brief highlight of the sender's most relevant qualifications that match the job requirements
4. Specific examples of relevant experience or accomplishments that demonstrate the sender's value
5. A clear explanation of why the sender is interested in this specific role and company
6. A professional closing with a call to action

LENGTH: ${normalizedLength.toUpperCase()} (${
      normalizedLength === 'short' ? '150-250 words' : 
      normalizedLength === 'medium' ? '250-350 words' : '350-450 words'
    })

TONE: Professional, confident, and enthusiastic

IMPORTANT GUIDELINES:
- Make the email personal, not generic
- Demonstrate understanding of the role and company
- Highlight only the MOST relevant skills from the sender's background
- Include specific, quantifiable achievements where possible
- Keep paragraphs short and scannable
- Use a professional email structure with proper salutation and closing
- Be authentic, not overly formal
- Avoid clichés and buzzwords
- Don't include attachments or links in this draft (mention resume is attached)
- The email should be ready to send with minimal editing

### EMAIL:
`;

    // Generate the email
    try {
      console.log("Generating email with Groq API");
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-8b-8192', // Using Llama 3 for efficient email generation
        temperature: 0.7,
        max_tokens: 1200,
        top_p: 0.9,
      });

      const email = completion.choices[0]?.message?.content || '';

      // Return the generated email
      return NextResponse.json({ email });
    } catch (error: any) {
      console.error('Error generating email:', error);
      // If there was an issue with the Groq API, try a simpler prompt
      try {
        console.log("Attempting with simplified prompt");
        const simplifiedPrompt = `
Write a professional job application email for a ${role || 'Software Developer'} position${company ? ` at ${company}` : ''}.

My background is:
${portfolio}

The job requires: ${Array.isArray(skills) ? skills.join(', ') : skills || 'Software Development skills'}

Make the email ${normalizedLength} length, professional tone, and ready to send with minimal editing.
`;

        const completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: simplifiedPrompt }],
          model: 'llama3-8b-8192',
          temperature: 0.7,
          max_tokens: 1000,
        });

        const email = completion.choices[0]?.message?.content || '';
        return NextResponse.json({ email });
      } catch (fallbackError) {
        // If all else fails, return a detailed error
        console.error('Fallback email generation failed:', fallbackError);
        return NextResponse.json(
          { error: `Failed to generate email: ${error.message}` }, 
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error('Error in email generation route:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` }, 
      { status: 500 }
    );
  }
} 