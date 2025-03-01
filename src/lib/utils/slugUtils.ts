/**
 * Utility functions for handling slugs for meme templates
 */

/**
 * Converts a template name to a URL-friendly slug
 * @param name The template name to convert
 * @returns A URL-friendly slug
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
}

/**
 * Converts a slug back to a readable format (for display purposes)
 * @param slug The slug to convert
 * @returns A readable name
 */
export function slugToReadableName(slug: string): string {
  return slug
    .replace(/-/g, ' ') // Replace hyphens with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
} 