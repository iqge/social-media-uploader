// main.js - Main application logic with song name extraction and named localStorage configs

// Helper function to extract song name from filename
function extractSongName(filename) {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

  // Look for pattern __songName__
  const match = nameWithoutExt.match(/__([^_]+)__/);

  if (match && match[1]) {
    return match[1].trim();
  }

  // Fallback: return null if no pattern found
  return null;
}

// Helper function to substitute {song_name} in title template
function applyTitleTemplate(template, songName) {
  if (!songName) {
    // No song name extracted, return template as-is
    return template;
  }

  // Replace {song_name} placeholder with actual song name
  return template.replace(/\{song_name\}/gi, songName);
}

// ============================================================================
// CONFIGURATION MANAGEMENT - localStorage with Named Configs
// ============================================================================

const CONFIG_LIST_KEY = 'youtubeUploaderConfigs';

// Get all saved configuration names
function getSavedConfigNames() {
  try {
    const configs = localStorage.getItem(CONFIG_LIST_KEY);
    return configs ? JSON.parse(configs) : {};
  } catch (error) {
    console.error('Error reading configs:', error);
    return {};
  }
}

// Save all configurations
function saveAllConfigs(configs) {
  try {
    localStorage.setItem(CONFIG_LIST_KEY, JSON.stringify(configs));
  } catch (error) {
    console.error('Error saving configs:', error);
    throw error;
  }
}

// Get current configuration from form
function getCurrentConfig() {
  return {
    bulkTitle: document.getElementById('bulk-title').value,
    bulkDescription: document.getElementById('bulk-description').value,
    bulkTags: document.getElementById('bulk-tags').value,
    bulkIs18Plus: document.getElementById('bulk-is-18-plus').checked,
    bulkStartDate: document.getElementById('bulk-start-date').value,
    bulkEndDate: document.getElementById('bulk-end-date').value,
    bulkStartTime: document.getElementById('bulk-start-time').value,
    bulkEndTime: document.getElementById('bulk-end-time').value,
    enableSmartSchedule: document.getElementById('enable-smart-schedule').checked,
    batchMinGap: document.getElementById('batch-min-gap').value,
    batchMaxGap: document.getElementById('batch-max-gap').value,
    existingMinGap: document.getElementById('existing-min-gap').value,
    existingMaxGap: document.getElementById('existing-max-gap').value,
    randomnessFactor: document.getElementById('randomness-factor').value,
    respectExisting: document.getElementById('respect-existing').checked,
    selectedDays: Array.from(document.querySelectorAll('.day-btn.selected')).map(btn => btn.dataset.day),
    savedAt: new Date().toISOString()
  };
}

