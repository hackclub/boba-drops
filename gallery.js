const BASE_DOMAIN = "api2.hackclub.com";

let submissionStatus = "All";
const urlParams = new URLSearchParams(window.location.search);
const statusQuery = urlParams.get("status");
let eventCode = urlParams.get("eventCode") || "";

let allSubmissions = [];
let currentIndex = 0;
const itemsPerLoad = 12;
let isLoading = false;

document.getElementById("event-input").value = eventCode;

if (["All", "Approved", "Pending", "Rejected"].includes(statusQuery)) {
  submissionStatus = statusQuery;
}

document
  .getElementById(`status-${submissionStatus.toLowerCase()}`)
  .classList.add("active");

fetchData();

// Fetch all records (we cannot change backend, so we get everything at once)
async function fetchData() {
  const params = new URLSearchParams();
  let filterFormula = "AND(";
  if (submissionStatus !== "All") {
    filterFormula += `{Status} = '${submissionStatus}'`;
  }
  if (eventCode !== "") {
    if (submissionStatus !== "All") filterFormula += ",";
    filterFormula += `{Event Code} = '${eventCode}'`;
  }
  filterFormula += ")";

  params.append("select", JSON.stringify({ filterByFormula: filterFormula }));
  params.append("cache", true);

  document.getElementById("grid-gallery").innerHTML = "Loading...";

  try {
    const response = await fetch(
      `https://${BASE_DOMAIN}/v0.1/Boba Drops/Websites?${params}`
    );
    const submissions = await response.json();
    allSubmissions = submissions;
    currentIndex = 0;
    document.getElementById("grid-gallery").innerHTML = "";
    loadMoreSubmissions(); // Load first batch
  } catch (error) {
    console.error("Failed to fetch data:", error);
    document.getElementById("grid-gallery").innerHTML =
      "<h1 style='text-align:center;'>Failed to load submissions</h1>";
  }
}

// Load next batch of submissions
function loadMoreSubmissions() {
  if (isLoading || currentIndex >= allSubmissions.length) return;
  isLoading = true;

  const endIndex = Math.min(currentIndex + itemsPerLoad, allSubmissions.length);
  const batch = allSubmissions.slice(currentIndex, endIndex);

  const gallery = document.getElementById("grid-gallery");
  batch.forEach((sub) => {
    const photoUrl =
      sub.fields.Screenshot?.[0]?.thumbnails?.large?.url ||
      sub.fields.Screenshot?.[0]?.url ||
      "https://hc-cdn.hel1.your-objectstorage.com/s/v3/.../no-image.jpg";

    const div = document.createElement("div");
    div.className = "grid-submission";
    div.innerHTML = `
      <div class="submission-photo">
        <img src="${photoUrl}" alt="Screenshot" loading="lazy"
             onerror="this.src='https://hc-cdn.hel1.your-objectstorage.com/s/v3/.../no-image.jpg'"/>
      </div>
      <span class="status ${sub.fields.Status?.toLowerCase() || 'unknown'}"></span>
      <div class="links">
        ${
          sub.fields["Code URL"]
            ? `<a href="${sub.fields["Code URL"]}" class="github-button" target="_blank">Github</a>`
            : ""
        }
        ${
          sub.fields["Playable URL"]
            ? `<a href="${sub.fields["Playable URL"]}" class="demo-button" target="_blank">Demo</a>`
            : ""
        }
      </div>
    `;
    gallery.appendChild(div);
  });

  currentIndex = endIndex;
  isLoading = false;
}

// Infinite scroll
window.addEventListener("scroll", () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;

  // Load more when 1000px from bottom
  if (scrollTop + windowHeight >= documentHeight - 1000) {
    loadMoreSubmissions();
  }
});

// Event code search form
const form = document.getElementById("event-code-search");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const newEventCode = document.getElementById("event-input").value.trim();
  window.location.href = `?eventCode=${newEventCode}&status=${submissionStatus}`;
});
