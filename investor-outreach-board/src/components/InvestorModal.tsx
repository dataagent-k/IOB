import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, VideoCameraIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { type Investor } from './InvestorDashboard';

interface InvestorModalProps {
  isOpen: boolean;
  onClose: () => void;
  investor: Investor | null;
}

const CLOUDINARY_CLOUD_NAME = 'dluij4x5g';
const CLOUDINARY_UPLOAD_PRESET = 'ml_default';
const API_URL = 'http://localhost:5000';

const InvestorModal = ({ isOpen, onClose, investor }: InvestorModalProps) => {
  const [foundEmail, setFoundEmail] = useState('');
  const [isFindingEmail, setIsFindingEmail] = useState(false);
  const [emailBody, setEmailBody] = useState('');
  const [recordingPhase, setRecordingPhase] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [aiTips, setAiTips] = useState('');
  const [isGeneratingTips, setIsGeneratingTips] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFoundEmail('');
      setVideoUrl('');
      setEmailBody('');
      setRecordingPhase('idle');
      setIsUploading(false);
      setAiTips('');
    }
  }, [isOpen, investor]);
  
  useEffect(() => {
    if (videoUrl.startsWith('[https://res.cloudinary.com](https://res.cloudinary.com)') && investor) {
        const template = `Hi ${investor.name.split(' ')[0]},\n\nI saw your work with ${investor.fund} and was really impressed. I recorded a short, personalized video to explain why I'm reaching out.\n\nYou can watch the pitch here: ${videoUrl}\n\nBest,\n[Your Name]`;
        setEmailBody(template);
    }
  }, [videoUrl, investor]);

  if (!isOpen || !investor) return null;

  const handleStartRecording = async () => {
    setVideoUrl('');
    setEmailBody('');
    setRecordingPhase('recording');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        }
        
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recordedChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunksRef.current.push(event.data);
        };
        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const localUrl = URL.createObjectURL(blob);
            if(videoRef.current) {
                videoRef.current.srcObject = null;
                videoRef.current.src = localUrl;
            }
            setRecordingPhase('preview');
        };
        mediaRecorderRef.current.start();
    } catch (err) {
        console.error("Error accessing media devices.", err);
        alert("Could not access camera/microphone. Please check permissions.");
        setRecordingPhase('idle');
    }
  };

  const handleStopRecording = () => {
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          (videoRef.current?.srcObject as MediaStream)?.getTracks().forEach(track => track.stop());
      }
  };

  const handleRetryRecording = () => {
    setVideoUrl('');
    setEmailBody('');
    recordedChunksRef.current = [];
    setRecordingPhase('idle');
  };

  const handleSaveOffline = () => {
    if (recordedChunksRef.current.length === 0) return;
    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pitch_to_${investor.name.replace(/\s/g, '_')}.webm`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleProceedAndUpload = async () => {
    if (recordedChunksRef.current.length === 0) return;
    setIsUploading(true);

    const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    const formData = new FormData();
    formData.append('file', blob);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;

    try {
        const response = await fetch(uploadUrl, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.secure_url) {
            setVideoUrl(data.secure_url);
            alert("Video uploaded successfully!");
        } else {
            throw new Error(data.error?.message || 'Upload failed. Check Cloudinary settings.');
        }
    } catch (error) {
        console.error("Cloudinary Upload Error:", error);
        alert(`Upload failed: ${error}`);
    } finally {
        setIsUploading(false);
    }
  };
  
  const handleFindEmail = async () => {
    setIsFindingEmail(true);
    try {
        const response = await fetch(`${API_URL}/api/find_email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: investor.name, domain: investor.domain }),
        });
        const data = await response.json();
        setFoundEmail(response.ok ? (data.email || 'Not Found') : `Error: ${data.error}`);
    } catch (error) {
        console.error('Error finding email:', error);
        setFoundEmail('Failed to fetch');
    } finally {
        setIsFindingEmail(false);
    }
  };

  const handleGenerateTips = async () => {
    setIsGeneratingTips(true);
    setAiTips('');
    try {
        const response = await fetch(`${API_URL}/api/generate_tips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: investor.name, bio: investor.bio, thesis: investor.thesis }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to get tips');
        setAiTips(data.tips);
    } catch (error: any) {
        setAiTips(`Error: ${error.message}`);
    } finally {
        setIsGeneratingTips(false);
    }
  };

  const handleSendEmail = async () => {
    if (!foundEmail || foundEmail.includes('Not Found') || foundEmail.includes('Error')) {
        alert('Please find a valid email address first.');
        return;
    }
    if (!videoUrl.startsWith('https')) {
        alert('Please upload the video pitch first.');
        return;
    }
    const subject = `Video Pitch from OpenCrew AI`;
    const body = emailBody.replace(/\n/g, '<br>');

    try {
        const response = await fetch(`${API_URL}/api/send_email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_email: foundEmail, subject, body }),
        });
        if (!response.ok) throw new Error("Server responded with an error.");
        alert('Email sent successfully!');
    } catch (error) {
         alert('Failed to send email. See console for details.');
         console.error(error);
    }
  };

  const handlePrepLinkedIn = async () => {
    await fetch(`${API_URL}/api/prep_linkedin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: investor.id }),
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-card rounded-lg border border-border w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">{investor.name} - {investor.fund}</h2>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-md">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-grow p-6 gap-8 overflow-y-auto grid grid-cols-1 lg:grid-cols-2">
          {/* Left Column: Info, Tips, Recording */}
          <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Investor Info</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{investor.bio || "No bio available."}</p>
                <p className="text-sm text-muted-foreground mt-2 italic"><strong>Thesis:</strong> {investor.thesis || "N/A"}</p>
            </div>
            <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">AI-Powered Pitch Tips</h3>
                <Button onClick={handleGenerateTips} disabled={isGeneratingTips} size="sm" variant="outline">
                    <SparklesIcon className="w-4 h-4 mr-2"/>
                    {isGeneratingTips ? 'Generating...' : 'Generate Tips'}
                </Button>
                {aiTips && (
                    <div className="bg-muted rounded-lg p-3 mt-3 border border-border text-sm whitespace-pre-wrap">{aiTips}</div>
                )}
            </div>
            <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Record & Edit Pitch</h3>
                <div className="bg-black rounded-lg aspect-video flex items-center justify-center border border-border">
                    {recordingPhase === 'idle' && <VideoCameraIcon className="w-16 h-16 text-muted-foreground" />}
                    {/* FIX: Removed 'muted' prop to allow audio playback in preview */}
                    <video ref={videoRef} className={`w-full h-full object-cover ${recordingPhase === 'idle' ? 'hidden' : ''}`} autoPlay playsInline src={videoUrl} controls></video>
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  {recordingPhase === 'idle' && <Button onClick={handleStartRecording} className="bg-blue-600 hover:bg-blue-700">Record</Button>}
                  {recordingPhase === 'recording' && <Button onClick={handleStopRecording} className="bg-red-600 hover:bg-red-700">Stop</Button>}
                  {recordingPhase === 'preview' && (
                      <>
                          <Button onClick={handleSaveOffline} variant="outline">Save Offline</Button>
                          <Button onClick={handleRetryRecording} variant="secondary">Retry</Button>
                          <Button onClick={handleProceedAndUpload} disabled={isUploading} className="bg-green-600 hover:bg-green-700">
                              {isUploading ? 'Uploading...' : 'Proceed & Upload'}
                          </Button>
                      </>
                  )}
                </div>
            </div>
          </div>

          {/* Right Column: Outreach Actions */}
          <div className="space-y-6 flex flex-col">
            <div className="bg-muted p-4 rounded-lg border border-border">
                <h4 className="font-semibold text-foreground mb-3">Step 1: Find Contact</h4>
                <div className="flex items-center gap-4">
                    <Button onClick={handleFindEmail} disabled={isFindingEmail} size="sm" variant="outline">{isFindingEmail ? 'Finding...' : 'Find Email'}</Button>
                    {foundEmail && <span className="text-foreground font-medium">{foundEmail}</span>}
                </div>
            </div>
            <div className="bg-muted p-4 rounded-lg border border-border flex-grow flex flex-col">
                <h4 className="font-semibold text-foreground mb-3">Step 2: Customize & Send Email</h4>
                <Textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full flex-grow p-2 bg-background rounded-md border text-sm mb-4"
                    placeholder="Upload a video to generate the email template..."
                    disabled={!videoUrl.startsWith('https')}
                />
                <Button 
                    onClick={handleSendEmail}
                    disabled={!videoUrl.startsWith('https') || !foundEmail || foundEmail.includes('Not Found')}
                    className="w-full bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-500"
                >
                    Send Email Pitch
                </Button>
            </div>
            <div className="bg-muted p-4 rounded-lg border border-border">
                <h4 className="font-semibold text-foreground mb-3">Alternative: LinkedIn</h4>
                <Button onClick={handlePrepLinkedIn} className="w-full bg-blue-800 text-white hover:bg-blue-900">
                    Prep LinkedIn Message
                </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestorModal;
