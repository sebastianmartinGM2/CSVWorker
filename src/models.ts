import { z } from 'zod';

export const DirectionEnum = z.enum(['debit', 'credit']);

export const BankMovementSchema = z.object({
  bankId: z.string().min(1),
  accountId: z.string().min(1),
  bookingDate: z.union([z.string(), z.date()]),
  valueDate: z.union([z.string(), z.date()]).optional(),
  conceptCode: z.string().optional(),
  concept: z.string().min(1),
  // accept numeric strings (with possible separators) and coerce to number
  amount: z.preprocess((v) => {
    if (typeof v === 'string') {
      const cleaned = v.replace(/[^0-9.-]+/g, '');
      return cleaned === '' ? NaN : Number(cleaned);
    }
    return v;
  }, z.number().positive()),
  direction: DirectionEnum,
  currency: z.string().min(1),
  balance: z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v === 'string') {
      const cleaned = v.replace(/[^0-9.-]+/g, '');
      return cleaned === '' ? NaN : Number(cleaned);
    }
    return v;
  }, z.number().optional()),
  counterpartyName: z.string().optional(),
  counterpartyIdType: z.string().optional(),
  counterpartyIdNumber: z.string().optional(),
  counterpartyAccount: z.string().optional(),
  reference: z.string().optional(),
  rawRowId: z.union([z.string(), z.number()]).optional(),
});

export type BankMovement = z.infer<typeof BankMovementSchema>;

export default BankMovementSchema;
