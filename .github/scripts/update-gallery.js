import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function escapeUrl(url) {
  if (typeof url !== 'string') return '#';
  try {
    // Validate URL format
    const urlObj = new URL(url);
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '#';
    }
    return encodeURI(url);
  } catch {
    return '#';
  }
}

function sanitizeStatus(status) {
  if (typeof status !== 'string') return 'pending';
  const validStatuses = ['approved', 'pending', 'rejected'];
  const lowercased = status.toLowerCase();
  return validStatuses.includes(lowercased) ? lowercased : 'pending';
}

// Generate responsive image URLs for different sizes
function generateResponsiveImageUrls(cdnUrl) {
  if (!cdnUrl || !cdnUrl.includes('cdn.hackclub.com')) {
    return { original: cdnUrl };
  }
  
  // Generate different sizes for responsive loading
  const baseUrl = cdnUrl.replace(/\.[^/.]+$/, ''); // Remove extension
  const extension = cdnUrl.match(/\.[^/.]+$/)?.[0] || '.jpg';
  
  return {
    thumbnail: `${baseUrl}_200x200${extension}`,
    small: `${baseUrl}_400x400${extension}`,
    medium: `${baseUrl}_800x800${extension}`,
    large: `${baseUrl}_1200x1200${extension}`,
    original: cdnUrl
  };
}

const CDN_API = "https://cdn.hackclub.com/api/v3/new";

