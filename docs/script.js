// Global variables
let jobs = {};
let techColors = {};
let technicians = [];
let fullTechList = [];
let shortTechList = [];
let showJobDetail = true;
let isDragging = false;
let scrollInterval = null;
let workDayHours = 8;

// Load data and initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Initialize event listeners
  initializeEventListeners();

  // Load job data
  fetch("job.dat")
    .then((response) => response.json())
    .then((data) => {
      jobs = data.jobs;
      techColors = data.techColors;
      fullTechList = data.fullTechList;
      shortTechList = data.shortTechList;
      technicians = fullTechList;
      generateSchedule();
    })
    .catch((error) => console.error("Error loading job data:", error));
});

function initializeEventListeners() {
  // Keyboard event listener
  document.addEventListener("keydown", function (event) {
    if (event.key.toLowerCase() === "t") {
      technicians = technicians === fullTechList ? shortTechList : fullTechList;
      generateSchedule();
    }
  });

  // Checkbox event listener
  document
    .getElementById("showDetail")
    .addEventListener("change", function (e) {
      showJobDetail = e.target.checked;
      generateSchedule();
    });

  // Work hours input handler
  document.getElementById("workHours").addEventListener("input", function (e) {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 4 && value <= 24) {
      workDayHours = value;
      generateSchedule();
    } else if (e.target.value !== "") {
      // Reset to previous valid value if input is invalid
      e.target.value = workDayHours;
    }
  });

  // Schedule event listeners
  const schedule = document.getElementById("schedule");
  schedule.addEventListener("mouseover", function (e) {
    const jobElement = e.target.closest(".job");
    if (jobElement && !isDragging) {
      const job = JSON.parse(jobElement.dataset.job);
      showTooltip(e, job);
    }
  });

  schedule.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget?.closest(".job")) {
      hideTooltip();
    }
  });

  schedule.addEventListener("dragend", function (e) {
    const jobElement = e.target;
    if (jobElement.classList.contains("job")) {
      isDragging = false;
    }
  });

  // Window resize handler
  window.addEventListener("resize", () => {
    generateSchedule();
  });

  // Auto-scroll handlers
  document.addEventListener("mousemove", handleAutoScroll);
  document.addEventListener("dragover", handleAutoScroll);

  // Main content mouseleave handler
  document.querySelector(".main-content").addEventListener("mouseleave", () => {
    const container = document.querySelector(".main-content");
    if (scrollInterval) {
      clearInterval(scrollInterval);
      scrollInterval = null;
    }
    container.style.cursor = "default";
  });
}

function adjustColumnWidths() {
  const schedule = document.getElementById("schedule");
  const columns = schedule.getElementsByClassName("column");
  const container = document.querySelector(".main-content");
  const availableWidth = container.clientWidth - 20; // 20px for container padding

  const MIN_WIDTH = 150; // Minimum column width
  const MAX_WIDTH = 250; // Maximum column width

  // Calculate how many columns would fit at MIN_WIDTH
  const maxPossibleColumns = Math.floor(availableWidth / MIN_WIDTH);
  // Calculate how many columns would fit at MAX_WIDTH
  const minPossibleColumns = Math.floor(availableWidth / MAX_WIDTH);

  // Calculate optimal number of columns (between 4 and calculated maximum)
  const optimalColumns = Math.min(
    Math.max(Math.max(maxPossibleColumns, minPossibleColumns), 4),
    20 // Set an absolute maximum number of columns
  );

  // Calculate column width to show optimal columns plus a peek at the next
  const columnWidth = Math.min(
    MAX_WIDTH,
    Math.max(
      MIN_WIDTH,
      Math.floor((availableWidth - 4) / (optimalColumns + 0.3))
    )
  );

  Array.from(columns).forEach((column) => {
    column.style.minWidth = `${columnWidth}px`;
    column.style.width = `${columnWidth}px`;
  });
}

