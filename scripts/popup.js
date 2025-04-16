/**
 * Extension Update Checker
 * 
 * This script manages the popup UI for checking Chrome extension updates
 * and displaying removed extensions.
 */

// DOM element creation helper function
function createElement(type, attributes = {}, children = []) {
    const element = document.createElement(type);

    // Set attributes
    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'class' && Array.isArray(value)) {
            for (const cls of value) element.classList.add(cls);
        } else if (key === 'innerHTML') element.innerHTML = value;
        else if (value != null && value != undefined) element.setAttribute(key, value);
    }

    // Append children
    for (const child of children) {
        if (child) element.appendChild(child);
    };

    return element;
}

// Constants
const SVG_ICONS = {
    EXTERNAL_LINK: '<svg viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" style="pointer-events: none; display: block;"><g><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"></path></g></svg>',
    VISIBILITY_OFF: '<svg class="svg-icon" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" style="pointer-events: none; display: block;"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"></path></svg>',
    WRENCH: '<svg class="svg-icon" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" focusable="false" style="pointer-events: none; display: block;"><path d="M4.5.257l3.771 3.771c.409 1.889-2.33 4.66-4.242 4.242l-3.771-3.77c-.172.584-.258 1.188-.258 1.792 0 1.602.607 3.202 1.83 4.426 1.351 1.351 3.164 1.958 4.931 1.821.933-.072 1.852.269 2.514.931l9.662 9.662c.578.578 1.337.868 2.097.868 1.661 0 3.001-1.364 2.966-3.03-.016-.737-.306-1.47-.868-2.033l-9.662-9.663c-.662-.661-1.002-1.581-.931-2.514.137-1.767-.471-3.58-1.82-4.93-1.225-1.224-2.825-1.83-4.428-1.83-.603 0-1.207.086-1.791.257zm17.5 20.743c0 .553-.447 1-1 1-.553 0-1-.448-1-1s.447-1 1-1 1 .447 1 1z"></path></svg>'
};

// Main UI initialization
function initializeUI() {
    const container = document.getElementById('app');

    // Create UI containers
    const appContainer = createElement('ul', { id: 'extensionList' });
    const removedContainer = createElement('ul', { id: 'removedList' });

    // Create status elements
    const updateStatus = createElement('div', {
        class: ['message'],
        id: 'updateStatus'
    }, [
        createElement('p', {
            innerHTML: chrome.i18n.getMessage('popup_checkingForUpdates')
        })
    ]);

    const removedStatus = createElement('div', {
        class: ['message', 'hidden'],
        id: 'removedStatus',
        title: chrome.i18n.getMessage('popup_removedExtensionsTooltip')
    }, [
        createElement('p', {
            innerHTML: chrome.i18n.getMessage('popup_removedExtensions')
        })
    ]);

    // Append all elements to container
    container.appendChild(updateStatus);
    container.appendChild(appContainer);
    container.appendChild(removedStatus);
    container.appendChild(removedContainer);

    return {
        appContainer,
        removedContainer,
        updateStatus,
        removedStatus
    };
}

// Extension icon helper
function getExtensionIconUrl(extensionId, iconSize = 16) {
    return `chrome://extension-icon/${extensionId}/${iconSize}/0`;
}

// Create an element for an updatable extension
function createUpdateableExtensionItem(extension, updateInfo, isWebstore) {
    const { id: appId, name, version, icons, homepageUrl, enabled } = extension;
    const updateVersion = updateInfo.version;
    const crxUrl = updateInfo['@codebase'];

    const li = createElement('li', {
        'data-enabled': enabled ? 'true' : 'false',
        title: `${version} ⇒ ${updateVersion}` // Show version difference in the tooltip
    });

    // Add icon
    const iconSize = icons && icons.length > 0 ? icons[0].size : 16;
    const img = createElement('img', {
        src: getExtensionIconUrl(appId, iconSize),
        alt: name
    });
    li.appendChild(img);

    // Add name and version difference
    const versionText = `${version} ⇒ ${updateVersion}`;  // The version difference
    const nameSpan = createElement('span', {
        innerHTML: `${name} <br> <small style='font-weight: normal; font-size: 12px; color: #666;'>${versionText}</small>`
    });

    li.appendChild(nameSpan);

    // Add store/homepage link if available
    if (isWebstore || homepageUrl) {
        const linkUrl = isWebstore
            ? `https://chrome.google.com/webstore/detail/${appId}`
            : homepageUrl;

        if (linkUrl) {
            const storeLink = createElement('a', {
                target: '_blank',
                href: linkUrl,
                innerHTML: SVG_ICONS.EXTERNAL_LINK
            });
            li.appendChild(storeLink);
        }
    }

    // Add click handler for installation
    li.setAttribute('crx_url', crxUrl);
    li.addEventListener('click', (evt) => evt.target.tagName ? promptInstall(crxUrl, isWebstore) : null);

    return li;
}

