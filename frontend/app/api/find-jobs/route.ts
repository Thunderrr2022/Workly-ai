import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// TheirStack API key
const THEIRSTACK_API_KEY = process.env.THEIRSTACK_API_KEY || 'xxxx';
const THEIRSTACK_API_URL = 'https://api.theirstack.com/v1/jobs/search';

// SendGrid API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'xxxx';

// Determine the project root directory and find the YC companies CSV file
function findCsvFile(filename: string): string {
  // Try different possible locations for the CSV file
  const possiblePaths = [
    path.join(process.cwd(), filename), // Current working directory
    path.join(process.cwd(), '../../../..', filename), // 4 levels up (from app/api/find-jobs/ to project root)
    path.join(process.cwd(), '../../..', filename), // 3 levels up
    path.join(process.cwd(), '../..', filename), // 2 levels up
    path.join(process.cwd(), '..', filename), // 1 level up
    path.join(process.cwd(), 'public', filename), // In public folder
    path.resolve(process.cwd(), '..', '..', '..', '..', filename) // Absolute path 4 levels up
  ];
  
  // Check each path and return the first one that exists
  for (const csvPath of possiblePaths) {
    if (fs.existsSync(csvPath)) {
      console.log("Found CSV file at:", csvPath);
      return csvPath;
    } else {
      console.log("CSV file not found at:", csvPath);
    }
  }
  
  // Default to the first path if none exist
  console.error("Could not find CSV file in any expected location");
  return possiblePaths[0];
}

// Path to YC companies CSV file
const YC_COMPANIES_CSV_PATH = findCsvFile('yc.csv');

// Define job interface
interface Job {
  id: number;
  job_title?: string;
  job_description?: string;
  company?: string;
  url?: string;
  date_posted?: string;
  location?: string;
  [key: string]: any; // Allow for other properties
}

// Define YC company interface
interface YCCompany {
  'Company Name': string;
  'Website': string;
  'Company Description': string;
  'Industry': string;
  'Founder Name': string;
  'Location': string;
  [key: string]: any; // Allow for other properties
}

// Define email recipient interface
interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Finds jobs based on skills using TheirStack API
 */
