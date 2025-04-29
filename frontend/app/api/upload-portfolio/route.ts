import { NextRequest, NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/portfolio';
import * as path from 'path';
import { extractTextFromPDF } from '@/lib/pdf-parser';

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
    
    try {
      // Extract text from PDF
      const text = await extractTextFromPDF(buffer);
      
      // Create a portfolio item from the PDF content
      const item = {
        Techstack: text.substring(0, 500), // Limit to 500 chars
        Links: `Resume: ${file.name} (uploaded on ${new Date().toLocaleDateString()})`
      };
      
      // Get portfolio instance
      const portfolio = getPortfolio();
      
      // Add resume data to portfolio
      const success = await portfolio.addItem(item.Techstack, item.Links);
      
      if (success) {
        return NextResponse.json({ 
          success: true,
          message: 'Resume successfully added to portfolio'
        });
      } else {
        return NextResponse.json({ error: 'Failed to add resume to portfolio' }, { status: 500 });
      }
    } catch (error) {
      console.error('Error processing PDF:', error);
      return NextResponse.json({ error: 'Failed to process PDF file' }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error uploading resume:', error);
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 });
  }
} 