async function main() {
  const BASE_DOMAIN = "api2.hackclub.com";
  const API_TOKEN = process.env.API_TOKEN;
  
  if (!API_TOKEN) {
    console.error('API_TOKEN environment variable is required');
    process.exit(1);
  }
  
  console.log('Fetching submissions from Airtable...');
  
  try {
    const params = new URLSearchParams();
    params.append("select", JSON.stringify({ filterByFormula: "AND()" }));
    params.append("cache", true);
    
    const response = await fetch(`https://${BASE_DOMAIN}/v0.1/Boba Drops/Websites?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const submissions = await response.json();
    console.log(`Found ${submissions.length} submissions`);
    
    // Process submissions in batches to avoid overwhelming the CDN
    const BATCH_SIZE = 10;
    const optimizedSubmissions = [];
    
    for (let i = 0; i < submissions.length; i += BATCH_SIZE) {
      const batch = submissions.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(submissions.length / BATCH_SIZE)}`);
      
      const batchResults = await Promise.all(
        batch.map(async (submission) => {
          return await optimizeSubmission(submission, API_TOKEN);
        })
      );
      
      optimizedSubmissions.push(...batchResults);
      
      // Add a small delay between batches to be respectful to the CDN
      if (i + BATCH_SIZE < submissions.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const galleryContent = generateGalleryHTML(optimizedSubmissions);
    const galleryChecksum = crypto.createHash('md5').update(galleryContent).digest('hex');
    
    const checksumPath = '.github/data/gallery-checksum.txt';
    let currentChecksum = '';
    
    if (fs.existsSync(checksumPath)) {
      currentChecksum = fs.readFileSync(checksumPath, 'utf8').trim();
    }
    
    if (galleryChecksum === currentChecksum) {
      console.log('Gallery content unchanged, skipping update');
      return;
    }
    
    console.log('Gallery content changed, updating...');
    
    const templatePath = 'gallery.template.html';
    const template = fs.readFileSync(templatePath, 'utf8');
    const galleryHTML = template.replace('{{GALLERY_CONTENT}}', galleryContent);
    
    fs.writeFileSync('gallery.html', galleryHTML);
    fs.writeFileSync(checksumPath, galleryChecksum);
    
    console.log('Gallery updated successfully');
    
  } catch (error) {
    console.error('Error updating gallery:', error);
    process.exit(1);
  }
}

async function optimizeSubmission(submission, apiToken) {
  let photoUrl = "";
  let isOptimized = false;
  
  if (!submission.fields.Screenshot || submission.fields.Screenshot.length === 0) {
    photoUrl = "https://hc-cdn.hel1.your-objectstorage.com/s/v3/ee0109f20430335ebb5cd3297a973ce244ed01cf_depositphotos_247872612-stock-illustration-no-image-available-icon-vector.jpg";
  } else {
    photoUrl = submission.fields.Screenshot[0].url;
    
    const metadataPath = `.github/data/image-metadata.json`;
    let imageMetadata = {};
    
    // Ensure the directory exists
    const metadataDir = path.dirname(metadataPath);
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
    }
    
    if (fs.existsSync(metadataPath)) {
      try {
        imageMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      } catch (error) {
        console.warn('Failed to parse image metadata, starting fresh:', error.message);
        imageMetadata = {};
      }
    }
    
    const imageHash = crypto.createHash('md5').update(photoUrl).digest('hex');
    
    // Check if we already have an optimized version
    if (imageMetadata[imageHash] && imageMetadata[imageHash].cdnUrl) {
      photoUrl = imageMetadata[imageHash].cdnUrl;
      isOptimized = true;
      console.log(`Using cached optimized image for ${imageHash.substring(0, 8)}...`);
    } else {
      try {
        console.log(`Optimizing image: ${photoUrl.substring(0, 50)}...`);
        const optimizedUrl = await optimizeImageViaCDN(photoUrl, apiToken);
        
        if (optimizedUrl && optimizedUrl !== photoUrl) {
          imageMetadata[imageHash] = {
            originalUrl: photoUrl,
            cdnUrl: optimizedUrl,
            timestamp: new Date().toISOString(),
            status: 'optimized'
          };
          
          // Save metadata atomically
          const tempPath = `${metadataPath}.tmp`;
          fs.writeFileSync(tempPath, JSON.stringify(imageMetadata, null, 2));
          fs.renameSync(tempPath, metadataPath);
          
          console.log(`Successfully optimized and cached image: ${optimizedUrl.substring(0, 50)}...`);
          photoUrl = optimizedUrl;
          isOptimized = true;
        } else {
          // Mark as attempted but failed
          imageMetadata[imageHash] = {
            originalUrl: photoUrl,
            cdnUrl: photoUrl,
            timestamp: new Date().toISOString(),
            status: 'failed'
          };
          
          const tempPath = `${metadataPath}.tmp`;
          fs.writeFileSync(tempPath, JSON.stringify(imageMetadata, null, 2));
          fs.renameSync(tempPath, metadataPath);
        }
      } catch (error) {
        console.error(`Failed to optimize image ${photoUrl.substring(0, 50)}...:`, error.message);
        
        // Mark as failed in metadata
        imageMetadata[imageHash] = {
          originalUrl: photoUrl,
          cdnUrl: photoUrl,
          timestamp: new Date().toISOString(),
          status: 'failed',
          error: error.message
        };
        
        try {
          const tempPath = `${metadataPath}.tmp`;
          fs.writeFileSync(tempPath, JSON.stringify(imageMetadata, null, 2));
          fs.renameSync(tempPath, metadataPath);
        } catch (writeError) {
          console.error('Failed to save error metadata:', writeError.message);
        }
      }
    }
  }
  
  return {
    ...submission,
    optimizedPhotoUrl: photoUrl,
    isOptimized
  };
}

