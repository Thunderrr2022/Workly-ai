'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Check } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function Demo() {
  const [url, setUrl] = useState('')
  const [processStep, setProcessStep] = useState(0)
  const [progressValue, setProgressValue] = useState(0)
  const [showReasoning, setShowReasoning] = useState(false)
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [email, setEmail] = useState('')
  const [emailContent, setEmailContent] = useState('')
  const [analysisRationale, setAnalysisRationale] = useState<string[]>([])
  const [recipientName, setRecipientName] = useState('')
  const [copied, setCopied] = useState(false)
  const [improvePrompt, setImprovePrompt] = useState('')
  const [isImprovingEmail, setIsImprovingEmail] = useState(false)
  const [improveDialogOpen, setImproveDialogOpen] = useState(false)
  const [showLinkedInSuggestions, setShowLinkedInSuggestions] = useState(false)
  const [showCampaignSuggestions, setShowCampaignSuggestions] = useState(false)
  const router = useRouter()

  const linkedInSuggestions = [
    "https://www.linkedin.com/in/jenhsunhuang/",
    "https://www.linkedin.com/in/satyanadella/",
    "https://www.linkedin.com/in/williamhgates/",
    "https://www.linkedin.com/in/sundarpichai/",
  ]

  const campaignSuggestions = [
    "Looking to discuss how our solution can improve your sales efficiency.",
    "Would like to share how our platform can reduce operational costs.",
    "Interested in connecting about potential partnership opportunities.",
    "I would like to learn more about your company's products and how we can help you improve your sales efficiency."
  ]

  const aiSteps = [
    { title: 'Sensing', description: 'Scraping LinkedIn profile data' },
    { title: 'Thinking', description: 'Extracting name, title, and company' },
    { title: 'Retrieving', description: 'Finding and validating email address' },
    { title: 'Planning', description: 'Analyzing their page to shape email' },
    { title: 'Executing', description: 'Generating and finalizing personalized email' }
  ];

  const handleAnalyzeProfile = async () => {
    if (!url || !prompt) return

    const linkedInRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-_%]+\/?$/;

    if (!linkedInRegex.test(url)) {
      toast.error('Invalid LinkedIn URL. Please enter a valid profile URL.')
      return;
    }
    
    setProcessStep(1)
    setProgressValue(0) // Start at 0%
    setIsEmailLoading(true)
    setShowReasoning(false)
  
    // Animate progress from 0% to 20%
    setTimeout(() => {
      setProgressValue(20)
    }, 300)

    const progressInterval = setInterval(() => {
      setProcessStep(prev => {
        if (prev >= 3) {
          clearInterval(progressInterval)
          return 3
        }
        return prev + 1
      })
      
      setProgressValue(prev => {
        if (prev >= 60) return 60
        return prev + 20
      })
    }, 3000)
  
    try {
      const [response] = await Promise.all([
        fetch('https://leadhunterbackend.vercel.app/scrape-linkedin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, prompt })
        }).then(res => res.json()),
        new Promise(res => setTimeout(res, 10000))
      ])
  
      if (response.error) {
        toast.error(`Error: ${response.error}`)
      } else {
        setEmail(response.email)
        setRecipientName(response.recipient_name)
        setEmailContent(response.groq_response)
        setAnalysisRationale(response.analysis_rationale)
        
        setProcessStep(4)
        setProgressValue(80)
        setTimeout(() => {
          setProcessStep(5)
          setProgressValue(100)
        }, 1500)
      }
    } catch (err) {
      toast.error(`An error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsEmailLoading(false)
    }
  }

  const handleImproveEmail = async () => {
    if (!improvePrompt || !emailContent) {
      toast.error('Improve prompt or email content is empty')
      return;
    }
    
    setIsImprovingEmail(true);
    
    try {
      const response = await fetch('https://leadhunterbackend.vercel.app/improve-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: emailContent, 
          prompt: improvePrompt,
          recipient_name: recipientName
        })
      }).then(res => res.json());
      
      if (response.error) {
        toast.error(`Error: ${response.error}`)
      } else {
        setEmailContent(response.improved_email);
        setAnalysisRationale(response.improvement_rationale);
        setImproveDialogOpen(false);
        setImprovePrompt('');
        toast.success('Email improved successfully')
      }
    } catch (err) {
      toast.error(`An error occurred: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsImprovingEmail(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        toast.success('Copied to clipboard')
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        toast.error(`Failed to copy text: ${err instanceof Error ? err.message : 'Unknown error'}`)
      });
  };

  const selectLinkedInSuggestion = (suggestion: string) => {
    setUrl(suggestion);
    setShowLinkedInSuggestions(false);
  };

  const selectCampaignSuggestion = (suggestion: string) => {
    setPrompt(suggestion);
    setShowCampaignSuggestions(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-5xl mx-auto space-y-8">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-blue-600">
            Workly <span className="text-gray-900">AI</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 max-w-3xl mx-auto">
            Automate your job applications with AI. Let our system find and apply to the perfect opportunities for you.
          </p>
          
          {/* Replace the input fields with a direct CTA button */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 w-full max-w-md mx-auto">
            <Button 
              onClick={() => router.push('/dashboard')}
              className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-700"
            >
              Get Started
            </Button>
          </div>
          
          <div className="pt-8 flex flex-col sm:flex-row gap-6 justify-center">
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <span>AI-powered job matching</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <span>Personalized applications</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              <span>Automatic scheduling</span>
            </div>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="p-6 border-t border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold text-blue-600">Workly AI</span>
            <span className="text-sm text-gray-500">© 2025</span>
          </div>
          <div className="flex gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">About</Link>
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">Privacy</Link>
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}