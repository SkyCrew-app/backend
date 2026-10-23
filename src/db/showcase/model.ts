import { FleetAircraft } from './fleet';
import { FlightCategory } from '../../modules/reservations/entity/reservations.entity';
import { InvoiceLine } from '../../modules/invoices/invoice-number';

// The showcase club as it is planned in memory, before anything is written.
// Rows refer to each other by object; `id` is set when a row is written.

export type MemberKind =
  | 'pilot'
  | 'student'
  | 'instructor'
  | 'technician'
  | 'office';

export const ROLE_OF: Record<MemberKind, string> = {
  pilot: 'Pilote',
  student: 'Pilote',
  instructor: 'Instructeur',
  technician: 'Technicien',
  office: 'Administrateur',
};

export interface DraftLicence {
  member: DraftMember;
  license_type: string;
  license_number: string;
  issue_date: Date;
  expiration_date: Date;
  status: 'active' | 'expired';
  is_valid: boolean;
  // Reminders already sent (the step and the expiry date it was for).
  reminderDays: number | null;
  // Renewed by a refresh: when, and the expiry it had before (a booking
  // made before the renewal was checked against that one).
  renewedAt?: Date;
  previousExpiry?: Date;
  id?: number;
}

export interface DraftMember {
  key: string;
  kind: MemberKind;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  birth: Date;
  joined: Date;
  priorHours: number;
  // Experienced enough for the advanced aircraft.
  experienced: boolean;
  // How often they fly: relative weight.
  activity: number;
  licences: DraftLicence[];
  // Instructor of a student.
  instructor?: DraftMember;
  // One of the presentation accounts: 'pilot' | 'student' | ...
  login?: string;
  // Filled while planning.
  balanceCents: number;
  closedHours: number;
  // A refresh books for the member from then on only: its money lines come
  // after the last one of the account.
  bookableFrom?: Date;
  id?: number;
}

export interface DraftCourse {
  instructor: DraftMember;
  student: DraftMember;
  lesson: number;
  start: Date;
  end: Date;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  feedback: string | null;
  rating: number | null;
  competencies: {
    name: string;
    description: string;
    validated: boolean;
    validatedAt: Date | null;
  }[];
  comments: { author: DraftMember; content: string; at: Date }[];
  booking: DraftBooking | null;
  id?: number;
}

export interface DraftFlight {
  booking: DraftBooking;
  hours: number;
  departure: Date;
  arrival: Date;
  origin: string;
  destination: string;
  closedAt: Date | null;
  remarks: string;
  passengers: number;
  // A flight plan made ahead of the flight (a row of the new engine): it is
  // what the pilot closes once flown.
  planned?: boolean;
  id?: number;
}

export interface DraftBooking {
  aircraft: FleetAircraft & { id?: number };
  pilot: DraftMember;
  instructor: DraftMember | null;
  bookedAt: Date;
  start: Date;
  end: Date;
  category: FlightCategory;
  purpose: string;
  notes: string | null;
  passengers: number;
  priceCents: number;
  // Destination of a cross-country flight.
  destination: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  // An administrator cancelled it for the member.
  cancelledBy: DraftMember | null;
  course: DraftCourse | null;
  flight: DraftFlight | null;
  // A cancelled booking is deleted, as the API does: it only keeps the id
  // its charge and refund lines refer to.
  id?: number;
}

export type PaymentKind =
  | 'top_up'
  | 'booking'
  | 'booking_refund'
  | 'manual_credit'
  | 'manual_debit';

export interface DraftInvoice {
  member: DraftMember;
  number: string;
  date: Date;
  amountCents: number;
  method: string;
  lines: () => InvoiceLine[];
  id?: number;
}

export interface DraftPayment {
  member: DraftMember;
  kind: PaymentKind;
  amountCents: number;
  date: Date;
  method: string;
  status: 'completed' | 'pending';
  reason: string | null;
  booking: DraftBooking | null;
  invoice: DraftInvoice | null;
  createdBy: DraftMember | null;
  externalId: string | null;
  id?: number;
}

export interface DraftAdminAction {
  actor: DraftMember;
  at: Date;
  action: string;
  targetType: string;
  // Read when written: the target's id is known then.
  targetId: () => string | null;
  targetLabel: string | null;
  summary: () => Record<string, unknown> | null;
}

export interface DraftNotification {
  member: DraftMember;
  type: string;
  message: () => string;
  date: Date;
  read: boolean;
  priority: string | null;
  expiration: Date | null;
}