function generateSchedule() {
  const schedule = document.getElementById("schedule");
  schedule.innerHTML = "";

  // Calculate available height for the schedule more precisely
  const controlsHeight = document.querySelector(".controls").offsetHeight;
  const mainPadding = 20;
  const availableHeight = window.innerHeight - controlsHeight - mainPadding;

  // Fixed measurements
  const HEADER_HEIGHT = 45;
  const CONTENT_PADDING = 5;

  // Calculate work area height based on available space
  const WORK_AREA_HEIGHT = availableHeight - HEADER_HEIGHT;
  const HOUR_HEIGHT = WORK_AREA_HEIGHT / workDayHours;
  const TOTAL_HEIGHT = availableHeight;

  technicians.forEach((tech) => {
    const column = document.createElement("div");
    column.classList.add("column");
    column.setAttribute("ondrop", "drop(event)");
    column.setAttribute("ondragover", "allowDrop(event)");
    column.setAttribute("ondragenter", "highlightDropZone(event)");
    column.setAttribute("ondragleave", "unhighlightDropZone(event)");
    column.dataset.technician = tech;

    // Calculate total hours for technician
    const totalHours =
      jobs[tech]?.reduce((sum, job) => sum + job.duration, 0) || 0;
    const progressPercentage = Math.min((totalHours / workDayHours) * 100, 100);
    const isOverallocated = totalHours > workDayHours;

    if (tech === "Unallocated") {
      column.innerHTML = `
                <div class='column-header'>
                    ${tech}
                </div>
            `;
    } else {
      column.innerHTML = `
                <div class='column-header'>
                    ${tech}
                    <div class='progress-bar'>
                        <div class='progress-bar-fill ${
                          isOverallocated ? "overallocated" : ""
                        }' 
                             style='width: ${progressPercentage}%;'></div>
                    </div>
                </div>
            `;
    }

    column.style.height = `${TOTAL_HEIGHT}px`;

    if (jobs[tech]) {
      const jobsContainer = document.createElement("div");
      jobsContainer.classList.add("jobs-container");
      jobsContainer.style.padding = "0";
      jobsContainer.style.height = `${WORK_AREA_HEIGHT}px`;
      jobsContainer.style.display = "flex";
      jobsContainer.style.flexDirection = "column";
      jobsContainer.style.gap = "0";

      jobs[tech].forEach((job) =>
        jobsContainer.appendChild(createJobElement(job, HOUR_HEIGHT, tech))
      );
      column.appendChild(jobsContainer);
    }

    schedule.appendChild(column);
  });

  adjustColumnWidths();
}

function createJobElement(job, hourHeight, technicianName) {
  const jobElement = document.createElement("div");
  jobElement.classList.add("job");
  jobElement.setAttribute("draggable", "true");
  jobElement.setAttribute("ondragstart", "drag(event)");
  jobElement.setAttribute("id", job.id);
  // Store job data as JSON in dataset
  jobElement.dataset.job = JSON.stringify(job);

  // Call the utility function to set height and innerHTML
  setJobElementProperties(jobElement, job, hourHeight, technicianName);

  return jobElement;
}

function setJobElementProperties(jobElement, job, hourHeight, technicianName) {
  const JOB_GAP = 3;
  const TOTAL_GAPS = workDayHours - 1; // Gaps between hours

  // Adjust hourHeight to account for all possible gaps
  const adjustedHourHeight = hourHeight - (TOTAL_GAPS * JOB_GAP) / workDayHours;

  // Set height based on whether it's in Unallocated column or not
  const baseHeight =
    technicianName === "Unallocated"
      ? 0.5 * adjustedHourHeight // Fixed 0.5 hour height for unallocated
      : job.duration * adjustedHourHeight; // Normal height calculation for other columns

  jobElement.style.height = `${baseHeight}px`;
  jobElement.style.padding = "4px";
  jobElement.style.marginBottom = `${JOB_GAP}px`;

  // Modify the innerHTML based on showJobDetail and column
  jobElement.innerHTML = `
        <div class="job-id">${job.id}</div>
        <div class="job-time">@${job.start}</div>
        ${
          technicianName !== "Unallocated"
            ? `<div class="job-duration">(${job.duration}h)</div>`
            : ""
        }
        ${
          showJobDetail
            ? `
            <div class="job-customer">${job.customer}</div>
            ${
              technicianName !== "Unallocated"
                ? `<div class="job-description">${job.description}</div>`
                : ""
            }
        `
            : ""
        }
    `;

  // Check if description overflows and add class if it does
  if (showJobDetail && technicianName !== "Unallocated") {
    setTimeout(() => {
      const descriptionEl = jobElement.querySelector(".job-description");
      if (
        descriptionEl &&
        descriptionEl.scrollHeight > descriptionEl.clientHeight
      ) {
        jobElement.classList.add("overflow");
      }
    }, 0);
  }
}

