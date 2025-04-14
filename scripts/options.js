/**
 * Extension Options Manager
 * Handles loading and management of extension options UI
 */

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeOptions);

/**
 * Main initialization function for options page
 */
function initializeOptions() {
    loadExtensionOptions();
}

/**
 * Loads all extension options and populates the UI
 */
function loadExtensionOptions() {
    const updateToggleContainer = document.getElementById('updatetoggle');
    if (!updateToggleContainer) {
        console.error('Update toggle container not found');
        return;
    }

    // Create default options based on constants
    const defaultOptions = { ...DEFAULT_MANAGEMENT_OPTIONS };
    let installedExtensions = [];

    // Fetch all extensions from Chrome management API
    chrome.management.getAll(function (extensions) {
        // Filter extensions that have update URLs
        const filteredExtensions = extensions.filter(ext => ext.updateUrl);
        installedExtensions = filteredExtensions.map(ext => ext.id);

        // Populate the UI with extension entries
        populateExtensionList(filteredExtensions, updateToggleContainer, defaultOptions);

        // Set up the import/export functionality
        setupImportExport(filteredExtensions, installedExtensions);

        // Load saved options and set up event listeners
        loadSavedOptions(defaultOptions);
    });
}

/**
 * Creates and adds extension entries to the UI
 * @param {Array} extensions - List of extension objects
 * @param {HTMLElement} container - Container element to append entries to
 * @param {Object} defaultOptions - Default options object to populate
 */
function populateExtensionList(extensions, container, defaultOptions) {
    for (const extension of extensions) {
        const extensionEntry = createExtensionEntry(extension);
        container.appendChild(extensionEntry);
        defaultOptions[extension.id] = false;
    }
}

/**
 * Creates a DOM element representing an extension entry
 * @param {Object} extension - Extension object from chrome.management API
 * @return {HTMLElement} - The created extension entry element
 */
function createExtensionEntry(extension) {
    const div = document.createElement('div');
    const label = document.createElement('label');
    const input = document.createElement('input');
    const img = document.createElement('img');
    const span = document.createElement('span');

    // Configure label
    label.setAttribute('title', chrome.i18n.getMessage('options_neverCheckTooltip'));

    // Configure checkbox
    input.setAttribute('type', 'checkbox');
    input.setAttribute('id', extension.id);

    // Check if this extension is from a store that should be ignored
    const isIgnoredStore = Array.from(store_extensions.keys()).some((pattern) => pattern.test(extension.updateUrl) && store_extensions.get(pattern).ignore);

    if (isIgnoredStore) {
        input.checked = true;
        input.disabled = true;
    }

    // Configure icon
    img.setAttribute('alt', extension.name);
    const iconSize = extension.icons ? extension.icons[0].size : 16;
    img.setAttribute('src', `chrome://extension-icon/${extension.id}/${iconSize}/0`);

    // Configure name span
    span.textContent = extension.name;

    // Assemble the elements
    label.appendChild(input);
    label.appendChild(img);
    label.appendChild(span);
    div.appendChild(label);

    return div;
}

/**
 * Sets up the import/export functionality
 * @param {Array} extensions - List of extension objects
 * @param {Array} installedExtensions - List of installed extension IDs
 */
function setupImportExport(extensions, installedExtensions) {
    const importExportTextarea = document.getElementById('import_export_list');
    const importAllButton = document.getElementById('import_all_button');

    if (!importExportTextarea || !importAllButton) {
        console.error('Import/export elements not found');
        return;
    }

    // Create export list of extensions
    importExportTextarea.value = extensions
        .map(extension => {
            // Check if extension is from a known store
            for (const [pattern, updaterOptions] of store_extensions) {
                if (pattern.test(extension.updateUrl)) {
                    if (!updaterOptions.ignore) {
                        return `${extension.name}|${extension.id}`;
                    } else {
                        return extension.name;
                    }
                }
            }
            // If not from a known store, include the update URL
            return `${extension.name}|${extension.id}|${extension.updateUrl}`;
        })
        .join('\r\n');

    // Set up import button click handler
    importAllButton.addEventListener('click', () => importAllExtensions(importExportTextarea.value, installedExtensions));
}

/**
 * Handles importing extensions from the textarea
 * @param {string} importText - Text containing extension information
 * @param {Array} installedExtensions - List of already installed extension IDs
 */
