import { NextRequest, NextResponse } from 'next/server';
import { Chain } from '@/lib/chains';
import { getPortfolio } from '@/lib/portfolio';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { job, emailLength, companyName, senderName, apiKey } = body;
    
    // Validate inputs
    if (!job) {
      return NextResponse.json({ error: 'Job details are required' }, { status: 400 });
    }
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }
    
    // Clean up job data to ensure consistent structure
    const cleanedJob = {
      role: job.role || "the job position",
      company: job.company || "the company", 
      experience: job.experience || "Not specified",
      skills: Array.isArray(job.skills) ? job.skills : (typeof job.skills === 'string' ? [job.skills] : ["technical skills"]),
      description: job.description || "the described job position",
      url: job.url || "",
      relevantPortfolio: job.relevantPortfolio || []
    };
    
    // Validate company name and sender name
    const validCompanyName = companyName || 'Your Company';
    const validSenderName = senderName || 'Your Name';
    const validEmailLength = ['Short', 'Medium', 'Long'].includes(emailLength) ? emailLength : 'Medium';
    
    console.log('Generating email for job:', {
      role: cleanedJob.role,
      company: cleanedJob.company,
      skills: Array.isArray(cleanedJob.skills) ? cleanedJob.skills.length : 0,
      portfolioItems: cleanedJob.relevantPortfolio.length
    });
    
    // Get portfolio instance
    const portfolio = getPortfolio();
    
    // Find relevant portfolio items based on job skills if not already provided
    let relevantPortfolioItems = cleanedJob.relevantPortfolio;
    
    if ((!relevantPortfolioItems || relevantPortfolioItems.length === 0) && cleanedJob.skills) {
      try {
        console.log('Finding relevant portfolio items for skills:', cleanedJob.skills);
        relevantPortfolioItems = await portfolio.queryLinks(cleanedJob.skills, 3);
      } catch (portfolioError) {
        console.error('Error fetching portfolio items:', portfolioError);
        // Continue with empty portfolio items rather than failing
        relevantPortfolioItems = [];
      }
    }
    
    // Initialize Chain
    const chain = new Chain(apiKey);
    
    // Generate email using LangChain with error handling
    try {
      console.log('Calling email generation chain...');
      const email = await chain.generateColdEmail(
        cleanedJob,
        relevantPortfolioItems,
        validEmailLength,
        validCompanyName,
        validSenderName
      );
      
      console.log('Email generated successfully');
      return NextResponse.json({ email });
    } catch (emailError) {
      console.error('Error in email generation chain:', emailError);
      
      // Create a basic fallback email if chain fails
      const fallbackEmail = `Subject: ${validCompanyName} Services for ${cleanedJob.role} Position at ${cleanedJob.company}

Dear ${cleanedJob.company} Team,

I hope this email finds you well. My name is ${validSenderName}, a Business Development Executive at ${validCompanyName}.

I recently came across your job posting for the ${cleanedJob.role} position. Our team at ${validCompanyName} specializes in providing custom software solutions that align perfectly with your requirements.

We have extensive experience working with companies requiring expertise in ${cleanedJob.skills.join(', ')}. I believe we could be an excellent partner for your project.

Would you be available for a brief 15-minute call next week to discuss how we can assist your team?

Looking forward to your response.

Best regards,
${validSenderName}
Business Development Executive
${validCompanyName}`;

      // Return the fallback email with a warning
      return NextResponse.json({ 
        email: fallbackEmail,
        warning: 'Used fallback template due to an error in email generation.'
      });
    }
  } catch (error: any) {
    console.error('Error generating email:', error.message || error);
    return NextResponse.json({ 
      error: 'Failed to generate email', 
      details: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 