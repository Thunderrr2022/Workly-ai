import { NextRequest, NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/portfolio';

// GET handler
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const skills = searchParams.get('skills');
    
    // Get portfolio instance
    const portfolio = getPortfolio();
    
    if (skills) {
      // If skills parameter is provided, return relevant items using vector search
      const skillsArray = skills.split(',').map(s => s.trim());
      const relevantItems = await portfolio.queryLinks(skillsArray);
      return NextResponse.json(relevantItems);
    }
    
    // Otherwise return all portfolio items
    const data = portfolio.getData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading portfolio:', error);
    return NextResponse.json({ error: 'Failed to read portfolio data' }, { status: 500 });
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.techstack || !body.link) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get portfolio instance
    const portfolio = getPortfolio();
    
    // Add item to portfolio with vector storage
    const success = await portfolio.addItem(body.techstack, body.link);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to add portfolio item' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error adding portfolio item:', error);
    return NextResponse.json({ error: 'Failed to add portfolio item' }, { status: 500 });
  }
} 