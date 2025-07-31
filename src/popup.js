// Simplified TalkPilot Popup
console.log('TalkPilot Extension: Popup script loaded');

class Popup {
    constructor() {
        this.init();
    }

    init() {
        this.checkAuthStatus();
        this.setupEventListeners();
    }

    checkAuthStatus() {
        chrome.storage.local.get(['authToken', 'userEmail'], (result) => {
            if (result.authToken) {
                this.showAuthenticatedState(result.userEmail);
            } else {
                this.showUnauthenticatedState();
            }
        });
    }

    showAuthenticatedState(userEmail) {
        document.getElementById('auth-status').innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">✅</div>
                <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #333;">Signed In</h3>
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #666;">${userEmail}</p>
                <button id="signout-btn" style="background: #f8f9fa; color: #666; border: 1px solid #ddd; padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer;">Sign Out</button>
            </div>
        `;
    }

    showUnauthenticatedState() {
        document.getElementById('auth-status').innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🧠</div>
                <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #333;">TalkPilot</h3>
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #666;">AI Sales Assistant</p>
                <p style="margin: 0 0 16px 0; font-size: 12px; color: #999;">Sign in on a video call page to get started</p>
            </div>
        `;
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.id === 'signout-btn') {
                this.signOut();
            }
        });
    }

    signOut() {
        chrome.storage.local.clear(() => {
            this.showUnauthenticatedState();
        });
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Popup();
});

