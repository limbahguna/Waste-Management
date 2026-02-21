import { createContext, useContext, useState, ReactNode } from 'react';

interface PerceptionResult {
  wasteType: string;
  wasteGrade: string;
  grade: "A" | "B" | "C";
  moisture: string;
  calorificValue: string;
  contamination: { detected: boolean; type: string | null };
  confidence: number;
}

interface GroqSortingDecision {
  robotCommand: string;
  targetBin: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'EMERGENCY';
  reasoning: string;
  processingNotes: string;
  estimatedValue: string;
  wasteGrade?: string;
}

interface CarbonSyncResult {
  carbonSaved: number;
  synced: boolean;
}

interface ScanState {
  selectedImage: string | null;
  perception: PerceptionResult | null;
  decision: GroqSortingDecision | null;
  carbonSyncResult: CarbonSyncResult | null;
  debugData: Record<string, unknown> | null;
}

interface ScanContextType {
  scanState: ScanState;
  setScanState: (state: ScanState) => void;
  clearScanState: () => void;
  hasScanResult: boolean;
}

const emptyScanState: ScanState = {
  selectedImage: null,
  perception: null,
  decision: null,
  carbonSyncResult: null,
  debugData: null,
};

const ScanContext = createContext<ScanContextType | undefined>(undefined);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [scanState, setScanState] = useState<ScanState>(emptyScanState);

  const clearScanState = () => setScanState(emptyScanState);
  const hasScanResult = !!(scanState.perception && scanState.selectedImage);

  return (
    <ScanContext.Provider value={{ scanState, setScanState, clearScanState, hasScanResult }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScanContext() {
  const context = useContext(ScanContext);
  if (!context) throw new Error('useScanContext must be used within a ScanProvider');
  return context;
}
