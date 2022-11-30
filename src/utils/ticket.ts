import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from '@/types';

export const generateTicket = (type: TransactionType | 'mfaTotp') =>
  `${type}:${uuidv4()}`;

export function generateTicketExpiresAt(seconds: number) {
  const date = new Date();
  date.setSeconds(date.getSeconds() + seconds);
  return date;
}
