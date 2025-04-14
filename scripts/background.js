importScripts('./util.js');

// Constants and state management
const STATE = {
  nonWebstoreExtensionsDownloading: new Set(),
  manualInstallExtensionsDownloading: new Set(),
  tabsAwaitingInstall: new Set(),
  extensionsTabId: null
};

// Configuration
const BADGE_COLOR = '#FE0000';

/**
 * Handles context menu click events
 * @param {Object} info - Information about the clicked menu item
 * @param {Object} tab - The tab where the context menu was clicked
 */
function handleContextClick(info, tab) {
  switch (info.menuItemId) {
    case 'updateAll':
      checkForUpdates((updateCheck, installed_versions, appid, updatever, is_webstore) => {
        const crx_url = updateCheck['@codebase'];
        promptInstall(crx_url, is_webstore, WEBSTORE.chrome, msgHandler);
      });
      break;
    case 'installExt':
      const store = determineWebstore(tab.url);
      promptInstall(buildExtensionUrl(tab.url), true, store, msgHandler);
      break;
    case 'cws':
      chrome.tabs.create({
        url: 'https://chrome.google.com/webstore/'
      });
      break;
  }
}

/**
 * Determines which webstore the URL belongs to
 * @param {string} url - The URL to check
 * @returns {Object} - The webstore object
 */
function determineWebstore(url) {
  let store = WEBSTORE.chrome;
  for (const [pattern, storeType] of WEBSTORE_MAP.entries()) {
    if (pattern.test(url)) {
      store = storeType;
      break;
    }
  }
  return store;
}

/**
 * Updates the extension badge with update count
 * @param {string|null} modified_ext_id - Optional extension ID that was modified
 */
function updateBadge(modified_ext_id = null) {
  checkForUpdates();
}

/**
 * Performs startup tasks for the extension
 */
function startupTasks() {
  chrome.storage.sync.get(DEFAULT_MANAGEMENT_OPTIONS, settings => {
    chrome.storage.local.get(
      {
        badge_display: '',
        last_scheduled_update: 0
      },
      localstore => {
        chrome.action.setBadgeText({
          text: localstore.badge_display
        });
        
        // Schedule update check
        scheduleUpdateCheck(settings, localstore.last_scheduled_update);
      }
    );
  });
}

/**
 * Schedules the update check alarm
 * @param {Object} settings - Extension settings
 * @param {number} lastUpdateTime - Timestamp of the last update
 */
function scheduleUpdateCheck(settings, lastUpdateTime) {
  const elapsedMinutes = Math.floor((Date.now() - lastUpdateTime) / (1000 * 60));
  const delayMinutes = Math.max(1, settings.update_period_in_minutes - elapsedMinutes);
  
  chrome.alarms.create('cws_check_extension_updates', {
    delayInMinutes: delayMinutes,
    periodInMinutes: settings.update_period_in_minutes
  });
}

/**
 * Handles message requests from other parts of the extension
 * @param {Object} request - The message request
 * @param {Object} sender - The sender of the message
 * @param {Function} sendResponse - Function to send a response
 * @returns {boolean} - Whether the response will be sent asynchronously
 */
function msgHandler(request, sender, sendResponse) {
  if (request.nonWebstoreDownloadUrl) {
    chrome.downloads.download(
      {
        url: request.nonWebstoreDownloadUrl
      },
      dlid => {
        STATE.nonWebstoreExtensionsDownloading.add(dlid);
      }
    );
  }
  
  if (request.manualInstallDownloadUrl) {
    chrome.downloads.download(
      {
        url: request.manualInstallDownloadUrl,
        saveAs: true // required to suppress warning: 'Apps, extensions and user scripts cannot be added from this website'
      },
      dlid => {
        STATE.manualInstallExtensionsDownloading.add(dlid);
      }
    );
  }
  
  if (request.newTabUrl) {
    chrome.tabs.create({ active: false, url: request.newTabUrl });
  }
  
  if (request.checkExtInstalledId) {
    chrome.management.get(request.checkExtInstalledId, extinfo => {
      sendResponse({
        installed: !(chrome.runtime.lastError && !extinfo)
      });
    });
    return true; // Indicate we'll respond asynchronously
  }
  
  if (request.uninstallExt) {
    chrome.management.uninstall(request.uninstallExt, () => {
      sendResponse({ uninstalled: !chrome.runtime.lastError });
    });
    return true; // Indicate we'll respond asynchronously
  }
  
  if (request.installExt && sender.tab) {
    STATE.tabsAwaitingInstall.add(sender.tab.id);
  }
}

/**
 * Handles download completion events
 * @param {Object} downloadDelta - Information about the download that changed
 */
function handleDownloadChange(downloadDelta) {
  if (!downloadDelta.endTime) {
    return; // Only proceed if download has completed
  }
  
  if (STATE.manualInstallExtensionsDownloading.has(downloadDelta.id)) {
    STATE.manualInstallExtensionsDownloading.delete(downloadDelta.id);
    openExtensionsPage();
  }
}

/**
 * Opens the extensions page and focuses it if it's already open
 */
function openExtensionsPage() {
  const tabId = STATE.extensionsTabId;
  
  if (tabId) {
    chrome.tabs.get(tabId, tab => {
      if (!chrome.runtime.lastError) {
        chrome.tabs.highlight({
          tabs: tab.index,
          windowId: tab.windowId
        });
      } else {
        createExtensionsTab();
      }
    });
  } else {
    createExtensionsTab();
  }
}

/**
 * Creates a new extensions tab
 */
function createExtensionsTab() {
  chrome.tabs.create(
    {
      url: 'chrome://extensions/'
    },
    tab => {
      STATE.extensionsTabId = tab.id;
    }
  );
}

