import { z } from 'zod';

export const emailSchema = z.string().trim().email('Enter a valid email address.');
export const passwordSchema = z
  .string()
  .min(8, 'Password must have at least 8 characters.')
  .regex(/[A-Z]/, 'Add at least one uppercase letter.')
  .regex(/[a-z]/, 'Add at least one lowercase letter.')
  .regex(/[0-9]/, 'Add at least one number.');

export const signUpSchema = z
  .object({
    firstName: z.string().trim().min(2, 'Enter your first name.').max(60),
    lastName: z.string().trim().min(2, 'Enter your last name.').max(60),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const chatInputSchema = z
  .string()
  .trim()
  .min(1, 'Write a message first.')
  .max(8000, 'Keep your message under 8,000 characters.');

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Check the information and try again.';
}
