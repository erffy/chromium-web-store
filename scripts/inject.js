/**
 * Extension Button Manager
 * Manages button interactions for installing/uninstalling extensions across various web stores
 */

// Store button reference
let dlBtn;

// Constants
const WEBSTORES = {
    CHROME: 'chrome',
    EDGE: 'edge',
    OPERA: 'opera'
};

// Regular expressions for web store detection
const STORE_PATTERNS = {
    CWS: /^https:\/\/chrome\.google\.com\/webstore/,
    EWS: /^https:\/\/microsoftedge\.microsoft\.com\/addons/,
    OWS: /^https:\/\/addons\.opera\.com\/[a-z]+\/extensions/,
    NCWS: /^https:\/\/chromewebstore\.google\.com/
};

/**
 * Creates and configures an installation/removal button
 * @param {HTMLElement} newParent - Parent element to attach the button to
 * @param {boolean} addBtn - Whether to create an 'Add' button (true) or 'Remove' button (false)
 */
function createButton(newParent, addBtn = true) {
    if (!newParent) {
        console.error('Parent element is required to create button');
        return;
    }

    const button_div = document.createElement('div');
    button_div.setAttribute('role', 'button');
    button_div.setAttribute('class', 'dd-Va g-c-wb g-eg-ua-Uc-c-za g-c-Oc-td-jb-oa g-c');

    button_div.setAttribute('tabindex', '0');
    button_div.setAttribute('style', 'user-select: none;');

    const hf = document.createElement('div');
    hf.setAttribute('class', 'g-c-Hf');
    button_div.appendChild(hf);

    const x = document.createElement('div');
    x.setAttribute('class', 'g-c-x');
    hf.appendChild(x);

    const r = document.createElement('div');
    r.setAttribute('class', 'g-c-R webstore-test-button-label');
    x.appendChild(r);

    // Define toggling state function
    button_div.toggleState = function (isInstall) {
        if (isInstall) button_div.setAttribute('isInstallBtn', '');
        else button_div.removeAttribute('isInstallBtn');

        const buttonLabel = isInstall
            ? chrome.i18n.getMessage('webstore_addButton')
            : chrome.i18n.getMessage('webstore_removeButton');

        button_div.setAttribute('aria-label', buttonLabel);
        r.innerHTML = buttonLabel;
    };

    if (addBtn) button_div.setAttribute('isInstallBtn', '');

    button_div.toggleState(addBtn);

    const extensionId = getExtensionId(window.location.href);
    const downloadUrl = buildExtensionUrl(window.location.href);
    button_div.id = extensionId;

    // Add event listeners
    button_div.addEventListener('click', function () {
        if (button_div.hasAttribute('isInstallBtn')) {
            chrome.runtime.sendMessage({
                installExt: extensionId
            });
            promptInstall(downloadUrl, true);
        } else {
            chrome.runtime.sendMessage(
                {
                    uninstallExt: extensionId
                },
                (resp) => {
                    if (resp && resp.uninstalled) {
                        button_div.toggleState(true);
                    }
                }
            );
        }
    });

    // Add hover effects
    button_div.addEventListener('mouseover', () => this.classList.add('g-c-l'));
    button_div.addEventListener('mouseout', () => this.classList.remove('g-c-l'));

    // Clear parent and append the button
    newParent.innerHTML = '';
    newParent.appendChild(button_div);
    dlBtn = button_div;

    return button_div;
}

/**
 * Modifies existing Chrome Web Store buttons
 * @param {HTMLElement} button_div - Button element to modify
 * @param {boolean} addBtn - Whether it should be an 'Add' button (true) or 'Remove' button (false)
 */
function modifyNewCWSButton(button_div, addBtn = true) {
    if (!button_div) {
        console.error('Button element is required to modify');
        return;
    }

    button_div.removeAttribute('disabled');
    const label = button_div.querySelector('span.UywwFc-vQzf8d');

    if (!label) {
        console.error('Label element not found within button');
        return;
    }

    // Define toggling state function
    button_div.toggleState = function (isInstall) {
        button_div.setAttribute('isInstallBtn', isInstall.toString());
        label.innerHTML = isInstall
            ? chrome.i18n.getMessage('webstore_addButton')
            : chrome.i18n.getMessage('webstore_removeButton');
    };

    button_div.toggleState(addBtn);

    const extensionId = getExtensionId(window.location.href);
    const downloadUrl = buildExtensionUrl(window.location.href);
    button_div.id = extensionId;

    // Add click event listener
    button_div.addEventListener('click', function () {
        if (button_div.getAttribute('isInstallBtn') === 'true') {
            chrome.runtime.sendMessage({
                installExt: extensionId
            });
            promptInstall(downloadUrl, true);
        } else {
            chrome.runtime.sendMessage(
                {
                    uninstallExt: extensionId
                },
                (resp) => {
                    if (resp && resp.uninstalled) {
                        button_div.toggleState(true);
                    }
                }
            );
        }
    });

    return button_div;
}

