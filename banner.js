
document.getElementById("announcement-banner").addEventListener("click", function() {
    var additionalInfo = document.getElementById("additional-info");
    if (additionalInfo.style.display === "block") {
      additionalInfo.style.display = "none";
    } else {
      additionalInfo.style.display = "block";
    }
  });
 
