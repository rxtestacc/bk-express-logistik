
import { collection, serverTimestamp, Timestamp, addDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

type EntityType = 'task' | 'event' | 'vehicle' | 'driver' | 'damage_marker' | 'handover' | 'document' | 'contract';
type Action = 'create' | 'update' | 'delete';

type AnyRec = Record<string, any>;

export const isTimestamp = (v: unknown): v is Timestamp => v instanceof Timestamp;

export const isServerTimestamp = (v: unknown): boolean => {
    if (typeof v !== 'object' || v === null) return false;
    return (v as any)._methodName === 'serverTimestamp' || 
           (v as any)._type === 'server_timestamp';
}

/**
 * STRICKTE Prüfung für einfache Datenobjekte.
 * Verhindert das Eindringen in komplexe SDK- oder Browser-Objekte (File, Blob, etc.)
 */
const isSimpleDataValue = (val: any): boolean => {
    if (val === null || val === undefined) return true;
    const type = typeof val;
    return type === 'string' || type === 'number' || type === 'boolean' || isTimestamp(val) || isServerTimestamp(val) || val instanceof Date;
};

const isPlainObject = (val: any) => 
    !!val && typeof val === 'object' && 
    Object.getPrototypeOf(val) === Object.prototype;

const flatten = (obj: any, prefix = '', res: AnyRec = {}, depth = 0): AnyRec => {
    // Harte Grenze für Rekursionstiefe und Typprüfung
    if (obj === null || typeof obj !== 'object' || depth > 2 || !isPlainObject(obj)) {
        return res;
    }
    
    try {
        Object.entries(obj).forEach(([key, value]) => {
            if (key.startsWith('_')) return; // Interne Felder ignorieren
            const pre = prefix.length ? prefix + '.' : '';
            
            if (isSimpleDataValue(value)) {
                res[pre + key] = value;
            } else if (Array.isArray(value)) {
                res[pre + key] = `Liste(${value.length})`;
            } else if (isPlainObject(value)) {
                flatten(value, pre + key, res, depth + 1);
            }
        });
    } catch (e) {
        console.error("Error flattening audit data:", e);
        // Silent catch um Abstürze bei zirkulären Referenzen zu verhindern
    }
    return res;
};

const fieldTranslations: Record<string, string> = {
    // Allgemeine Felder
    title: 'Titel',
    description: 'Beschreibung',
    status: 'Status',
    notes: 'Notizen',
    due_date: 'Datum',
    assignee_name: 'Zuständiger',
    category: 'Kategorie',
    license_plate: 'Kennzeichen',
    
    // Fahrzeug Felder
    vin: 'FIN/VIN',
    make: 'Fabrikat',
    model: 'Modell',
    mileage_km: 'Kilometerstand',
    first_registration: 'Erstzulassung',
    purchase_date: 'Zulassung BK',
    tuv_due: 'TÜV fällig',
    carrier: 'Auftraggeber',
    fleet_type: 'Fuhrpark',
    location: 'Standort',
    power_kw: 'Leistung (kW)',
    fuel_type: 'Kraftstoff',
    color: 'Farbe',
    tire_size: 'Reifengröße',
    engine: 'Motor',
    hsn: 'HSN',
    tsn: 'TSN',
    variant: 'Variante',
    year: 'Baujahr',
    first_installment_date: 'Ersterate Datum',
    last_installment_date: 'Schlussrate Datum',
    
    // Fahrer Felder
    first_name: 'Vorname',
    last_name: 'Nachname',
    phone: 'Telefon',
    email: 'E-Mail',
    'address.street': 'Straße',
    'address.zip': 'PLZ',
    'address.city': 'Stadt',
    license_number: 'Führerschein-Nr.',
    license_expiry_date: 'FS-Ablauf',
    license_issue_date: 'FS-Erteilung',
    license_issue_country: 'Ausstellungsland',
    license_classes: 'FS-Klassen',
    nationality: 'Nationalität',
    birth_place: 'Geburtsort',
    birth_date: 'Geburtsdatum',
    employment_start_date: 'Eintrittsdatum',
    employee_number: 'Personalnummer',
    zsb: 'ZSB',
    health_insurance: 'Krankenkasse',
    
    // Ereignis / Schaden Felder
    odometer_km: 'Tachostand',
    cost_eur: 'Kosten (€)',
    vendor: 'Werkstatt/Partner',
    type: 'Ereignis-Typ',
    police_involved: 'Polizei dabei',
    police_case_number: 'Aktenzeichen',
    fault: 'Schuldfrage',
    'third_party.first_name': 'Gegner Vorname',
    'third_party.last_name': 'Gegner Nachname',
    'third_party.license_plate': 'Gegner Kennzeichen',
    
    // Vertrag Felder
    providerName: 'Vertragspartner',
    contractNumber: 'Vertragsnummer',
    startDate: 'Beginn',
    endDate: 'Ende',
    cancellationDeadline: 'Kündigungsfrist',
    monthlyCostEur: 'Monatl. Rate',
    contractType: 'Vertragsart',
    acquisition_type: 'Erwerbsart',
    purchase_price: 'Investition',
    leasing_start: 'Leasing-Beginn',
    leasing_end: 'Leasing-Ende',
    leasing_rate_eur: 'Rate',
    financing_start: 'Finanzierung-Beginn',
    financing_end: 'Finanzierung-Ende',
    financing_rate_eur: 'Finanz-Rate',
    matchStatus: 'Prüfstatus',
    contractStatus: 'Vertragsstatus',
    
    // Übergabe Felder
    handoverAt: 'Übergabedatum',
    toDriverName: 'Empfänger',
    fromDriverName: 'Übergeber',
    existingDamageConfirmed: 'Vorschäden bestätigt',
    
    // ID-Verknüpfungen (werden oft im Display aufgelöst)
    driverId: 'Fahrer',
    vehicleId: 'Fahrzeug',
    fromDriverId: 'Abgebender Fahrer',
    toDriverId: 'Übernehmender Fahrer',
};

export const translateFieldName = (field: string) => fieldTranslations[field] || field;

export const formatAuditValue = (field: string, value: unknown): string => {
    if (isServerTimestamp(value)) return 'Aktuelles Datum';
    if (value === null || value === undefined || value === '') return 'nicht festgelegt';
    
    // Übersetzung von Enum-Werten
    const stringValue = String(value);
    
    if (field === 'status') {
        const translations: Record<string, string> = {
            aktiv: 'Aktiv', in_werkstatt: 'In Werkstatt', inaktiv: 'Inaktiv',
            open: 'Offen', in_progress: 'In Bearbeitung', done: 'Erledigt',
            draft: 'Entwurf', completed: 'Abgeschlossen', new_damage: 'Neuer Schaden', 
            in_review: 'In Prüfung', closed: 'Archiviert'
        };
        return translations[stringValue] || stringValue;
    }
    
    if (field === 'fault') {
        const translations: Record<string, string> = {
            own: 'Eigenschuld', third_party: 'Fremdschuld', unknown: 'Unbekannt'
        };
        return translations[stringValue] || stringValue;
    }

    if (field === 'acquisition_type' || field === 'contractType') {
        const translations: Record<string, string> = {
            cash: 'Barkauf', purchase: 'Kauf', leasing: 'Leasing', financing: 'Finanzierung',
            insurance: 'Versicherung', warranty: 'Garantie', maintenance: 'Wartung', other: 'Sonstiges'
        };
        return translations[stringValue] || stringValue;
    }

    if (field === 'contractStatus') {
        const translations: Record<string, string> = {
            active: 'Aktiv', expiring_soon: 'Läuft bald aus', expired: 'Abgelaufen'
        };
        return translations[stringValue] || stringValue;
    }

    if (field === 'matchStatus') {
        const translations: Record<string, string> = {
            unverified: 'Ungeprüft', verified: 'Geprüft', corrected: 'Korrigiert'
        };
        return translations[stringValue] || stringValue;
    }

    if (isTimestamp(value)) return format(value.toDate(), 'dd.MM.yyyy HH:mm', { locale: de });
    if (value instanceof Date) return format(value, 'dd.MM.yyyy HH:mm', { locale: de });
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
    
    return stringValue;
};

/**
 * Erstellt ein Audit-Log Eintrag. 
 * Absolut sicher gegen Hänger durch setTimeout und striktes Flattening.
 */
export const generateAuditLog = async (
    firestore: any,
    entityType: EntityType,
    entityId: string,
    originalData: unknown,
    newData: unknown,
    username: string,
    action: Action = 'update'
) => {
    if (!firestore) return;
    
    // Komplett vom Hauptthread entkoppeln
    setTimeout(async () => {
        try {
            // Nur einfache Datenstrukturen verarbeiten
            const safeOriginal = isPlainObject(originalData) ? originalData : {};
            const safeNew = isPlainObject(newData) ? newData : {};

            const flatBefore = flatten(safeOriginal);
            const flatAfter = flatten(safeNew);

            let changes: { field: string; oldValue: any; newValue: any }[] = [];

            if (action === 'create') {
                changes = Object.entries(flatAfter).map(([key, value]) => ({ field: key, oldValue: null, newValue: value }));
            } else if (action === 'update') {
                const allKeys = new Set([...Object.keys(flatBefore), ...Object.keys(flatAfter)]);
                allKeys.forEach(key => {
                    const ov = flatBefore[key];
                    const nv = flatAfter[key];
                    if (JSON.stringify(ov) !== JSON.stringify(nv)) {
                         changes.push({ field: key, oldValue: ov ?? null, newValue: nv ?? null });
                    }
                });
            } else if (action === 'delete') {
                changes = Object.entries(flatBefore).map(([key, value]) => ({ field: key, oldValue: value, newValue: null }));
            }

            // Unwichtige Felder filtern
            const filteredChanges = changes.filter(c => !['updated_at', 'created_at', 'id', 'storagePath', 'downloadUrl', 'mileage_updated_at'].includes(c.field));
            
            if (filteredChanges.length === 0 && action === 'update') return;

            await addDoc(collection(firestore, 'audit_logs'), {
                entity: entityType,
                entityId,
                timestamp: serverTimestamp(),
                userName: username || 'System',
                action,
                changes: filteredChanges.length > 0 ? filteredChanges : changes.slice(0, 10), // Notfall-Limit
            });
        } catch (e) {
            console.error("Audit log failed safely", e);
        }
    }, 100); // Kleiner Delay für UI-Priorität
};
