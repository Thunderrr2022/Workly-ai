import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { JobAutomation, AutomationConfig } from '@/lib/job-automation';

// Path to store automation configuration
const CONFIG_FILE_PATH = path.join(process.cwd(), 'automation-config.json');

// Ensure config file exists
async function ensureConfigFile() {
  try {
    await fsPromises.access(CONFIG_FILE_PATH);
  } catch (error) {
    // Create with default config if it doesn't exist
    const defaultConfig: AutomationConfig = {
      enabled: false,
      keywords: ['software developer', 'react', 'web development'],
      sites: ['https://linkedin.com/jobs', 'https://indeed.com'],
      maxResults: 5,
      emailSettings: {
        companyName: 'Your Company',
        senderName: 'Your Name',
        emailLength: 'Medium'
      },
      schedule: {
        days: ['Monday', 'Wednesday', 'Friday'],
        time: '09:00'
      }
    };
    
    await fsPromises.writeFile(CONFIG_FILE_PATH, JSON.stringify(defaultConfig, null, 2));
  }
}

// Read config from file
async function readConfig(): Promise<AutomationConfig> {
  await ensureConfigFile();
  const fileContent = await fsPromises.readFile(CONFIG_FILE_PATH, 'utf-8');
  return JSON.parse(fileContent);
}

// Write config to file
async function writeConfig(config: AutomationConfig) {
  await fsPromises.writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2));
}

// POST endpoint for running job automation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywords, sites, maxResults = 5, apiKey } = body;
    
    // Validate inputs
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: 'Keywords are required as an array' }, { status: 400 });
    }
    
    if (!sites || !Array.isArray(sites) || sites.length === 0) {
      return NextResponse.json({ error: 'Sites are required as an array' }, { status: 400 });
    }
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }
    
    // Initialize automation with API key
    const automation = new JobAutomation(apiKey);
    
    // Search for jobs
    const jobUrls = await automation.searchJobs({
      keywords,
      sites,
      maxResults
    });
    
    return NextResponse.json({ jobUrls });
  } catch (error) {
    console.error('Error in job automation API:', error);
    return NextResponse.json({ error: 'Failed to search for jobs' }, { status: 500 });
  }
}

// GET endpoint to retrieve current automation config
export async function GET(request: NextRequest) {
  try {
    // For demonstration, we'll return a default configuration
    // In a real application, this would be pulled from a database
    
    const defaultConfig = {
      enabled: true,
      keywords: ['developer', 'software engineer', 'fullstack'],
      sites: [
        'https://www.linkedin.com/jobs',
        'https://www.indeed.com',
        'https://www.naukri.com'
      ],
      maxResults: 5,
      emailSettings: {
        sendEmails: false,
        delayBetweenEmails: 1800, // 30 minutes in seconds
        maxEmailsPerDay: 10,
        companyName: 'Your Company',
        senderName: 'Your Name',
        emailLength: 'Medium',
      },
      schedule: {
        runDaily: false,
        runTime: '09:00',
      }
    };
    
    return NextResponse.json(defaultConfig);
  } catch (error) {
    console.error('Error getting automation config:', error);
    return NextResponse.json({ error: 'Failed to retrieve automation configuration' }, { status: 500 });
  }
}

// PUT endpoint to update automation config
export async function PUT(request: NextRequest) {
  try {
    const config = await request.json();
    
    // Validate the config
    if (!config) {
      return NextResponse.json({ error: 'Missing configuration data' }, { status: 400 });
    }
    
    // Process incoming keywords if they're a comma-separated string
    if (typeof config.keywords === 'string') {
      config.keywords = config.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
    }
    
    // Process incoming sites if they're a newline-separated string
    if (typeof config.sites === 'string') {
      config.sites = config.sites.split('\n').map((s: string) => s.trim()).filter(Boolean);
    }
    
    // In a real application, you would save this to a database
    console.log('Saving automation config:', config);
    
    return NextResponse.json({ success: true, message: 'Configuration saved successfully' });
  } catch (error) {
    console.error('Error saving automation config:', error);
    return NextResponse.json({ error: 'Failed to save automation configuration' }, { status: 500 });
  }
}

// PATCH handler to run the automation manually
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }
    
    // Load the current configuration
    // In a real application, this would come from a database
    const config = {
      enabled: true,
      keywords: ['javascript', 'react', 'node'],
      sites: [
        'https://www.linkedin.com/jobs',
        'https://www.indeed.com',
        'https://www.naukri.com'
      ],
      maxResults: 5,
      emailSettings: {
        sendEmails: false,
        delayBetweenEmails: 1800,
        maxEmailsPerDay: 10,
        companyName: 'Your Company',
        senderName: 'Your Name',
        emailLength: 'Medium',
      },
      schedule: {
        runDaily: false,
        runTime: '09:00',
      }
    };
    
    console.log('Starting job automation...');
    
    try {
      // Initialize and run the automation
      const automation = new JobAutomation(apiKey, config);
      const results = await automation.runAutomation();
      
      // Process the results to ensure they are serializable
      const sanitizedResults = {
        success: results.success,
        message: results.message,
        processedJobs: results.processedJobs || 0,
        results: results.results ? results.results.map(result => ({
          jobDetails: {
            role: result.jobDetails?.role || 'Job Position',
            company: result.jobDetails?.company || 'Company',
            experience: result.jobDetails?.experience || 'Not specified',
            skills: Array.isArray(result.jobDetails?.skills) 
              ? result.jobDetails.skills 
              : ['technical skills'],
            description: result.jobDetails?.description || 'No description available',
            url: result.jobDetails?.url || ''
          },
          email: result.email || 'Email generation failed'
        })) : []
      };
      
      return NextResponse.json(sanitizedResults);
    } catch (automationError) {
      console.error('Automation execution error:', automationError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to execute automation',
        details: automationError instanceof Error ? automationError.message : String(automationError)
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error parsing request:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to parse automation request',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 400 });
  }
} 