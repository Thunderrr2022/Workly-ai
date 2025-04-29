import { NextRequest, NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/portfolio';

// Docparser API key from environment variable
const DOCPARSER_API_KEY = process.env.DOCPARSER_API_KEY || '';

// API endpoints
const DOCPARSER_BASE_URL = 'https://api.docparser.com/v1';
const DOCPARSER_PING_URL = `${DOCPARSER_BASE_URL}/ping`;
const DOCPARSER_PARSERS_URL = `${DOCPARSER_BASE_URL}/parsers`;
const DOCPARSER_UPLOAD_URL = (parserId: string) => `${DOCPARSER_BASE_URL}/document/upload/${parserId}`;
const DOCPARSER_RESULTS_URL = (parserId: string, documentId: string) => `${DOCPARSER_BASE_URL}/results/${parserId}/${documentId}`;

// Interface for the document parser response
interface DocparserUploadResponse {
  id: string;
  file_size?: number;
  quota_used?: number;
  quota_left?: number;
  quota_refill?: string;
}

interface DocparserParser {
  id: string;
  label: string;
}

/**
 * Handles GET requests to retrieve available parsers
 */
export async function GET(request: NextRequest) {
  try {
    // Test connection by pinging the API
    const pingResponse = await fetch(DOCPARSER_PING_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${DOCPARSER_API_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!pingResponse.ok) {
      console.error('Failed to ping Docparser API:', await pingResponse.text());
      return NextResponse.json({ error: 'Failed to connect to document parsing service' }, { status: 500 });
    }

    // Get list of available parsers
    const parsersResponse = await fetch(DOCPARSER_PARSERS_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${DOCPARSER_API_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!parsersResponse.ok) {
      console.error('Failed to get parsers:', await parsersResponse.text());
      return NextResponse.json({ error: 'Failed to retrieve document parsers' }, { status: 500 });
    }

    const parsers: DocparserParser[] = await parsersResponse.json();
    return NextResponse.json({ parsers });
  } catch (error) {
    console.error('Error connecting to document parsing service:', error);
    return NextResponse.json({ error: 'Failed to connect to document parsing service' }, { status: 500 });
  }
}

/**
 * Handles POST requests to upload and parse PDF documents
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const parserId = formData.get('parserId') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!parserId) {
      return NextResponse.json({ error: 'Parser ID is required' }, { status: 400 });
    }

    // Only allow PDF files
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ 
        error: 'Only PDF files are supported' 
      }, { status: 400 });
    }

    // Convert file to buffer to upload to Docparser
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create form data for Docparser API
    const docparserFormData = new FormData();
    const docparserFile = new File([buffer], file.name, { type: file.type });
    docparserFormData.append('file', docparserFile);

    // Upload the file to Docparser
    const uploadUrl = DOCPARSER_UPLOAD_URL(parserId);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${DOCPARSER_API_KEY}:`).toString('base64')}`,
      },
      body: docparserFormData
    });

    if (!uploadResponse.ok) {
      console.error('Failed to upload document:', await uploadResponse.text());
      return NextResponse.json({ error: 'Failed to upload document to parsing service' }, { status: 500 });
    }

    const uploadResult: DocparserUploadResponse = await uploadResponse.json();
    
    // Wait a moment for the document to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get the parsed results
    const resultsUrl = DOCPARSER_RESULTS_URL(parserId, uploadResult.id);
    const resultsResponse = await fetch(resultsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${DOCPARSER_API_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!resultsResponse.ok) {
      console.error('Failed to get parsed results:', await resultsResponse.text());
      
      // Even if we can't get results yet, return success for the upload
      return NextResponse.json({ 
        success: true,
        message: 'Document uploaded successfully but parsing is still in progress',
        documentId: uploadResult.id,
        parserId: parserId
      });
    }

    const parsedResults = await resultsResponse.json();

    // Add to portfolio if we have text content
    try {
      let portfolioContent = '';
      
      // Try to extract text content from parsed results
      if (typeof parsedResults === 'object') {
        portfolioContent = JSON.stringify(parsedResults);
      }
      
      if (portfolioContent) {
        const portfolio = getPortfolio();
        await portfolio.addItem(
          portfolioContent.substring(0, 500), // Limit to 500 chars
          `Parsed PDF Document: ${file.name}`
        );
      }
    } catch (portfolioError) {
      console.error('Error adding parsed document to portfolio:', portfolioError);
      // Continue even if portfolio addition fails
    }

    return NextResponse.json({ 
      success: true,
      message: 'Document parsed successfully',
      documentId: uploadResult.id,
      parserId: parserId,
      results: parsedResults
    });
  } catch (error) {
    console.error('Error parsing document:', error);
    return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 });
  }
} 