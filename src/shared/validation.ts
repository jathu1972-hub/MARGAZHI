import { z } from 'zod';
import { normalizeIndianPhone } from './seatAllocation';

export const GENDER_OPTIONS = [
  'Male',
  'Female',
  'Other',
  'Prefer not to say',
] as const;

export const CreateBookingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Please enter your full name (at least 2 characters).')
    .max(120, 'Name must be under 120 characters.'),
  phone: z
    .string()
    .trim()
    .refine((val) => normalizeIndianPhone(val) !== null, {
      message: 'Please enter a valid 10-digit Indian mobile number (starting with 6–9).',
    }),
  address: z
    .string()
    .trim()
    .min(5, 'Please enter your full residential address.')
    .max(400, 'Address must be under 400 characters.'),
  gender: z.enum(GENDER_OPTIONS, {
    error: 'Please select a gender option.',
  }),
  consent: z.literal(true, {
    error: 'You must agree to the registration consent statement.',
  }),
  dateIds: z
    .array(z.string().min(1))
    .min(1, 'Please select at least one festival date.')
    .max(9, 'Cannot select more than 9 festival dates.'),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, 'Invalid submission key.')
    .max(128, 'Invalid submission key.'),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

export const AdminLoginSchema = z.object({
  password: z.string().min(1, 'Please enter the administrator password.'),
});

export const VerifyTicketSchema = z.object({
  ticketId: z.string().trim().min(1, 'Ticket ID is required.'),
  token: z.string().trim().min(1, 'Verification token is required.'),
});
