import { z } from 'zod';

// Schema for creating a new Persona
export const PersonaCreateSchema = z.object({
  name: z.string().trim().min(1, { message: "Name cannot be empty" }),
  description: z.string().trim().optional(), // Trim description too
});

// Schema for updating an existing Persona (can be the same as create)
export const PersonaUpdateSchema = PersonaCreateSchema;

// Schema for creating/updating Meme Feedback
export const FeedbackCreateSchema = z.object({
  template_id: z.string().uuid({ message: "Invalid Template ID format" }),
  persona_id: z.string().uuid({ message: "Invalid Persona ID format" }),
  status: z.enum(['used', 'dont_use'], { 
    required_error: "Status is required",
    invalid_type_error: "Status must be either 'used' or 'dont_use'"
  }),
}); 