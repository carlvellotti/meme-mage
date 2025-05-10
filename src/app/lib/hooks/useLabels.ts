import { useReducer, Dispatch } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Type definitions (originally from MemeGenerator.tsx)
export interface Label {
  id: string;
  text: string;
  horizontalPosition: number;
  verticalPosition: number;
  size: number;
  font: string;
}

export interface CommonLabelSettings {
  font: string;
  size: number;
  color: 'white' | 'black';
  strokeWeight: number;
  backgroundColor: 'black' | 'white' | 'transparent';
  backgroundOpacity: number;
}

export interface LabelsState {
  labels: Label[];
  labelSettings: CommonLabelSettings;
}

export const initialLabelsState: LabelsState = {
  labels: [],
  labelSettings: {
    font: 'Arial',
    size: 78,
    color: 'white',
    strokeWeight: 0.08,
    backgroundColor: 'black',
    backgroundOpacity: 0.5,
  },
};

// Action Types (as string constants, originally from MemeGenerator.tsx)
export const ADD_LABEL = 'ADD_LABEL';
export const UPDATE_LABEL = 'UPDATE_LABEL';
export const DELETE_LABEL = 'DELETE_LABEL';
export const UPDATE_COMMON_LABEL_SETTINGS = 'UPDATE_COMMON_LABEL_SETTINGS';

// Action Interfaces (originally from MemeGenerator.tsx)
export interface AddLabelAction { type: typeof ADD_LABEL; }
export interface UpdateLabelAction { type: typeof UPDATE_LABEL; payload: { id: string; updates: Partial<Label> }; }
export interface DeleteLabelAction { type: typeof DELETE_LABEL; payload: { id: string }; }
export interface UpdateCommonLabelSettingsAction { type: typeof UPDATE_COMMON_LABEL_SETTINGS; payload: { key: keyof CommonLabelSettings; value: string | number }; }

export type LabelAction = AddLabelAction | UpdateLabelAction | DeleteLabelAction | UpdateCommonLabelSettingsAction;

// Reducer (adapted from MemeGenerator.tsx)
export const labelsReducer = (state: LabelsState, action: LabelAction): LabelsState => {
  switch (action.type) {
    case ADD_LABEL:
      const newLabel: Label = {
        id: uuidv4(),
        text: '',
        horizontalPosition: 50,
        verticalPosition: 50,
        size: state.labelSettings.size,
        font: state.labelSettings.font,
      };
      return { ...state, labels: [...state.labels, newLabel] };
    case UPDATE_LABEL:
      return {
        ...state,
        labels: state.labels.map(label =>
          label.id === action.payload.id ? { ...label, ...action.payload.updates } : label
        ),
      };
    case DELETE_LABEL:
      return {
        ...state,
        labels: state.labels.filter(label => label.id !== action.payload.id),
      };
    case UPDATE_COMMON_LABEL_SETTINGS:
      const newSettings = {
        ...state.labelSettings,
        [action.payload.key]: action.payload.value,
      };
      return {
        ...state,
        labelSettings: newSettings,
        labels: state.labels.map(label => ({
          ...label,
          ...(action.payload.key === 'font' && { font: action.payload.value as string }),
          ...(action.payload.key === 'size' && { size: action.payload.value as number }),
        })),
      };
    default:
      return state;
  }
};

// Custom Hook
export const useLabels = (): [LabelsState, Dispatch<LabelAction>] => {
  const [state, dispatch] = useReducer(labelsReducer, initialLabelsState);
  return [state, dispatch];
}; 