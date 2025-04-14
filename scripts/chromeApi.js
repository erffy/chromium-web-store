/**
 * Content script that injects Chrome Web Store API functionality
 * This script acts as a bridge between the Chrome Web Store page and the extension
 */

// Configuration and initialization
const CONFIG = {
  // Regular expression to extract extension ID from URL
  // Copied from util.js since it's out of context
  ncws_re: /.*detail(?:\/[^\/]+)?\/([a-z]{32})/i
};

// Safely extract extension IDs and initialize connection
const EXTENSION = {
  // The ID of the extension displayed on the current page
  CURRENT_PAGE_EXT_ID: extractCurrentPageExtensionId(),
  // The ID of our extension that's injecting this script
  OUR_EXT_ID: document.currentScript.getAttribute('extension_id')
};

// Communication setup
const COMMUNICATION = {
  port: null,
  callbacks: [],
  initializePort() {
    try {
      this.port = chrome.runtime.connect(EXTENSION.OUR_EXT_ID, {
        name: 'windowchromeport'
      });

      this.port.onMessage.addListener(this.handlePortMessage.bind(this));
      return true;
    } catch (error) {
      console.error('Failed to initialize port:', error);
      return false;
    }
  },

  handlePortMessage(msg) {
    if (msg.callbackIndex === undefined) return;

    const callback = this.callbacks[msg.callbackIndex];
    if (!callback) {
      console.warn('Received message for unknown callback index:', msg.callbackIndex);
      return;
    }

    // Set runtime.lastError for the callback to access
    if (msg.err) chrome.runtime.lastError = msg.err; 

    // Convert arguments to proper array and apply to callback
    callback.apply(null, Array.from(msg.args || []));
  },

  sendPortMessage(func, args, callbackIndex) {
    if (!this.port) {
      console.error('Port not initialized');
      return false;
    }

    this.port.postMessage({
      func,
      args: [...args, callbackIndex]
    });
    return true;
  },

  sendRuntimeMessage(func, args, callback) {
    chrome.runtime.sendMessage(
      EXTENSION.OUR_EXT_ID,
      { func, args },
      response => {
        if (response && response.args) callback(...response.args);
        else callback();
      }
    );
  },

  registerCallback(callback) {
    const index = this.callbacks.length;
    this.callbacks.push(callback);
    return index;
  }
};

/**
 * Extracts the extension ID from the current page URL
 * @returns {string|null} The extension ID or null if not found
 */
function extractCurrentPageExtensionId() {
  try {
    const matches = CONFIG.ncws_re.exec(window.location.href);
    return matches && matches[1] ? matches[1] : null;
  } catch (error) {
    console.error('Failed to extract extension ID from URL:', error);
    return null;
  }
}

/**
 * Creates and initializes the Chrome Web Store Private API
 * @returns {Object} The webstorePrivate API object
 */
function createWebstorePrivateAPI() {
  return {
    getExtensionStatus(id, manifest, callback) {
      if (!id || !callback) {
        console.error('Invalid parameters for getExtensionStatus');
        return;
      }

      COMMUNICATION.sendRuntimeMessage(
        'getExtensionStatus',
        [id, manifest],
        callback
      );
    },

    beginInstallWithManifest3(extinfo, callback) {
      if (!extinfo || !callback) {
        console.error('Invalid parameters for beginInstallWithManifest3');
        return;
      }

      COMMUNICATION.sendRuntimeMessage(
        'beginInstallWithManifest3',
        [extinfo, window.location.href],
        callback
      );
    },

    // Return false since it's likely this extension isn't running in incognito
    isInIncognitoMode(callback) {
      if (callback) callback(false);
    },

    // Standard referrer chain format used by the Chrome Web Store
    getReferrerChain(callback) {
      if (callback) callback('EgIIAA==');
    },

    // This will never be called since we cancel all install attempts with 'user_cancelled'
    // Instead we rely on the onInstalled listener to continue the flow correctly
    completeInstall(id, callback) {
      if (callback) callback(true);
    }
  };
}

/**
 * Creates and initializes the Management API
 * @returns {Object} The management API object
 */
function createManagementAPI() {
  return {
    setEnabled(extId, enabled, callback) {
      if (!extId || typeof enabled !== 'boolean') {
        console.error('Invalid parameters for setEnabled');
        return;
      }

      const callbackIndex = COMMUNICATION.registerCallback(callback || function () { });
      COMMUNICATION.sendPortMessage('setEnabled', [extId, enabled], callbackIndex);
    },

    install() {
      console.warn('chrome.management.install not implemented, but called with args:',
        Array.from(arguments));
    },

    uninstall(extId, options, callback) {
      if (!extId) {
        console.error('Invalid extension ID for uninstall');
        return;
      }

      const callbackIndex = COMMUNICATION.registerCallback(callback || function () { });
      COMMUNICATION.sendPortMessage('uninstall', [extId, options], callbackIndex);
    },

    getAll(callback) {
      if (!callback) {
        console.error('Missing callback for getAll');
        return;
      }

      COMMUNICATION.sendRuntimeMessage(
        'getAll',
        [EXTENSION.CURRENT_PAGE_EXT_ID],
        callback
      );
    },

    onInstalled: {
      addListener(callback) {
        if (!callback) {
          console.error('Missing callback for onInstalled.addListener');
          return;
        }

        const callbackIndex = COMMUNICATION.registerCallback(callback);
        COMMUNICATION.sendPortMessage('onInstalled', [], callbackIndex);
      }
    },

    onUninstalled: {
      addListener(callback) {
        if (!callback) {
          console.error('Missing callback for onUninstalled.addListener');
          return;
        }

        const callbackIndex = COMMUNICATION.registerCallback(callback);
        COMMUNICATION.sendPortMessage('onUninstalled', [], callbackIndex);
      }
    }
  };
}

/**
 * Initialize the script and inject APIs
 */
function init() {
  if (!EXTENSION.CURRENT_PAGE_EXT_ID || !EXTENSION.OUR_EXT_ID) {
    console.error('Failed to initialize: Missing extension IDs');
    return;
  }

  if (!COMMUNICATION.initializePort()) {
    console.error('Failed to initialize communication');
    return;
  }

  // Add API to window.chrome
  if (window.chrome) {
    // Inject our APIs
    window.chrome.webstorePrivate = createWebstorePrivateAPI();
    window.chrome.management = createManagementAPI();
    window.chrome.runtime.getManifest = () => true;
  } else console.error('window.chrome is not available');
}

// Start initialization
init();