// Create an element for a removed extension
function createRemovedExtensionItem(extension) {
    const { id, name, icons, enabled } = extension;

    const li = createElement('li', {
        'data-enabled': enabled ? 'true' : 'false',
        class: ['removedext']
    });

    // Add icon if available
    if (icons) {
        const iconSize = icons.length > 0 ? icons[0].size : 16;
        li.appendChild(createElement('img', {
            src: getExtensionIconUrl(id, iconSize)
        }));
    }

    // Add name
    li.appendChild(createElement('span', { innerHTML: name }));

    // Add dismiss button
    const closeButton = createElement('a', {
        target: '_blank',
        innerHTML: SVG_ICONS.VISIBILITY_OFF
    });

    // Handle dismissal
    closeButton.onclick = () => handleDismissRemoved(id, li);
    li.appendChild(closeButton);

    return li;
}

// Create an element for a failed update
function createFailedUpdateItem(extension) {
    const { id, name, icons, enabled, updateUrl } = extension;

    const li = createElement('li', {
        'data-enabled': enabled ? 'true' : 'false',
        class: ['updatefailure']
    });

    // Add icon if available
    if (icons) {
        const iconSize = icons.length > 0 ? icons[0].size : 16;
        li.appendChild(createElement('img', {
            src: getExtensionIconUrl(id, iconSize)
        }));
    }

    // Add failure message
    li.appendChild(createElement('span', {
        innerHTML: chrome.i18n.getMessage('popup_updateFailed', name)
    }));

    // Add fix button if update URL exists
    if (updateUrl) checkAndAddFixButton(li, updateUrl);

    return li;
}

// Check permissions and add fix button if needed
function checkAndAddFixButton(listItem, updateUrl) {
    chrome.permissions.contains({ origins: [updateUrl] }, (hasPermission) => {
        if (!hasPermission) {
            const fixButton = createElement('a', {
                target: '_blank',
                innerHTML: SVG_ICONS.WRENCH
            });

            fixButton.onclick = () => chrome.permissions.request({ origins: [updateUrl] });

            listItem.appendChild(fixButton);
        }
    });
}

// Handle dismissing a removed extension
function handleDismissRemoved(extensionId, listItem) {
    const defaultOptions = { removed_extensions: {} };

    chrome.storage.sync.get(defaultOptions, (storedValues) => {
        storedValues.removed_extensions[extensionId] = true;

        chrome.storage.sync.set({
            removed_extensions: storedValues.removed_extensions
        });

        // Remove from UI
        listItem.remove();

        // Hide header if no more items
        const removedContainer = document.getElementById('removedList');
        const removedStatus = document.getElementById('removedStatus');

        if (removedContainer.getElementsByTagName('li').length === 0) removedStatus.classList.add('hidden');
    });
}

// Initialize the UI and start checking for updates
function init() {
    const ui = initializeUI();

    // Start update check
    checkForUpdates(
        // Success handler - extension has an update
        function (updateInfo, installedVersions, appId, updateVer, isWebstore) {
            const extensionData = installedVersions[appId];
            const extensionItem = createUpdateableExtensionItem(extensionData, { '@codebase': updateInfo['@codebase'], version: updateVer }, isWebstore);

            ui.appContainer.appendChild(extensionItem);
            ui.updateStatus.classList.add('hidden');
        },

        // Failure handler - extension update failed or was removed
        function (wasRemoved, extensionData) {
            if (wasRemoved) {
                ui.removedContainer.appendChild(createRemovedExtensionItem(extensionData));
                ui.removedStatus.classList.remove('hidden');
            } else ui.appContainer.appendChild(createFailedUpdateItem(extensionData));
        },

        // All up to date handler
        function () {
            const updateText = ui.updateStatus.querySelector('p');
            updateText.innerHTML = chrome.i18n.getMessage('popup_allUpToDate');
        }
    );
}

// Start the application
init();