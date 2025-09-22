const BASE_DOMAIN = "api2.hackclub.com";

// Security helper functions
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeUrl(url) {
  if (typeof url !== 'string') return '#';
  try {
    const urlObj = new URL(url);
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

let submissionStatus = "All";
const urlParams = new URLSearchParams(window.location.search);
const statusQuery = urlParams.get("status");
let eventCode = urlParams.get("eventCode") || "";
let allSubmissions = [];
let displayedSubmissions = [];
const itemsPerLoad = 12;
let currentIndex = 0;
let isLoading = false;

document.getElementById("event-input").value = eventCode

if (["All", "Approved", "Pending", "Rejected"].includes(statusQuery)) {
  submissionStatus = statusQuery;
}

document
  .getElementById(`status-${submissionStatus.toLowerCase()}`)
  .classList.add("active");

fetchData();

async function fetchData() {
  const params = new URLSearchParams();
  let filterFormula = "AND(";
  if (submissionStatus !== "All") {
    filterFormula += `{Status} = '${submissionStatus}'`;
  }
  if (eventCode !== "") {
    if (submissionStatus !== "All") {
      filterFormula += ",";
    }
    filterFormula += `{Event Code} = '${eventCode}'`;
  }

  filterFormula += ")";

  params.append(
    "select",
    JSON.stringify({ filterByFormula: filterFormula })
  );
  params.append("cache", true);

  try {
    const response = await fetch(
      `https://${BASE_DOMAIN}/v0.1/Boba Drops/Websites?${params}`
    );
    const submissions = await response.json();
    console.log(submissions);
    allSubmissions = submissions;
    currentIndex = 0;
    displayedSubmissions = [];
    loadMoreSubmissions();
  } catch (error) {
    console.error("Failed to fetch data:", error);
    allSubmissions = [];
    displayNoSubmissions();
  }
}

function loadMoreSubmissions() {
  if (isLoading || currentIndex >= allSubmissions.length) {
    return;
  }

  isLoading = true;
  const endIndex = Math.min(currentIndex + itemsPerLoad, allSubmissions.length);
  const newSubmissions = allSubmissions.slice(currentIndex, endIndex);
  
  displayedSubmissions.push(...newSubmissions);
  currentIndex = endIndex;
  
  renderSubmissions();
  isLoading = false;
}

function renderSubmissions() {
  if (displayedSubmissions.length === 0) {
    displayNoSubmissions();
    return;
  }

  const gridGallery = document.getElementById("grid-gallery");
  gridGallery.innerHTML = ''; // Clear existing content
  
  displayedSubmissions.forEach((submission) => {
    let photoUrl = "";
    if (
      !submission.fields.Screenshot ||
      submission.fields.Screenshot.length === 0
    ) {
      photoUrl = "https://hc-cdn.hel1.your-objectstorage.com/s/v3/ee0109f20430335ebb5cd3297a973ce244ed01cf_depositphotos_247872612-stock-illustration-no-image-available-icon-vector.jpg";
    } else {
      photoUrl = submission.fields.Screenshot[0].url;
    }

    // Create elements safely using DOM methods
    const gridSubmission = document.createElement('div');
    gridSubmission.className = 'grid-submission';

    const submissionPhoto = document.createElement('div');
    submissionPhoto.className = 'submission-photo';
    submissionPhoto.style.backgroundImage = `url('${escapeUrl(photoUrl)}')`;

    const statusSpan = document.createElement('span');
    statusSpan.className = `status ${sanitizeStatus(submission.fields.Status)}`;

    const linksDiv = document.createElement('div');
    linksDiv.className = 'links';

    const githubLink = document.createElement('a');
    githubLink.href = escapeUrl(submission.fields["Code URL"]);
    githubLink.className = 'github-button';
    githubLink.innerHTML = '<i class="fa-brands fa-github"></i> Github';

    const demoLink = document.createElement('a');
    demoLink.href = escapeUrl(submission.fields["Playable URL"]);
    demoLink.className = 'demo-button';
    demoLink.innerHTML = '<i class="fa-solid fa-link"></i> Demo';

    linksDiv.appendChild(githubLink);
    linksDiv.appendChild(demoLink);

    gridSubmission.appendChild(submissionPhoto);
    gridSubmission.appendChild(statusSpan);
    gridSubmission.appendChild(linksDiv);

    gridGallery.appendChild(gridSubmission);
  });
}

function displayNoSubmissions() {
  document.getElementById("submissions-content").innerHTML =
    "<h1 style='text-align: center;'>No submissions found</h1>";
}

function handleScroll() {
  if (isLoading || currentIndex >= allSubmissions.length) {
    return;
  }

  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  if (scrollTop + windowHeight >= documentHeight - 1000) {
    loadMoreSubmissions();
  }
}

window.addEventListener('scroll', handleScroll);

const form = document.getElementById("event-code-search");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const newEventCode = document.getElementById("event-input").value.trim();
  window.location.href = `?eventCode=${newEventCode}&status=${submissionStatus}`;
});
