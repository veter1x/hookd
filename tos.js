
document.addEventListener("DOMContentLoaded", function () {
  const links = document.querySelectorAll(".sidebar a");
  const sections = document.querySelectorAll("main section");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute("id");
      const link = document.querySelector('.sidebar a[href="#' + id + '"]');
      if (link) {
        if (entry.isIntersecting) {
          links.forEach(l => l.classList.remove("active"));
          link.classList.add("active");
        }
      }
    });
  }, { threshold: 0.5 });

  sections.forEach(section => observer.observe(section));
});
