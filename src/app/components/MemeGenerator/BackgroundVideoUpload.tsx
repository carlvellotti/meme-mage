import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { BackgroundVideo } from '@/lib/types/meme';

interface BackgroundVideoUploadProps {
  onVideoUploaded: (video: BackgroundVideo) => void;
  isUploading: boolean;
  onUploadingChange: (isUploading: boolean) => void;
}

const BackgroundVideoUpload: React.FC<BackgroundVideoUploadProps> = ({
  onVideoUploaded,
  isUploading,
  onUploadingChange
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoName, setVideoName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        toast.error('Please select a video file');
        return;
      }
      
      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        toast.error('Video file must be smaller than 50MB');
        return;
      }
      
      setSelectedFile(file);
      // Auto-generate name from filename if not set
      if (!videoName) {
        const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, '');
        setVideoName(nameWithoutExtension);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !videoName.trim()) {
      toast.error('Please select a video file and enter a name');
      return;
    }

    onUploadingChange(true);
    const uploadToast = toast.loading('Uploading background video...');

    try {
      // Create form data for file upload
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('name', videoName.trim());

      // Upload the video file
      const uploadResponse = await fetch('/api/background-videos/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      toast.success('Background video uploaded successfully!', { id: uploadToast });
      
      // Reset form
      setSelectedFile(null);
      setVideoName('');
      setIsExpanded(false);
      
      // Reset file input
      const fileInput = document.getElementById('backgroundVideoFile') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      // Notify parent component
      onVideoUploaded(uploadResult.backgroundVideo);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload video', { id: uploadToast });
    } finally {
      onUploadingChange(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setVideoName('');
    setIsExpanded(false);
    // Reset file input
    const fileInput = document.getElementById('backgroundVideoFile') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        disabled={isUploading}
        className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
      >
        + Upload New Background Video
      </button>
    );
  }

  return (
    <div className="mt-3 p-3 bg-gray-700 rounded-md border border-gray-600">
      <h4 className="text-sm font-medium text-gray-300 mb-3">Upload Background Video</h4>
      
      <div className="space-y-3">
        <div>
          <label htmlFor="videoName" className="block text-xs font-medium text-gray-400 mb-1">
            Video Name
          </label>
          <input
            type="text"
            id="videoName"
            value={videoName}
            onChange={(e) => setVideoName(e.target.value)}
            placeholder="Enter a name for this background video"
            className="w-full px-2 py-1 text-sm border border-gray-600 rounded bg-gray-800 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isUploading}
          />
        </div>

        <div>
          <label htmlFor="backgroundVideoFile" className="block text-xs font-medium text-gray-400 mb-1">
            Video File (MP4, WebM, MOV - Max 50MB)
          </label>
          <input
            type="file"
            id="backgroundVideoFile"
            accept="video/*"
            onChange={handleFileSelect}
            className="w-full text-sm text-gray-300 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
            disabled={isUploading}
          />
        </div>

        {selectedFile && (
          <div className="text-xs text-gray-400">
            Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024 / 1024 * 100) / 100} MB)
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || !videoName.trim() || isUploading}
            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            onClick={handleCancel}
            disabled={isUploading}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackgroundVideoUpload; 