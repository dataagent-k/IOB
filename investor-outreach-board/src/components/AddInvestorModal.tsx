// NEW FILE: Create this file at src/components/AddInvestorModal.tsx

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { XMarkIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDropzone } from 'react-dropzone';

interface AddInvestorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvestorsAdded: () => void; // Callback to refresh the dashboard
}

type FormData = {
    name: string;
    fund: string;
    domain: string;
    linkedin_url: string;
    twitter_handle: string;
    stage_focus: string;
    sector_focus: string;
    notes_for_pitch: string;
    // Add other fields as needed
};

const API_URL = 'http://localhost:5000';

export const AddInvestorModal: React.FC<AddInvestorModalProps> = ({ isOpen, onClose, onInvestorsAdded }) => {
    const { register, handleSubmit, reset } = useForm<FormData>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        const file = acceptedFiles[0];
        const formData = new FormData();
        formData.append('file', file);

        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/api/upload_csv`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'CSV upload failed');
            alert(data.message);
            onInvestorsAdded(); // Refresh the dashboard list
            onClose();
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    }, [onClose, onInvestorsAdded]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'text/csv': ['.csv'] },
        maxFiles: 1,
    });

    const onManualSubmit = async (formData: FormData) => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/api/add_investor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to add investor');
            alert(data.message);
            reset();
            onInvestorsAdded(); // Refresh dashboard
            onClose();
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-2xl font-bold text-foreground">Add New Investors</h2>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground rounded-md">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left: Manual Form */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg text-foreground">Add Manually</h3>
                        <form onSubmit={handleSubmit(onManualSubmit)} className="space-y-3">
                            <div>
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" {...register('name', { required: true })} />
                            </div>
                            <div>
                                <Label htmlFor="fund">Fund Name</Label>
                                <Input id="fund" {...register('fund')} />
                            </div>
                             <div>
                                <Label htmlFor="domain">Fund Domain (e.g., a16z.com)</Label>
                                <Input id="domain" {...register('domain')} />
                            </div>
                            <div>
                                <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                                <Input id="linkedin_url" {...register('linkedin_url')} />
                            </div>
                            {/* Add more fields as needed */}
                            <Button type="submit" disabled={isSubmitting} className="w-full">
                                {isSubmitting ? 'Adding...' : 'Add Investor'}
                            </Button>
                        </form>
                    </div>

                    {/* Right: CSV Upload */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg text-foreground">Upload from CSV</h3>
                        <p className="text-sm text-muted-foreground">
                            For a template, <a href={`${API_URL}/api/download_template`} className="text-primary underline">click here to download</a>.
                        </p>
                        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary'}`}>
                            <input {...getInputProps()} />
                            <ArrowUpTrayIcon className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                            {isDragActive ? (
                                <p>Drop the file here ...</p>
                            ) : (
                                <p>Drag & drop a .csv file here, or click to select</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};