export async function POST(request: NextRequest) {
  try {
    const { skills = [], eligibleRoles = [], additionalFilters = {}, sendEmails = false, userInfo = {} } = await request.json();
    
    if ((!skills || skills.length === 0) && (!eligibleRoles || eligibleRoles.length === 0)) {
      return NextResponse.json({ error: 'Skills or eligible roles are required' }, { status: 400 });
    }

    // Map common skills to technology slugs
    const techSlugs = mapSkillsToTechSlugs(skills);
    
    // Normalize eligible roles to ensure proper search terms
    const normalizedRoles = eligibleRoles.map((role: string) => normalizeJobTitle(role));
    
    // Create payload with eligible roles as primary search parameter
    const payload = {
      limit: 25,
      // Required filters - keep this wide
      posted_at_max_age_days: 90, // Expand to 90 days
      // Required company filter with empty string
      company_name_or: [""],
      // Add any additional filters provided
      ...additionalFilters
    };

    // Use eligible roles if available for job title search
    if (normalizedRoles.length > 0) {
      payload.job_title_or = normalizedRoles;
      console.log("Using extracted roles for job search:", normalizedRoles);
    } else {
      // Fallback to simplified skills if no roles available
      const simplified = getSimplifiedSkills(skills);
      if (simplified.length > 0) {
        payload.job_title_pattern_or = simplified.map(skill => 
          skill.toLowerCase().replace(/[^\w\s]/g, '').trim()
        );
      }
    }

    console.log("First search payload:", JSON.stringify(payload));

    // First attempt - search with eligible roles or skills
    const response = await fetch(THEIRSTACK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${THEIRSTACK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to search jobs:', errorText);
      return NextResponse.json({ 
        error: 'Failed to search jobs', 
        details: errorText 
      }, { status: 500 });
    }

    let result = await response.json();
    
    // If no results, try with technology slugs
    if ((!result.data || result.data.length === 0) && techSlugs.length > 0) {
      console.log("No jobs found with role search, trying technology slugs...");
      
      const techPayload = {
        ...payload,
        job_technology_slug_or: techSlugs,
        job_title_or: undefined // Remove previous job title filter
      };
      
      console.log("Technology search payload:", JSON.stringify(techPayload));
      
      const techResponse = await fetch(THEIRSTACK_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${THEIRSTACK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(techPayload)
      });
      
      if (techResponse.ok) {
        const techResult = await techResponse.json();
        if (techResult.data && techResult.data.length > 0) {
          result = techResult;
        }
      }
    }
    
    // If still no results, try a fallback search for popular tech jobs
    if (!result.data || result.data.length === 0) {
      console.log("No jobs found with previous searches, using fallback search...");
      
      // Default job titles if none were provided
      const defaultJobTitles = ["software engineer", "developer", "programmer", "data scientist", "product manager"];
      
      const fallbackPayload = {
        limit: 25,
        posted_at_max_age_days: 90,
        company_name_or: [""],
        job_title_or: normalizedRoles.length > 0 ? normalizedRoles : defaultJobTitles
      };
      
      console.log("Fallback search payload:", JSON.stringify(fallbackPayload));
      
      const fallbackResponse = await fetch(THEIRSTACK_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${THEIRSTACK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fallbackPayload)
      });
      
      if (fallbackResponse.ok) {
        const fallbackResult = await fallbackResponse.json();
        if (fallbackResult.data && fallbackResult.data.length > 0) {
          result = fallbackResult;
        }
      }
    }
    
    // If STILL no results, get random companies from YC CSV
    if (!result.data || result.data.length === 0) {
      console.log("No jobs found with any API search, using YC companies fallback...");
      
      try {
        // Get random YC companies
        const ycCompanies = getRandomYCCompanies(skills, eligibleRoles);
        
        // Format YC companies as job listings
        if (ycCompanies && ycCompanies.length > 0) {
          const mockJobListings = ycCompaniesToJobListings(ycCompanies, skills, eligibleRoles);
          result = { 
            data: mockJobListings,
            from_yc_companies: true 
          };
          console.log(`Created ${mockJobListings.length} mock job listings from YC companies`);
        }
      } catch (error) {
        console.error("Error loading YC companies:", error);
      }
    }
    
    // Process the results to add matched skills to each job
    if (result.data && Array.isArray(result.data)) {
      result.data = result.data.map((job: Job) => {
        // Find which skills match this job description or title
        const matchedSkills = skills.filter((skill: string) => {
          // Use a simpler matching approach to catch more matches
          const skillLower = skill.toLowerCase();
          const titleMatch = job.job_title ? job.job_title.toLowerCase().includes(skillLower) : false;
          const descMatch = job.job_description ? job.job_description.toLowerCase().includes(skillLower) : false;
          return titleMatch || descMatch;
        });
        
        // Find which role best matches this job
        let matchedRole = null;
        if (normalizedRoles.length > 0 && job.job_title) {
          const jobTitleLower = job.job_title.toLowerCase();
          for (const role of normalizedRoles) {
            if (jobTitleLower.includes(role.toLowerCase())) {
              matchedRole = eligibleRoles.find((r: string) => 
                normalizeJobTitle(r).toLowerCase() === role.toLowerCase()
              ) || role;
              break;
            }
          }
        }
        
        return {
          ...job,
          matched_skills: matchedSkills.length > 0 ? matchedSkills : ["Tech Job"],
          matched_role: matchedRole
        };
      });
      
      // Automatically send job application emails
      if (result.data.length > 0) {
        try {
          const emailResults = await sendAutomaticJobApplications(result.data, skills);
          result.email_results = emailResults;
        } catch (error) {
          console.error('Error sending automatic job applications:', error);
          result.email_error = error instanceof Error ? error.message : String(error);
        }
      }
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error searching jobs:', error);
    return NextResponse.json({ 
      error: 'Failed to search jobs',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Automatically send job application emails for found jobs
 */
async function sendAutomaticJobApplications(jobs: Job[], skills: string[]) {
  // Recipients as provided
  const recipients = [
    "jayforaws2004@gmail.com",
    "tadimallasubhakar@gmail.com",
    "shujay1009@gmail.com",
    "biji56831@gmail.com",
    "mj.oceanspirits@gmail.com"
  ];
  
  // Sender email
  const senderEmail = "tadimallasubhakar@gmail.com";
  
  // Current timestamp for uniqueness
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  const results = [];
  
  // Only process up to 5 jobs to avoid spamming
  const jobsToProcess = jobs.slice(0, 5);
  
  console.log("Sending individual emails to each recipient...\n");
  
  // Send a separate email for each recipient
  for (let i = 0; i < recipients.length; i++) {
    // Select a job based on recipient index (wrap around if more recipients than jobs)
    const job = jobsToProcess[i % jobsToProcess.length];
    const recipient = recipients[i];
    
    // Create a personalized cover letter for this recipient/job
    const htmlContent = createPersonalizedEmail(job, skills, recipient, timestamp);
    
    try {
      // Prepare the email data for SendGrid API
      const emailData = {
        personalizations: [
          {
            to: [{ email: recipient }],
            subject: `Application for ${job.job_title || 'Open Position'} - ${timestamp}`
          }
        ],
        from: { email: senderEmail },
        content: [
          {
            type: "text/html",
            value: htmlContent
          }
        ]
      };
      
      // Send the email using the SendGrid API
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
      });
      
      // Process the response
      if (response.ok) {
        console.log(`Email sent to ${recipient} successfully!`);
        console.log(`Status code: ${response.status}`);
        console.log(`X-Message-Id: ${response.headers.get('X-Message-Id') || 'Not available'}`);
        console.log("-".repeat(50));
        
        results.push({
          recipient,
          job_title: job.job_title,
          company: job.company,
          status: 'sent',
          message_id: response.headers.get('X-Message-Id') || undefined
        });
      } else {
        const errorText = await response.text();
        console.log(`An error occurred sending to ${recipient}: ${errorText}`);
        console.log("-".repeat(50));
        
        results.push({
          recipient,
          job_title: job.job_title,
          company: job.company,
          status: 'error',
          error: errorText
        });
      }
      
      // Add a small delay between sends to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`An error occurred sending to ${recipient}: ${error instanceof Error ? error.message : String(error)}`);
      console.log("-".repeat(50));
      
      results.push({
        recipient,
        job_title: job.job_title,
        company: job.company,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  console.log("\nCheck all email accounts for individual emails.");
  console.log("The subject line should contain the timestamp:");
  console.log(`Application for [Job Title] - ${timestamp}`);
  console.log("\nCheck the following in each Gmail account:");
  console.log("1. Main inbox");
  console.log("2. Spam/Junk folder");
  console.log("3. Promotions tab (if Gmail tabs are enabled)");
  
  return results;
}

/**
 * Create personalized email content for each recipient
 */
function createPersonalizedEmail(job: Job, skills: string[], recipient: string, timestamp: string): string {
  // Job details
  const jobTitle = job.job_title || 'the open position';
  const company = job.company || 'your company';
  const location = job.location || 'Remote';
  
  // Applicant info - would come from a user profile in a real app
  const applicantName = "Achal Bajpai";
  const applicantEmail = "axhalb05@gmail.com";
  const applicantPhone = "XXXXXXXXX000";
  
  // Generate a somewhat unique introduction based on recipient and job
  const introductions = [
    `I am excited to submit my application for the ${jobTitle} position at ${company}.`,
    `I recently discovered the ${jobTitle} opportunity at ${company} and am eager to apply.`,
    `As a passionate professional with expertise in ${skills.slice(0, 3).join(', ')}, I am interested in the ${jobTitle} role at ${company}.`,
    `I'm writing to express my interest in the ${jobTitle} position at ${company}.`,
    `With my background in ${skills.slice(0, 2).join(' and ')}, I believe I would be an excellent fit for the ${jobTitle} role at ${company}.`
  ];
  
  // Generate a somewhat unique skills section based on recipient and job
  const skillsSections = [
    `My experience with ${skills.join(', ')} perfectly aligns with the requirements for this position.`,
    `Throughout my career, I've developed strong skills in ${skills.slice(0, 3).join(', ')}, which would be valuable in this role.`,
    `My proficiency in ${skills.slice(0, 4).join(', ')} has prepared me to excel as a ${jobTitle}.`,
    `I bring extensive experience in ${skills.slice(0, 3).join(', ')}, which I understand are key requirements for this position.`,
    `Having worked with ${skills.slice(0, 4).join(', ')}, I am confident in my ability to make significant contributions to your team.`
  ];
  
  // Generate a somewhat unique company section based on recipient and job
  const companySections = [
    `I am particularly drawn to ${company} because of your innovative approach and industry reputation.`,
    `${company}'s mission and values resonate strongly with me, and I am excited about the opportunity to contribute to your success.`,
    `I have been following ${company}'s growth and am impressed by your achievements in the industry.`,
    `What excites me most about ${company} is your commitment to excellence and innovation.`,
    `I believe my skills and experience align perfectly with ${company}'s focus and goals.`
  ];
  
  // Generate a somewhat unique closing based on recipient and job
  const closings = [
    `I would welcome the opportunity to discuss how my background would make me a valuable addition to your team.`,
    `I am excited about the possibility of bringing my skills to ${company} and would appreciate the chance to speak with you further.`,
    `Thank you for considering my application. I look forward to the possibility of working together.`,
    `I am available for an interview at your convenience and look forward to discussing my qualifications further.`,
    `I am eager to contribute my skills and expertise to your team and would welcome the chance to discuss this opportunity.`
  ];
  
  // Select unique content based on recipient email (hashCode-like function)
  const getIndex = (str: string, max: number) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash) % max;
  };
  
  const recipientSeed = recipient.split('@')[0]; // Use username part of email
  const introIndex = getIndex(recipientSeed + '1', introductions.length);
  const skillsIndex = getIndex(recipientSeed + '2', skillsSections.length);
  const companyIndex = getIndex(recipientSeed + '3', companySections.length);
  const closingIndex = getIndex(recipientSeed + '4', closings.length);
  
  // Build HTML content
  return `
<html>
<body>
    <h2>Application for ${jobTitle} at ${company}</h2>
    
    <p>Dear Hiring Manager,</p>
    
    <p>${introductions[introIndex]}</p>
    
    <p>${skillsSections[skillsIndex]}</p>
    
    <p>${companySections[companyIndex]}</p>
    
    <p>${closings[closingIndex]}</p>
    
    <p>Thank you for your time and consideration.</p>
    
    <p>Sincerely,<br>
    ${applicantName}<br>
    ${applicantEmail}<br>
    ${applicantPhone}</p>
    
    <p><i>This email was sent at: ${timestamp}</i></p>
</body>
</html>
  `;
}

/**
 * Get random YC companies that might match the user's skills and roles
 */
function getRandomYCCompanies(skills: string[], roles: string[], count: number = 10): YCCompany[] {
  try {
    // Check if file exists again just to be sure
    if (!fs.existsSync(YC_COMPANIES_CSV_PATH)) {
      console.error(`CSV file not found at path: ${YC_COMPANIES_CSV_PATH}`);
      return [];
    }
    
    // Read and parse the CSV file
    const fileContent = fs.readFileSync(YC_COMPANIES_CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    }) as YCCompany[];
    
    if (!records || records.length === 0) {
      return [];
    }
    
    // Convert skills and roles to lowercase for matching
    const skillsLower = skills.map(s => s.toLowerCase());
    const rolesLower = roles.map(r => r.toLowerCase());
    
    // First, try to find companies that match the skills or roles
    let matchedCompanies = records.filter((company: YCCompany) => {
      const description = company['Company Description']?.toLowerCase() || '';
      const industry = company['Industry']?.toLowerCase() || '';
      
      // Check if any skill or role matches in the description or industry
      return skillsLower.some(skill => description.includes(skill) || industry.includes(skill)) ||
             rolesLower.some(role => description.includes(role) || industry.includes(role));
    });
    
    // If we don't have enough matched companies, add random ones
    if (matchedCompanies.length < count) {
      const remainingCompanies = records.filter(
        (company: YCCompany) => !matchedCompanies.includes(company)
      );
      
      // Shuffle the remaining companies
      const shuffled = remainingCompanies.sort(() => 0.5 - Math.random());
      
      // Add random companies until we reach the desired count
      matchedCompanies = [
        ...matchedCompanies,
        ...shuffled.slice(0, count - matchedCompanies.length)
      ];
    } else if (matchedCompanies.length > count) {
      // If we have too many matched companies, shuffle and pick the desired number
      matchedCompanies = matchedCompanies
        .sort(() => 0.5 - Math.random())
        .slice(0, count);
    }
    
    return matchedCompanies;
  } catch (error) {
    console.error('Error loading YC companies:', error);
    return [];
  }
}

/**
 * Convert YC companies to job listing format
 */
function ycCompaniesToJobListings(companies: YCCompany[], skills: string[], roles: string[]): Job[] {
  // Common job titles to use
  const jobTitles = [
    "Software Engineer",
    "Full Stack Developer",
    "Frontend Developer",
    "Backend Engineer",
    "Data Scientist",
    "Machine Learning Engineer",
    "Product Manager",
    "DevOps Engineer",
    "Mobile Developer",
    "UX/UI Designer"
  ];
  
  // Generate job listings from companies
  return companies.map((company, index) => {
    // Determine job title based on company industry or description
    let jobTitle = jobTitles[index % jobTitles.length];
    
    // Try to match a job title to the company's industry
    const industry = company['Industry'] || '';
    if (industry.toLowerCase().includes('ai') || industry.toLowerCase().includes('machine learning')) {
      jobTitle = "Machine Learning Engineer";
    } else if (industry.toLowerCase().includes('data')) {
      jobTitle = "Data Scientist";
    } else if (industry.toLowerCase().includes('mobile')) {
      jobTitle = "Mobile Developer";
    }
    
    // If we have roles, use one of them instead
    if (roles && roles.length > 0) {
      jobTitle = roles[index % roles.length];
    }
    
    // Create the job description from the company description
    const description = `${company['Company Name']} is looking for a talented ${jobTitle} to join our team. ${company['Company Description']} We're looking for someone with experience in ${skills.join(', ')} to help us build the future of ${industry}.`;
    
    // Create mock job listing
    return {
      id: index + 1000, // Arbitrary ID
      job_title: jobTitle,
      job_description: description,
      company: company['Company Name'],
      url: company['Website'],
      date_posted: new Date().toISOString().split('T')[0], // Today's date
      location: company['Location'] || 'Remote',
      is_yc_company: true,
      matched_skills: skills,
      matched_role: jobTitle
    };
  });
}

/**
 * Maps common skills to TheirStack technology slugs
 */
function mapSkillsToTechSlugs(skills: string[]): string[] {
  const skillToSlugMap: Record<string, string> = {
    'python': 'python',
    'javascript': 'javascript',
    'typescript': 'typescript',
    'react': 'react',
    'reactjs': 'react',
    'next.js': 'nextjs',
    'nextjs': 'nextjs',
    'node.js': 'nodejs',
    'nodejs': 'nodejs',
    'express': 'express',
    'express.js': 'express',
    'tailwind': 'tailwind-css',
    'tailwind css': 'tailwind-css',
    'mongodb': 'mongodb',
    'postgresql': 'postgresql',
    'postgres': 'postgresql',
    'prisma': 'prisma',
    'jest': 'jest',
    'git': 'git',
    'docker': 'docker',
    'kubernetes': 'kubernetes',
    'aws': 'aws',
    'github': 'github',
    'github actions': 'github-actions',
    'css': 'css',
    'html': 'html',
    'sql': 'sql',
    'nosql': 'nosql',
    'redux': 'redux',
    'graphql': 'graphql',
    'rest': 'rest-api',
    'api': 'api',
    'ui': 'ui',
    'ux': 'ux',
    'java': 'java',
    'c#': 'c-sharp',
    'csharp': 'c-sharp',
    'c++': 'cpp',
    'cpp': 'cpp',
    'go': 'golang',
    'golang': 'golang',
    'php': 'php',
    'ruby': 'ruby',
    'rails': 'ruby-on-rails',
    'ruby on rails': 'ruby-on-rails',
    'scala': 'scala',
    'rust': 'rust',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'flutter': 'flutter',
    'dart': 'dart',
    'react native': 'react-native',
    'vue': 'vue',
    'vue.js': 'vue',
    'angular': 'angular',
    'svelte': 'svelte',
    'laravel': 'laravel',
    'django': 'django',
    'flask': 'flask',
    'spring': 'spring',
    'spring boot': 'spring-boot',
    'asp.net': 'asp-net',
    'asp': 'asp-net',
    'dotnet': 'dotnet',
    '.net': 'dotnet',
    'tensorflow': 'tensorflow',
    'pytorch': 'pytorch',
    'machine learning': 'machine-learning',
    'ml': 'machine-learning',
    'ai': 'artificial-intelligence',
    'data science': 'data-science',
    'data analysis': 'data-analysis',
    'data analytics': 'data-analytics',
    'data engineering': 'data-engineering',
    'big data': 'big-data',
    'hadoop': 'hadoop',
    'spark': 'spark',
    'kafka': 'kafka',
  };

  const slugs: string[] = [];
  
  skills.forEach(skill => {
    const normalizedSkill = skill.toLowerCase().trim();
    
    // Try to match the full skill
    if (skillToSlugMap[normalizedSkill]) {
      slugs.push(skillToSlugMap[normalizedSkill]);
    } else {
      // Try to match partial skills
      for (const [key, value] of Object.entries(skillToSlugMap)) {
        if (normalizedSkill.includes(key) || key.includes(normalizedSkill)) {
          slugs.push(value);
          break;
        }
      }
    }
  });
  
  // Return unique slugs
  return [...new Set(slugs)];
}

/**
 * Gets a simplified list of skills for better matching
 */
function getSimplifiedSkills(skills: string[]): string[] {
  // Common tech job role keywords
  const commonTerms = [
    'software', 'developer', 'engineer', 'web', 'frontend', 'backend',
    'fullstack', 'data', 'devops', 'cloud', 'mobile', 'design',
    'product', 'project', 'manager'
  ];
  
  // Filter for skills that contain common tech job role keywords
  return skills.filter(skill => 
    commonTerms.some(term => 
      skill.toLowerCase().includes(term.toLowerCase())
    )
  );
}

/**
 * Normalizes job titles for better matching
 */
function normalizeJobTitle(title: string): string {
  // Clean up and standardize job title
  let normalized = title.trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')          // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, ' ')      // Replace non-alphanumeric chars with space
    .trim();
  
  // Remove common filler words
  const fillerWords = ['senior', 'junior', 'lead', 'staff', 'principal', 'head', 'chief', 'of', 'the', 'a', 'an'];
  fillerWords.forEach(word => {
    // Only remove if it's a standalone word (with word boundaries)
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    normalized = normalized.replace(regex, '');
  });
  
  // Trim and replace multiple spaces again
  normalized = normalized.trim().replace(/\s+/g, ' ');
  
  return normalized;
} 