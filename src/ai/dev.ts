'use server';
// Flows will be imported for their side effects in this file.
import './flows/extract-vehicle-data-flow';
import './flows/analyze-damage-flow';
import './flows/extract-driver-data-flow';
import './flows/extract-event-data-flow';
import './flows/extract-contract-data-flow';
import './flows/extract-drivers-from-document-flow';
import './flows/process-voice-task-flow';
import './flows/contract-assistant-flow';
import './flows/fleet-assistant-flow';
import './flows/extract-vehicles-from-document-flow';
import './flows/extract-document-info-flow';
import './flows/refine-text-flow';