/**
 * Handles alarm events
 * @param {Object} alarm - The alarm that fired
 */
function handleAlarm(alarm) {
  if (alarm.name !== 'cws_check_extension_updates') {
    return;
  }
  
  chrome.storage.sync.get(DEFAULT_MANAGEMENT_OPTIONS, settings => {
    if (settings.auto_update) {
      updateBadge();
      chrome.storage.local.set({
        last_scheduled_update: Date.now()
      });
      
      // Reschedule the update check
      scheduleUpdateCheck(settings, Date.now());
    }
  });
}

/**
 * Handles messages from external sources (e.g. Chrome Web Store)
 * @param {Object} request - The message request
 * @param {Object} sender - The sender of the message
 * @param {Function} sendResponse - Function to send a response
 */
function handleExternalMessage(request, sender, sendResponse) {
  const { func, args } = request;
  
  switch (func) {
    case 'getExtensionStatus': {
      const [id] = args;
      chrome.management.getAll(exts => {
        const thisExt = exts.filter(extInfo => extInfo.id === id);
        if (!thisExt.length) {
          sendResponse({ args: ['installable'] });
          return;
        }
        sendResponse({
          args: [thisExt[0].enabled ? 'enabled' : 'disabled']
        });
      });
      break;
    }
    
    case 'getAll': {
      const [id] = args;
      chrome.management.getAll(exts => {
        // Filter to only the relevant extension for security
        sendResponse({
          args: [exts.filter(extInfo => extInfo.id === id)]
        });
      });
      break;
    }
    
    case 'beginInstallWithManifest3': {
      const [extInfo, href] = args;
      promptInstall(
        buildExtensionUrl(href),
        true,
        WEBSTORE.chrome,
        msgHandler
      );
      sendResponse({
        // Return user_cancelled to ensure the button doesn't get stuck
        args: ['user_cancelled']
      });
      break;
    }
  }
  
  return true; // Indicate we'll respond asynchronously
}

/**
 * Handles connection from external sources
 * @param {Port} port - The connection port
 */
function handleExternalConnection(port) {
  let portDisconnected = false;
  
  port.onDisconnect.addListener(() => {
    portDisconnected = true;
  });
  
  port.onMessage.addListener((msg, port) => {
    const { func, args } = msg;
    
    switch (func) {
      case 'onInstalled': {
        const [callbackIndex] = args;
        const listener = function callback() {
          if (portDisconnected) {
            chrome.management.onInstalled.removeListener(callback);
            return;
          }
          port.postMessage({
            args: arguments,
            callbackIndex,
            err: chrome.runtime.lastError
          });
        };
        chrome.management.onInstalled.addListener(listener);
        break;
      }
      
      case 'onUninstalled': {
        const [callbackIndex] = args;
        const listener = function callback() {
          if (portDisconnected) {
            chrome.management.onUninstalled.removeListener(callback);
            return;
          }
          port.postMessage({
            args: arguments,
            callbackIndex,
            err: chrome.runtime.lastError
          });
        };
        chrome.management.onUninstalled.addListener(listener);
        break;
      }
      
      case 'uninstall': {
        const [extId, options, callbackIndex] = args;
        chrome.management.uninstall(extId, options, function() {
          port.postMessage({
            args: arguments,
            callbackIndex,
            err: chrome.runtime.lastError
          });
        });
        break;
      }
      
      case 'setEnabled': {
        const [extId, enabled, callbackIndex] = args;
        chrome.management.setEnabled(extId, enabled, function() {
          port.postMessage({
            args: arguments,
            callbackIndex,
            err: chrome.runtime.lastError
          });
        });
        break;
      }
    }
  });
}

/**
 * Creates context menu items
 */
function createContextMenus() {
  chrome.contextMenus.create({
    title: chrome.i18n.getMessage('contextMenu_updateAll'),
    id: 'updateAll',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    title: '🔗 Chrome Web Store',
    id: 'cws',
    contexts: ['action']
  });
  
  chrome.contextMenus.create({
    title: chrome.i18n.getMessage('webstore_addButton'),
    id: 'installExt',
    documentUrlPatterns: [
      'https://chrome.google.com/webstore/detail/*',
      'https://chromewebstore.google.com/detail/*',
      'https://addons.opera.com/*/extensions/details/*',
      'https://microsoftedge.microsoft.com/addons/detail/*'
    ]
  });
}

// -------------- Event Listeners --------------

// Set badge background color
chrome.action.setBadgeBackgroundColor({
  color: BADGE_COLOR
});

// Listen for extension installation events
chrome.management.onInstalled.addListener(ext => {
  updateBadge(ext.id);
  
  for (const tabId of STATE.tabsAwaitingInstall) {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: 'extInstalled',
        extId: ext.id
      },
      () => {
        if (chrome.runtime.lastError) {
          STATE.tabsAwaitingInstall.delete(tabId);
        }
      }
    );
  }
});

// Listen for extension uninstallation events
chrome.management.onUninstalled.addListener(ext => {
  updateBadge(ext.id);
});

// Listen for browser startup
chrome.runtime.onStartup.addListener(startupTasks);

// Listen for alarms
chrome.alarms.onAlarm.addListener(handleAlarm);

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  startupTasks();
  createContextMenus();
});

// Listen for messages from the extension
chrome.runtime.onMessage.addListener(msgHandler);

// Listen for download state changes
chrome.downloads.onChanged.addListener(handleDownloadChange);

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener(handleContextClick);

// Listen for external connections
chrome.runtime.onConnectExternal.addListener(handleExternalConnection);

// Listen for external messages
chrome.runtime.onMessageExternal.addListener(handleExternalMessage);