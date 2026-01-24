import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjaqoleimhuulkdbiriu.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYXFvbGVpbWh1dWxrZGJpcml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkyODY4MTEsImV4cCI6MjA4NDg2MjgxMX0.UNkDi_jVO28bK1wAO8QdoGKAriM5iUFB9ai7qpY50Ho';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage bucket name
const BUCKET_NAME = 'songs';

/**
 * Upload a PDF file to Supabase Storage
 * @param choirId - The choir ID
 * @param songId - The song ID
 * @param file - The file to upload
 * @returns The public URL of the uploaded file
 */
export async function uploadPdfToSupabase(choirId: string, songId: string, file: File | Blob): Promise<string> {
    const fileName = `${choirId}/${songId}.pdf`;

    // Upload the file
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true, // Overwrite if exists
            contentType: 'application/pdf'
        });

    if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

/**
 * Delete a PDF file from Supabase Storage
 * @param choirId - The choir ID
 * @param songId - The song ID
 */
export async function deletePdfFromSupabase(choirId: string, songId: string): Promise<void> {
    const fileName = `${choirId}/${songId}.pdf`;

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileName]);

    if (error) {
        console.error('Supabase delete error:', error);
        // Don't throw - file might not exist
    }
}
