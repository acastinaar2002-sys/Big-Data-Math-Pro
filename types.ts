
export enum AppTab {
  SIMULATOR = 'SIMULATOR',
  TUTOR = 'TUTOR'
}

export interface VariableDef {
  name: string;
  symbol: string;
  min: number;
  max: number;
  default: number;
  step: number;
  description: string;
}

export interface OutputVariable {
  name: string;
  symbol: string; // The key used in the JS return object
  unit?: string;
  color?: string; // Hex code for the chart
  visible?: boolean;
}

export interface SimulationSchema {
  title: string;
  description: string;
  independentVariables: VariableDef[];
  outputs: OutputVariable[]; // Changed from single dependentVariable to array
  jsFormula: string; // Must return a number OR an object { y1: val, y2: val }
  pythonFormula: string;
  analysisMarkdown: string;
}

export interface DataPoint {
  [key: string]: number | string;
}
