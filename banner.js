document.addEventListener("DOMContentLoaded", function () {
  const items = document.querySelectorAll(".item-step");
  items.forEach((item, index) => {
    item.style.opacity = "0";
    item.style.animation = `fadeInUp 0.8s ease forwards ${0.2 + index * 0.1}s`;
  });

  const animateOnScroll = function () {
    const elements = document.querySelectorAll(".section, h2, h3");

    elements.forEach((element) => {
      const elementPosition = element.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;

      if (elementPosition < windowHeight - 50) {
        element.classList.add("visible");
        element.style.opacity = "1";
        element.style.transform = "translateY(0)";
      }
    });
  };

  const scrollElements = document.querySelectorAll(".section, h2, h3");
  scrollElements.forEach((element) => {
    if (!element.classList.contains("visible")) {
      element.style.opacity = "0";
      element.style.transform = "translateY(20px)";
      element.style.transition = "opacity 0.8s ease, transform 0.8s ease";
    }
  });

  // Run once on load
  setTimeout(animateOnScroll, 100);

  window.addEventListener("scroll", animateOnScroll);

  var bannerClose = document.getElementById("banner-close");
  if (bannerClose) {
    bannerClose.addEventListener("click", function () {
      var bannerBar = document.getElementById("banner-bar");
      if (bannerBar) {
        bannerBar.style.display = "none";
        localStorage.setItem("banner-closed", "true");
      }
    });
  }

  const banner = document.querySelector(".banner");
  if (banner) {
    banner.addEventListener("click", function (e) {
      e.preventDefault();
      window.open("https://hackclub.com/", "_blank");
    });
  }
});
