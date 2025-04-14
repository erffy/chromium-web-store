/**
 * Extension Update Checker - Core Utilities
 * 
 * This file contains the core functionality for checking Chrome extension updates,
 * handling webstore integrations, and managing extension installations.
 */

// ==== CONSTANTS ====

/**
 * Extract the Chrome version from user agent
 */
const chromeVersion = /Chrome\/([0-9.]+)/.exec(navigator.userAgent)?.[1] || '';

/**
 * Default options for extension management
 */
const DEFAULT_MANAGEMENT_OPTIONS = {
  auto_update: true,
  check_store_apps: true,
  check_external_apps: true,
  update_period_in_minutes: 60,
  removed_extensions: {},
  manually_install: false,
  webstore_integration: true,
};

/**
 * Web store identifiers
 */
const WEBSTORE = Object.freeze({
  chrome: 0,
  edge: 1,
  opera: 2,
  chromenew: 3
});

// ==== STORE DEFINITIONS ====

/**
 * Store configuration for different extension stores
 */
const store_extensions = new Map();

// Chrome Web Store
store_extensions.set(/clients2\.google\.com\/service\/update2\/crx/, {
  baseUrl: 'https://clients2.google.com/service/update2/crx?response=updatecheck&acceptformat=crx2,crx3&prodversion=',
  name: 'CWS Extensions'
});

// Microsoft Edge Store
store_extensions.set(/edge\.microsoft\.com\/extensionwebstorebase\/v1\/crx/, {
  baseUrl: 'https://edge.microsoft.com/extensionwebstorebase/v1/crx?os=win&arch=x64&os_arch=x86_64&nacl_arch=x86-64&prod=edgecrx&prodchannel=&lang=en-US&acceptformat=crx3&prodversion=',
  name: 'Edge Extensions',
  ignore: true
});

// Opera Store
store_extensions.set(/extension-updates\.opera\.com\/api\/omaha\/update/, {
  baseUrl: 'https://extension-updates.opera.com/api/omaha/update/?os=win&arch=x64&os_arch=x86_64&nacl_arch=x86-64&prod=chromiumcrx&prodchannel=Stable&lang=en-US&acceptformat=crx3&prodversion=',
  name: 'Opera Extensions',
  userAgent: 'foobar',
  ignore: true
});

// ==== WEBSTORE URL PATTERNS ====

/**
 * Regular expressions for detecting and parsing webstore URLs
 */
