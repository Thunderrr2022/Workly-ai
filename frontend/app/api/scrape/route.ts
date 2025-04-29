import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Groq } from 'groq-sdk';

// Function to clean text by removing non-content tags and unnecessary whitespace
function cleanText(html: string): string {
  if (!html) return '';
  
  const $ = cheerio.load(html);
  
  // Remove script, style, svg, iframe tags that don't contain content
  $('script, style, svg, iframe, noscript, img, video, audio, canvas').remove();
  
  // Get clean text
  let text = $('body').text();
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n+/g, '\n');
  text = text.trim();
  
  // Remove URLs and other noise
  text = text.replace(/https?:\/\/[^\s]+/g, '');
  
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, apiKey } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Determine which job platform is being used
    const platform = url.includes('linkedin.com') ? 'linkedin' :
                    url.includes('indeed.com') ? 'indeed' :
                    url.includes('naukri.com') ? 'naukri' : 'other';

    console.log(`Scraping ${platform} job listing from ${url}`);

    // Fetch the job page
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 10000 // 10 second timeout
      });

      const html = response.data;
      let cleanedText = cleanText(html);

      // Different scraping strategies based on platform
      if (platform === 'naukri') {
        // For Naukri, focus on the job details section
        const $ = cheerio.load(html);
        const jobDescription = $('.job-desc').text() || '';
        const jobDetails = $('.about-company').text() || '';
        const additionalInfo = $('.other-details').text() || '';
        cleanedText = [jobDescription, jobDetails, additionalInfo].join('\n');
      }

      // Return partially cleaned text if too short
      if (cleanedText.length < 100) {
        console.log('Cleaned text is too short, returning partial page content');
        return NextResponse.json({ 
          text: cleanText(html.substring(0, 15000)), // First 15KB of the page
          platform,
          url
        });
      }

      // Return full cleaned text
      return NextResponse.json({ 
        text: cleanedText,
        platform,
        url
      });
    } catch (error: any) {
      console.error('Error fetching page:', error);
      return NextResponse.json({ 
        error: `Failed to fetch job listing: ${error.message}`,
        platform,
        url
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in scrape route:', error);
    return NextResponse.json({ error: `Internal server error: ${error.message}` }, { status: 500 });
  }
} 