const BASE_DOMAIN = "api2.hackclub.com";

let submissionStatus = "All";
const urlParams = new URLSearchParams(window.location.search);
const statusQuery = urlParams.get("status");
let eventCode = urlParams.get("eventCode") || "";

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
  const response = await fetch(
    `https://${BASE_DOMAIN}/v0.1/Boba Drops/Websites?${params}`
  );
  const submissions = await response.json();

  console.log(submissions);

  let submissionsPush = "";
  submissions.forEach((submission) => {
    let photoUrl = "";
    if (
      !submission.fields.Screenshot ||
      submission.fields.Screenshot.length === 0
    ) {
      ("https://hc-cdn.hel1.your-objectstorage.com/s/v3/ee0109f20430335ebb5cd3297a973ce244ed01cf_depositphotos_247872612-stock-illustration-no-image-available-icon-vector.jpg");
    } else {
      photoUrl = submission.fields.Screenshot[0].url;
    }
    submissionsPush += `
      <div class="grid-submission">
        <div class="submission-photo"
          style="background-image: url(${photoUrl});">
        </div>
        <span class="status ${submission.fields.Status.toLowerCase()}"></span>
        <div class="links">
          <a href="${
            submission.fields["Code URL"]
          }" class="github-button" target="_blank"><i class="fa-brands fa-github"></i> Github</a>
          <a href="${
            submission.fields["Playable URL"]
          }" class="demo-button" target="_blank"><i class="fa-solid fa-link"></i> Demo</a>
        </div>
      </div>
    `;
  });

  if (submissionsPush === "") {
    document.getElementById("submissions-content").innerHTML =
      "<h1 style='text-align: center;'>No submissions found</h1>";
  } else {
    document.getElementById("grid-gallery").innerHTML = submissionsPush;
  }
}

const form = document.getElementById("event-code-search");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const eventCode = document.getElementById("event-input").value.trim();
  window.location.href = `?eventCode=${eventCode}&status=${submissionStatus}`;
});
