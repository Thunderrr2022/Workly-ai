import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Upload, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { SkillsJobMatcher } from './SkillsJobMatcher';

interface DocparserParser {
  id: string;
  label: string;
}

export const PDFParserUploader = forwardRef((props, ref) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parsers, setParsers] = useState<DocparserParser[]>([]);
  const [selectedParserId, setSelectedParserId] = useState<string>('');
  const [isLoadingParsers, setIsLoadingParsers] = useState(false);
  const [parserLoadError, setParserLoadError] = useState<string | null>(null);
  const [parseResults, setParseResults] = useState<any>(null);
  const { toast } = useToast();

  // Expose methods through ref
  useImperativeHandle(ref, () => ({
    submitResume: handleParseDocument,
    getParseResults: () => parseResults
  }));

  // Load available parsers when component mounts
  useEffect(() => {
    const fetchParsers = async () => {
      try {
        setIsLoadingParsers(true);
        setParserLoadError(null);
        
        const response = await fetch('/api/document-parser');
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load document parsers');
        }
        
        const data = await response.json();
        setParsers(data.parsers || []);
        
        // Auto-select the first parser if available
        if (data.parsers && data.parsers.length > 0) {
          setSelectedParserId(data.parsers[0].id);
        }
      } catch (error) {
        console.error('Error loading parsers:', error);
        setParserLoadError(error instanceof Error ? error.message : 'Failed to load document parsers');
        toast({
          title: "Error",
          description: "Failed to connect to document parsing service. Please try again later.",
          variant: "destructive"
        });
      } finally {
        setIsLoadingParsers(false);
      }
    };
    
    fetchParsers();
  }, [toast]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const selectedFile = event.target.files[0];
      
      // Check if it's a PDF file
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        toast({
          title: "Invalid File",
          description: "Please select a PDF file",
          variant: "destructive"
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleParseDocument = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a PDF file to parse",
        variant: "destructive"
      });
      return;
    }
    
    if (!selectedParserId) {
      toast({
        title: "No Parser Selected",
        description: "Please select a document parser",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsUploading(true);
      setParseResults(null);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('parserId', selectedParserId);
      
      const response = await fetch('/api/document-parser', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse document');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Success",
          description: result.message || "Document parsed successfully",
          variant: "default"
        });
        
        if (result.results) {
          setParseResults(result.results);
        }
      } else {
        toast({
          title: "Warning",
          description: result.message || "Document uploaded but parsing is incomplete",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error parsing document:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to parse document",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Uploader
          </CardTitle>
          <CardDescription>
            Upload PDF documents to extract structured data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingParsers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              <span className="ml-2 text-sm text-gray-500">Loading document parsers...</span>
            </div>
          ) : parserLoadError ? (
            <div className="flex items-center text-red-500 p-3 bg-red-50 rounded-md">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span>{parserLoadError}</span>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Document Parser</label>
                {parsers.length > 0 ? (
                  <Select value={selectedParserId} onValueChange={setSelectedParserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a parser" />
                    </SelectTrigger>
                    <SelectContent>
                      {parsers.map(parser => (
                        <SelectItem key={parser.id} value={parser.id}>
                          {parser.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-amber-600 p-2 bg-amber-50 rounded">
                    No document parsers available. Please create a parser in your Docparser account.
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Upload PDF Document</label>
                <Input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileChange}
                  disabled={isUploading || parsers.length === 0}
                />
                {file && (
                  <div className="text-sm text-gray-500 flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                  </div>
                )}
              </div>
              
              {parseResults && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <h3 className="text-sm font-semibold mb-2 flex items-center">
                    <Check className="h-4 w-4 mr-1 text-green-500" />
                    Parsing Results
                  </h3>
                  <div className="text-xs overflow-auto max-h-60 border p-2 rounded bg-white">
                    <pre>{typeof parseResults === 'object' ? JSON.stringify(parseResults, null, 2) : String(parseResults)}</pre>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleParseDocument} 
            disabled={!file || !selectedParserId || isUploading || isLoadingParsers}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing Document...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Submit Resume
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Add Skills Job Matcher Component */}
      {parseResults && <SkillsJobMatcher resumeData={parseResults} />}
    </div>
  );
}); 