
import { Timestamp } from 'firebase/firestore';

export interface Vehicle {
  id: string;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  first_registration: { seconds: number; nanoseconds: number } | Timestamp;
  mileage_km: number;
  status: string;
  carrier?: 'GLS' | 'Hermes' | 'Stadtbote';
  fleet_type?: 'Ja' | 'Überlassung';
  variant?: string;
  year?: number;
  engine?: string;
  fuel_type?: string;
  power_kw?: number;
  tire_size?: string;
  color?: string;
  location?: string;
  notes?: string;
  hsn?: string;
  tsn?: string;
  
  acquisition_type?: 'cash' | 'leasing' | 'financing';
  purchase_date?: { seconds: number; nanoseconds: number } | Timestamp;
  purchase_price?: number;
  leasing_start?: { seconds: number; nanoseconds: number } | Timestamp;
  leasing_end?: { seconds: number; nanoseconds: number } | Timestamp;
  leasing_rate_eur?: number;
  first_installment_date?: { seconds: number; nanoseconds: number } | Timestamp;
  last_installment_date?: { seconds: number; nanoseconds: number } | Timestamp;
  leasing_annual_mileage?: number;
  leasing_company?: string;
  financing_start?: { seconds: number; nanoseconds: number } | Timestamp;
  financing_end?: { seconds: number; nanoseconds: number } | Timestamp;
  financing_rate_eur?: number;
  financing_bank?: string;
  warranty_end?: { seconds: number; nanoseconds: number } | Timestamp;
  tuv_due?: { seconds: number; nanoseconds: number } | Timestamp;
  total_costs_eur?: number;
}

export interface Contract {
    id: string;
    vehicleId: string | null;
    vehicleMatchCandidateIds?: string[];
    matchConfidence?: 'high' | 'medium' | 'low' | 'none';
    matchStatus: 'unverified' | 'verified' | 'corrected';
    contractStatus: 'active' | 'expiring_soon' | 'expired';
    contractType: 'leasing' | 'financing' | 'purchase' | 'warranty' | 'maintenance' | 'insurance' | 'other';
    providerName: string | null;
    contractNumber: string | null;
    startDate: Timestamp | null;
    endDate: Timestamp | null;
    cancellationDeadline: Timestamp | null;
    monthlyCostEur: number | null;
    yearlyCostEur: number | null;
    oneTimeCostEur: number | null;
    currency: 'EUR';
    notes: string | null;
    responsibleName: string | null;
    summary?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdByName: string;
    documentRef?: {
        downloadUrl: string;
        fileName: string;
        fileType: string;
    };
}
