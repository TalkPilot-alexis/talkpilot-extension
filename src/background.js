// Background service worker for OAuth and URL detection
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    this.setupMessageListeners();
    this.setupTabListeners();
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'initiateOAuth':
          this.handleOAuth(message.provider, sendResponse);
          break;
        case 'getAuthToken':
          this.getAuthToken(sendResponse);
          break;
        case 'storeData':
          this.storeData(message.data, sendResponse);
          break;
        case 'getData':
          this.getData(message.keys, sendResponse);
          break;
        case 'captureTab':
          this.captureTab(sendResponse);
          break;
      }
      return true; // Keep message channel open
    });
  }

  setupTabListeners() {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.isVideoCallURL(tab.url)) {
        this.injectContentScript(tabId);
      }
    });
  }

  isVideoCallURL(url) {
    const videoCallDomains = [
      'meet.google.com',
      'zoom.us',
      'teams.microsoft.com',
      'webex.com'
    ];
    return videoCallDomains.some(domain => url.includes(domain));
  }

  async injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content.js']
      });
    } catch (error) {
      console.error('Failed to inject content script:', error);
    }
  }

  async handleOAuth(provider, sendResponse) {
    try {
      // OAuth is now handled by the popup directly
      sendResponse({ success: false, error: 'OAuth is handled by the popup' });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async captureTab(sendResponse) {
    try {
      const streamId = await chrome.tabCapture.capture({
        audio: true,
        video: false
      });
      sendResponse({ success: true, streamId });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async storeData(data, sendResponse) {
    try {
      await chrome.storage.local.set(data);
      sendResponse({ success: true });
      return true;
    } catch (error) {
      sendResponse({ success: false, error: error.message });
      return false;
    }
  }

  async getData(keys, sendResponse) {
    try {
      const result = await chrome.storage.local.get(keys);
      sendResponse({ success: true, data: result });
      return true;
    } catch (error) {
      sendResponse({ success: false, error: error.message });
      return false;
    }
  }
}

// Initialize background service
new BackgroundService();