/**
 * Injects a script into the page
 * @param {string} filePath - Path to the script to inject
 * @param {string} targetTag - Tag to inject the script into (e.g., 'head')
 */
function injectScript(filePath, targetTag) {
    if (!filePath || !targetTag) {
        console.error('File path and target tag are required');
        return;
    }

    const node = document.getElementsByTagName(targetTag)[0];

    if (!node) {
        console.error(`Target tag '${targetTag}' not found in document`);
        return;
    }

    const script = document.createElement('script');
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('extension_id', chrome.runtime.id);
    script.setAttribute('src', filePath);
    node.appendChild(script);
}

/**
 * Observer for button container mutations
 */
const modifyButtonObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        if (
            mutation.addedNodes.length &&
            !mutation.removedNodes.length &&
            mutation.nextSibling === null &&
            mutation.addedNodes[0].className === 'f-rd'
        ) {
            const container_div = document.querySelector('.h-e-f-Ra-c');
            if (container_div && container_div.firstChild === null) {
                chrome.runtime.sendMessage(
                    {
                        checkExtInstalledId: getExtensionId(window.location.href)
                    },
                    (resp) => {
                        if (resp) {
                            createButton(container_div, !resp.installed);
                        }
                    }
                );
            }
        }
    });
});

/**
 * Observer for attaching the main button observer
 */
const attachMainObserver = new MutationObserver(function (mutations, observer) {
    for (const mutation of mutations) {
        const target = mutation.target.querySelector('.F-ia-k');
        if (target) modifyButtonObserver.observe(target, {
            subtree: true,
            childList: true
        });
    }

    observer.disconnect();
});

// Initialize for Edge Web Store
if (STORE_PATTERNS.EWS.test(window.location.href)) {
    new MutationObserver(function (mutations) {
        for (const mutation of mutations) {
            for (const btn of mutation.target.querySelectorAll('button[id^="getOrRemoveButton-"][disabled]')) {
                // Find and remove the highest-numeric class if it's a GetButton, or second highest if not
                const classes = btn.className.split(' ');
                const sortedClasses = classes.sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
                btn.classList.remove(sortedClasses[btn.name === 'GetButton' ? 1 : 0]);

                btn.removeAttribute('disabled');
                btn.addEventListener('click', () => {
                    const btnId = btn.id.split('-')[1];
                    promptInstall(
                        buildExtensionUrl(window.location.href, btnId),
                        true,
                        WEBSTORES.EDGE
                    );
                });
                dlBtn = btn;
            }
        }
    }).observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Initialize for Chrome Web Store
if (STORE_PATTERNS.CWS.test(window.location.href)) attachMainObserver.observe(document.body, { childList: true });

// Initialize for Opera Web Store
if (STORE_PATTERNS.OWS.test(window.location.href) && document.body.querySelector('#feedback-container')) { // built-ins don't have a feedback section
    const installDiv = document.body.querySelector('.sidebar .get-opera');
    if (installDiv) {
        const sidebar = installDiv.parentElement;
        const wrapper = document.createElement('div');
        wrapper.classList.add('wrapper-install');

        dlBtn = document.createElement('a');
        dlBtn.classList.add('btn-install', 'btn-with-plus');
        dlBtn.innerHTML = chrome.i18n.getMessage('webstore_addButton');

        if (sidebar) {
            sidebar.replaceChild(wrapper, installDiv);
            wrapper.appendChild(dlBtn);

            dlBtn.addEventListener('click', () =>
                promptInstall(
                    buildExtensionUrl(window.location.href),
                    true,
                    WEBSTORES.OPERA
                )
            );
        }
    }
}

// Set up message listener for extension installation updates
window.addEventListener('load', () => {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extInstalled' &&
            request.extId === getExtensionId(window.location.href) &&
            document.getElementById(request.extId)) {
            document.getElementById(request.extId).toggleState(false);
        }
        return true; // Keep the message channel open for async responses
    });
});

// Initialize for New Chrome Web Store
if (STORE_PATTERNS.NCWS.test(window.location.href)) chrome.storage.sync.get({ webstore_integration: true },
    function (stored_values) {
        if (stored_values.webstore_integration) injectScript(chrome.runtime.getURL('scripts/chromeApi.js'), 'head');
    }
);