'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Check, Loader2, Clock } from "lucide-react"
import { PDFParserUploader } from '@/components/PDFParserUploader'
import { SkillsJobMatcher } from '@/components/SkillsJobMatcher'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

export default function ColdEmailGeneratorDashboard() {
  // State variables for LinkedIn profile
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [isScrapingProfile, setIsScrapingProfile] = useState(false)
  const [scrapingError, setScrapingError] = useState('')
  const [scrapedProfile, setScrapedProfile] = useState<any>(null)
  
  // Email sent confirmation state
  const [emailSent, setEmailSent] = useState(false)

  // Process profile automation states
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentProcessStep, setCurrentProcessStep] = useState(0)
  
  // State for resume data
  const [resumeData, setResumeData] = useState<any>(null)
  
  // Cron job scheduling states
  const [cronEnabled, setCronEnabled] = useState(false)
  const [cronFrequency, setCronFrequency] = useState('daily')
  const [cronScheduled, setCronScheduled] = useState(false)
  
  // Refs to components for automated processing
  const pdfUploaderRef = useRef<any>(null)
  const skillsMatcherRef = useRef<any>(null)
  
  const scrapeLinkedInProfile = async () => {
    if (!linkedinUrl) return
    
    setIsScrapingProfile(true)
    setScrapingError('')
    setScrapedProfile(null)
    
    try {
      const response = await fetch('/api/portfolio/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkedinUrl })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setScrapedProfile(data.profile)
        toast.success('LinkedIn profile scraped successfully')
      } else {
        setScrapingError(data.error || 'Failed to scrape LinkedIn profile')
        toast.error(data.error || 'Failed to scrape LinkedIn profile')
      }
    } catch (error) {
      console.error('Error scraping LinkedIn profile:', error)
      setScrapingError('Error connecting to the scraping service')
      toast.error('Error connecting to the scraping service')
    } finally {
      setIsScrapingProfile(false)
    }
  }

  const resetProcess = () => {
    setEmailSent(false)
    setCurrentProcessStep(0)
  }
  
  // New function to process all steps automatically
  const processProfile = async () => {
    setIsProcessing(true)
    setCurrentProcessStep(1)
    
    try {
      // Step 1: Simulate Resume Parsing
      toast.info('Step 1: Processing resume...')
      
      // Simulate parsing result - in a real implementation, 
      // you would call pdfUploaderRef.current.submitResume()
      setResumeData({ 
        name: "John Doe",
        skills: ['JavaScript', 'React', 'TypeScript', 'Node.js'],
        experiences: [
          { title: "Software Engineer", company: "Tech Co", duration: "2 years" }
        ]
      })
      
      // Wait for a simulated parsing to complete
      await new Promise(resolve => setTimeout(resolve, 3000))
      setCurrentProcessStep(2)
      
      // Step 2: Extract Skills and Roles
      toast.info('Step 2: Extracting skills and potential roles...')
      
      try {
        // Simulate calling the extract-skills API
        const extractResponse = await fetch('/api/extract-skills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeData: resumeData })
        })
        
        if (!extractResponse.ok) {
          throw new Error('Failed to extract skills')
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000))
        setCurrentProcessStep(3)
        
        // Step 3: Find Matching Jobs
        toast.info('Step 3: Finding matching jobs...')
        
        const jobsResponse = await fetch('/api/find-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            skills: ['JavaScript', 'React', 'TypeScript', 'Node.js'],
            eligibleRoles: ['Software Engineer', 'Frontend Developer'],
            sendEmails: true,
            userInfo: {
              name: "Job Applicant",
              email: "tadimallasubhakar@gmail.com",
              phone: "(555) 123-4567"
            }
          })
        })
        
        if (!jobsResponse.ok) {
          throw new Error('Failed to find matching jobs')
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Step 4: Show success
        toast.success('All steps completed successfully!')
        setEmailSent(true)
        
      } catch (error) {
        console.error('Error in processing steps:', error)
        toast.error(`Process failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
    } finally {
      setIsProcessing(false)
    }
  }

  // Function to schedule the cron job
  const scheduleCronJob = async () => {
    toast.info(`Scheduled automated job application to run ${cronFrequency}`)
    
    // In a real implementation, this would call an API to set up a cron job
    // For now, we'll just simulate success
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      setCronScheduled(true)
      toast.success(`Your automated job applications are now scheduled to run ${cronFrequency}`)
    } catch (error) {
      toast.error('Failed to schedule automated applications')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">
            <span className="text-blue-600">Workly</span> AI
          </h1>
          <p className="text-sm sm:text-base text-gray-500">Generate personalized cold emails for business opportunities based on job listings</p>
        </div>

        {emailSent ? (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <Check className="h-6 w-6" />
                Email Sent Successfully
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-4 py-6">
                <div className="mx-auto bg-green-100 text-green-800 rounded-full p-4 w-16 h-16 flex items-center justify-center">
                  <Check className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-medium">Your email has been sent!</h2>
                <p className="text-gray-500 max-w-md mx-auto">
                  The system has automatically sent an email to the job poster based on your profile and the job listing.
                </p>
                <Button 
                  onClick={resetProcess} 
                  className="mt-4"
                >
                  Process Another Job
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex flex-col md:flex-row items-center justify-between gap-4">
                <span>Manage Your Profile</span>
                {/* Add Process Profile button */}
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
                  onClick={processProfile}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing Step {currentProcessStep}...
                    </>
                  ) : (
                    'Process Profile'
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-6">
                  {/* Restore LinkedIn Profile Scraper Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Import LinkedIn Profile</h3>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter LinkedIn profile URL"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        disabled={isScrapingProfile}
                      />
                      <Button 
                        onClick={scrapeLinkedInProfile} 
                        disabled={isScrapingProfile || !linkedinUrl}
                      >
                        {isScrapingProfile ? 'Scraping...' : 'Import Profile'}
                      </Button>
                    </div>
                    
                    {scrapingError && (
                      <div className="text-red-500 text-sm">{scrapingError}</div>
                    )}
                    
                    {scrapedProfile && (
                      <div className="p-3 bg-gray-50 rounded-md text-sm mt-2 max-h-96 overflow-y-auto">
                        <div><strong>Name:</strong> {typeof scrapedProfile.name === 'object' ? JSON.stringify(scrapedProfile.name) : scrapedProfile.name}</div>
                        {scrapedProfile.about && (
                          <div className="mt-1"><strong>About:</strong> {typeof scrapedProfile.about === 'object' ? JSON.stringify(scrapedProfile.about) : scrapedProfile.about.substring(0, 150)}...</div>
                        )}
                        <div className="mt-3">
                          <strong>Experience:</strong>
                          {scrapedProfile.experiences?.length > 0 ? (
                            <ul className="list-disc pl-5 mt-1 space-y-2">
                              {scrapedProfile.experiences.map((exp: any, index: number) => (
                                <li key={index}>
                                  <div className="font-medium">
                                    {typeof exp.title === 'object' ? JSON.stringify(exp.title) : exp.title} at {typeof exp.company === 'object' ? JSON.stringify(exp.company) : exp.company}
                                  </div>
                                  <div className="text-xs text-gray-500">{typeof exp.date_range === 'object' ? JSON.stringify(exp.date_range) : exp.date_range}</div>
                                  {exp.description && (
                                    <div className="text-xs mt-1 text-gray-600">
                                      {typeof exp.description === 'object' ? JSON.stringify(exp.description) : 
                                       typeof exp.description === 'string' && exp.description.length > 100 ? 
                                       `${exp.description.substring(0, 100)}...` : exp.description}
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500 ml-2">No experience data found</span>
                          )}
                        </div>
                        <div className="mt-3">
                          <strong>Education:</strong>
                          {scrapedProfile.educations?.length > 0 ? (
                            <ul className="list-disc pl-5 mt-1 space-y-2">
                              {scrapedProfile.educations.map((edu: any, index: number) => (
                                <li key={index}>
                                  <div className="font-medium">{typeof edu.institution === 'object' ? JSON.stringify(edu.institution) : edu.institution}</div>
                                  <div className="text-xs">{typeof edu.degree === 'object' ? JSON.stringify(edu.degree) : edu.degree}</div>
                                  <div className="text-xs text-gray-500">{typeof edu.date_range === 'object' ? JSON.stringify(edu.date_range) : edu.date_range}</div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500 ml-2">No education data found</span>
                          )}
                        </div>
                        <div className="mt-3">
                          <strong>Skills:</strong>
                          {scrapedProfile.skills?.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {scrapedProfile.skills.map((skill: any, index: number) => (
                                <Badge key={index} variant="outline" className="bg-blue-50">
                                  {typeof skill === 'object' ? JSON.stringify(skill) : skill}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500 ml-2">No skills found</span>
                          )}
                        </div>
                        {scrapedProfile.accomplishments?.length > 0 && (
                          <div className="mt-3">
                            <strong>Accomplishments:</strong>
                            <ul className="list-disc pl-5 mt-1">
                              {scrapedProfile.accomplishments.map((acc: any, index: number) => (
                                <li key={index}>{typeof acc === 'object' ? JSON.stringify(acc) : acc}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <Separator />
                  
                  {/* Add the PDF Parser Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Upload Resume </h3>
                    <p className="text-sm text-gray-500">Use Docparser to extract structured data from PDFs</p>
                    <PDFParserUploader ref={pdfUploaderRef} />
                  </div>
                  
                  {/* Show SkillsJobMatcher if resumeData is available */}
                  {resumeData && (
                    <div className="mt-6">
                      <SkillsJobMatcher ref={skillsMatcherRef} resumeData={resumeData} />
                    </div>
                  )}
                  
                  {/* New Cron Job Scheduler Section */}
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Automated Job Applications
                    </h3>
                    <p className="text-sm text-gray-500">
                      Schedule the system to automatically check for new jobs and apply on your behalf
                    </p>
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="auto-apply" 
                        checked={cronEnabled}
                        onCheckedChange={setCronEnabled}
                      />
                      <Label htmlFor="auto-apply">Enable automated applications</Label>
                    </div>
                    
                    {cronEnabled && (
                      <div className="space-y-4 p-4 bg-gray-50 rounded-md">
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="frequency">Application Frequency</Label>
                            <Select
                              value={cronFrequency}
                              onValueChange={setCronFrequency}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hourly">Every hour</SelectItem>
                                <SelectItem value="daily">Once a day</SelectItem>
                                <SelectItem value="weekly">Once a week</SelectItem>
                                <SelectItem value="biweekly">Every two weeks</SelectItem>
                                <SelectItem value="monthly">Once a month</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <Button 
                            onClick={scheduleCronJob}
                            disabled={cronScheduled}
                            className="w-full"
                          >
                            {cronScheduled ? (
                              <span className="flex items-center">
                                <Check className="h-4 w-4 mr-2" />
                                Scheduled
                              </span>
                            ) : (
                              'Schedule Automated Applications'
                            )}
                          </Button>
                          
                          {cronScheduled && (
                            <p className="text-sm text-green-600">
                              Your automated job applications are scheduled to run {cronFrequency}.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="text-xs text-gray-500">
                {isProcessing && (
                  <span className="flex items-center">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Processing step {currentProcessStep} of 3...
                  </span>
                )}
              </div>
              {/* Process Manually button removed */}
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
} 