function showTooltip(event, job) {
  if (isDragging) return;

  const tooltip = document.getElementById("tooltip");
  tooltip.innerHTML = `
        <div class="tooltip-header">Customer: ${job.customer}</div>
        <strong>Time Added:</strong> ${job.added}<br>
        <strong>Job Address:</strong> ${job.address}<br>
        <strong>Job Type:</strong> Service Request<br>
        <strong>Job Status:</strong> Booked<br>
        <strong>Job Description:</strong> ${job.description}
    `;
  tooltip.style.display = "block";

  // Get tooltip dimensions
  const tooltipRect = tooltip.getBoundingClientRect();

  // Calculate available space
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Default position
  let left = event.pageX + 10;
  let top = event.pageY + 10;

  // Check right edge
  if (left + tooltipRect.width > viewportWidth - 20) {
    left = event.pageX - tooltipRect.width - 10;
  }

  // Check bottom edge
  if (top + tooltipRect.height > viewportHeight - 20) {
    top = event.pageY - tooltipRect.height - 10;
  }

  // Apply final position
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  document.getElementById("tooltip").style.display = "none";
}

function drag(event) {
  isDragging = true;
  hideTooltip();
  event.dataTransfer.setData("text", event.target.id);

  // Store the source column for later use
  const sourceColumn = event.target.closest(".column");
  event.target.dataset.sourceColumn = sourceColumn.dataset.technician;
}

function handleDragEnd(event) {
  isDragging = false;
}

function updateProgressBar(column) {
  if (!column || column.dataset.technician === "Unallocated") return;

  const jobsContainer = column.querySelector(".jobs-container");
  const jobElements = jobsContainer
    ? jobsContainer.getElementsByClassName("job")
    : [];
  let totalHours = 0;

  Array.from(jobElements).forEach((job) => {
    const durationText = job.querySelector(".job-duration").textContent;
    const duration = parseFloat(durationText.match(/\d+/)[0]);
    totalHours += duration;
  });

  // Update progress bar
  const progressBar = column.querySelector(".progress-bar-fill");
  const progressPercentage = Math.min((totalHours / workDayHours) * 100, 100);
  const isOverallocated = totalHours > workDayHours;

  progressBar.style.width = `${progressPercentage}%`;
  if (isOverallocated) {
    progressBar.classList.add("overallocated");
  } else {
    progressBar.classList.remove("overallocated");
  }
}

function updateJobHeight(jobElement, technicianName, hourHeight) {
  const JOB_GAP = 3;
  const TOTAL_GAPS = workDayHours - 1;
  const adjustedHourHeight = hourHeight - (TOTAL_GAPS * JOB_GAP) / workDayHours;

  // Set height based on whether it's in Unallocated column or not
  const baseHeight =
    technicianName === "Unallocated"
      ? 0.5 * adjustedHourHeight // Fixed 0.5 hour height for unallocated
      : parseFloat(
          jobElement
            .querySelector(".job-duration")
            ?.textContent.match(/\d+(\.\d+)?/)[0] || 0
        ) * adjustedHourHeight;

  jobElement.style.height = `${baseHeight}px`;

  // Update job content based on column
  const duration = jobElement.querySelector(".job-duration");
  const description = jobElement.querySelector(".job-description");

  if (technicianName === "Unallocated") {
    if (duration) duration.style.display = "none";
    if (description) description.style.display = "none";
  } else {
    if (duration) duration.style.display = "";
    if (description) description.style.display = "";
  }
}

