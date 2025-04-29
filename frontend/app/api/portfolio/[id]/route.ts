import { NextRequest, NextResponse } from 'next/server';
import { getPortfolio } from '@/lib/portfolio';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const index = parseInt(params.id);
    
    if (isNaN(index) || index < 0) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }
    
    // Get portfolio instance
    const portfolio = getPortfolio();
    
    // Remove item
    const success = await portfolio.removeItem(index);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to remove portfolio item' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error removing portfolio item:', error);
    return NextResponse.json({ error: 'Failed to remove portfolio item' }, { status: 500 });
  }
} 