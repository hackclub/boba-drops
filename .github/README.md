# Gallery Automation System

This directory contains the automated gallery update system for Boba Drops.

## Files

### Workflows
- `workflows/update-gallery.yml` - GitHub Action that runs every 5 minutes and updates the gallery

### Scripts  
- `scripts/update-gallery.js` - Main script that fetches Airtable data, optimizes images, and generates gallery.html

### Data
- `data/gallery-checksum.txt` - MD5 checksum of current gallery content to avoid unnecessary updates
- `data/image-metadata.json` - Cache of optimized image URLs to prevent re-processing

## How It Works

1. **Scheduled Execution**: GitHub Action runs every 5 minutes via cron schedule
2. **Data Fetching**: Script fetches submissions from Airtable API (`api2.hackclub.com`)
3. **Image Optimization**: Screenshots are optimized to WebP format and uploaded to HC CDN
4. **Checksum Comparison**: Only updates gallery.html if content has changed
5. **Template Generation**: Uses `gallery.template.html` to generate static `gallery.html`
6. **Auto Commit**: Changes are automatically committed and pushed to the repository

## Environment Variables

The GitHub Action requires:
- `API_TOKEN` - Authentication token for both Airtable and HC CDN APIs

## Manual Triggering

The workflow can be manually triggered via GitHub's "Actions" tab using the "workflow_dispatch" event.

## Performance Benefits

- **Static Generation**: Replaces client-side API calls with pre-generated HTML
- **Image Optimization**: WebP format reduces file sizes by ~30-50%
- **CDN Delivery**: Images served from HC CDN for faster loading
- **Smart Caching**: Prevents redundant processing of unchanged images
- **Checksum Validation**: Skips updates when content hasn't changed