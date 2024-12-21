
document.getElementById("announcement-banner").addEventListener("mouseenter", function() {
    var additionalInfo = document.getElementById("additional-info");
    additionalInfo.style.display = "block";
  });
 
document.getElementById("announcement-banner").addEventListener("mouseleave", function() {
    var additionalInfo = document.getElementById("additional-info");
    additionalInfo.style.display = "none";
  });

document.getElementById("announcement-banner").addEventListener("click", function() {
    var additionalInfo = document.getElementById("additional-info");
    if (additionalInfo.style.display === "block") {
      additionalInfo.style.display = "none";
    } else {
      additionalInfo.style.display = "block";
    }
  });
