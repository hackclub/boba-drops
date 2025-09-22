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

async function main() {
  const BASE_DOMAIN = "api2.hackclub.com";
  const CDN_API = "https://cdn.hackclub.com/api/v3/new";
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
    
    const optimizedSubmissions = await Promise.all(
      submissions.map(async (submission) => {
        return await optimizeSubmission(submission, API_TOKEN);
      })
    );
    
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
  
  if (!submission.fields.Screenshot || submission.fields.Screenshot.length === 0) {
    photoUrl = "https://hc-cdn.hel1.your-objectstorage.com/s/v3/ee0109f20430335ebb5cd3297a973ce244ed01cf_depositphotos_247872612-stock-illustration-no-image-available-icon-vector.jpg";
  } else {
    photoUrl = submission.fields.Screenshot[0].url;
    
    const metadataPath = `.github/data/image-metadata.json`;
    let imageMetadata = {};
    
    if (fs.existsSync(metadataPath)) {
      imageMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }
    
    const imageHash = crypto.createHash('md5').update(photoUrl).digest('hex');
    
    if (imageMetadata[imageHash]) {
      photoUrl = imageMetadata[imageHash].cdnUrl;
      console.log(`Using cached optimized image for ${imageHash}`);
    } else {
      try {
        console.log(`Attempting to optimize image: ${photoUrl}`);
        const optimizedUrl = await optimizeImageViaCDN(photoUrl, apiToken);
        
        if (optimizedUrl && optimizedUrl !== photoUrl) {
          imageMetadata[imageHash] = {
            originalUrl: photoUrl,
            cdnUrl: optimizedUrl,
            timestamp: new Date().toISOString()
          };
          
          fs.writeFileSync(metadataPath, JSON.stringify(imageMetadata, null, 2));
          console.log(`Cached optimized image: ${optimizedUrl}`);
          photoUrl = optimizedUrl;
        }
      } catch (error) {
        console.error(`Failed to optimize image ${photoUrl}:`, error);
      }
    }
  }
  
  return {
    ...submission,
    optimizedPhotoUrl: photoUrl
  };
}

async function optimizeImageViaCDN(imageUrl, apiToken) {
  try {
    console.log(`Uploading to CDN: ${imageUrl}`);
    
    const uploadResponse = await fetch(CDN_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([imageUrl])
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`CDN upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    
    if (uploadResult.files && uploadResult.files.length > 0) {
      return uploadResult.files[0].deployedUrl;
    } else {
      throw new Error('No files returned from CDN upload');
    }
    
  } catch (error) {
    console.error('CDN upload failed:', error);
    return imageUrl;
  }
}

function generateGalleryHTML(submissions) {
  if (submissions.length === 0) {
    return '<h1 style="text-align: center;">No submissions found</h1>';
  }
  
  let galleryHTML = '';
  
  submissions.forEach((submission) => {
    const photoUrl = escapeUrl(submission.optimizedPhotoUrl);
    const status = sanitizeStatus(submission.fields.Status);
    const codeUrl = escapeUrl(submission.fields["Code URL"]);
    const playableUrl = escapeUrl(submission.fields["Playable URL"]);
    const eventCode = escapeHtml(submission.fields["Event Code"] || '');
    
    galleryHTML += `
      <div class="grid-submission" data-event-code="${eventCode}">
        <div class="submission-photo" style="background-image: url('${photoUrl}');"></div>
        <span class="status ${status}"></span>
        <div class="links">
          <a href="${codeUrl}" class="github-button"><i class="fa-brands fa-github"></i> Github</a>
          <a href="${playableUrl}" class="demo-button"><i class="fa-solid fa-link"></i> Demo</a>
        </div>
      </div>
    `;
  });
  
  return galleryHTML.trim();
}

main();
