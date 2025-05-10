import React from 'react';

// TODO: Define WatermarkSettings type if not already globally available
interface WatermarkSettings {
  text: string;
  horizontalPosition: number;
  verticalPosition: number;
  size: number;
  font: string;
  color: 'white' | 'black';
  strokeWeight: number;
  opacity: number;
  backgroundColor: 'black' | 'white' | 'transparent';
  backgroundOpacity: number;
}

interface WatermarkControlsProps {
  isWatermarkEnabled: boolean;
  onToggleWatermark: (enabled: boolean) => void;
  watermarkSettings: WatermarkSettings;
  onWatermarkSettingChange: (key: keyof WatermarkSettings, value: string | number) => void;
}

const WatermarkControls: React.FC<WatermarkControlsProps> = ({
  isWatermarkEnabled,
  onToggleWatermark,
  watermarkSettings,
  onWatermarkSettingChange,
}) => {
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm text-gray-300 hover:text-white list-item">
        <div className="inline-flex items-center gap-2 ml-1">
          <span>Watermark</span>
          <input
            type="checkbox"
            checked={isWatermarkEnabled}
            onChange={(e) => {
              e.stopPropagation(); 
              onToggleWatermark(!isWatermarkEnabled);
            }}
            onClick={(e) => e.stopPropagation()} 
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
          />
        </div>
      </summary>
      {isWatermarkEnabled && (
        <div className="mt-3 space-y-4 pl-4 pr-2 py-3 bg-gray-700/50 rounded-lg">
          <div>
            <label className="block text-xs text-gray-300 mb-1">Text</label>
            <input 
              type="text" 
              value={watermarkSettings.text} 
              onChange={(e) => onWatermarkSettingChange('text', e.target.value)} 
              placeholder="Enter watermark text..." 
              className="w-full p-2 text-sm border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Font</label>
            <select 
              value={watermarkSettings.font} 
              onChange={(e) => onWatermarkSettingChange('font', e.target.value)} 
              className="w-full p-2 text-sm border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="Arial">Arial</option>
              <option value="Impact">Impact</option>
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
                min="10" 
                max="100" 
                value={watermarkSettings.size} 
                onChange={(e) => onWatermarkSettingChange('size', parseInt(e.target.value))} 
                className="flex-1" 
              />
              <span className="text-sm text-gray-300 w-12">{watermarkSettings.size}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-300 mb-1">Horizontal Position</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={watermarkSettings.horizontalPosition} 
                  onChange={(e) => onWatermarkSettingChange('horizontalPosition', parseInt(e.target.value))} 
                  className="flex-1" 
                />
                <span className="text-sm text-gray-300 w-12">{watermarkSettings.horizontalPosition}%</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-300 mb-1">Vertical Position</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={watermarkSettings.verticalPosition} 
                  onChange={(e) => onWatermarkSettingChange('verticalPosition', parseInt(e.target.value))} 
                  className="flex-1" 
                />
                <span className="text-sm text-gray-300 w-12">{watermarkSettings.verticalPosition}%</span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Color</label>
            <div className="flex gap-0 border rounded-md overflow-hidden">
              <button onClick={() => onWatermarkSettingChange('color', 'white')} className={`flex-1 p-2 text-sm font-bold text-black bg-white flex items-center justify-center gap-1 ${watermarkSettings.color === 'white' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-gray-50'}`} > {watermarkSettings.color === 'white' && ( <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> )} White </button>
              <div className="w-px bg-gray-200" />
              <button onClick={() => onWatermarkSettingChange('color', 'black')} className={`flex-1 p-2 text-sm font-bold text-white bg-black flex items-center justify-center gap-1 ${watermarkSettings.color === 'black' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-opacity-90'}`} > {watermarkSettings.color === 'black' && ( <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> )} Black </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Text Opacity</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={Math.round(watermarkSettings.opacity * 100)} 
                onChange={(e) => onWatermarkSettingChange('opacity', parseInt(e.target.value) / 100)} 
                className="flex-1" 
              />
              <span className="text-sm text-gray-300 w-12">{Math.round(watermarkSettings.opacity * 100)}%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Stroke Weight</label>
            <div className="flex items-center gap-2">
              <input 
                type="range" 
                min="0" 
                max="20" 
                value={Math.round(watermarkSettings.strokeWeight * 100)} 
                onChange={(e) => onWatermarkSettingChange('strokeWeight', parseInt(e.target.value) / 100)} 
                className="flex-1" 
              />
              <span className="text-sm text-gray-300 w-12">{Math.round(watermarkSettings.strokeWeight * 100)}%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Background Color</label>
            <div className="flex gap-0 border rounded-md overflow-hidden">
              <button onClick={() => onWatermarkSettingChange('backgroundColor', 'black')} className={`flex-1 p-2 text-sm font-bold text-white bg-black flex items-center justify-center gap-1 ${watermarkSettings.backgroundColor === 'black' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-opacity-90'}`} > {watermarkSettings.backgroundColor === 'black' && ( <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> )} Black </button>
              <div className="w-px bg-gray-200" />
              <button onClick={() => onWatermarkSettingChange('backgroundColor', 'white')} className={`flex-1 p-2 text-sm font-bold text-black bg-white flex items-center justify-center gap-1 ${watermarkSettings.backgroundColor === 'white' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-gray-50'}`} > {watermarkSettings.backgroundColor === 'white' && ( <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> )} White </button>
              <div className="w-px bg-gray-200" />
              <button onClick={() => onWatermarkSettingChange('backgroundColor', 'transparent')} className={`flex-1 p-2 text-sm font-bold text-white bg-gray-700 flex items-center justify-center gap-1 ${watermarkSettings.backgroundColor === 'transparent' ? 'ring-2 ring-inset ring-blue-500' : 'hover:bg-gray-600'}`} > {watermarkSettings.backgroundColor === 'transparent' && ( <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> )} None </button>
            </div>
          </div>
          {watermarkSettings.backgroundColor !== 'transparent' && (
            <div>
              <label className="block text-xs text-gray-300 mb-1">Background Opacity</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={Math.round(watermarkSettings.backgroundOpacity * 100)} 
                  onChange={(e) => onWatermarkSettingChange('backgroundOpacity', parseInt(e.target.value) / 100)} 
                  className="flex-1" 
                />
                <span className="text-sm text-gray-300 w-12">{Math.round(watermarkSettings.backgroundOpacity * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      )}
    </details>
  );
};

export default WatermarkControls; 