import React from 'react';
import { TextSettings } from '@/lib/types/meme'; // Assuming this path is correct

interface TextOverlayFormProps {
  caption: string;
  onCaptionChange: (caption: string) => void;
  textSettings: TextSettings;
  onTextSettingChange: (key: keyof TextSettings, value: string | number) => void;
  isCropped: boolean; // To conditionally show/hide vertical position
}

const TextOverlayForm: React.FC<TextOverlayFormProps> = ({
  caption,
  onCaptionChange,
  textSettings,
  onTextSettingChange,
  isCropped,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">
          Caption
        </h3>
        <textarea
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          className="w-full p-3 border border-gray-600 bg-gray-900 text-white rounded-md focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Enter your caption..."
        />
      </div>

      <details className="mt-2" open>
        <summary className="cursor-pointer text-sm text-gray-300 hover:text-white">
          Caption Settings
        </summary>
        <div className="mt-3 space-y-4 pl-2">
          <div>
            <label className="block text-xs text-gray-300 mb-1">Font</label>
            <select
              value={textSettings.font}
              onChange={(e) => onTextSettingChange('font', e.target.value)}
              className="w-full p-2 text-sm border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="Arial">Arial</option>
              <option value="Impact">Impact (Classic Meme)</option>
              <option value="Arial Black">Arial Black</option>
              <option value="Comic Sans MS">Comic Sans MS</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Futura">Futura</option>
              <option value="Oswald">Oswald</option>
              <option value="Anton">Anton</option>
              <option value="Roboto">Roboto</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Verdana">Verdana</option>
              <option value="Courier New">Courier New</option>
              <option value="Bebas Neue">Bebas Neue</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Size</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="40"
                max="120"
                value={textSettings.size}
                onChange={(e) => onTextSettingChange('size', parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm text-gray-300 w-12">{textSettings.size}</span>
            </div>
          </div>

          {!isCropped && (
            <div>
              <label className="block text-xs text-gray-300 mb-1">Vertical Position</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="2"
                  max="95"
                  value={textSettings.verticalPosition}
                  onChange={(e) => onTextSettingChange('verticalPosition', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm text-gray-300 w-12">{textSettings.verticalPosition}%</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-300 mb-1">Text Alignment</label>
            <div className="flex gap-0 border border-gray-700 rounded-md overflow-hidden">
              <button
                onClick={() => onTextSettingChange('alignment', 'left')}
                className={`flex-1 p-2 text-sm ${
                  textSettings.alignment === 'left' 
                    ? 'bg-blue-900 text-blue-300' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Left
              </button>
              <div className="w-px bg-gray-600" />
              <button
                onClick={() => onTextSettingChange('alignment', 'center')}
                className={`flex-1 p-2 text-sm ${
                  textSettings.alignment === 'center' 
                    ? 'bg-blue-900 text-blue-300' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Center
              </button>
              <div className="w-px bg-gray-600" />
              <button
                onClick={() => onTextSettingChange('alignment', 'right')}
                className={`flex-1 p-2 text-sm ${
                  textSettings.alignment === 'right' 
                    ? 'bg-blue-900 text-blue-300' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Right
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Text Color</label>
            <div className="flex gap-0 border rounded-md overflow-hidden">
              <button
                onClick={() => onTextSettingChange('color', 'white')}
                className={`flex-1 p-2 text-sm font-bold text-black bg-white flex items-center justify-center gap-1
                  ${textSettings.color === 'white' 
                    ? 'ring-2 ring-inset ring-blue-500' 
                    : 'hover:bg-gray-50'
                  }`}
              >
                {textSettings.color === 'white' && (
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                White
              </button>
              <div className="w-px bg-gray-200" />
              <button
                onClick={() => onTextSettingChange('color', 'black')}
                className={`flex-1 p-2 text-sm font-bold text-white bg-black flex items-center justify-center gap-1
                  ${textSettings.color === 'black' 
                    ? 'ring-2 ring-inset ring-blue-500' 
                    : 'hover:bg-opacity-90'
                  }`}
              >
                {textSettings.color === 'black' && (
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Black
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Stroke Weight</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="20"
                value={Math.round(textSettings.strokeWeight * 100)}
                onChange={(e) => onTextSettingChange('strokeWeight', parseInt(e.target.value) / 100)}
                className="flex-1"
              />
              <span className="text-sm text-gray-300 w-12">{Math.round(textSettings.strokeWeight * 100)}%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Background Color</label>
            <div className="flex gap-0 border border-gray-700 rounded-md overflow-hidden">
              <button
                onClick={() => onTextSettingChange('backgroundColor', 'black')}
                className={`flex-1 p-2 text-sm font-bold text-white bg-black flex items-center justify-center gap-1
                  ${textSettings.backgroundColor === 'black' 
                    ? 'ring-2 ring-inset ring-blue-500' 
                    : 'hover:bg-opacity-90'
                  }`}
              >
                {textSettings.backgroundColor === 'black' && (
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Black
              </button>
              <div className="w-px bg-gray-600" />
              <button
                onClick={() => onTextSettingChange('backgroundColor', 'white')}
                className={`flex-1 p-2 text-sm font-bold text-black bg-white flex items-center justify-center gap-1
                  ${textSettings.backgroundColor === 'white' 
                    ? 'ring-2 ring-inset ring-blue-500' 
                    : 'hover:bg-gray-50'
                  }`}
              >
                {textSettings.backgroundColor === 'white' && (
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                White
              </button>
              <div className="w-px bg-gray-600" />
              <button
                onClick={() => onTextSettingChange('backgroundColor', 'none')}
                className={`flex-1 p-2 text-sm
                  ${textSettings.backgroundColor === 'none' 
                    ? 'bg-blue-900 text-blue-300' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
              >
                None
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Background Opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round((textSettings.backgroundOpacity ?? 0.5) * 100)}
                onChange={(e) => onTextSettingChange('backgroundOpacity', parseInt(e.target.value) / 100)}
                className="flex-1"
                disabled={textSettings.backgroundColor === 'none'}
              />
              <span className="text-sm text-gray-300 w-12">
                {textSettings.backgroundColor === 'none' ? 'N/A' : `${Math.round((textSettings.backgroundOpacity ?? 0.5) * 100)}%`}
              </span>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
};

export default TextOverlayForm; 