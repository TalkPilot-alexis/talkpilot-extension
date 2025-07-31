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
            const openPanelBtn = document.getElementById('open-panel-btn');
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
                openPanelBtn.style.display = 'block';
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
        
        document.getElementById('open-panel-btn').addEventListener('click', () => {
            this.openTalkPilotPanel();
        });
    }

    async signIn(provider) {
        try {
            if (provider === 'google') {
                await this.handleGoogleSignIn();
            } else if (provider === 'microsoft') {
                // TODO: Implement Microsoft OAuth
                alert('Microsoft sign-in not implemented yet');
            }
        } catch (error) {
            alert('Sign-in error: ' + error.message);
        }
    }

    async handleGoogleSignIn() {
        try {
            // Get OAuth URL
            const authResponse = await fetch('https://talkpilot-extension-uc6a.vercel.app/api/auth/google/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getAuthUrl'
                })
            });

            if (!authResponse.ok) {
                throw new Error(`Failed to get auth URL: ${authResponse.status}`);
            }

            const authData = await authResponse.json();
            
            if (authData.success) {
                // Open OAuth popup
                const popup = window.open(
                    authData.authUrl,
                    'google_oauth',
                    'width=600,height=700,scrollbars=yes,resizable=yes'
                );

                // Listen for OAuth completion
                const checkPopup = setInterval(async () => {
                    if (popup.closed) {
                        clearInterval(checkPopup);
                        
                        // Check if we have tokens stored
                        chrome.storage.local.get(['googleAccessToken', 'googleUserInfo'], async (result) => {
                            if (result.googleAccessToken && result.googleUserInfo) {
                                // Store user data
                                await chrome.storage.local.set({
                                    authToken: result.googleAccessToken,
                                    userEmail: result.googleUserInfo.email,
                                    userName: result.googleUserInfo.name,
                                    isGuest: false
                                });
                                
                                await this.checkAuthStatus();
                            } else {
                                alert('Google authentication was cancelled or failed');
                            }
                        });
                    }
                }, 1000);
            } else {
                throw new Error(authData.error || 'Failed to get auth URL');
            }
        } catch (error) {
            console.error('Google sign-in error:', error);
            alert('Google sign-in error: ' + error.message);
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

    async openTalkPilotPanel() {
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Send message to content script to open the panel
            await chrome.tabs.sendMessage(tab.id, { action: 'openTalkPilotPanel' });
            
            // Close the popup
            window.close();
        } catch (error) {
            console.error('Error opening TalkPilot panel:', error);
            alert('Error opening panel: ' + error.message);
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