function drop(event) {
  event.preventDefault();
  const jobId = event.dataTransfer.getData("text");
  const jobElement = document.getElementById(jobId);
  const newColumn = event.target.closest(".column");
  if (!newColumn) return;

  // Remove drag-over class
  newColumn.classList.remove("drag-over");

  // Find or create jobsContainer in the new column
  let jobsContainer = newColumn.querySelector(".jobs-container");
  if (!jobsContainer) {
    jobsContainer = document.createElement("div");
    jobsContainer.classList.add("jobs-container");
    jobsContainer.style.padding = "0";
    const controlsHeight = document.querySelector(".controls").offsetHeight;
    const mainPadding = 20;
    const availableHeight = window.innerHeight - controlsHeight - mainPadding;
    const workAreaHeight = availableHeight - 45;
    jobsContainer.style.height = `${workAreaHeight}px`;
    jobsContainer.style.display = "flex";
    jobsContainer.style.flexDirection = "column";
    jobsContainer.style.gap = "0";
    newColumn.appendChild(jobsContainer);
  }

  // Get the source column before moving the job
  const sourceTech = jobElement.dataset.sourceColumn;
  const sourceColumn = Array.from(
    document.getElementsByClassName("column")
  ).find((col) => col.dataset.technician === sourceTech);

  // Calculate current hour height
  const controlsHeight = document.querySelector(".controls").offsetHeight;
  const mainPadding = 20;
  const availableHeight = window.innerHeight - controlsHeight - mainPadding;
  const HEADER_HEIGHT = 45;
  const WORK_AREA_HEIGHT = availableHeight - HEADER_HEIGHT;
  const HOUR_HEIGHT = WORK_AREA_HEIGHT / workDayHours;

  // Update job height based on new column
  updateJobHeight(jobElement, newColumn.dataset.technician, HOUR_HEIGHT);

  // Add the job to the container
  jobsContainer.appendChild(jobElement);

  // Update progress bars for both source and destination columns
  if (sourceColumn) {
    updateProgressBar(sourceColumn);
  }
  updateProgressBar(newColumn);
}

function highlightDropZone(event) {
  event.preventDefault();
  const column = event.target.closest(".column");
  if (column) {
    column.classList.add("drag-over");
  }
}

function unhighlightDropZone(event) {
  const column = event.target.closest(".column");
  if (column) {
    column.classList.remove("drag-over");
  }
}

function handleAutoScroll(e) {
  const container = document.querySelector(".main-content");
  const scrollSpeed = 15;
  const scrollThreshold = 100; // pixels from edge to start scrolling

  // Clear any existing scroll interval and reset cursor
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
    container.style.cursor = "default";
  }

  // Only auto-scroll if content is wider than container
  if (container.scrollWidth <= container.clientWidth) return;

  // Get container bounds
  const containerRect = container.getBoundingClientRect();

  // Check if mouse is within the container vertically
  if (e.clientY < containerRect.top || e.clientY > containerRect.bottom) {
    container.style.cursor = "default";
    return;
  }

  const distanceFromRight = containerRect.right - e.clientX;
  const distanceFromLeft = e.clientX - containerRect.left;

  // Scroll right
  if (distanceFromRight < scrollThreshold) {
    container.style.cursor = "e-resize";
    scrollInterval = setInterval(() => {
      container.scrollLeft += scrollSpeed;
    }, 16);
  }
  // Scroll left
  else if (distanceFromLeft < scrollThreshold) {
    container.style.cursor = "w-resize";
    scrollInterval = setInterval(() => {
      container.scrollLeft -= scrollSpeed;
    }, 16);
  }
  // Reset cursor when not in scroll zones
  else {
    container.style.cursor = "default";
  }
}

function allowDrop(event) {
  event.preventDefault();
}
