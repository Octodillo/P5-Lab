// @ts-check
// Single-page app for p5.js playground with three-column layout

let currentSketch = null;
let isLoadingSketch = false;
let globalControlsInitialized = false;

// Store reference globally so sketches can attach to it
window.__p5_instance__ = null;

/**
 * Initialize global controls (only once)
 */
async function initGlobalControls() {
  if (globalControlsInitialized) return;

  try {
    // Import GlobalControls and initialize
    const { GlobalControls } = await import("/api/src/common.ts");
    GlobalControls.getInstance();
    globalControlsInitialized = true;
  } catch (error) {
    console.error("Failed to initialize global controls:", error);
  }
}

/**
 * Load and display sketches in the list
 */
async function loadSketches() {
  try {
    const response = await fetch("/api/sketches");
    const sketches = await response.json();

    const container = document.getElementById("sketches-container");
    if (!container) return;

    if (sketches.length === 0) {
      container.innerHTML = '<div class="no-sketches">No sketches found</div>';
      return;
    }

    container.innerHTML = "";
    sketches.forEach(sketch => {
      const item = document.createElement("div");
      item.className = "sketch-item";

      // Create icon element
      const icon = document.createElement("img");
      icon.className = "sketch-icon";
      icon.src = `/static/icons/${sketch}.svg`;
      icon.alt = "";
      icon.onerror = () => {
        icon.src = "/static/icons/default.svg";
      };

      // Create label element
      const label = document.createElement("span");
      label.className = "sketch-label";
      label.textContent = sketch;

      item.appendChild(icon);
      item.appendChild(label);
      item.addEventListener("click", () => loadSketch(sketch));
      container.appendChild(item);
    });

    // // Load first sketch by default
    // if (sketches.length > 0) {
    //   loadSketch(sketches[0]);
    // }
  } catch (error) {
    console.error("Failed to load sketches:", error);
    const container = document.getElementById("sketches-container");
    if (container) {
      container.innerHTML = '<div class="no-sketches">Error loading sketches</div>';
    }
  }
}

/**
 * Load and run a specific sketch
 * @param {string} sketchName
 */
async function loadSketch(sketchName) {
  // Prevent concurrent loads
  if (isLoadingSketch) {
    console.log("Sketch already loading, ignoring request");
    return;
  }

  // Prevent reloading the same sketch
  if (currentSketch === sketchName && window.__p5_instance__) {
    console.log("Sketch already loaded");
    return;
  }

  isLoadingSketch = true;

  try {
    // Update active state in list
    document.querySelectorAll(".sketch-item").forEach(item => {
      if (item.textContent === sketchName) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    // Remove previous sketch if exists - do this BEFORE clearing containers
    if (window.__p5_instance__) {
      try {
        window.__p5_instance__.remove();
        window.__p5_instance__ = null;
      } catch (e) {
        console.warn("Error removing previous sketch:", e);
      }
    }

    // Clean up resize observer if exists
    if (window.__resize_observer__) {
      try {
        window.__resize_observer__.disconnect();
        window.__resize_observer__ = null;
      } catch (e) {
        console.warn("Error disconnecting resize observer:", e);
      }
    }

    // Clear previous sketch containers
    const sketchContainer = document.getElementById("sketch-container");
    const controlsContainer = document.getElementById("controls-container");

    if (sketchContainer) {
      sketchContainer.innerHTML = "";
    }

    if (controlsContainer) {
      controlsContainer.innerHTML = '<div class="loading">Loading controls...</div>';
    }

    // Reset controls ready flag
    window.__controls_ready__ = false;

    // Load the sketch module
    currentSketch = sketchName;

    // Dynamic import with cache busting for development
    const cacheBuster = Date.now();
    const module = await import(`/api/src/${sketchName}/mod.ts?t=${cacheBuster}`);

    // Wait for controls to be ready and move them to sidebar
    const moveControls = () => {
      const controls = document.querySelector(".sketch-controls:not(.sketch-controls--global)");
      if (controls && controlsContainer) {
        controlsContainer.innerHTML = "";
        // Remove from current parent and show
        controls.remove();
        controls.style.display = "flex";
        controlsContainer.appendChild(controls);
      } else if (controlsContainer && window.__controls_ready__ !== undefined) {
        // Sketch loaded but has no controls
        controlsContainer.innerHTML = '<div class="controls-empty">No controls for this sketch</div>';
      }
    };

    // Check if controls are ready
    if (window.__controls_ready__) {
      moveControls();
    } else {
      // Wait a bit for controls to be created
      setTimeout(moveControls, 200);
    }
  } catch (error) {
    console.error(`Failed to load sketch "${sketchName}":`, error);
    const controlsContainer = document.getElementById("controls-container");
    if (controlsContainer) {
      controlsContainer.innerHTML = '<div class="controls-empty">Error loading sketch</div>';
    }
  } finally {
    // Always reset the loading flag
    isLoadingSketch = false;
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", async () => {
  await initGlobalControls();
  loadSketches();
});

// Handle live reload
window.addEventListener("load", () => {
  if (currentSketch) {
    // Reload current sketch on live reload
    setTimeout(() => {
      if (currentSketch) {
        loadSketch(currentSketch);
      }
    }, 500);
  }
});
