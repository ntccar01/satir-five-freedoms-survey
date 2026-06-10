const slides = Array.from(document.querySelectorAll(".slide"));
const progressFill = document.querySelector("#progressFill");
const slideCount = document.querySelector("#slideCount");
const prevSlide = document.querySelector("#prevSlide");
const nextSlide = document.querySelector("#nextSlide");

let currentSlide = 0;

function showSlide(index) {
  currentSlide = Math.max(0, Math.min(index, slides.length - 1));
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === currentSlide);
  });
  slideCount.textContent = `${currentSlide + 1} / ${slides.length}`;
  progressFill.style.width = `${((currentSlide + 1) / slides.length) * 100}%`;
  prevSlide.disabled = currentSlide === 0;
  nextSlide.disabled = currentSlide === slides.length - 1;
}

prevSlide.addEventListener("click", () => showSlide(currentSlide - 1));
nextSlide.addEventListener("click", () => showSlide(currentSlide + 1));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " ") {
    event.preventDefault();
    showSlide(currentSlide + 1);
  }
  if (event.key === "ArrowLeft" || event.key === "PageUp") {
    event.preventDefault();
    showSlide(currentSlide - 1);
  }
  if (event.key === "Home") showSlide(0);
  if (event.key === "End") showSlide(slides.length - 1);
});

showSlide(0);
