import { NextRequest, NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/portfolio';
import { promises as fs } from 'fs';
import * as path from 'path';
import { extractTextFromPDF } from '@/lib/pdf-parser';

// Process PDF resume/CV
const processPDF = async (buffer: Buffer, filename: string) => {
  try {
    // Extract text from PDF
    const text = await extractTextFromPDF(buffer);
    
    // Create a portfolio item from the PDF content
    return [{
      Techstack: text.substring(0, 500), // Limit to 500 chars
      Links: `Resume: ${filename} (uploaded on ${new Date().toLocaleDateString()})`
    }];
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Get file extension
    const fileExt = path.extname(file.name).toLowerCase();
    
    // Only allow PDF files
    if (fileExt !== '.pdf') {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF file.' }, 
        { status: 400 }
      );
    }
    
    // Process the PDF
    const items = await processPDF(buffer, file.name);
    
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No valid data extracted from PDF' }, { status: 400 });
    }
    
    // Get portfolio instance
    const portfolio = getPortfolio();
    
    // Add resume data to portfolio
    let success = false;
    for (const item of items) {
      if (item.Techstack && item.Links) {
        success = await portfolio.addItem(item.Techstack, item.Links);
        if (success) break; // Just need one successful item
      }
    }
    
    if (success) {
      return NextResponse.json({ 
        success: true,
        message: 'Resume successfully added to portfolio'
      });
    } else {
      return NextResponse.json({ error: 'Failed to add resume to portfolio' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error uploading resume:', error);
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 });
  }
} 