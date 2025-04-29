import { useState, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Briefcase, Building2, MapPin, Calendar, ExternalLink, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SkillsJobMatcherProps {
  resumeData: any;
}

export const SkillsJobMatcher = forwardRef<any, SkillsJobMatcherProps>(({ resumeData }, ref) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [eligibleRoles, setEligibleRoles] = useState<string[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    extractSkills,
    findMatchingJobs,
    getSkills: () => skills,
    getEligibleRoles: () => eligibleRoles,
    getJobs: () => jobs
  }));

  const extractSkills = async () => {
    if (!resumeData) {
      toast({
        title: "Error",
        description: "No resume data available to extract skills",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsExtracting(true);
      setError(null);
      
      const response = await fetch('/api/extract-skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeData })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract skills and roles');
      }
      
      setSkills(data.skills || []);
      setEligibleRoles(data.eligibleRoles || []);
      
      toast({
        title: "Success",
        description: `Extracted ${data.skills?.length || 0} skills and ${data.eligibleRoles?.length || 0} potential roles`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error extracting skills and roles:', error);
      setError(error instanceof Error ? error.message : 'Failed to extract skills and roles');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to extract skills and roles',
        variant: "destructive"
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const findMatchingJobs = async () => {
    if (!skills || skills.length === 0) {
      toast({
        title: "Error",
        description: "No skills available to search for jobs",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      setJobs([]);
      
      // Use all skills and eligible roles for job searching
      const response = await fetch('/api/find-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          skills,
          eligibleRoles,
          additionalFilters: {
            // Add default filters
            posted_at_max_age_days: 90,
            // Can add more filters like location, etc.
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.details || data.error || 'Failed to find matching jobs';
        throw new Error(errorMessage);
      }
      
      setJobs(data.data || []);
      
      if (data.data && data.data.length > 0) {
        toast({
          title: "Success",
          description: `Found ${data.data.length} matching jobs based on your profile`,
          variant: "default"
        });
      } else {
        toast({
          title: "No Results",
          description: "No jobs found matching your skills. Try broadening your search or updating your skills.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error finding jobs:', error);
      setError(error instanceof Error ? error.message : 'Failed to find matching jobs');
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to find matching jobs',
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Helper to format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <Card className="w-full mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Skills & Job Matcher
        </CardTitle>
        <CardDescription>
          Extract your core skills and find matching job opportunities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Extract Skills and Roles */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-sm">Step 1: Extract Skills & Potential Roles</h3>
            <Button 
              onClick={extractSkills} 
              disabled={isExtracting || !resumeData}
              size="sm"
              variant="outline"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract Profile'
              )}
            </Button>
          </div>
          
          {skills.length > 0 && (
            <div className="p-3 bg-gray-50 rounded-md">
              <h4 className="text-sm font-medium mb-2">Extracted Skills</h4>
              <div className="flex flex-wrap gap-1">
                {skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="bg-blue-50">
                    {skill}
                  </Badge>
                ))}
              </div>
              
              {eligibleRoles.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Potential Roles</h4>
                  <div className="flex flex-wrap gap-1">
                    {eligibleRoles.map((role, index) => (
                      <Badge key={index} variant="outline" className="bg-green-50">
                        <Briefcase className="h-3 w-3 mr-1" />
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-2 text-xs text-gray-500">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                All skills and potential roles will be used to find the most relevant job opportunities.
              </div>
            </div>
          )}
        </div>
        
        {/* Step 2: Find Matching Jobs */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-sm">Step 2: Find Matching Jobs</h3>
            <Button 
              onClick={findMatchingJobs} 
              disabled={isSearching || skills.length === 0}
              size="sm"
              variant="default"
            >
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                'Find Jobs'
              )}
            </Button>
          </div>
          
          {jobs.length > 0 && (
            <div className="space-y-4 mt-4">
              <h4 className="text-sm font-medium">Matching Job Opportunities</h4>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {jobs.map((job, index) => (
                  <Card key={index} className="bg-white border border-gray-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{job.job_title}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{job.company}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-2 space-y-2 text-sm">
                      {job.location && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{job.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Posted: {formatDate(job.date_posted)}</span>
                      </div>
                      {job.matched_skills && job.matched_skills.length > 0 && (
                        <div className="mt-2">
                          <h5 className="text-xs font-medium mb-1">Matching Skills</h5>
                          <div className="flex flex-wrap gap-1">
                            {job.matched_skills.map((skill: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-green-50">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {job.matched_role && (
                        <div className="mt-2 text-xs text-gray-600 flex items-center">
                          <Briefcase className="h-3 w-3 mr-1 text-blue-500" />
                          <span>Matched with your <span className="font-medium">{job.matched_role}</span> profile</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="pt-0">
                      <a 
                        href={job.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Job Details
                      </a>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {isSearching && (
            <div className="flex justify-center py-8">
              <div className="flex flex-col items-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                <span className="text-sm text-gray-500">Searching for matching jobs...</span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Error finding jobs</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}); 