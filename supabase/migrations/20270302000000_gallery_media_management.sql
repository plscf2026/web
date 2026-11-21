-- Migration: Create gallery_media table for Photo Gallery & Video Memories Management
-- Created for Grand Reunion 2027 Photo Gallery & Video CMS

CREATE TABLE IF NOT EXISTS public.gallery_media (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
    title_en TEXT NOT NULL,
    title_bn TEXT NOT NULL,
    album TEXT NOT NULL DEFAULT 'heritage',
    year TEXT NOT NULL DEFAULT '2026',
    thumbnail TEXT NOT NULL,
    video_url TEXT,
    description_en TEXT DEFAULT '',
    description_bn TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for rapid queries
CREATE INDEX IF NOT EXISTS idx_gallery_media_type ON public.gallery_media (type);
CREATE INDEX IF NOT EXISTS idx_gallery_media_album ON public.gallery_media (album);
CREATE INDEX IF NOT EXISTS idx_gallery_media_sort ON public.gallery_media (sort_order ASC, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.gallery_media ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can view published gallery photos and videos
DROP POLICY IF EXISTS "Public read access for gallery media" ON public.gallery_media;
CREATE POLICY "Public read access for gallery media"
ON public.gallery_media FOR SELECT
TO anon, authenticated
USING (true);

-- 2. Permitted management access
DROP POLICY IF EXISTS "Admins full access to gallery media" ON public.gallery_media;
CREATE POLICY "Admins full access to gallery media"
ON public.gallery_media FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
