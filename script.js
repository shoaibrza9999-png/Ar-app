document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const video = document.getElementById("camera-stream");
  const canvas = document.getElementById("overlay-canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const sourceImage = document.getElementById("source-image");

  // Controls
  const opacitySlider = document.getElementById("opacity-slider");
  const opacityVal = document.getElementById("opacity-val");
  const scaleSlider = document.getElementById("scale-slider");
  const scaleVal = document.getElementById("scale-val");
  const colorPicker = document.getElementById("color-picker");
  const toleranceSlider = document.getElementById("tolerance-slider");
  const toleranceVal = document.getElementById("tolerance-val");
  const imageUpload = document.getElementById("image-upload");
  const lockBtn = document.getElementById("lock-btn");
  const unlockBtn = document.getElementById("unlock-btn");
  const resetBtn = document.getElementById("reset-btn");

  // State
  let isLocked = false;
  let imgX = 0;
  let imgY = 0;
  let isDragging = false;
  let startDragX = 0;
  let startDragY = 0;
  let scale = 1.0;

  // Original image data for processing
  let originalImageData = null;

  // --- Camera Setup ---
  async function setupCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Prefer rear camera
      });
      video.srcObject = stream;
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert(
        "Could not access the camera. Please ensure you have granted permission.",
      );
    }
  }

  // --- Image Processing ---
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 255, g: 255, b: 255 };
  }

  function processImageColor() {
    if (!originalImageData) return;

    const targetColor = hexToRgb(colorPicker.value);
    const tolerance = parseInt(toleranceSlider.value, 10);

    // Create a copy of the original data to modify
    const processedData = new ImageData(
      new Uint8ClampedArray(originalImageData.data),
      originalImageData.width,
      originalImageData.height,
    );

    const data = processedData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculate color distance (simple Manhattan distance for speed)
      const rDiff = Math.abs(r - targetColor.r);
      const gDiff = Math.abs(g - targetColor.g);
      const bDiff = Math.abs(b - targetColor.b);

      // If the pixel is within tolerance of the target color, make it transparent
      if (rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance) {
        data[i + 3] = 0; // Set alpha to 0
      }
    }

    ctx.putImageData(processedData, 0, 0);
  }

  function initImage() {
    // Set canvas size to match image
    canvas.width = sourceImage.naturalWidth;
    canvas.height = sourceImage.naturalHeight;

    // Draw initial image
    ctx.drawImage(sourceImage, 0, 0);

    // Store original data for color processing
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Center the image initially
    resetPosition();

    // Apply initial transparency if needed
    processImageColor();
  }

  // --- Interactions & Controls ---
  function updateTransform() {
    canvas.style.transform = `translate(${imgX}px, ${imgY}px) scale(${scale})`;
    canvas.style.opacity = opacitySlider.value;
  }

  function resetPosition() {
    scale = 1.0;
    scaleSlider.value = 1.0;
    scaleVal.textContent = "1.0x";

    // Center based on window size and canvas size
    imgX = (window.innerWidth - canvas.width) / 2;
    // Place it slightly higher than center to leave room for controls
    imgY = (window.innerHeight - canvas.height) / 3;

    updateTransform();
  }

  // Dragging logic (supports mouse and touch)
  function startDrag(e) {
    if (isLocked) return;
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startDragX = clientX - imgX;
    startDragY = clientY - imgY;
    e.preventDefault(); // Prevent default touch actions like scrolling
  }

  function doDrag(e) {
    if (!isDragging || isLocked) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    imgX = clientX - startDragX;
    imgY = clientY - startDragY;
    updateTransform();
    e.preventDefault();
  }

  function endDrag() {
    isDragging = false;
  }

  // Event Listeners for Dragging
  canvas.addEventListener("mousedown", startDrag);
  window.addEventListener("mousemove", doDrag);
  window.addEventListener("mouseup", endDrag);

  canvas.addEventListener("touchstart", startDrag, { passive: false });
  window.addEventListener("touchmove", doDrag, { passive: false });
  window.addEventListener("touchend", endDrag);

  // Controls Listeners
  opacitySlider.addEventListener("input", (e) => {
    opacityVal.textContent = Math.round(e.target.value * 100) + "%";
    canvas.style.opacity = e.target.value;
  });

  scaleSlider.addEventListener("input", (e) => {
    scale = parseFloat(e.target.value);
    scaleVal.textContent = scale.toFixed(1) + "x";
    updateTransform();
  });

  colorPicker.addEventListener("input", processImageColor);

  toleranceSlider.addEventListener("input", (e) => {
    toleranceVal.textContent = e.target.value;
    processImageColor();
  });

  resetBtn.addEventListener("click", resetPosition);

  lockBtn.addEventListener("click", () => {
    isLocked = true;
    document.body.classList.add("locked");
    lockBtn.style.display = "none";
  });

  unlockBtn.addEventListener("click", () => {
    isLocked = false;
    document.body.classList.remove("locked");
    lockBtn.style.display = "inline-block";
  });

  imageUpload.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      sourceImage.onload = () => {
        initImage();
      };
      sourceImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // --- Initialization ---
  // Ensure image loads (especially useful for local dev or cached images)
  if (sourceImage.complete) {
    initImage();
  } else {
    sourceImage.onload = initImage;
  }

  setupCamera();
});