function importAllExtensions(importText, installedExtensions) {
    const extensionsToImport = [];
    const extensionPattern = /^(.*)\|([a-z]{32})(?:\||$)(.*)$/gim;

    // Match and process each extension in the import list
    for (const match of importText.matchAll(extensionPattern)) {
        const [_, name, id, updateUrl] = match;

        // Skip already installed extensions
        if (installedExtensions.includes(id)) continue;

        // Create extension object
        extensionsToImport.push({
            name: name,
            id: id,
            updateUrl: updateUrl || googleUpdateUrl,
            version: '0'
        });
    }

    // Check for updates and install extensions
    if (extensionsToImport.length > 0) {
        checkForUpdates(
            function (updateCheck, installed_versions, appid, updatever, is_webstore) {
                const crxUrl = updateCheck['@codebase'];
                promptInstall(crxUrl, is_webstore);
            },
            null,
            null,
            extensionsToImport
        );
    }
}

/**
 * Loads saved options from storage and sets up event listeners
 * @param {Object} defaultOptions - Default options object
 */
function loadSavedOptions(defaultOptions) {
    chrome.storage.sync.get(defaultOptions, function (storedValues) {
        storedValues.ignored_extensions = [];

        // Get managed storage values (e.g., from enterprise policies)
        chrome.storage.managed.get(storedValues, function (items) {
            // Apply ignored extensions from managed storage
            items.ignored_extensions.forEach(ignoredAppId => {
                if (ignoredAppId in items) {
                    items[ignoredAppId] = true;
                }
            });
            delete items.ignored_extensions;

            // Apply values to UI and set up event listeners
            applyStoredValues(items);
            setupDependentOptions();
        });
    });
}

/**
 * Applies stored values to UI elements and sets up change listeners
 * @param {Object} items - Object containing stored option values
 */
function applyStoredValues(items) {
    for (const [settingId, value] of Object.entries(items)) {
        const element = document.getElementById(settingId);
        if (!element) continue;

        if (element.type === 'checkbox') {
            setupCheckboxOption(element, value);
        } else {
            setupNumericOption(element, value);
        }
    }
}

/**
 * Sets up a checkbox option element
 * @param {HTMLInputElement} checkbox - Checkbox input element
 * @param {boolean} value - Current value of the option
 */
function setupCheckboxOption(checkbox, value) {
    // Only set checked if not already checked (preserves disabled state)
    if (!checkbox.checked) checkbox.checked = value;

    // Set up change event listener
    checkbox.addEventListener('change', event => {
        const checked = event.target.checked;

        // Save to sync storage
        chrome.storage.sync.set(
            { [event.target.id]: checked },
            function () {
                // Revert if there was an error
                if (chrome.runtime.lastError) {
                    checkbox.checked = !checked;
                }
            }
        );
    });
}

/**
 * Sets up a numeric input option element
 * @param {HTMLInputElement} input - Numeric input element
 * @param {number} value - Current value of the option
 */
function setupNumericOption(input, value) {
    input.value = value;

    // Set up input event listener
    input.addEventListener('input', event => {
        const val = parseInt(event.target.value) || 60;
        const validValue = Math.max(1, val);

        // Save to sync storage
        chrome.storage.sync.set(
            { [event.target.id]: validValue },
            function () {
                // Revert if there was an error
                if (chrome.runtime.lastError) {
                    input.value = '60';
                }
            }
        );
    });
}

/**
 * Sets up dependent options that should be enabled/disabled based on parent checkbox
 */
function setupDependentOptions() {
    for (const subLabel of document.querySelectorAll('label.sub')) {
        const parentCheckbox = subLabel.previousElementSibling.querySelector('input[type="checkbox"]');
        if (!parentCheckbox) return;

        // Set initial state
        updateDependentOptionState(subLabel, parentCheckbox.checked);

        // Set up change listener
        parentCheckbox.addEventListener('change', event => {
            updateDependentOptionState(subLabel, event.target.checked);
        });
    };
}

/**
 * Updates the state of dependent options based on parent checkbox
 * @param {HTMLElement} container - Container element for dependent options
 * @param {boolean} enabled - Whether dependent options should be enabled
 */
function updateDependentOptionState(container, enabled) {
    if (enabled) {
        container.classList.remove('disabled');
        for (const input of container.querySelectorAll('input')) input.disabled = false;
    } else {
        container.classList.add('disabled');
        for (const input of container.querySelectorAll('input')) input.disabled = true;
    }
}