// Apply configuration to form
function applyConfig(config) {
  // Load bulk settings
  if (config.bulkTitle !== undefined) document.getElementById('bulk-title').value = config.bulkTitle;
  if (config.bulkDescription !== undefined) document.getElementById('bulk-description').value = config.bulkDescription;
  if (config.bulkTags !== undefined) document.getElementById('bulk-tags').value = config.bulkTags;
  if (config.bulkIs18Plus !== undefined) document.getElementById('bulk-is-18-plus').checked = config.bulkIs18Plus;
  if (config.bulkStartDate !== undefined) document.getElementById('bulk-start-date').value = config.bulkStartDate;
  if (config.bulkEndDate !== undefined) document.getElementById('bulk-end-date').value = config.bulkEndDate;
  if (config.bulkStartTime !== undefined) document.getElementById('bulk-start-time').value = config.bulkStartTime;
  if (config.bulkEndTime !== undefined) document.getElementById('bulk-end-time').value = config.bulkEndTime;

  // Load smart schedule settings
  if (config.enableSmartSchedule !== undefined) {
    const smartScheduleCheckbox = document.getElementById('enable-smart-schedule');
    smartScheduleCheckbox.checked = config.enableSmartSchedule;
    smartScheduleCheckbox.dispatchEvent(new Event('change'));
  }
  if (config.batchMinGap !== undefined) document.getElementById('batch-min-gap').value = config.batchMinGap;
  if (config.batchMaxGap !== undefined) document.getElementById('batch-max-gap').value = config.batchMaxGap;
  if (config.existingMinGap !== undefined) document.getElementById('existing-min-gap').value = config.existingMinGap;
  if (config.existingMaxGap !== undefined) document.getElementById('existing-max-gap').value = config.existingMaxGap;
  if (config.randomnessFactor !== undefined) document.getElementById('randomness-factor').value = config.randomnessFactor;
  if (config.respectExisting !== undefined) document.getElementById('respect-existing').checked = config.respectExisting;

  // Load selected days
  if (config.selectedDays && Array.isArray(config.selectedDays)) {
    document.querySelectorAll('.day-btn').forEach(btn => {
      if (config.selectedDays.includes(btn.dataset.day)) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  // Trigger schedule options display if dates are set
  toggleScheduleOptions();

  // Trigger title counter update
  document.getElementById('bulk-title').dispatchEvent(new Event('input'));
}

// Save configuration with a name
function saveConfiguration() {
  const configName = prompt('Enter a name for this configuration:');

  if (!configName || configName.trim() === '') {
    alert('⚠️ Configuration name cannot be empty');
    return;
  }

  const trimmedName = configName.trim();

  try {
    const allConfigs = getSavedConfigNames();
    const config = getCurrentConfig();

    // Check if name already exists
    if (allConfigs[trimmedName]) {
      if (!confirm(`Configuration "${trimmedName}" already exists. Overwrite?`)) {
        return;
      }
    }

    allConfigs[trimmedName] = config;
    saveAllConfigs(allConfigs);

    alert(`✅ Configuration "${trimmedName}" saved successfully!`);
    updateConfigList();
  } catch (error) {
    alert('❌ Error saving configuration: ' + error.message);
  }
}

// Load configuration by name
function loadConfiguration(configName) {
  try {
    const allConfigs = getSavedConfigNames();
    const config = allConfigs[configName];

    if (!config) {
      alert(`❌ Configuration "${configName}" not found`);
      return;
    }

    applyConfig(config);
    alert(`✅ Configuration "${configName}" loaded successfully!`);
  } catch (error) {
    alert('❌ Error loading configuration: ' + error.message);
  }
}

// Delete configuration by name
function deleteConfiguration(configName) {
  if (!confirm(`Are you sure you want to delete "${configName}"?`)) {
    return;
  }

  try {
    const allConfigs = getSavedConfigNames();
    delete allConfigs[configName];
    saveAllConfigs(allConfigs);

    alert(`✅ Configuration "${configName}" deleted successfully!`);
    updateConfigList();
  } catch (error) {
    alert('❌ Error deleting configuration: ' + error.message);
  }
}

// Update the configuration list display
function updateConfigList() {
  const listContainer = document.getElementById('config-list');
  if (!listContainer) return;

  const allConfigs = getSavedConfigNames();
  const configNames = Object.keys(allConfigs);

  if (configNames.length === 0) {
    listContainer.innerHTML = '<p style="color: #666; font-style: italic; padding: 10px;">No saved configurations</p>';
    return;
  }

  listContainer.innerHTML = configNames.map(name => {
    const config = allConfigs[name];
    const savedDate = config.savedAt ? new Date(config.savedAt).toLocaleString() : 'Unknown';

    return `
      <div class="config-item">
        <div class="config-item-info">
          <strong>${name}</strong>
          <small style="color: #666;">Saved: ${savedDate}</small>
        </div>
        <div class="config-item-actions">
          <button type="button" class="btn-small btn-load" onclick="loadConfiguration('${name.replace(/'/g, "\\'")}')">
            📂 Load
          </button>
          <button type="button" class="btn-small btn-delete" onclick="deleteConfiguration('${name.replace(/'/g, "\\'")}')">
            🗑️ Delete
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// END CONFIGURATION MANAGEMENT
// ============================================================================

// Set minimum date for datetime inputs to now
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
document.getElementById('bulk-start-date').min = now.toISOString().slice(0, 16);
document.getElementById('bulk-end-date').min = now.toISOString().slice(0, 16);

// Smart schedule toggle
document.getElementById('enable-smart-schedule').addEventListener('change', function() {
  document.getElementById('smart-schedule-options').style.display = this.checked ? 'block' : 'none';
});

// Validate gap settings - Existing gaps
document.getElementById('existing-min-gap').addEventListener('change', function() {
  const minGap = parseInt(this.value);
  const maxGapInput = document.getElementById('existing-max-gap');
  const maxGap = parseInt(maxGapInput.value);

  if (maxGap <= minGap) {
    maxGapInput.value = minGap + 1;
  }
});

document.getElementById('existing-max-gap').addEventListener('change', function() {
  const maxGap = parseInt(this.value);
  const minGapInput = document.getElementById('existing-min-gap');
  const minGap = parseInt(minGapInput.value);

  if (maxGap <= minGap) {
    this.value = minGap + 1;
  }
});

// Validate gap settings - Batch gaps
document.getElementById('batch-min-gap').addEventListener('change', function() {
  const minGap = parseInt(this.value);
  const maxGapInput = document.getElementById('batch-max-gap');
  const maxGap = parseInt(maxGapInput.value);

  if (maxGap <= minGap) {
    maxGapInput.value = minGap + 1;
  }
});

document.getElementById('batch-max-gap').addEventListener('change', function() {
  const maxGap = parseInt(this.value);
  const minGapInput = document.getElementById('batch-min-gap');
  const minGap = parseInt(minGapInput.value);

  if (maxGap <= minGap) {
    this.value = minGap + 1;
  }
});

// Fetch existing schedule
document.getElementById('fetch-schedule-btn').addEventListener('click', () => {
  window.schedulingModule.fetchExistingSchedule();
});

// Save Configuration button
document.getElementById('save-config-btn')?.addEventListener('click', () => {
  saveConfiguration();
});

// Load Configuration button - show list
document.getElementById('load-config-btn')?.addEventListener('click', () => {
  updateConfigList();
  const modal = document.getElementById('config-modal');
  if (modal) {
    modal.classList.add('active');
  }
});

// Close config modal
document.getElementById('close-config-modal')?.addEventListener('click', () => {
  const modal = document.getElementById('config-modal');
  if (modal) {
    modal.classList.remove('active');
  }
});

// Click outside modal to close
document.getElementById('config-modal')?.addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('active');
  }
});

// Initialize config list on page load
document.addEventListener('DOMContentLoaded', () => {
  updateConfigList();
});

// Title counter
document.getElementById('bulk-title').addEventListener('input', function() {
  const titles = this.value.split('\n').filter(t => t.trim().length > 0);
  const counter = document.getElementById('title-counter');

  if (titles.length > 0) {
    counter.style.display = 'block';
    counter.textContent = `📝 ${titles.length} title(s) entered`;
  } else {
    counter.style.display = 'none';
  }
});

// Preview functionality
document.getElementById('preview-bulk').addEventListener('click', function() {
  const bulkTitleText = document.getElementById('bulk-title').value;
  const bulkDescription = document.getElementById('bulk-description').value;

  const bulkTitles = bulkTitleText
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (bulkTitles.length === 0) {
    alert('⚠️ Please enter at least one title to preview');
    return;
  }

  const previewItems = document.getElementById('preview-items');
  previewItems.innerHTML = '';

  bulkTitles.forEach((title, index) => {
    const formattedDescription = bulkDescription
      ? `${title}\n\n\n${bulkDescription}`
      : `${title}\n\n\n`;

    const item = document.createElement('div');
    item.className = 'preview-item';
    item.innerHTML = `
      <h4>Sample ${index + 1}</h4>
      <div class="preview-title">Title: ${title}</div>
      <div style="font-weight: 600; margin: 10px 0;">Description:</div>
      <div class="preview-description">${formattedDescription}</div>
    `;
    previewItems.appendChild(item);
  });

  document.getElementById('preview-modal').classList.add('active');
});

document.getElementById('close-preview').addEventListener('click', function() {
  document.getElementById('preview-modal').classList.remove('active');
});

document.getElementById('preview-modal').addEventListener('click', function(e) {
  if (e.target === this) {
    this.classList.remove('active');
  }
});

// Show/hide schedule options
document.getElementById('bulk-start-date').addEventListener('change', toggleScheduleOptions);
document.getElementById('bulk-end-date').addEventListener('change', toggleScheduleOptions);

function toggleScheduleOptions() {
  const startDate = document.getElementById('bulk-start-date').value;
  const endDate = document.getElementById('bulk-end-date').value;
  const scheduleOptions = document.getElementById('schedule-options');

  if (startDate && endDate) {
    scheduleOptions.style.display = 'block';
  } else {
    scheduleOptions.style.display = 'none';
  }
}

// Day selector
const dayButtons = document.querySelectorAll('.day-btn');
dayButtons.forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    this.classList.toggle('selected');
  });
});

function getSelectedDays() {
  return Array.from(document.querySelectorAll('.day-btn.selected'))
    .map(btn => btn.dataset.day);
}

// Apply bulk settings with smart scheduling
document.getElementById('apply-bulk').addEventListener('click', function() {
  const bulkTitleText = document.getElementById('bulk-title').value;
  const bulkDescription = document.getElementById('bulk-description').value;
  const bulkTags = document.getElementById('bulk-tags').value;
  const bulkIs18Plus = document.getElementById('bulk-is-18-plus').checked;
  const bulkStartDate = new Date(document.getElementById('bulk-start-date').value);
  const bulkEndDate = new Date(document.getElementById('bulk-end-date').value);
  const bulkDays = getSelectedDays();
  const bulkStartTime = document.getElementById('bulk-start-time').value;
  const bulkEndTime = document.getElementById('bulk-end-time').value;

  const videoSections = document.querySelectorAll('.video-form-section');
  const videoCount = videoSections.length;

  if (videoCount === 0) {
    alert('⚠️ Please select videos first');
    return;
  }

  if (!bulkStartDate || !bulkEndDate) {
    alert('⚠️ Please set start and end dates');
    return;
  }

  if (bulkEndDate <= bulkStartDate) {
    alert('⚠️ End date must be after start date');
    return;
  }

  // Prepare titles
  const bulkTitles = bulkTitleText
    .split('\n')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (bulkTitles.length > 0 && bulkTitles.length < videoCount) {
    if (!confirm(`You have ${bulkTitles.length} titles but ${videoCount} videos. Some titles will be reused. Continue?`)) {
      return;
    }
  }

  // Create title pool - but keep as templates for now
  let titleTemplates = [];
  if (bulkTitles.length > 0) {
    while (titleTemplates.length < videoCount) {
      titleTemplates = titleTemplates.concat([...bulkTitles]);
    }
    titleTemplates.sort(() => Math.random() - 0.5);
    titleTemplates = titleTemplates.slice(0, videoCount);
  }

  // Generate schedule
  let scheduledDates = [];
  const useSmartSchedule = document.getElementById('enable-smart-schedule').checked;

  const respectExisting = document.getElementById('respect-existing')?.checked || false;

  if (useSmartSchedule) {
    const batchMinGap = parseInt(document.getElementById('batch-min-gap').value) || 30;
    const batchMaxGap = parseInt(document.getElementById('batch-max-gap').value) || 45;
    const existingMinGap = parseInt(document.getElementById('existing-min-gap').value) || 7;
    const existingMaxGap = parseInt(document.getElementById('existing-max-gap').value) || 14;
    const randomnessFactor = parseInt(document.getElementById('randomness-factor').value) || 20;

    scheduledDates = window.schedulingModule.generateSmartSchedule(
      videoCount,
      bulkStartDate,
      bulkEndDate,
      {
        batchMinGap,
        batchMaxGap,
        existingMinGap,
        existingMaxGap,
        randomnessFactor,
        respectExisting,
        allowedDays: bulkDays,
        startTime: bulkStartTime,
        endTime: bulkEndTime
      }
    );

    const quality = window.schedulingModule.analyzeScheduleQuality(
      scheduledDates,
      respectExisting ? window.schedulingModule.getExistingSchedule() : []
    );

    if (quality) {
      console.log('Schedule Quality Analysis:', quality);
    }
  } else {
    for (let i = 0; i < videoCount; i++) {
      let randomDate;
      let attempts = 0;
      do {
        randomDate = new Date(bulkStartDate.getTime() + Math.random() * (bulkEndDate.getTime() - bulkStartDate.getTime()));
        attempts++;
      } while (bulkDays.length > 0 && !bulkDays.includes(randomDate.getDay().toString()) && attempts < 100);

      if (bulkStartTime && bulkEndTime) {
        const startTime = new Date(`1970-01-01T${bulkStartTime}`);
        const endTime = new Date(`1970-01-01T${bulkEndTime}`);
        const randomTime = new Date(startTime.getTime() + Math.random() * (endTime.getTime() - startTime.getTime()));
        randomDate.setHours(randomTime.getHours());
        randomDate.setMinutes(randomTime.getMinutes());
      }

      scheduledDates.push(randomDate);
    }

    scheduledDates.sort(() => Math.random() - 0.5);
  }

  // Apply to form
  videoSections.forEach((section, index) => {
    // Get the song name from the section's stored filename
    const originalFilename = section.dataset.originalFilename;
    const songName = originalFilename ? extractSongName(originalFilename) : null;

    if (titleTemplates.length > 0 && titleTemplates[index]) {
      const titleTemplate = titleTemplates[index];
      // Apply song name substitution to the title template
      const finalTitle = applyTitleTemplate(titleTemplate, songName);

      const titleInput = section.querySelector('input[name^="title_"]');
      if (titleInput) {
        titleInput.value = finalTitle;
      }

      const descriptionTextarea = section.querySelector('textarea[name^="description_"]');
      if (descriptionTextarea) {
        if (bulkDescription && bulkDescription.trim()) {
          descriptionTextarea.value = `${finalTitle}\n\n\n${bulkDescription}`;
        } else {
          descriptionTextarea.value = `${finalTitle}\n\n\n`;
        }
      }
    } else if (bulkDescription && bulkDescription.trim()) {
      const descriptionTextarea = section.querySelector('textarea[name^="description_"]');
      if (descriptionTextarea) {
        descriptionTextarea.value = bulkDescription;
      }
    }

    if (bulkTags && bulkTags.trim()) {
      const tagsInput = section.querySelector('input[name^="tags_"]');
      if (tagsInput) {
        tagsInput.value = bulkTags;
      }
    }

    const is18PlusCheckbox = section.querySelector('input[name^="is18Plus_"]');
    if (is18PlusCheckbox) {
      is18PlusCheckbox.checked = bulkIs18Plus;
    }

    if (scheduledDates[index]) {
      const formattedDate = scheduledDates[index].toISOString().slice(0, 16);
      const publishAtInput = section.querySelector('input[name^="publishAt_"]');
      if (publishAtInput) {
        publishAtInput.value = formattedDate;
      }
    }
  });

  const uniqueTitlesUsed = new Set(titleTemplates).size;
  let summaryMessage = 'Applied bulk settings!\n\n';

  if (titleTemplates.length > 0) {
    summaryMessage += `${uniqueTitlesUsed} unique title template(s) assigned to ${videoCount} video(s)\n`;
    if (titleTemplates.some(t => t.includes('{song_name}'))) {
      summaryMessage += '🎵 Song names will be substituted from filenames\n';
    }
    summaryMessage += 'Each title has been prefixed in the description with 2 empty lines\n\n';
    summaryMessage += 'Title templates used:\n';
    titleTemplates.slice(0, Math.min(5, titleTemplates.length)).forEach((title, idx) => {
      summaryMessage += `  ${idx + 1}. ${title}\n`;
    });
    if (titleTemplates.length > 5) {
      summaryMessage += `  ... and ${titleTemplates.length - 5} more\n`;
    }
  } else {
    summaryMessage += 'Description applied to all videos\n';
  }

  if (bulkTags && bulkTags.trim()) {
    summaryMessage += '\nTags applied';
  }

  if (scheduledDates.length > 0) {
    summaryMessage += '\nPublish dates scheduled';

    if (useSmartSchedule) {
      const quality = window.schedulingModule.analyzeScheduleQuality(
        scheduledDates,
        respectExisting ? window.schedulingModule.getExistingSchedule() : []
      );

      if (quality) {
        summaryMessage += `\n\nSchedule Quality:`;
        if (quality.batchGaps) {
          summaryMessage += `\n📊 Between new videos:`;
          summaryMessage += `\n  Average gap: ${quality.batchGaps.average} days`;
          summaryMessage += `\n  Min gap: ${quality.batchGaps.min} days`;
          summaryMessage += `\n  Max gap: ${quality.batchGaps.max} days`;
        }
        if (quality.existingGaps) {
          summaryMessage += `\n📅 From existing videos:`;
          summaryMessage += `\n  Average gap: ${quality.existingGaps.average} days`;
          summaryMessage += `\n  Min gap: ${quality.existingGaps.min} days`;
          summaryMessage += `\n  Max gap: ${quality.existingGaps.max} days`;
        }
      }
    }
  }

  alert(summaryMessage);

  console.log('Bulk apply completed:', {
    videoCount,
    titlesProvided: bulkTitles.length,
    uniqueTitlesUsed,
    titleTemplates,
    scheduledDates: scheduledDates.length
  });
});

// Handle file selection with song name extraction
const videoInput = document.getElementById('video-input');
const videoFormsContainer = document.getElementById('video-forms-container');

videoInput.addEventListener('change', (e) => {
  videoFormsContainer.innerHTML = '';
  const files = e.target.files;

  Array.from(files).forEach((file, index) => {
    // Extract song name from filename
    const songName = extractSongName(file.name);

    const formSection = document.createElement('div');
    formSection.classList.add('video-form-section');
    formSection.dataset.originalFilename = file.name; // Store for reference

    formSection.innerHTML = `
      <div class="video-header">
        <div class="video-number">
          Video ${index + 1}
          ${songName ? `<span style="color: #667eea; font-size: 0.9em; font-weight: 500; margin-left: 10px;">
            🎵 "${songName}"
          </span>` : ''}
        </div>
        <button type="button" class="btn btn-danger delete-btn">Delete</button>
      </div>

      <video class="video-preview" controls>
        <source src="${URL.createObjectURL(file)}" type="${file.type}">
      </video>

      <div class="input-group">
        <label>Title *</label>
        <input type="text" name="title_${index}" placeholder="Enter video title or use {song_name} placeholder" required>
        <small style="color: #666; display: block; margin-top: 3px;">
          ${songName ? `🎵 Detected song: "${songName}" - Use {song_name} in title to auto-substitute` : 'No song name detected in filename (use __songName__ pattern)'}
        </small>
      </div>

      <div class="input-group">
        <label>Description *</label>
        <textarea name="description_${index}" placeholder="Enter video description" required></textarea>
      </div>

      <div class="input-group">
        <label>Tags</label>
        <input type="text" name="tags_${index}" placeholder="tag1, tag2, tag3">
      </div>

      <div class="input-group">
        <label>Publish Date & Time (optional)</label>
        <input type="datetime-local" name="publishAt_${index}" min="${now.toISOString().slice(0, 16)}">
      </div>

      <div class="checkbox-group">
        <input type="checkbox" name="is18Plus_${index}" id="is18Plus_${index}">
        <label for="is18Plus_${index}">Mark as 18+ (Age Restricted)</label>
      </div>

      <button type="button" class="btn btn-secondary change-video-btn">Change Video</button>
      <input type="file" accept="video/*" style="display: none;" class="change-video-input">
    `;

    formSection.querySelector('.delete-btn').addEventListener('click', () => {
      formSection.remove();
      if (videoFormsContainer.children.length === 0) {
        videoInput.value = '';
      }
    });

    const changeBtn = formSection.querySelector('.change-video-btn');
    const changeInput = formSection.querySelector('.change-video-input');
    const titleInput = formSection.querySelector('input[name^="title_"]');

    changeBtn.addEventListener('click', () => changeInput.click());
    changeInput.addEventListener('change', (event) => {
      const newFile = event.target.files[0];
      if (newFile) {
        const videoPreview = formSection.querySelector('.video-preview');
        videoPreview.src = URL.createObjectURL(newFile);

        // Update song name when file changes
        const newSongName = extractSongName(newFile.name);

        // Update the display in the header
        const videoNumber = formSection.querySelector('.video-number');
        const existingSongDisplay = videoNumber.querySelector('span');

        if (newSongName) {
          if (existingSongDisplay) {
            existingSongDisplay.textContent = `🎵 "${newSongName}"`;
          } else {
            const songSpan = document.createElement('span');
            songSpan.style.cssText = 'color: #667eea; font-size: 0.9em; font-weight: 500; margin-left: 10px;';
            songSpan.textContent = `🎵 "${newSongName}"`;
            videoNumber.appendChild(songSpan);
          }
        } else if (existingSongDisplay) {
          existingSongDisplay.remove();
        }

        // Update helper text
        const helperText = titleInput.nextElementSibling;
        if (helperText && helperText.tagName === 'SMALL') {
          helperText.textContent = newSongName
            ? `🎵 Detected song: "${newSongName}" - Use {song_name} in title to auto-substitute`
            : 'No song name detected in filename (use __songName__ pattern)';
        }

        formSection.dataset.originalFilename = newFile.name;
      }
    });

    videoFormsContainer.appendChild(formSection);
  });
});

// Handle form submission
const form = document.getElementById('upload-form');
const loader = document.getElementById('loader');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  loader.classList.add('active');

  const formData = new FormData(form);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      let message = 'Videos uploaded successfully!';

      let warningHTML = '';

      if (result.warning && result.warning.videos && result.warning.videos.length > 0) {
        warningHTML = `
          <div class="warning-box">
            <h3>Manual Action Required</h3>
            <p><strong>${result.warning.count} video(s) marked as 18+ need age restriction set manually in YouTube Studio.</strong></p>
            <p>YouTube API does not support automatic age restriction. Please complete these steps:</p>
            <ul>
              ${result.warning.instructions.map(inst => `<li>${inst}</li>`).join('')}
            </ul>
            <h4 style="margin-top: 15px;">Videos requiring age restriction:</h4>
            ${result.warning.videos.map(v => `
              <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 6px;">
                <strong>${v.title}</strong><br>
                Video ID: ${v.videoId}<br>
                <a href="${v.editUrl}" target="_blank" class="video-link">Open in YouTube Studio</a>
              </div>
            `).join('')}
          </div>
        `;

        const warningDiv = document.createElement('div');
        warningDiv.innerHTML = warningHTML;
        document.querySelector('.upload-section').appendChild(warningDiv);
      }

      alert(message);
      console.log(result);
      videoFormsContainer.innerHTML = '';
      videoInput.value = '';
    } else {
      alert(`Failed to upload videos: ${result.error}`);
    }
  } catch (error) {
    alert(`An error occurred: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    loader.classList.remove('active');
  }
});

// Video Stats
const urlParams = new URLSearchParams(window.location.search);
const accessToken = urlParams.get('access_token');

if (accessToken) {
  document.getElementById('access_token').value = accessToken;
  document.getElementById('access_token_stats').value = accessToken;
}

document.getElementById('stats-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const videoId = document.getElementById('video-id').value;
  const token = document.getElementById('access_token_stats').value;

  try {
    const response = await fetch(`/video-stats/${videoId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const result = await response.json();

    if (response.ok) {
      document.getElementById('video-stats').innerHTML = `
        <div class="stats-display">
          <h3>${result.title || 'N/A'}</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">Views</div>
              <div class="stat-value">${result.views || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Likes</div>
              <div class="stat-value">${result.likes || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Comments</div>
              <div class="stat-value">${result.comments || 0}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Engagement Rate</div>
              <div class="stat-value">${result.engagementRate?.toFixed(2) || 0}%</div>
            </div>
          </div>
          <div style="margin-top: 15px;">
            <strong>Tags:</strong> ${result.tags?.join(', ') || 'None'}
          </div>
        </div>
      `;
    } else {
      alert(`Failed to fetch video stats: ${result.error}`);
    }
  } catch (error) {
    alert(`An error occurred: ${error.message}`);
  }
});
