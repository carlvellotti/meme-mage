import React from 'react';
import { Label, CommonLabelSettings as LabelSettings, LabelAction, ADD_LABEL, UPDATE_LABEL, DELETE_LABEL, UPDATE_COMMON_LABEL_SETTINGS } from '@/app/lib/hooks/useLabels';

// TODO: Define Label type if not already globally available or passed specifically
// TODO: Define LabelSettings type (for common settings like font, size, color, etc.)

interface LabelControlsProps {
  labels: Label[];
  labelSettings: LabelSettings;
  dispatch: React.Dispatch<LabelAction>; // Updated dispatch type
}

const LabelControls: React.FC<LabelControlsProps> = ({
  labels,
  labelSettings,
  dispatch,
}) => {
  return (
    <details className="mt-4">
      <summary 
        className="cursor-pointer text-sm text-gray-300 hover:text-white list-item" 
        onClick={() => {
          if (labels.length === 0) {
            dispatch({ type: ADD_LABEL });
          }
        }}
      >
        <div className="inline-flex items-center gap-2 ml-1">
            <span>Labels</span>
        </div>
      </summary>
      
      <div className="mt-3 space-y-4 pl-4 pr-2 py-3">
        {labels.map(label => (
          <div key={label.id} className="space-y-3 mb-4 p-3 bg-gray-700 rounded-lg">
            <input 
              type="text" 
              value={label.text} 
              onChange={(e) => dispatch({ type: UPDATE_LABEL, payload: { id: label.id, updates: { text: e.target.value } } })}
              placeholder="Enter label text..." 
              className="w-full p-2 text-sm border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500" 
            />
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-gray-300 mb-1">Horizontal</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={label.horizontalPosition} 
                    onChange={(e) => dispatch({ type: UPDATE_LABEL, payload: { id: label.id, updates: { horizontalPosition: parseInt(e.target.value) } } })}
                    className="flex-1" 
                  />
                  <span className="text-sm text-gray-300 w-12">{label.horizontalPosition}%</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-300 mb-1">Vertical</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={label.verticalPosition} 
                    onChange={(e) => dispatch({ type: UPDATE_LABEL, payload: { id: label.id, updates: { verticalPosition: parseInt(e.target.value) } } })}
                    className="flex-1" 
                  />
                  <span className="text-sm text-gray-300 w-12">{label.verticalPosition}%</span>
                </div>
              </div>
            </div>
            {/* Individual label settings like size/font if they differ from common settings */}
            {/* For now, assuming common labelSettings drive these for all labels based on original structure */}
            <div className="flex justify-end mt-3">
              <button onClick={() => dispatch({ type: DELETE_LABEL, payload: { id: label.id } })} className="text-sm text-red-600 hover:text-red-700" > Delete </button>
            </div>
          </div>
        ))}
        
        <div className="flex justify-start mt-2">
            <button
            onClick={() => dispatch({ type: ADD_LABEL })}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
            >
            Add Label
          </button>
        </div>

        {labels.length > 0 && (
          <details className="mt-4 mb-6">
            <summary className="cursor-pointer text-sm text-gray-300 hover:text-white">
              Label Style (All Labels)
            </summary>
            <div className="mt-3 space-y-4 pl-2 p-3 bg-gray-700 rounded-lg">
              {/* Font Dropdown */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">Font</label>
                <select
                  value={labelSettings.font}
                  onChange={(e) => dispatch({ type: UPDATE_COMMON_LABEL_SETTINGS, payload: { key: 'font', value: e.target.value } })}
                  className="w-full p-2 text-sm border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Arial">Arial</option>
                  <option value="Impact">Impact</option>
                  {/* Add other font options from MemeGenerator */}
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

              {/* Size Slider */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">Size</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="40" // Assuming same range as caption text for now
                    max="120"
                    value={labelSettings.size}
                    onChange={(e) => dispatch({ type: UPDATE_COMMON_LABEL_SETTINGS, payload: { key: 'size', value: parseInt(e.target.value) } })}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-300 w-12">{labelSettings.size}</span>
                </div>
              </div>

              {/* Text Color */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">Text Color</label>
                <div className="flex gap-0 border border-gray-700 rounded-md overflow-hidden">
                  <button
                    onClick={() => dispatch({ type: UPDATE_COMMON_LABEL_SETTINGS, payload: { key: 'color', value: 'white' } })}
                    className={`flex-1 p-2 text-sm font-bold text-black bg-white flex items-center justify-center gap-1 ${
                      labelSettings.color === 'white' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    {labelSettings.color === 'white' && <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    White
                  </button>
                  <div className="w-px bg-gray-200"></div>
                  <button
                    onClick={() => dispatch({ type: UPDATE_COMMON_LABEL_SETTINGS, payload: { key: 'color', value: 'black' } })}
                    className={`flex-1 p-2 text-sm font-bold text-white bg-black flex items-center justify-center gap-1 ${
                      labelSettings.color === 'black' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-opacity-90'
                    }`}
                  >
                    {labelSettings.color === 'black' && <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    Black
                  </button>
                </div>
              </div>

              {/* Stroke Weight */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">Stroke Weight</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="20" // Assuming same range as caption text for now
                    value={Math.round(labelSettings.strokeWeight * 100)}
                    onChange={(e) => dispatch({ type: UPDATE_COMMON_LABEL_SETTINGS, payload: { key: 'strokeWeight', value: parseInt(e.target.value) / 100 } })}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-300 w-12">{Math.round(labelSettings.strokeWeight * 100)}%</span>
                </div>
              </div>

              {/* Background Color for Label Text */}
              <div>
                <label className="block text-xs text-gray-300 mb-1">Background Color</label>
                <div className="flex gap-0 border border-gray-700 rounded-md overflow-hidden">
                    <button onClick={() => dispatch({ type: UPDATE_COMMON_LABEL_SETTINGS, payload: { key: 'backgroundColor', value: 'black' } })} className={`flex-1 p-2 text-sm font-bold text-white bg-black flex items-center justify-center gap-1 ${labelSettings.backgroundColor === 'black' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-opacity-90'}`}> {labelSettings.backgroundColor === 'black' && ( <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> )} Black </button>
                    <div className="w-px bg-gray-200" />
                    <button onClick={() => dispatch({ type: UPDATE_COMMON_LABEL_SETTINGS, payload: { key: 'backgroundColor', value: 'white' } })} className={`flex-1 p-2 text-sm font-bold text-black bg-white flex items-center justify-center gap-1 ${labelSettings.backgroundColor === 'white' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-gray-50'}`}> {labelSettings.backgroundColor === 'white' && ( <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> )} White </button>
                    <div className="w-px bg-gray-200" />
                    <button onClick={() => dispatch({ type: UPDATE_COMMON_LABEL_SETTINGS, payload: { key: 'backgroundColor', value: 'transparent' } })} className={`flex-1 p-2 text-sm font-bold text-white bg-gray-700 flex items-center justify-center gap-1 ${labelSettings.backgroundColor === 'transparent' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-gray-600'}`}> {labelSettings.backgroundColor === 'transparent' && ( <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> )} None </button>
                </div>
              </div>

              {/* Background Opacity for Label Text */}
              {labelSettings.backgroundColor !== 'transparent' && (
                <div>
                  <label className="block text-xs text-gray-300 mb-1">Background Opacity</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      value={Math.round(labelSettings.backgroundOpacity * 100)} 
                      onChange={(e) => dispatch({ type: UPDATE_COMMON_LABEL_SETTINGS, payload: { key: 'backgroundOpacity', value: parseInt(e.target.value) / 100 } })}
                      className="flex-1" 
                    />
                    <span className="text-sm text-gray-300 w-12">{Math.round(labelSettings.backgroundOpacity * 100)}%</span>
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </details>
  );
};

export default LabelControls; 