async function optimizeImageViaCDN(imageUrl, apiToken) {
  try {
    console.log(`Uploading to CDN: ${imageUrl.substring(0, 50)}...`);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const uploadResponse = await fetch(CDN_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([imageUrl]),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`CDN upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    
    if (uploadResult.files && uploadResult.files.length > 0 && uploadResult.files[0].deployedUrl) {
      return uploadResult.files[0].deployedUrl;
    } else {
      throw new Error('No valid files returned from CDN upload');
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('CDN upload timed out');
    }
    console.error('CDN upload failed:', error.message);
    throw error;
  }
}

function generateGalleryHTML(submissions) {
  if (submissions.length === 0) {
    return '<h1 style="text-align: center;">No submissions found</h1>';
  }
  
  let galleryHTML = '';
  
  submissions.forEach((submission, index) => {
    const photoUrl = escapeUrl(submission.optimizedPhotoUrl);
    const status = sanitizeStatus(submission.fields.Status);
    const codeUrl = escapeUrl(submission.fields["Code URL"]);
    const playableUrl = escapeUrl(submission.fields["Playable URL"]);
    const eventCode = escapeHtml(submission.fields["Event Code"] || '');
    const title = escapeHtml(submission.fields["Title"] || 'Untitled Project');
    const description = escapeHtml(submission.fields["Description"] || '');
    
    // Generate responsive image URLs if it's a CDN link
    const responsiveUrls = generateResponsiveImageUrls(photoUrl);
    
    // Create srcset for responsive images
    let srcset = '';
    let sizes = '';
    if (responsiveUrls.thumbnail !== responsiveUrls.original) {
      srcset = `${responsiveUrls.thumbnail} 200w, ${responsiveUrls.small} 400w, ${responsiveUrls.medium} 800w, ${responsiveUrls.large} 1200w`;
      sizes = '(max-width: 400px) 200px, (max-width: 800px) 400px, (max-width: 1200px) 800px, 1200px';
    }
    
    // Determine loading strategy - first few images load immediately, rest are lazy
    const loadingStrategy = index < 6 ? 'eager' : 'lazy';
    const fetchPriority = index < 3 ? 'high' : 'low';
    
    galleryHTML += `
      <div class="grid-submission" data-event-code="${eventCode}" style="content-visibility: auto; contain-intrinsic-size: 300px;">
        <div class="image-container">
          <img 
            class="submission-photo" 
            src="${responsiveUrls.small || photoUrl}" 
            ${srcset ? `srcset="${srcset}"` : ''}
            ${sizes ? `sizes="${sizes}"` : ''}
            alt="${title}"
            loading="${loadingStrategy}"
            fetchpriority="${fetchPriority}"
            decoding="async"
            width="400"
            height="300"
            style="aspect-ratio: 4/3; object-fit: cover;"
          />
          ${submission.isOptimized ? '<div class="optimized-badge" title="Image optimized via CDN">⚡</div>' : ''}
        </div>
        <div class="submission-content">
          <h3 class="submission-title">${title}</h3>
          ${description ? `<p class="submission-description">${description.substring(0, 100)}${description.length > 100 ? '...' : ''}</p>` : ''}
          <span class="status ${status}"></span>
          <div class="links">
            <a href="${codeUrl}" class="github-button" rel="noopener noreferrer" target="_blank">
              <i class="fa-brands fa-github" aria-hidden="true"></i> 
              <span>GitHub</span>
            </a>
            <a href="${playableUrl}" class="demo-button" rel="noopener noreferrer" target="_blank">
              <i class="fa-solid fa-link" aria-hidden="true"></i> 
              <span>Demo</span>
            </a>
          </div>
        </div>
      </div>
    `;
  });
  
  // Add performance-related CSS and JavaScript
  const performanceEnhancements = `
    <style>
      .grid-submission {
        content-visibility: auto;
        contain-intrinsic-size: 300px;
        contain: layout style paint;
      }
      
      .image-container {
        position: relative;
        overflow: hidden;
      }
      
      .submission-photo {
        transition: transform 0.2s ease;
        will-change: transform;
      }
      
      .submission-photo:hover {
        transform: scale(1.05);
      }
      
      .optimized-badge {
        position: absolute;
        top: 8px;
        right: 8px;
        background: #22c55e;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        z-index: 1;
      }
      
      .submission-content {
        padding: 1rem;
      }
      
      .submission-title {
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
        font-weight: 600;
        line-height: 1.2;
      }
      
      .submission-description {
        margin: 0 0 0.5rem 0;
        font-size: 0.9rem;
        color: #666;
        line-height: 1.4;
      }
      
      /* Improve link performance */
      .links a {
        contain: layout style;
      }
      
      /* Lazy loading placeholder */
      .submission-photo[loading="lazy"] {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 2s infinite;
      }
      
      @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    </style>
    
    <script>
      // Preload critical images
      document.addEventListener('DOMContentLoaded', function() {
        const criticalImages = document.querySelectorAll('img[fetchpriority="high"]');
        criticalImages.forEach(img => {
          if (!img.complete) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = img.src;
            document.head.appendChild(link);
          }
        });
      });
      
      // Intersection Observer for better lazy loading control
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
              }
              observer.unobserve(img);
            }
          });
        }, { rootMargin: '50px 0px' });
        
        document.querySelectorAll('img[loading="lazy"]').forEach(img => {
          imageObserver.observe(img);
        });
      }
    </script>
  `;
  
  return galleryHTML.trim() + performanceEnhancements;
}

main();
