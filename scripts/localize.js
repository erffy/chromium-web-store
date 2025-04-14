/**
 * Replaces internationalization message tags with localized content
 * @param {HTMLElement} element - The DOM element to update
 * @param {string} content - The content with potential message tags
 * @param {string|Array} [params] - Optional parameters for the message
 * @return {boolean} - Whether the content was modified
 */
function replaceI18nMessages(element, content, params) {
    if (!content || typeof content !== 'string') return false;
  
    const localizedContent = content.replace(/__MSG_(\w+)__/g, (match, messageName) => {
      return messageName ? chrome.i18n.getMessage(messageName, params) : '';
    });
  
    if (localizedContent !== content) {
      element.innerHTML = localizedContent;
      return true;
    }
  
    return false;
  }
  
  /**
   * Localizes the HTML page by replacing i18n message tags
   */
  function localizeHtmlPage() {
    // First process elements with explicit data-localize attributes
    const elements = document.querySelectorAll('[data-localize]');
    
    for (const element of elements) {
      const messageTag = element.getAttribute('data-localize');
      const messageParam = element.getAttribute('data-param1');
      
      if (messageTag) replaceI18nMessages(element, messageTag, messageParam);
    }
  
    // Then process the entire HTML for any remaining message tags
    // Note: This is more efficient than processing every element individually
    const htmlElement = document.documentElement;
    if (htmlElement) replaceI18nMessages(htmlElement, htmlElement.innerHTML);
  }
  
  // Run localization when the DOM is fully loaded
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', localizeHtmlPage);
  else localizeHtmlPage();