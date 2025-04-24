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

// --- Caption Rule Schemas ---

// Schema for creating a new Caption Rule Set
export const CaptionRuleCreateSchema = z.object({
  name: z.string().trim().min(1, { message: "Name cannot be empty" }),
  rules_text: z.string().trim().min(1, { message: "Rules text cannot be empty" }),
});

// Schema for updating an existing Caption Rule Set
export const CaptionRuleUpdateSchema = z.object({
  name: z.string().trim().min(1, { message: "Name cannot be empty" }).optional(),
  rules_text: z.string().trim().min(1, { message: "Rules text cannot be empty" }).optional(),
}).refine(data => data.name || data.rules_text, {
  message: "At least one field (name or rules_text) must be provided for update",
  path: [], // Optional: Specify a path, or leave empty for a general error
}); 