# Individual Image Captions Feature

## Overview
Implemented individual captions for each image in posts, separate from the main post content. Users can now add descriptive text to each uploaded image, which appears as an overlay on the image.

## Changes Made

### 1. Database Schema
- **File:** `supabase-schema.sql`
  - Added `caption TEXT` column to the `media` table
- **File:** `add-media-caption.sql`
  - Migration SQL file to add caption column to existing databases

### 2. Frontend - Type Definitions
- **File:** `src/app/types/media.ts`
  - Added optional `caption?: string` field to Media interface

### 3. Frontend - Create Post Component
- **File:** `src/app/components/pages/createpost/createpost.component.ts`
  - Added `imageCaptions: string[]` array to track captions
  - Updated `onFileSelected()` to initialize empty captions for new images
  - Updated `removeImage()` to also remove associated caption
  - Modified `onSubmit()` to include captions in media array

- **File:** `src/app/components/pages/createpost/createpost.component.html`
  - Redesigned image preview section from grid to list layout
  - Added textarea input for each image to enter caption
  - Each image preview shows 24x24 thumbnail with caption input beside it
  - Improved UX with clear labels and optional indicator

### 4. Frontend - Display Components
- **File:** `src/app/components/ui/post-card/post-card.component.html`
  - Added caption overlay with gradient background on carousel images
  - Added caption overlay on single images
  - Captions appear at bottom of image with semi-transparent black gradient

- **File:** `src/app/components/pages/post/post.component.html`
  - Added caption overlays to both carousel and single image displays
  - Responsive text sizing (sm on mobile, base on desktop)
  - Beautiful gradient transition from transparent to black/80

### 5. Backend - API Routes
- **File:** `src/app/api/routes/posts.js`
  - Updated `createPost` route to accept and store caption with each media item
  - Modified `getPosts` query to use JSON aggregation instead of STRING_AGG
  - Changed media structure from simple URL array to object array with url, mediaType, and caption
  - Updated single post query (`/post/:id`) to return media with captions
  - All queries now return `media` array instead of `mediaUrls` string

### 6. Database Query Changes
Changed from:
```sql
STRING_AGG(DISTINCT m."mediaUrl", ',') as "mediaUrls"
```

To:
```sql
COALESCE(
  json_agg(
    json_build_object(
      'url', m."mediaUrl", 
      'mediaType', m."mediaType",
      'caption', COALESCE(m.caption, '')
    ) ORDER BY m.id
  ) FILTER (WHERE m.id IS NOT NULL),
  '[]'
) as media
```

## UI/UX Features

### Caption Display
- Captions appear as overlay at bottom of images
- Gradient background (from-black/80 to-transparent) for readability
- White text with proper line height for multi-line captions
- Appears on both post cards and detail pages
- Works with single images and carousels

### Caption Input
- Clean list-based layout in create post form
- Small thumbnail (24x24) with caption textarea beside it
- Optional indicator so users know captions aren't required
- Remove button positioned on thumbnail for easy access
- 3 rows textarea for comfortable caption entry

## Database Migration
To apply this feature to an existing database:

```sql
-- Run the migration file
psql -U your_user -d your_database -f add-media-caption.sql

-- Or manually:
ALTER TABLE media ADD COLUMN IF NOT EXISTS caption TEXT;
UPDATE media SET caption = '' WHERE caption IS NULL;
```

## API Response Format
Media is now returned as an array of objects:

**Before:**
```json
{
  "mediaUrls": ["url1", "url2"]
}
```

**After:**
```json
{
  "media": [
    {
      "url": "url1",
      "mediaType": "image",
      "caption": "Beautiful sunset"
    },
    {
      "url": "url2",
      "mediaType": "image",
      "caption": ""
    }
  ]
}
```

## Testing Checklist
- [ ] Create a new post with multiple images and captions
- [ ] Create a post with images but no captions (should work)
- [ ] Create a post with no images (should work)
- [ ] View post cards in feed - captions should appear on images
- [ ] View post detail page - captions should appear on images
- [ ] Test carousel navigation with captions
- [ ] Test on mobile devices for responsive caption display
- [ ] Verify existing posts without captions still display correctly
- [ ] Test caption with long text (multiple lines)
- [ ] Test caption with special characters

## Future Enhancements
- [ ] Add caption editing in post edit functionality
- [ ] Add caption character limit with counter
- [ ] Support markdown formatting in captions
- [ ] Add caption search functionality
- [ ] Allow caption editing after post creation
- [ ] Add caption to listing images as well