const WEBSTORE_PATTERNS = {
  // Store detection patterns
  is_cws: /chrome.google.com\/webstore/i,
  is_ncws: /chromewebstore.google.com\//i,
  is_ows: /addons.opera.com\/.*extensions/i,
  is_ews: /microsoftedge\.microsoft\.com\/addons\//i,
  
  // ID extraction patterns
  cws_re: /.*detail\/[^\/]*\/([a-z]{32})/i,
  ncws_re: /.*detail(?:\/[^\/]+)?\/([a-z]{32})/i,
  ows_re: /.*details\/([^\/?#]+)/i,
  ews_re: /.*addons\/.+?\/([a-z]{32})/i
};

/**
 * Map store detection patterns to their respective WEBSTORE constants
 */
const WEBSTORE_MAP = new Map([
  [WEBSTORE_PATTERNS.is_cws, WEBSTORE.chrome],
  [WEBSTORE_PATTERNS.is_ews, WEBSTORE.edge],
  [WEBSTORE_PATTERNS.is_ows, WEBSTORE.opera],
  [WEBSTORE_PATTERNS.is_ncws, WEBSTORE.chromenew]
]);

// ==== XML PARSER ====

/**
 * XML parsing utility function
 * This is a minified library for XML parsing
 * Note: Keeping the minified version to maintain exact behavior
 */
var fromXML;
// prettier-ignore
!function(r){ var t={"&amp;":"&","&lt;":"<","&gt;":">","&apos;":"'","&quot;":'"'};function n(r){return r&&r.replace(/^\s+|\s+$/g,"")}function s(r){return r.replace(/(&(?:lt|gt|amp|apos|quot|#(?:\d{1,6}|x[0-9a-fA-F]{1,5}));)/g,(function(r){if("#"===r[1]){var n="x"===r[2]?parseInt(r.substr(3),16):parseInt(r.substr(2),10);if(n>-1)return String.fromCharCode(n)}return t[r]||r}))}function e(r,t){if("string"==typeof r)return r;var u=r.r;if(u)return u;var a,o=function(r,t){if(r.t){for(var e,u,a=r.t.split(/([^\s='"]+(?:\s*=\s*(?:'[\S\s]*?'|"[\S\s]*?"|[^\s'"]*))?)/),o=a.length,i=0;i<o;i++){var l=n(a[i]);if(l){e||(e={});var c=l.indexOf("=");if(c<0)l="@"+l,u=null;else{u=l.substr(c+1).replace(/^\s+/,""),l="@"+l.substr(0,c).replace(/\s+$/,"");var p=u[0];p!==u[u.length-1]||"'"!==p&&'"'!==p||(u=u.substr(1,u.length-2)),u=s(u)}t&&(u=t(l,u)),f(e,l,u)}}return e}}(r,t),i=r.f,l=i.length;if(o||l>1)a=o||{},i.forEach((function(r){"string"==typeof r?f(a,"#",r):f(a,r.n,e(r,t))}));else if(l){var c=i[0];if(a=e(c,t),c.n){var p={};p[c.n]=a,a=p}}else a=r.c?null:"";return t&&(a=t(r.n||"",a)),a}function f(r,t,n){if(void 0!==n){var s=r[t];s instanceof Array?s.push(n):r[t]=t in r?[s,n]:n}}r.fromXML=fromXML=function(r,t){return e(function(r){for(var t=String.prototype.split.call(r,/<([^!<>?](?:'[\S\s]*?'|"[\S\s]*?"|[^'"<>])*|!(?:--[\S\s]*?--|\[[^\[\]'"<>]+\[[\S\s]*?]]|DOCTYPE[^\[<>]*?\[[\S\s]*?]|(?:ENTITY[^"<>]*?"[\S\s]*?")?[\S\s]*?)|\?[\S\s]*?\?)>/),e=t.length,f={f:[]},u=f,a=[],o=0;o<e;){var i=t[o++];i&&v(i);var l=t[o++];l&&c(l)}return f;function c(r){var t=r.length,n=r[0];if("/"===n)for(var s=r.replace(/^\/|[\s\/].*$/g,"").toLowerCase();a.length;){var e=u.n&&u.n.toLowerCase();if(u=a.pop(),e===s)break}else if("?"===n)p({n:"?",r:r.substr(1,t-2)});else if("!"===n)"[CDATA["===r.substr(1,7)&&"]]"===r.substr(-2)?v(r.substr(8,t-10)):p({n:"!",r:r.substr(1)});else{var f=function(r){var t={f:[]},n=(r=r.replace(/\s*\/?$/,"")).search(/[\s='"\/]/);n<0?t.n=r:(t.n=r.substr(0,n),t.t=r.substr(n));return t}(r);p(f),"/"===r[t-1]?f.c=1:(a.push(u),u=f)}}function p(r){u.f.push(r)}function v(r){(r=n(r))&&p(s(r))}}(r),t)}}("object"==typeof exports&&exports||{});

// ==== UTILITY FUNCTIONS ====

/**
 * Compare version strings to determine if available version is newer
 * 
 * @param {string} current - Current version string (e.g. '1.2.3.4')
 * @param {string} available - Available version string (e.g. '1.2.4.0')
 * @returns {boolean} True if available version is newer
 */
function version_is_newer(current, available) {
  const current_subvs = current.split('.');
  const available_subvs = available.split('.');
  
  for (let i = 0; i < 4; i++) {
    const ver_diff = (parseInt(available_subvs[i]) || 0) - (parseInt(current_subvs[i]) || 0);
    if (ver_diff > 0) return true;
    if (ver_diff < 0) return false;
  }
  
  return false;
}

/**
 * Extract extension ID from a webstore URL
 * 
 * @param {string} url - Webstore URL
 * @returns {string|undefined} Extension ID if found
 */
function getExtensionId(url) {
  const { cws_re, ncws_re, ows_re, ews_re } = WEBSTORE_PATTERNS;
  return (
    cws_re.exec(url) ||
    ncws_re.exec(url) ||
    ows_re.exec(url) ||
    ews_re.exec(url) || 
    [undefined, undefined]
  )[1];
}

/**
 * Build the direct download URL for an extension
 * 
 * @param {string} href - Source webstore URL
 * @param {string} [extensionId] - Optional extension ID (will be extracted from href if not provided)
 * @returns {string|undefined} Direct download URL
 */
function buildExtensionUrl(href, extensionId) {
  const { is_cws, is_ncws, is_ows, is_ews } = WEBSTORE_PATTERNS;
  
  // Get extension ID if not provided
  extensionId = extensionId || getExtensionId(href);
  if (extensionId === undefined) return;
  
  // Chrome Web Store
  if (is_cws.test(href) || is_ncws.test(href)) {
    return `https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=${chromeVersion}&x=id%3D${extensionId}%26installsource%3Dondemand%26uc`;
  }
  
  // Opera Add-ons
  if (is_ows.test(href)) {
    return `https://addons.opera.com/extensions/download/${extensionId}/`;
  }
  
  // Edge Add-ons
  if (is_ews.test(href)) {
    return `https://edge.microsoft.com/extensionwebstorebase/v1/crx?response=redirect&x=id%3D${extensionId}%26installsource%3Dondemand%26uc`;
  }
}

/**
 * Prompt the user to install an extension
 * 
 * @param {string} crx_url - Direct download URL for the extension
 * @param {boolean} is_webstore - Whether this is from an official webstore
 * @param {number} [browser=WEBSTORE.chrome] - Browser identifier
 * @param {Function} [custom_msg_handler] - Optional custom message handler
 */
function promptInstall(crx_url, is_webstore, browser = WEBSTORE.chrome, custom_msg_handler) {
  chrome.storage.sync.get(DEFAULT_MANAGEMENT_OPTIONS, function(settings) {
    const msgHandler = custom_msg_handler || chrome.runtime.sendMessage;
    
    // Handle webstore installations
    if (is_webstore && !settings.manually_install) {
      switch (browser) {
        case WEBSTORE.edge:
          // Microsoft's webstore redirects from HTTPS to HTTP, so use chrome.tabs
          msgHandler({ newTabUrl: crx_url });
          break;
          
        case WEBSTORE.opera:
          // Opera extensions must be 'load unpacked'
          msgHandler({ manualInstallDownloadUrl: crx_url });
          break;
          
        default:
          // Use tab method for compatibility with service worker (MV3)
          msgHandler({ newTabUrl: crx_url });
          break;
      }
      return;
    }
    
    // Handle manual installations
    if (settings.manually_install) {
      msgHandler({ manualInstallDownloadUrl: crx_url });
    } else {
      msgHandler({ nonWebstoreDownloadUrl: crx_url });
    }
  });
}

/**
 * Update the badge counter with the number of available updates
 * 
 * @param {number} updateCount - Number of updates available
 * @returns {Promise} Promise that resolves when the badge is updated
 */
function updateBadgeCounter(updateCount) {
  return new Promise((resolve) => {
    chrome.action.getBadgeText({}, function(currentText) {
      const currentCount = parseInt(currentText) || 0;
      const newCount = updateCount + currentCount;
      const displayText = newCount ? newCount.toString() : '';
      
      chrome.action.setBadgeText({ text: displayText }, () => {
        chrome.storage.local.set({ badge_display: displayText }, resolve);
      });
    });
  });
}

/**
 * Process an update response for a specific extension
 * 
 * @param {Object} extInfo - Extension info from update response
 * @param {Object} installed_versions - Map of installed extensions
 * @param {Function} update_callback - Callback for updates
 * @param {Function} failure_callback - Callback for failures
 * @param {boolean} is_webstore - Whether this is from an official webstore
 * @param {Object} stored_values - Stored user settings
 * @returns {number} Number of updates found
 */
function processExtensionUpdate(extInfo, installed_versions, update_callback, failure_callback, is_webstore, stored_values) {
  if (!extInfo.updatecheck) return 0;
  
  const updatever = extInfo.updatecheck['@version'];
  const appid = extInfo['@appid'];
  const updatestatus = extInfo.updatecheck['@status'];
  const installedExt = installed_versions[appid];
  
  // Skip if extension is not installed or doesn't need update
  if (!updatever || !installedExt) return 0;
  
  // Check if update is needed
  const needsUpdate = (updatestatus === 'ok' || !is_webstore) && 
                     version_is_newer(installedExt.version, updatever);
  
  if (needsUpdate) {
    // Call update callback
    if (update_callback) {
      update_callback(extInfo.updatecheck, installed_versions, appid, updatever, is_webstore);
    }
    
    // Remove from 'removed_extensions' if present
    if (appid in stored_values.removed_extensions) {
      delete stored_values.removed_extensions[appid];
      chrome.storage.sync.set({
        removed_extensions: stored_values.removed_extensions
      });
    }
    
    return 1;
  } else if (failure_callback && updatestatus === 'noupdate' && 
             !(appid in stored_values.removed_extensions)) {
    // Call failure callback for no-update case
    failure_callback(true, installedExt);
  }
  
  return 0;
}

/**
 * Fetch and process updates for a specific extension or store
 * 
 * @param {string} ext_url - Update URL
 * @param {string} ext_id - Extension ID
 * @param {string} ext_name - Extension name
 * @param {Object} installed_versions - Map of installed extensions
 * @param {Function} update_callback - Callback for updates
 * @param {Function} failure_callback - Callback for failures
 * @param {Object} stored_values - Stored user settings
 * @returns {Promise} Promise that resolves when update is checked
 */
async function fetchAndProcessUpdate(ext_url, ext_id, ext_name, installed_versions, update_callback, failure_callback, stored_values) {
  const is_webstore = Array.from(store_extensions.keys()).some(x => x.test(ext_url));
  
  try {
    // Fetch update data
    const response = await fetch(ext_url);
    if (response.status !== 200) {
      throw new Error(`HTTP status ${response.status}`);
    }
    
    // Parse XML response
    const txt = await response.text();
    const xml = fromXML(txt);
    
    // Handle single extension response by converting to array
    if (xml.gupdate?.app && xml.gupdate.app['@appid']) {
      xml.gupdate.app = [xml.gupdate.app];
    }
    
    // Process each extension update
    let updateCount = 0;
    const apps = xml.gupdate?.app || [];
    
    for (const extInfo of apps) {
      updateCount += processExtensionUpdate(
        extInfo, 
        installed_versions, 
        update_callback, 
        failure_callback, 
        is_webstore, 
        stored_values
      );
    }
    
    // Update badge counter
    await updateBadgeCounter(updateCount);
    
    return Promise.resolve();
  } catch (error) {
    console.error(`Error updating extension [${ext_id || ext_name}]:`, error);
    
    if (failure_callback) {
      if (ext_id) {
        failure_callback(false, installed_versions[ext_id]);
      } else {
        failure_callback(false, { name: ext_name });
      }
    }
    
    return Promise.reject(error);
  }
}

/**
 * Check for updates to installed extensions
 * 
 * @param {Function} [update_callback] - Callback for updates
 * @param {Function} [failure_callback] - Callback for failures
 * @param {Function} [completed_callback] - Callback when all checks complete
 * @param {Array} [custom_ext_list=[]] - Custom extensions to check
 */
function checkForUpdates(update_callback, failure_callback, completed_callback, custom_ext_list = []) {
  // Get all installed extensions
  chrome.management.getAll(function(extensions) {
    // Add custom extensions if provided
    extensions.push(...custom_ext_list);
    
    // Prepare default options with extension-specific flags
    const default_options = { ...DEFAULT_MANAGEMENT_OPTIONS };
    extensions.forEach(function(ext) {
      default_options[ext.id] = false;
    });
    
    // Get stored user settings
    chrome.storage.sync.get(default_options, function(stored_values) {
      stored_values.ignored_extensions = [];
      
      // Get managed settings (enterprise policies)
      chrome.storage.managed.get(stored_values, function(settings) {
        // Apply ignored extensions from policy
        settings.ignored_extensions.forEach((ignored_appid) => {
          if (ignored_appid in settings) {
            settings[ignored_appid] = true;
          }
        });
        delete settings.ignored_extensions;
        
        // Prepare list of extensions and update URLs to check
        const installed_versions = {};
        const updateUrls = [];
        
        // Reset updateUrl for all store extensions
        Array.from(store_extensions.values()).forEach(x => delete x.updateUrl);
        
        // Process installed extensions
        extensions.forEach(function(ext) {
          if (ext.updateUrl && !settings[ext.id]) {
            let is_from_store = false;
            
            // Check if extension is from a known store
            for (const [re, updaterOptions] of store_extensions) {
              if (re.test(ext.updateUrl)) {
                is_from_store = true;
                updaterOptions.updateUrl = updaterOptions.updateUrl || 
                                          updaterOptions.baseUrl + chromeVersion;
                updaterOptions.updateUrl += '&x=id%3D' + ext.id + '%26uc';
              }
            }
            
            // Add non-store extensions to update list
            if (!is_from_store && settings.check_external_apps) {
              updateUrls.push({
                url: ext.updateUrl,
                name: ext.name,
                id: ext.id
              });
            }
            
            // Save installed extension info
            installed_versions[ext.id] = ext;
          }
        });
        
        // Add store extensions to update list if enabled
        if (settings.check_store_apps) {
          for (const [re, updaterOptions] of store_extensions) {
            if (!updaterOptions.ignore) {
              updateUrls.push({
                url: updaterOptions.updateUrl,
                name: updaterOptions.name
              });
            }
          }
        }
        
        // Clear badge before checking
        chrome.action.setBadgeText({ text: '' }, async () => {
          // Create promises for each update check
          const promises = updateUrls
            .filter(x => x.url)
            .map(uurl => fetchAndProcessUpdate(
              uurl.url, 
              uurl.id, 
              uurl.name, 
              installed_versions,
              update_callback,
              failure_callback,
              stored_values
            ));
          
          // Wait for all checks to complete
          const results = await Promise.allSettled(promises);
          
          // Show error indicator if any check failed
          if (results.some(x => x.status === 'rejected')) {
            chrome.action.getBadgeText({}, function(currentText) {
              if (!(parseInt(currentText) > 0)) {
                chrome.action.setBadgeText({ text: '?' });
              }
            });
          }
          
          // Call completion callback
          if (completed_callback) completed_callback();
        });
      });
    });
  });
}