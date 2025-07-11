import { useState, useRef, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { type Investor } from './InvestorDashboard'; // Import the type

interface InvestorModalProps {
  isOpen: boolean;
  onClose: () => void;
  investor: Investor | null;
}

const InvestorModal = ({ isOpen, onClose, investor }: InvestorModalProps) => {
  // State for backend interactions
  const [foundEmail, setFoundEmail] = useState('');
  const [isFindingEmail, setIsFindingEmail] = useState(false);
  
  // State for video recording
  const [isRecording, setIsRecording] = useState(false);
  const [videoURL, setVideoURL] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const API_URL = 'http://localhost:5000';

  // Reset state when modal opens or investor changes
  useEffect(() => {
    if (isOpen) {
      setFoundEmail('');
      setVideoURL('');
      setIsRecording(false);
    }
  }, [isOpen, investor]);

  if (!isOpen || !investor) return null;

  // --- Video Recording Handlers ---
  const handleStartRecording = async () => {
    setVideoURL('');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
        
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
        recordedChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };

        mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            setVideoURL(url);
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
    } catch (err) {
        console.error("Error accessing media devices.", err);
        alert("Could not access camera/microphone. Please check permissions.");
    }
  };

  const handleStopRecording = () => {
      if (mediaRecorderRef.current && videoRef.current && videoRef.current.srcObject) {
          mediaRecorderRef.current.stop();
          (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
          setIsRecording(false);
      }
  };

  // --- Backend Action Handlers ---
  // const handleFindEmail = async () => {
  //   setIsFindingEmail(true);
  //   try {
  //       const response = await fetch(`${API_URL}/api/find_email`, {
  //           method: 'POST',
  //           headers: { 'Content-Type': 'application/json' },
  //           body: JSON.stringify({ name: investor.name, company: investor.fund }),
  //       });
  //       const data = await response.json();
  //       setFoundEmail(data.email || 'Not Found');
  //   } catch (error) {
  //       console.error('Error finding email:', error);
  //       setFoundEmail('Failed to find');
  //   } finally {
  //       setIsFindingEmail(false);
  //   }
  // };


  const handleFindEmail = async () => {
    setIsFindingEmail(true);
    try {
        const response = await fetch(`${API_URL}/api/find_email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // UPDATED: We now pass the name AND the reliable domain
            body: JSON.stringify({ name: investor.name, domain: investor.domain }),
        });
        const data = await response.json();
        if (response.ok) {
            setFoundEmail(data.email || 'Not Found');
        } else {
            setFoundEmail(`Error: ${data.error}`);
        }
    } catch (error) {
        console.error('Error finding email:', error);
        setFoundEmail('Failed to fetch');
    } finally {
        setIsFindingEmail(false);
    }
};

  const handlePrepLinkedIn = async () => {
    try {
        await fetch(`${API_URL}/api/prep_linkedin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: investor.id }),
        });
    } catch(e) {
        alert("Failed to prepare LinkedIn message. See console for details.");
        console.error(e);
    }
  };

  const handleSendEmail = async () => {
    if (!foundEmail || foundEmail === 'Not Found' || foundEmail === 'Failed to find') {
        alert('Please find a valid email address first.');
        return;
    }
    if (!videoURL) {
        alert('Please record a video pitch first.');
        return;
    }
    const subject = `Video Pitch from OpenCrew AI`; // Customize your company name
    const body = `
        <p>Hi ${investor.name.split(' ')[0]},</p>
        <p>I saw your work with ${investor.fund} and was really impressed. I recorded a short, personalized video pitch regarding my company, OpenCrew AI, which I think aligns with your focus on ${investor.sector_focus}.</p>
        <p>You can watch it here: <a href="${videoURL}">Link to Video Pitch</a></p>
        <p>Best,</p>
        <p>Your Name</p>
    `;

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-card rounded-lg border border-border w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">{investor.name}</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow p-6 gap-8 overflow-y-auto grid grid-cols-1 md:grid-cols-2">
          {/* Left Column - Recording */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-foreground">Personalized Pitch Points</h4>
            <div className="bg-muted rounded-lg p-4 border border-border">
              <ul className="space-y-2 text-foreground text-sm">
                {investor.notes_for_pitch ? investor.notes_for_pitch.split(';').map((note: string, i: number) => (
                    <li key={i} className="flex items-start"><span className="mr-2">•</span><span>{note}</span></li>
                )) : <li>Add notes to your CSV to see them here.</li>}
              </ul>
            </div>
            
            <h4 className="text-lg font-semibold text-foreground">Record Your Pitch</h4>
            <div className="bg-black rounded-lg aspect-video flex items-center justify-center border border-border">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted={!videoURL} src={videoURL} controls={!!videoURL}></video>
            </div>
            <div className="flex gap-3">
              {!isRecording ? (
                <Button onClick={handleStartRecording} className="bg-blue-600 text-white hover:bg-blue-700">Record</Button>
              ) : (
                <Button onClick={handleStopRecording} className="bg-red-600 text-white hover:bg-red-700">Stop</Button>
              )}
            </div>
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            <div className="bg-muted p-4 rounded-lg border border-border">
                <h4 className="font-semibold text-foreground mb-3">Step 1: Find Contact</h4>
                <div className="flex items-center gap-4">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleFindEmail}
                        disabled={isFindingEmail}
                        className="border-border text-foreground hover:bg-accent"
                    >
                        {isFindingEmail ? 'Finding...' : 'Find Email'}
                    </Button>
                    {foundEmail && <span className="text-foreground font-medium">{foundEmail}</span>}
                </div>
            </div>
            <div className="bg-muted p-4 rounded-lg border border-border">
                <h4 className="font-semibold text-foreground mb-3">Step 2: Send Pitch</h4>
                <Button 
                    onClick={handleSendEmail}
                    disabled={!videoURL || !foundEmail || foundEmail === 'Not Found'}
                    className="w-full bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                    Send Email Pitch
                </Button>
            </div>
            <div className="bg-muted p-4 rounded-lg border border-border">
                <h4 className="font-semibold text-foreground mb-3">Alternative Outreach</h4>
                <Button 
                    onClick={handlePrepLinkedIn}
                    className="w-full bg-blue-800 text-white hover:bg-blue-900"
                >
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