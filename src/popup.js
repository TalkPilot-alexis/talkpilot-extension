// TalkPilot Popup Manager for Authentication
class PopupManager {
    constructor() {
        this.init();
    }

    async init() {
        await this.checkAuthStatus();
        this.setupEventListeners();
    }

    async checkAuthStatus() {
        try {
            const result = await chrome.storage.local.get(['authToken', 'userEmail', 'userName', 'isGuest']);
            const isSignedIn = result.authToken || result.isGuest;
            
            const statusDiv = document.getElementById('status');
            const statusText = document.getElementById('status-text');
            const userInfoDiv = document.getElementById('user-info');
            const userEmailSpan = document.getElementById('user-email');
            const signinGoogleBtn = document.getElementById('signin-google');
            const signinMicrosoftBtn = document.getElementById('signin-microsoft');
            const guestBtn = document.getElementById('guest-btn');
            const signoutBtn = document.getElementById('signout-btn');
            
            if (isSignedIn) {
                if (result.isGuest) {
                    statusDiv.className = 'status guest';
                    statusText.textContent = 'Guest Mode Active';
                    userEmailSpan.textContent = 'Guest User';
                } else {
                    statusDiv.className = 'status signed-in';
                    statusText.textContent = 'Signed In';
                    userEmailSpan.textContent = result.userEmail || result.userName || 'Unknown User';
                }
                
                userInfoDiv.style.display = 'block';
                signinGoogleBtn.style.display = 'none';
                signinMicrosoftBtn.style.display = 'none';
                guestBtn.style.display = 'none';
                signoutBtn.style.display = 'block';
            } else {
                statusDiv.className = 'status signed-out';
                statusText.textContent = 'Not signed in';
                userInfoDiv.style.display = 'none';
                signinGoogleBtn.style.display = 'block';
                signinMicrosoftBtn.style.display = 'block';
                guestBtn.style.display = 'block';
                signoutBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
        }
    }

    setupEventListeners() {
        document.getElementById('signin-google').addEventListener('click', () => {
            this.signIn('google');
        });
        
        document.getElementById('signin-microsoft').addEventListener('click', () => {
            this.signIn('microsoft');
        });
        
        document.getElementById('guest-btn').addEventListener('click', () => {
            this.continueAsGuest();
        });
        
        document.getElementById('signout-btn').addEventListener('click', () => {
            this.signOut();
        });
    }

    async signIn(provider) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'initiateOAuth',
                provider: provider
            });
            
            if (response.success) {
                await this.checkAuthStatus();
            } else {
                alert('Sign-in failed: ' + response.error);
            }
        } catch (error) {
            alert('Sign-in error: ' + error.message);
        }
    }

    async continueAsGuest() {
        try {
            await chrome.storage.local.set({
                isGuest: true,
                userEmail: 'guest@talkpilot.com',
                userName: 'Guest User'
            });
            await this.checkAuthStatus();
        } catch (error) {
            alert('Error setting guest mode: ' + error.message);
        }
    }

    async signOut() {
        try {
            await chrome.storage.local.remove(['authToken', 'userEmail', 'userName', 'isGuest']);
            await this.checkAuthStatus();
        } catch (error) {
            alert('Sign-out error: ' + error.message);
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
