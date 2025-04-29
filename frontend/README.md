# LeadHunter Frontend

A web application for generating personalized cold emails based on LinkedIn profiles and job listings.

## Features

-  LinkedIn profile integration (now works without backend)
-  Portfolio management (add, view, delete portfolio items)
-  Cold email generation
-  Email improvement

## Getting Started

### Prerequisites

-  Node.js 18+
-  npm or yarn

### Setup and Running

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

The frontend will start on http://localhost:3000

## LinkedIn Profile Integration

The LinkedIn profile feature now works without the backend service, using mock data to demonstrate functionality. When you add a LinkedIn profile URL, the system will:

1. Validate the URL format
2. Generate a mock profile with skills and experience
3. Add the profile to your portfolio for use in cold emails

This allows you to test and use the application without setting up the backend service.

## Common Issues

### API Key Issues

Make sure to set a valid GROQ API key in the dashboard for the cold email generation feature to work properly.

## Technology Stack

-  Frontend: Next.js, React, Tailwind CSS

## Learn More

To learn more about Next.js, take a look at the following resources:

-  [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
-  [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
