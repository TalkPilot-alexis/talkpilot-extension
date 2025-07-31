// TalkPilot Content Script with Real API Integrations
console.log('TalkPilot Extension: Content script loaded');

class ContentScript {
    constructor() {
        this.isActive = false;
        this.hasShownModal = false;
        this.timerInterval = null;
        this.audioContext = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.transcriptBuffer = '';
        this.apiBaseUrl = 'https://talkpilot-extension-uc6a.vercel.app/api';
        this.websocket = null;
        this.isTranscribing = false;
        this.currentSpeaker = null;
        this.speakers = new Map();
        this.isSpeaking = false;
        this.init();
    }

    init() {
        this.checkURLAndShowModal();
        this.setupMessageListener();
        console.log('TalkPilot Extension: Initialized on', window.location.href);
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'openTalkPilotPanel') {
                this.openTalkPilotPanel();
            }
        });
    }

    openTalkPilotPanel() {
        // Check if user is authenticated
        chrome.storage.local.get(['authToken', 'isGuest'], (result) => {
            if (result.authToken || result.isGuest) {
                // If panel is not already shown, show it
                const existingPanel = document.getElementById('talkpilot-incall-panel');
                if (!existingPanel) {
                    this.showTalkPilotPanel();
                }
            } else {
                // Show sign-in modal
                this.showURLRecognitionModal();
            }
        });
    }

    showTalkPilotPanel() {
        // Get stored context or create default
        chrome.storage.local.get(['meetingWith', 'callGoal', 'tone', 'extraNotes', 'selectedPlaybook'], (result) => {
            const context = {
                meetingWith: result.meetingWith || 'Prospect',
                callGoal: result.callGoal || 'Discovery Call',
                tone: result.tone || 'Professional',
                selectedPlaybook: result.selectedPlaybook || 'meddic'
            };
            
            this.showInCallPanel(context, this.getPlaybookSteps(context.selectedPlaybook));
        });
    }

    checkURLAndShowModal() {
        console.log('TalkPilot: Checking URL:', window.location.href);
        
        // Check if we've already shown the modal for this session
        if (this.hasShownModal) {
            console.log('TalkPilot: Modal already shown, skipping');
            return;
        }

        // Define target video call domains
        const videoCallDomains = [
            'meet.google.com',
            'zoom.us',
            'teams.microsoft.com',
            'webex.com',
            'gotomeeting.com',
            'bluejeans.com',
            'whereby.com',
            'jitsi.org'
        ];

        const currentDomain = window.location.hostname;
        console.log('TalkPilot: Current domain:', currentDomain);
        
        const isVideoCallDomain = videoCallDomains.some(domain => 
            currentDomain.includes(domain) || currentDomain.endsWith(domain)
        );

        console.log('TalkPilot: Is video call domain?', isVideoCallDomain);

        if (isVideoCallDomain) {
            console.log('TalkPilot: Showing URL recognition modal');
            this.showURLRecognitionModal();
        }
    }

    showURLRecognitionModal() {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('talkpilot-url-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'talkpilot-url-modal';
        
        // Style the modal
        Object.assign(modal.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '1000000',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });

        // Create modal content
        const modalContent = document.createElement('div');
        Object.assign(modalContent.style, {
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            transform: 'scale(0.9)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });

        modalContent.innerHTML = `
            <div style="margin-bottom: 24px;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🎤</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">TalkPilot Detected!</h2>
                <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">We detected you're on a video call. Ready to launch TalkPilot?</p>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="talkpilot-yes-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">Yes, let's go!</button>
                <button id="talkpilot-no-btn" style="background: #f5f5f5; color: #666; border: 1px solid #ddd; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">No, thanks</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            modalContent.style.transform = 'scale(1)';
            modalContent.style.opacity = '1';
        }, 100);

        // Add event listeners
        const yesBtn = modal.querySelector('#talkpilot-yes-btn');
        const noBtn = modal.querySelector('#talkpilot-no-btn');

        yesBtn.addEventListener('click', () => {
            this.handleYesClick();
        });

        noBtn.addEventListener('click', () => {
            this.handleNoClick();
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.handleNoClick();
            }
        });
    }

    async handleYesClick() {
        // Check if user has authentication token
        const result = await chrome.storage.local.get(['authToken', 'userEmail']);
        const hasValidToken = result.authToken && result.userEmail;

        if (hasValidToken) {
            // User is signed in, show activate button
            this.showActivateButton();
        } else {
            // User needs to sign in, show sign-in options
            this.showSignInOptions();
        }
    }

    handleNoClick() {
        this.hasShownModal = true;
        const modal = document.getElementById('talkpilot-url-modal');
        if (modal) {
            modal.remove();
        }
    }

    showActivateButton() {
        const modalContent = document.querySelector('#talkpilot-url-modal > div');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">✅</div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Ready to Activate!</h2>
                    <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">You're signed in and ready to use TalkPilot.</p>
                </div>
                
                <button id="talkpilot-activate-btn" style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; border: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; width: 100%;">Activate Assistant</button>
            `;

            const activateBtn = modalContent.querySelector('#talkpilot-activate-btn');
            activateBtn.addEventListener('click', () => {
                this.activateAssistant();
            });
        }
    }

    showSignInOptions() {
        const modalContent = document.querySelector('#talkpilot-url-modal > div');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔐</div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Sign In Required</h2>
                    <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">Sign in to get started with TalkPilot.</p>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button id="talkpilot-google-btn" style="background: #4285F4; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Sign in with Google
                    </button>
                    <button id="talkpilot-microsoft-btn" style="background: #00A1F1; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.5 2.75l-8.5 4.5v9.5l8.5 4.5 8.5-4.5v-9.5l-8.5-4.5zM12 4.5l6.5 3.5v7l-6.5 3.5-6.5-3.5v-7l6.5-3.5z"/>
                        </svg>
                        Sign in with Microsoft
                    </button>
                </div>
                
                <div style="margin-top: 20px; text-align: center; padding-top: 20px; border-top: 1px solid #eee;">
                    <button id="talkpilot-guest-btn" style="background: none; border: none; color: #667eea; font-size: 14px; cursor: pointer; text-decoration: underline; padding: 8px;">Continue as Guest</button>
                    <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">Try TalkPilot without signing in</p>
                </div>
            `;

            const googleBtn = modalContent.querySelector('#talkpilot-google-btn');
            const microsoftBtn = modalContent.querySelector('#talkpilot-microsoft-btn');
            const guestBtn = modalContent.querySelector('#talkpilot-guest-btn');

            googleBtn.addEventListener('click', () => {
                this.initiateOAuth('google');
            });

            microsoftBtn.addEventListener('click', () => {
                this.initiateOAuth('microsoft');
            });

            guestBtn.addEventListener('click', () => {
                this.continueAsGuest();
            });
        }
    }

    async initiateOAuth(provider) {
        try {
            console.log(`TalkPilot: Initiating OAuth for ${provider}...`);
            
            // Get the OAuth URL from our backend
            const authUrlResponse = await fetch(`${this.apiBaseUrl}/auth/${provider}/auth`);
            if (!authUrlResponse.ok) {
                throw new Error(`Failed to get ${provider} OAuth URL`);
            }
            
            const { authUrl } = await authUrlResponse.json();
            console.log(`TalkPilot: Got ${provider} OAuth URL:`, authUrl);
            
            // Use chrome.identity.launchWebAuthFlow for secure OAuth
            const redirectUrl = chrome.identity.getRedirectURL('oauth-callback');
            console.log(`TalkPilot: Redirect URL:`, redirectUrl);
            
            const finalAuthUrl = `${authUrl}&redirect_uri=${encodeURIComponent(redirectUrl)}`;
            
            chrome.identity.launchWebAuthFlow({
                url: finalAuthUrl,
                interactive: true
            }, async (redirectUrl) => {
                if (chrome.runtime.lastError) {
                    console.error(`TalkPilot: ${provider} OAuth error:`, chrome.runtime.lastError);
                    this.showOAuthError(provider, chrome.runtime.lastError.message);
                    return;
                }
                
                if (!redirectUrl) {
                    console.error(`TalkPilot: ${provider} OAuth cancelled by user`);
                    this.showOAuthError(provider, 'Authentication cancelled');
                    return;
                }
                
                console.log(`TalkPilot: ${provider} OAuth redirect URL:`, redirectUrl);
                
                // Extract the authorization code from the redirect URL
                const urlParams = new URLSearchParams(redirectUrl.split('?')[1]);
                const code = urlParams.get('code');
                const error = urlParams.get('error');
                
                if (error) {
                    console.error(`TalkPilot: ${provider} OAuth error:`, error);
                    this.showOAuthError(provider, error);
                    return;
                }
                
                if (!code) {
                    console.error(`TalkPilot: ${provider} OAuth - no authorization code received`);
                    this.showOAuthError(provider, 'No authorization code received');
                    return;
                }
                
                // Exchange the code for tokens
                await this.exchangeCodeForTokens(provider, code);
                
            });
            
        } catch (error) {
            console.error(`TalkPilot: ${provider} OAuth initiation error:`, error);
            this.showOAuthError(provider, error.message);
        }
    }

    async exchangeCodeForTokens(provider, code) {
        try {
            console.log(`TalkPilot: Exchanging code for ${provider} tokens...`);
            
            const response = await fetch(`${this.apiBaseUrl}/auth/${provider}/callback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to exchange code for ${provider} tokens`);
            }
            
            const tokens = await response.json();
            console.log(`TalkPilot: ${provider} tokens received:`, tokens);
            
            // Store tokens in chrome.storage.local
            await new Promise((resolve) => {
                chrome.storage.local.set({
                    authToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    userEmail: tokens.userInfo?.email || 'user@example.com',
                    provider: provider,
                    isGuest: false
                }, resolve);
            });
            
            // Show success and proceed
            this.showOAuthSuccess(provider);
            
        } catch (error) {
            console.error(`TalkPilot: ${provider} token exchange error:`, error);
            this.showOAuthError(provider, error.message);
        }
    }

    showOAuthSuccess(provider) {
        const modalContent = document.querySelector('#talkpilot-url-modal > div');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">✅</div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Successfully Signed In!</h2>
                    <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">You're now signed in with ${provider}.</p>
                </div>
                
                <button id="talkpilot-activate-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">Activate Assistant</button>
            `;

            const activateBtn = modalContent.querySelector('#talkpilot-activate-btn');
            activateBtn.addEventListener('click', () => {
                this.activateAssistant();
            });
        }
    }

    continueAsGuest() {
        // Store guest authentication data
        chrome.storage.local.set({
            authToken: 'guest_token_12345',
            userEmail: 'guest@talkpilot.com',
            isGuest: true
        }, () => {
            // Show the activate button
            this.showActivateButton();
        });
    }

    showOAuthInProgress(provider) {
        const modalContent = document.querySelector('#talkpilot-url-modal > div');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">⏳</div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Signing In...</h2>
                    <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">Please complete the sign-in process in the new window.</p>
                </div>
                
                <div style="display: flex; justify-content: center;">
                    <div style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                </div>
            `;
        }
    }

    showOAuthError(provider, errorMessage = '') {
        const modalContent = document.querySelector('#talkpilot-url-modal > div');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="margin-bottom: 24px;">
                    <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #FF6B6B 0%, #FF5252 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">❌</div>
                    <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Sign-in Failed</h2>
                    <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">There was an issue connecting to ${provider}.${errorMessage ? ' ' + errorMessage : ''} Please try again.</p>
                </div>
                
                <button id="talkpilot-retry-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">Try Again</button>
            `;

            const retryBtn = modalContent.querySelector('#talkpilot-retry-btn');
            retryBtn.addEventListener('click', () => {
                this.showSignInOptions();
            });
        }
    }

    activateAssistant() {
        // Close the URL recognition modal
        const modal = document.getElementById('talkpilot-url-modal');
        if (modal) {
            modal.remove();
        }

        // Mark as shown to prevent re-showing
        this.hasShownModal = true;

        // Start the pre-call configuration flow
        this.launchPreCallFlow();
    }

    launchPreCallFlow() {
        // Start with Step 1: CRM Modal
        this.showCRMModal();
    }

    showCRMModal() {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('talkpilot-crm-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'talkpilot-crm-modal';
        
        // Style the modal
        Object.assign(modal.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '1000000',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });

        // Create modal content
        const modalContent = document.createElement('div');
        Object.assign(modalContent.style, {
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            transform: 'scale(0.9)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });

        modalContent.innerHTML = `
            <div style="margin-bottom: 24px; text-align: center;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📊</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Step 1: Connect Your CRM</h2>
                <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">Connect your CRM to access lead information and meeting context.</p>
            </div>
            
            <div id="crm-signin-section">
                <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
                    <button id="talkpilot-salesforce-crm-btn" style="background: #00A1E0; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">Sign in to Salesforce</button>
                    <button id="talkpilot-hubspot-crm-btn" style="background: #FF7A59; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">Sign in to HubSpot</button>
                    <div style="text-align: center; margin-top: 8px;">
                        <span style="color: #666; font-size: 12px;">or</span>
                    </div>
                    <button id="talkpilot-crm-guest-btn" style="background: #f8f9fa; color: #666; border: 1px solid #ddd; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">Continue as Guest (Manual Entry)</button>
                </div>
            </div>
            
            <div id="crm-leads-section" style="display: none;">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Select Lead:</label>
                    <select id="talkpilot-leads-dropdown" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; background: white;">
                        <option value="">Choose a lead...</option>
                        <option value="acme">Acme Corp</option>
                        <option value="globex">Globex Inc</option>
                        <option value="techstart">TechStart Solutions</option>
                        <option value="innovate">Innovate Labs</option>
                        <option value="future">Future Systems</option>
                    </select>
                </div>
                
                <div style="margin-bottom: 24px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Prospect LinkedIn or Company URL:</label>
                    <input type="url" id="talkpilot-prospect-url" placeholder="https://linkedin.com/in/..." style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                </div>
            </div>
            
            <div style="display: flex; justify-content: flex-end;">
                <button id="talkpilot-crm-next-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; opacity: 0.5;" disabled>Next</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            modalContent.style.transform = 'scale(1)';
            modalContent.style.opacity = '1';
        }, 100);

        // Add event listeners
        const salesforceBtn = modal.querySelector('#talkpilot-salesforce-crm-btn');
        const hubspotBtn = modal.querySelector('#talkpilot-hubspot-crm-btn');
        const nextBtn = modal.querySelector('#talkpilot-crm-next-btn');
        const leadsDropdown = modal.querySelector('#talkpilot-leads-dropdown');

        salesforceBtn.addEventListener('click', () => {
            this.handleCRMSignIn('salesforce');
        });

        hubspotBtn.addEventListener('click', () => {
            this.handleCRMSignIn('hubspot');
        });

        const guestBtn = modal.querySelector('#talkpilot-crm-guest-btn');
        guestBtn.addEventListener('click', () => {
            this.handleCRMGuest();
        });

        nextBtn.addEventListener('click', () => {
            this.handleCRMNext();
        });

        leadsDropdown.addEventListener('change', () => {
            this.handleLeadSelection();
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeCRMModal();
            }
        });
    }

    async handleCRMSignIn(provider) {
        try {
            // Show loading state
            const signinSection = document.getElementById('crm-signin-section');
            if (signinSection) {
                signinSection.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
                        <p style="margin: 0; color: #666;">Connecting to ${provider}...</p>
                    </div>
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                `;
            }

            console.log(`TalkPilot: Starting OAuth flow for ${provider}`);

            // Get OAuth URL
            const authResponse = await fetch(`${this.apiBaseUrl}/crm/${provider}/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getAuthUrl'
                })
            });

            console.log(`TalkPilot: ${provider} auth response status:`, authResponse.status);

            if (!authResponse.ok) {
                const errorText = await authResponse.text();
                console.error(`TalkPilot: ${provider} auth error:`, errorText);
                throw new Error(`Failed to get auth URL: ${authResponse.status} - ${errorText}`);
            }

            const authData = await authResponse.json();
            
            if (authData.success) {
                // Open OAuth popup
                const popup = window.open(
                    authData.authUrl,
                    `${provider}_oauth`,
                    'width=600,height=700,scrollbars=yes,resizable=yes'
                );

                // Listen for OAuth completion
                const checkPopup = setInterval(async () => {
                    if (popup.closed) {
                        clearInterval(checkPopup);
                        
                        // Check if we have tokens stored
                        chrome.storage.local.get([`${provider}AccessToken`, `${provider}RefreshToken`], async (result) => {
                            if (result[`${provider}AccessToken`]) {
                                // Fetch CRM data with access token
                                await this.fetchCRMData(provider, result[`${provider}AccessToken`], result[`${provider}InstanceUrl`]);
                            } else {
                                // Show error if no token found
                                this.showCRMError(provider, 'Authentication was cancelled or failed');
                            }
                        });
                    }
                }, 1000);
            } else {
                throw new Error(authData.error || 'Failed to get auth URL');
            }
        } catch (error) {
            console.error('CRM sign-in error:', error);
            this.showCRMError(provider, error.message);
        }
    }

    async fetchCRMData(provider, accessToken, instanceUrl) {
        try {
            console.log(`TalkPilot: Fetching ${provider} data with access token`);
            
            const response = await fetch(`${this.apiBaseUrl}/crm/${provider}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: provider === 'salesforce' ? 'getLeads' : 'getContacts',
                    accessToken: accessToken,
                    instanceUrl: instanceUrl
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Store CRM data
                chrome.storage.local.set({
                    crmToken: accessToken,
                    crmType: provider,
                    crmData: data[provider === 'salesforce' ? 'leads' : 'contacts']
                }, () => {
                    // Show the leads section
                    const leadsSection = document.getElementById('crm-leads-section');
                    if (leadsSection) {
                        leadsSection.style.display = 'block';
                        this.populateLeadsDropdown(data[provider === 'salesforce' ? 'leads' : 'contacts']);
                    }
                });
            } else {
                throw new Error(data.error || 'Failed to fetch CRM data');
            }
        } catch (error) {
            console.error('CRM data fetch error:', error);
            this.showCRMError(provider, error.message);
        }
    }

    showCRMError(provider, message) {
        const signinSection = document.getElementById('crm-signin-section');
        if (signinSection) {
            signinSection.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p style="margin: 0; color: #dc3545;">Failed to connect to ${provider}: ${message}</p>
                    <button onclick="window.talkpilotContentScript.handleCRMSignIn('${provider}')" style="margin-top: 12px; padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
                </div>
            `;
        }
    }

    handleCRMGuest() {
        console.log('TalkPilot: User chose to continue as guest');
        
        // Show manual entry form
        const signinSection = document.getElementById('crm-signin-section');
        const leadsSection = document.getElementById('crm-leads-section');
        
        if (signinSection) {
            signinSection.style.display = 'none';
        }
        
        if (leadsSection) {
            leadsSection.style.display = 'block';
            
            // Update the leads dropdown for manual entry
            const leadsDropdown = document.getElementById('talkpilot-leads-dropdown');
            if (leadsDropdown) {
                leadsDropdown.innerHTML = `
                    <option value="">Choose a lead...</option>
                    <option value="manual-acme">Acme Corp</option>
                    <option value="manual-globex">Globex Inc</option>
                    <option value="manual-techstart">TechStart Solutions</option>
                    <option value="manual-innovate">Innovate Labs</option>
                    <option value="manual-future">Future Systems</option>
                    <option value="manual-custom">Custom Lead (Enter Below)</option>
                `;
            }
            
            // Add custom lead input field
            const prospectUrlInput = document.getElementById('talkpilot-prospect-url');
            if (prospectUrlInput) {
                const customLeadSection = document.createElement('div');
                customLeadSection.id = 'custom-lead-section';
                customLeadSection.style.display = 'none';
                customLeadSection.style.marginBottom = '16px';
                customLeadSection.innerHTML = `
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Custom Lead Information:</label>
                    <input type="text" id="talkpilot-custom-lead-name" placeholder="Company Name" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box; margin-bottom: 8px;">
                    <input type="text" id="talkpilot-custom-lead-contact" placeholder="Contact Name" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box; margin-bottom: 8px;">
                    <input type="text" id="talkpilot-custom-lead-role" placeholder="Contact Role" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                `;
                
                prospectUrlInput.parentNode.insertBefore(customLeadSection, prospectUrlInput);
                
                // Add event listener for custom lead option
                leadsDropdown.addEventListener('change', () => {
                    const customSection = document.getElementById('custom-lead-section');
                    if (leadsDropdown.value === 'manual-custom') {
                        customSection.style.display = 'block';
                    } else {
                        customSection.style.display = 'none';
                    }
                });
            }
        }
        
        // Enable the Next button
        const nextBtn = document.getElementById('talkpilot-crm-next-btn');
        if (nextBtn) {
            nextBtn.disabled = false;
            nextBtn.style.opacity = '1';
        }
        
        // Store guest mode in storage
        chrome.storage.local.set({
            crmMode: 'guest',
            crmProvider: 'manual'
        });
    }

    populateLeadsDropdown(leads) {
        const dropdown = document.getElementById('talkpilot-leads-dropdown');
        if (dropdown) {
            dropdown.innerHTML = '<option value="">Select a lead...</option>';
            leads.forEach(lead => {
                const option = document.createElement('option');
                option.value = lead.Id || lead.id;
                option.textContent = `${lead.Name || lead.name} - ${lead.Company || lead.company || 'Unknown Company'}`;
                dropdown.appendChild(option);
            });
        }
    }

    handleLeadSelection() {
        const leadsDropdown = document.getElementById('talkpilot-leads-dropdown');
        const nextBtn = document.getElementById('talkpilot-crm-next-btn');
        
        if (leadsDropdown && nextBtn) {
            if (leadsDropdown.value) {
                nextBtn.disabled = false;
                nextBtn.style.opacity = '1';
            } else {
                nextBtn.disabled = true;
                nextBtn.style.opacity = '0.5';
            }
        }
    }

    handleCRMNext() {
        // Get selected lead and URL
        const leadsDropdown = document.getElementById('talkpilot-leads-dropdown');
        const prospectUrl = document.getElementById('talkpilot-prospect-url');
        
        let leadData = {
            company: '',
            contact: '',
            role: ''
        };
        
        if (leadsDropdown && leadsDropdown.value) {
            if (leadsDropdown.value === 'manual-custom') {
                // Get custom lead data
                const customName = document.getElementById('talkpilot-custom-lead-name');
                const customContact = document.getElementById('talkpilot-custom-lead-contact');
                const customRole = document.getElementById('talkpilot-custom-lead-role');
                
                leadData = {
                    company: customName ? customName.value : '',
                    contact: customContact ? customContact.value : '',
                    role: customRole ? customRole.value : ''
                };
            } else {
                // Get predefined lead data
                const selectedOption = leadsDropdown.options[leadsDropdown.selectedIndex];
                leadData = {
                    company: selectedOption.textContent,
                    contact: 'Contact Name',
                    role: 'Decision Maker'
                };
            }
        }
        
        // Store lead data
        chrome.storage.local.set({
            selectedLead: leadData,
            prospectUrl: prospectUrl ? prospectUrl.value : ''
        });
        
        // Close CRM modal
        this.closeCRMModal();
        
        // Move to Step 2: Context Modal
        this.showContextModal();
    }

    closeCRMModal() {
        const modal = document.getElementById('talkpilot-crm-modal');
        if (modal) {
            modal.remove();
        }
    }

    showContextModal() {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('talkpilot-context-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'talkpilot-context-modal';
        
        // Style the modal
        Object.assign(modal.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '1000000',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });

        // Create modal content
        const modalContent = document.createElement('div');
        Object.assign(modalContent.style, {
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            transform: 'scale(0.9)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });

        modalContent.innerHTML = `
            <div style="margin-bottom: 24px; text-align: center;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📋</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Step 2: Meeting Context</h2>
                <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">Configure your meeting details and objectives.</p>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Duration:</label>
                    <select id="talkpilot-duration" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; background: white;">
                        <option value="">Select duration...</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="45">45 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="90">1.5 hours</option>
                        <option value="120">2 hours</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Call Objectives: <span style="color: #999; font-weight: normal;">(Optional)</span></label>
                    <textarea id="talkpilot-objectives" placeholder="What do you want to achieve in this call? (Optional)" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; min-height: 80px; resize: vertical; font-family: inherit; box-sizing: border-box;"></textarea>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Type of Call: <span style="color: #999; font-weight: normal;">(Optional)</span></label>
                    <select id="talkpilot-call-type" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; background: white;">
                        <option value="">Select call type... (Optional)</option>
                        <option value="demo">Demo</option>
                        <option value="discovery">Discovery</option>
                        <option value="closing">Closing</option>
                        <option value="negotiation">Negotiation</option>
                        <option value="follow-up">Follow Up</option>
                        <option value="proposal">Proposal</option>
                        <option value="onboarding">Onboarding</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Playbook: <span style="color: #999; font-weight: normal;">(Optional)</span></label>
                    <select id="talkpilot-playbook" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; background: white;">
                        <option value="">Select playbook... (Optional)</option>
                        <option value="meddic">MEDDIC</option>
                        <option value="spin">SPIN</option>
                        <option value="bant">BANT</option>
                        <option value="sandler">Sandler</option>
                        <option value="challenger">Challenger</option>
                        <option value="solution">Solution Selling</option>
                    </select>
                </div>
            </div>
            
            <div style="display: flex; justify-content: flex-end; margin-top: 32px;">
                <button id="talkpilot-context-next-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease; opacity: 0.5;" disabled>Next</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            modalContent.style.transform = 'scale(1)';
            modalContent.style.opacity = '1';
        }, 100);

        // Add event listeners for validation
        const durationSelect = modal.querySelector('#talkpilot-duration');
        const objectivesTextarea = modal.querySelector('#talkpilot-objectives');
        const callTypeSelect = modal.querySelector('#talkpilot-call-type');
        const playbookSelect = modal.querySelector('#talkpilot-playbook');
        const nextBtn = modal.querySelector('#talkpilot-context-next-btn');

        const validateFields = () => {
            // Only require duration and lead selection (lead is handled in CRM step)
            const isValid = durationSelect.value;
            
            nextBtn.disabled = !isValid;
            nextBtn.style.opacity = isValid ? '1' : '0.5';
        };

        durationSelect.addEventListener('change', validateFields);
        objectivesTextarea.addEventListener('input', validateFields);
        callTypeSelect.addEventListener('change', validateFields);
        playbookSelect.addEventListener('change', validateFields);

        nextBtn.addEventListener('click', () => {
            this.handleContextNext();
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeContextModal();
            }
        });
    }

    handleContextNext() {
        // Save context data
        const duration = document.getElementById('talkpilot-duration').value;
        const objectives = document.getElementById('talkpilot-objectives').value;
        const callType = document.getElementById('talkpilot-call-type').value;
        const playbook = document.getElementById('talkpilot-playbook').value;

        chrome.storage.local.set({
            callDuration: duration,
            callObjectives: objectives,
            callType: callType,
            selectedPlaybook: playbook
        }, () => {
            // Close context modal
            this.closeContextModal();
            
            // Move to Step 3: Pre-call Intelligence
            this.showPreCallIntelligenceModal();
        });
    }

    closeContextModal() {
        const modal = document.getElementById('talkpilot-context-modal');
        if (modal) {
            modal.remove();
        }
    }

    showPreCallIntelligenceModal() {
        console.log('TalkPilot: Showing Step 3: Pre-call Intelligence Modal');
        
        // Remove existing modal if it exists
        const existingModal = document.getElementById('talkpilot-intelligence-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'talkpilot-intelligence-modal';
        
        // Style the modal
        Object.assign(modal.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '1000000',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });

        // Create modal content
        const modalContent = document.createElement('div');
        Object.assign(modalContent.style, {
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            transform: 'scale(0.9)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });

        modalContent.innerHTML = `
            <div style="margin-bottom: 24px; text-align: center;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🧠</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Step 3: Pre-Call Intelligence</h2>
                <p style="margin: 0; font-size: 16px; color: #666; line-height: 1.5;">AI-powered insights and preparation for your call.</p>
            </div>
            
            <div style="margin-bottom: 24px;">
                <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #333;">🎯 Call Preparation</h3>
                    <p style="margin: 0; font-size: 14px; color: #666;">TalkPilot will analyze your conversation in real-time and provide:</p>
                    <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 14px; color: #666;">
                        <li>Automatic playbook step tracking</li>
                        <li>Proactive battle cards and insights</li>
                        <li>Real-time conversation analysis</li>
                        <li>AI-powered coaching suggestions</li>
                    </ul>
                </div>
                
                <div style="background: #e8f5e8; border-radius: 8px; padding: 16px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #2e7d32;">✅ Ready to Launch</h3>
                    <p style="margin: 0; font-size: 14px; color: #2e7d32;">Your call is fully prepared with AI assistance!</p>
                </div>
            </div>
            
            <div style="display: flex; justify-content: center;">
                <button id="talkpilot-launch-call" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s ease;">
                    🚀 Launch TalkPilot Assistant
                </button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            modalContent.style.transform = 'scale(1)';
            modalContent.style.opacity = '1';
        }, 100);

        // Add event listener
        const launchButton = modal.querySelector('#talkpilot-launch-call');
        launchButton.addEventListener('click', () => {
            this.launchTalkPilotAssistant();
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeIntelligenceModal();
            }
        });
    }

    launchTalkPilotAssistant() {
        console.log('TalkPilot: Launching assistant...');
        
        // Close the intelligence modal
        this.closeIntelligenceModal();
        
        // Activate the extension
        this.isActive = true;
        this.activateExtension();
    }

    closeIntelligenceModal() {
        const modal = document.getElementById('talkpilot-intelligence-modal');
        if (modal) {
            modal.remove();
        }
    }

    showInCallPanel(context, playbookSteps) {
        // Remove existing panel if it exists
        const existingPanel = document.getElementById('talkpilot-incall-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('aside');
        panel.id = 'talkpilot-incall-panel';
        
        // Style the panel
        Object.assign(panel.style, {
            position: 'fixed',
            top: '0',
            right: '0',
            width: '350px',
            height: '100vh',
            backgroundColor: 'white',
            boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
            zIndex: '999999',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        });

        // Push page content to the left
        document.body.style.marginRight = '350px';

        // Get playbook steps based on selected playbook
        const steps = this.getPlaybookSteps(context.selectedPlaybook || 'meddic');
        
        panel.innerHTML = `
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; display: flex; align-items: center; gap: 12px; position: relative;">
                <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">🧠</div>
                <div>
                    <div style="font-weight: 600; font-size: 16px;">TalkPilot</div>
                    <div style="font-size: 12px; opacity: 0.9;">AI Sales Assistant</div>
                </div>
                <!-- End Call Button (Top-Right) -->
                <button id="talkpilot-end-call-small" style="position: absolute; top: 12px; right: 12px; background: rgba(255, 107, 107, 0.9); color: white; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">
                    📞 End
                </button>
            </div>

            <!-- Call Information -->
            <div style="padding: 20px; border-bottom: 1px solid #eee;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                    <div style="width: 24px; height: 24px; background: #f0f0f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">🏢</div>
                    <div style="font-weight: 500; font-size: 14px;">${context.company || 'ACME Corp'} / ${context.contact || 'Sarah Chen'}</div>
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 12px;">${context.role || 'VP Marketing'} · ${context.callType || 'Follow Up'}</div>
                
                <!-- Live Call Status -->
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; animation: pulse 2s infinite;"></div>
                    <span style="font-size: 12px; font-weight: 500; color: #4CAF50;">Live Call Active</span>
                    <span id="talkpilot-timer" style="font-size: 12px; color: #666; margin-left: auto;">00:00</span>
                </div>
                
                <!-- Real-time Indicators -->
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px;">
                    <div id="talkpilot-vad-indicator" class="vad-inactive" style="display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 4px 8px; border-radius: 12px; background: #f0f0f0; color: #666;">
                        <span>🔇</span> <span>Silent</span>
                    </div>
                    <div id="talkpilot-current-speaker" style="display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 4px 8px; border-radius: 12px; background: #e3f2fd; color: #1976d2;">
                        <span>👤</span> <span>Waiting...</span>
                    </div>
                </div>
            </div>

            <!-- Talking Points -->
            <div style="flex: 1; padding: 20px; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">TALKING POINTS</h3>
                    <span id="talkpilot-progress" style="font-size: 12px; color: #666;">0/${steps.length}</span>
                </div>
                
                <div id="talkpilot-steps-list" style="display: flex; flex-direction: column; gap: 12px;">
                    ${steps.map((step, index) => `
                        <div class="talkpilot-step" data-step="${step.key}" style="display: flex; align-items: flex-start; gap: 12px;">
                            <input type="checkbox" id="step-${index}" class="talkpilot-step-checkbox" style="margin-top: 2px;">
                            <div style="flex: 1;">
                                <label for="step-${index}" class="talkpilot-step-label" style="font-size: 13px; color: #333; cursor: pointer; display: block;">${step.name}</label>
                                <div class="talkpilot-step-note" style="display: none; margin-top: 8px;">
                                    <textarea placeholder="Add a note..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; resize: vertical; min-height: 60px; font-family: inherit; box-sizing: border-box;"></textarea>
                                </div>
                            </div>
                            <button class="talkpilot-add-note" style="background: none; border: none; color: #667eea; font-size: 11px; cursor: pointer; padding: 0;">+ Note</button>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Real-time Transcript -->
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h4 style="margin: 0; font-size: 13px; font-weight: 600; color: #333;">LIVE TRANSCRIPT</h4>
                        <div style="display: flex; gap: 8px;">
                            <button id="talkpilot-test-transcript" style="background: #28a745; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">Test</button>
                            <button id="talkpilot-debug-toggle" style="background: #6c757d; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer;">Debug</button>
                            <button id="talkpilot-clear-transcript" style="background: none; border: none; color: #667eea; font-size: 11px; cursor: pointer; padding: 0;">Clear</button>
                        </div>
                    </div>
                    <div id="talkpilot-transcript" style="background: #f8f9fa; border-radius: 8px; padding: 12px; max-height: 200px; overflow-y: auto; font-size: 12px; line-height: 1.4; color: #333; font-family: 'Monaco', 'Menlo', monospace;">
                        <div style="color: #666; font-style: italic;">Waiting for speech...</div>
                    </div>
                </div>
            </div>

            <!-- AI Insight Popup (initially hidden) -->
            <div id="talkpilot-ai-insight" style="position: absolute; bottom: 80px; left: 20px; right: 20px; background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); padding: 16px; display: none; z-index: 1000;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 16px; height: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; color: white;">🧠</div>
                        <span style="font-size: 12px; font-weight: 600; color: #333;">AI Insight</span>
                    </div>
                    <button id="talkpilot-close-insight" style="background: none; border: none; color: #666; font-size: 16px; cursor: pointer; padding: 0;">×</button>
                </div>
                <div style="font-size: 12px; color: #666; margin-bottom: 12px;">AI Coach Response</div>
                <div id="talkpilot-insight-text" style="font-size: 13px; color: #333; line-height: 1.4; margin-bottom: 12px;"></div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button id="talkpilot-got-it" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        <span style="font-size: 10px;">✓</span> Got it
                    </button>
                    <button id="talkpilot-later" style="background: none; border: none; color: #667eea; font-size: 12px; cursor: pointer;">Later</button>
                </div>
            </div>

            <!-- Battle Card (initially hidden) -->
            <div id="talkpilot-battle-card" style="position: absolute; bottom: 140px; left: 20px; right: 20px; display: none; z-index: 1000;">
                <!-- Battle card content will be dynamically inserted here -->
            </div>

            <!-- Chat Widget -->
            <div style="padding: 20px; border-top: 1px solid #eee;">
                <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 500; color: #333;">Ask AI Coach</label>
                <div style="display: flex; gap: 8px;">
                    <input type="text" id="talkpilot-chat-input" placeholder="Ask about company, budget..." style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 13px; font-family: inherit;">
                    <button id="talkpilot-send-chat" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 40px;">
                        <span style="font-size: 14px;">✈️</span>
                    </button>
                </div>
                

            </div>
        `;

        document.body.appendChild(panel);

        // Start timer
        this.startCallTimer();

        // Add event listeners
        this.setupInCallEventListeners(steps);
    }

    getPlaybookSteps(playbook) {
        const playbooks = {
            meddic: [
                { key: 'metrics', name: 'Metrics' },
                { key: 'economic_buyer', name: 'Economic Buyer' },
                { key: 'decision_criteria', name: 'Decision Criteria' },
                { key: 'decision_process', name: 'Decision Process' },
                { key: 'identify_pain', name: 'Identify Pain' },
                { key: 'champion', name: 'Champion' },
                { key: 'timeline', name: 'Timeline' },
                { key: 'competition', name: 'Competition' }
            ],
            spin: [
                { key: 'situation', name: 'Situation' },
                { key: 'problem', name: 'Problem' },
                { key: 'implication', name: 'Implication' },
                { key: 'need_payoff', name: 'Need Payoff' }
            ],
            bant: [
                { key: 'budget', name: 'Budget' },
                { key: 'authority', name: 'Authority' },
                { key: 'need', name: 'Need' },
                { key: 'timeline', name: 'Timeline' }
            ]
        };
        
        return playbooks[playbook] || playbooks.meddic;
    }

    setupInCallEventListeners(steps) {
        // Checkbox listeners
        const checkboxes = document.querySelectorAll('.talkpilot-step-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateProgress();
                this.toggleStepLabel(checkbox);
            });
        });

        // Add note listeners
        const addNoteButtons = document.querySelectorAll('.talkpilot-add-note');
        addNoteButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.toggleNoteSection(button);
            });
        });

        // Chat input listener
        const chatInput = document.getElementById('talkpilot-chat-input');
        const sendButton = document.getElementById('talkpilot-send-chat');
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        sendButton.addEventListener('click', () => {
            this.sendChatMessage();
        });

        // AI Insight listeners
        const closeInsight = document.getElementById('talkpilot-close-insight');
        const gotIt = document.getElementById('talkpilot-got-it');
        const later = document.getElementById('talkpilot-later');

        closeInsight.addEventListener('click', () => this.hideAIInsight());
        gotIt.addEventListener('click', () => this.hideAIInsight());
        later.addEventListener('click', () => this.hideAIInsight());
        
        // Test transcript button
        const testTranscript = document.getElementById('talkpilot-test-transcript');
        if (testTranscript) {
            testTranscript.addEventListener('click', () => {
                const testPhrase = "This is a test transcription to verify the system is working correctly.";
                this.handleTranscript({
                    transcript: testPhrase,
                    isFinal: true,
                    confidence: 0.95
                });
            });
        }
        
        // Clear transcript button
        const clearTranscript = document.getElementById('talkpilot-clear-transcript');
        if (clearTranscript) {
            clearTranscript.addEventListener('click', () => {
                const transcriptElement = document.getElementById('talkpilot-transcript');
                if (transcriptElement) {
                    transcriptElement.innerHTML = '<div style="color: #666; font-style: italic;">Waiting for speech...</div>';
                }
                this.transcriptBuffer = '';
            });
        }
        
        // Small end call button (top-right)
        const endCallButtonSmall = document.getElementById('talkpilot-end-call-small');
        if (endCallButtonSmall) {
            endCallButtonSmall.addEventListener('click', () => {
                this.endCall();
            });
        }
        
        // Debug toggle button
        const debugToggle = document.getElementById('talkpilot-debug-toggle');
        if (debugToggle) {
            debugToggle.addEventListener('click', () => {
                this.toggleDebugMode();
            });
        }
    }

    startCallTimer() {
        let seconds = 0;
        this.timerInterval = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            const timerElement = document.getElementById('talkpilot-timer');
            if (timerElement) {
                timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    updateProgress() {
        const checkboxes = document.querySelectorAll('.talkpilot-step-checkbox');
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        const progressElement = document.getElementById('talkpilot-progress');
        if (progressElement) {
            progressElement.textContent = `${checkedCount}/${checkboxes.length}`;
        }
    }

    toggleStepLabel(checkbox) {
        const label = checkbox.nextElementSibling.querySelector('.talkpilot-step-label');
        if (checkbox.checked) {
            label.style.textDecoration = 'line-through';
            label.style.color = '#999';
        } else {
            label.style.textDecoration = 'none';
            label.style.color = '#333';
        }
    }

    toggleNoteSection(button) {
        const stepDiv = button.closest('.talkpilot-step');
        const noteSection = stepDiv.querySelector('.talkpilot-step-note');
        const isVisible = noteSection.style.display !== 'none';
        
        noteSection.style.display = isVisible ? 'none' : 'block';
        button.textContent = isVisible ? '+ Note' : '- Note';
    }

    sendChatMessage() {
        const input = document.getElementById('talkpilot-chat-input');
        const message = input.value.trim();
        
        if (message) {
            this.requestAIInsight(message);
            input.value = '';
        }
    }

    async requestAIInsight(query) {
        try {
            // Get current context from storage
            const context = await this.getStoredContext();
            
            const response = await fetch(`${this.apiBaseUrl}/ai/suggestions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    context: context,
                    transcript: this.transcriptBuffer,
                    query: query,
                    playbook: context.selectedPlaybook || 'General Sales'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.showAIInsight(data.suggestion);
        } catch (error) {
            console.error('AI API error:', error);
            // Fallback to mock response
            const fallbackResponses = [
                "Based on the call context, I recommend focusing on their immediate pain points and quantifying the business impact.",
                "Consider asking about their current process inefficiencies and how much time they're losing.",
                "Explore their decision-making timeline and who else needs to be involved in the process."
            ];
            const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
            this.showAIInsight(randomResponse);
        }
    }

    async getStoredContext() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                'meetingWith', 'callGoal', 'tone', 'extraNotes',
                'company', 'contact', 'role', 'callType', 'selectedPlaybook',
                'callDuration', 'callObjectives'
            ], (result) => {
                resolve(result);
            });
        });
    }

    showAIInsight(text) {
        const insightElement = document.getElementById('talkpilot-ai-insight');
        const textElement = document.getElementById('talkpilot-insight-text');
        
        if (insightElement && textElement) {
            textElement.textContent = text;
            insightElement.style.display = 'block';
        }
    }

    hideAIInsight() {
        const insightElement = document.getElementById('talkpilot-ai-insight');
        if (insightElement) {
            insightElement.style.display = 'none';
        }
    }

    startPreCallConfiguration() {
        // This would trigger your existing pre-call configuration modal flow
        // For now, we'll just activate the extension
        this.isActive = true;
        this.activateExtension();
        
        // Show the pre-call context panel
        chrome.storage.local.get(['meetingWith', 'callGoal', 'tone', 'extraNotes'], (result) => {
            this.showPreCallContext(result);
        });
    }

    async activateExtension() {
        // Add visual indicator that extension is active
        document.body.classList.add('talkpilot-active');
        
        // Add a subtle border to indicate extension is active
        const style = document.createElement('style');
        style.id = 'talkpilot-active-style';
        style.textContent = `
            .talkpilot-active {
                position: relative;
            }
            .talkpilot-active::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: linear-gradient(90deg, #4CAF50, #2196F3, #9C27B0);
                z-index: 999999;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
        
        // Create the suggestion panel and floating button
        this.createSuggestionPanel();
        this.createFloatingButton();
        this.showFloatingButton();
        
        // Start audio capture and transcription
        await this.startAudioCapture();
        
        // Show the in-call panel
        chrome.storage.local.get(['company', 'contact', 'role', 'callType', 'selectedPlaybook'], (result) => {
            this.showInCallPanel(result, []);
        });
    }

    async startAudioCapture() {
        try {
            console.log('TalkPilot: Starting real-time audio capture...');
            
            // Try multiple audio capture methods with improved error handling
            let stream = null;
            let captureMethod = 'unknown';
            
            // Method 1: Try microphone capture first
            try {
                console.log('TalkPilot: Trying microphone capture...');
                stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 16000 // Match Deepgram's expected sample rate
                    } 
                });
                captureMethod = 'microphone';
                console.log('TalkPilot: Microphone capture successful');
            } catch (micError) {
                console.log('TalkPilot: Microphone capture failed:', micError.message);
                this.showCaptureError('Microphone capture failed: ' + micError.message);
            }
            
            // Method 2: Try tab capture if microphone failed
            if (!stream) {
                try {
                    console.log('TalkPilot: Trying tab capture...');
                    const response = await chrome.runtime.sendMessage({ action: 'captureTab' });
                    
                    if (response.success && response.streamId) {
                        console.log('TalkPilot: Tab capture successful, streamId:', response.streamId);
                        
                        stream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                mandatory: {
                                    chromeMediaSource: 'tab',
                                    chromeMediaSourceId: response.streamId
                                }
                            },
                            video: false
                        });
                        captureMethod = 'tab';
                        console.log('TalkPilot: Tab audio stream obtained');
                    } else {
                        console.error('TalkPilot: Tab capture failed:', response.error);
                        this.showCaptureError('Tab capture failed: ' + response.error);
                    }
                } catch (tabError) {
                    console.error('TalkPilot: Tab capture error:', tabError.message);
                    this.showCaptureError('Tab capture error: ' + tabError.message);
                }
            }
            
            // If both methods failed, show error and return
            if (!stream) {
                console.error('TalkPilot: All audio capture methods failed');
                this.showCaptureError('Unable to capture audio. Please ensure microphone permissions are granted and you\'re on a supported platform.');
                return;
            }
            
            console.log('TalkPilot: Audio capture successful using method:', captureMethod);
            
            // Set up audio processing for Deepgram
            this.audioContext = new AudioContext({ sampleRate: 16000 });
            const source = this.audioContext.createMediaStreamSource(stream);
            
            // Create a real-time audio processor for 16-bit PCM
            const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            source.connect(processor);
            processor.connect(this.audioContext.destination);
            
            // Process audio in real-time and send to Deepgram
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                this.processAudioChunk(inputData);
            };
            
            this.audioProcessor = processor;
            this.audioSource = source;
            
            console.log('TalkPilot: Real-time audio capture started successfully');
            
            // Start real-time transcription with Deepgram
            await this.startRealTimeTranscription();
            
        } catch (error) {
            console.error('TalkPilot: Failed to start audio capture:', error);
            this.showCaptureError('Error starting audio capture: ' + error.message);
        }
    }

    showCaptureError(message) {
        console.error('TalkPilot: Audio capture error:', message);
        // Show user-visible error tooltip
        const errorDiv = document.createElement('div');
        errorDiv.id = 'talkpilot-capture-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    toggleDebugMode() {
        if (!this.debugMode) {
            this.debugMode = true;
            this.showDebugInfo();
        } else {
            this.debugMode = false;
            this.hideDebugInfo();
        }
    }

    showDebugInfo() {
        // Create debug panel
        const debugPanel = document.createElement('div');
        debugPanel.id = 'talkpilot-debug-panel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 400px;
            max-height: 80vh;
            background: #2d3748;
            color: #e2e8f0;
            padding: 16px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            z-index: 10001;
            overflow-y: auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        const debugInfo = this.getDebugInfo();
        debugPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h4 style="margin: 0; color: #f7fafc;">🔧 Debug Mode</h4>
                <button onclick="document.getElementById('talkpilot-debug-panel').remove();" style="background: none; border: none; color: #e2e8f0; cursor: pointer; font-size: 16px;">×</button>
            </div>
            <pre style="margin: 0; white-space: pre-wrap; word-break: break-word;">${debugInfo}</pre>
        `;

        document.body.appendChild(debugPanel);
    }

    hideDebugInfo() {
        const debugPanel = document.getElementById('talkpilot-debug-panel');
        if (debugPanel) {
            debugPanel.remove();
        }
    }

    getDebugInfo() {
        const info = {
            timestamp: new Date().toISOString(),
            extension: {
                isActive: this.isActive,
                hasShownModal: this.hasShownModal,
                apiBaseUrl: this.apiBaseUrl
            },
            audio: {
                audioContext: !!this.audioContext,
                audioProcessor: !!this.audioProcessor,
                audioSource: !!this.audioSource,
                mediaRecorder: !!this.mediaRecorder,
                audioChunks: this.audioChunks.length
            },
            transcription: {
                isTranscribing: this.isTranscribing,
                websocket: this.websocket ? {
                    readyState: this.websocket.readyState,
                    url: this.websocket.url
                } : null,
                transcriptBuffer: this.transcriptBuffer.length,
                currentSpeaker: this.currentSpeaker,
                isSpeaking: this.isSpeaking,
                speakers: Array.from(this.speakers.keys())
            },
            storage: {
                // Get storage info asynchronously
                pending: 'Loading...'
            }
        };

        // Get storage info
        chrome.storage.local.get(null, (result) => {
            info.storage = result;
            // Update debug panel if it exists
            const debugPanel = document.getElementById('talkpilot-debug-panel');
            if (debugPanel && this.debugMode) {
                const pre = debugPanel.querySelector('pre');
                if (pre) {
                    pre.textContent = JSON.stringify(info, null, 2);
                }
            }
        });

        return JSON.stringify(info, null, 2);
    }

    async startRealTimeTranscription() {
        try {
            console.log('TalkPilot: Starting real-time transcription with Deepgram...');
            
            // Connect directly to Deepgram's real-time transcription API
            const deepgramUrl = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&interim_results=true&endpointing=200&vad_events=true&diarize=true&utterances=true&smart_format=true&punctuate=true';
            
            console.log('TalkPilot: Connecting to Deepgram WebSocket:', deepgramUrl);
            
            this.websocket = new WebSocket(deepgramUrl);
            
            // Add authorization header
            this.websocket.onopen = () => {
                console.log('TalkPilot: WebSocket connected to Deepgram');
                this.isTranscribing = true;
                
                // Send authorization header
                const authMessage = JSON.stringify({
                    type: 'Authorization',
                    authorization: `Token ${this.getDeepgramApiKey()}`
                });
                this.websocket.send(authMessage);
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.type === 'Results') {
                        // Handle transcription results
                        if (data.channel?.alternatives?.[0]?.transcript) {
                            const transcript = data.channel.alternatives[0].transcript;
                            const isFinal = data.is_final;
                            const confidence = data.channel.alternatives[0].confidence;
                            
                            // Handle speaker diarization
                            if (data.channel?.alternatives?.[0]?.words) {
                                const words = data.channel.alternatives[0].words;
                                const speakers = words.map(word => ({
                                    word: word.word,
                                    speaker: word.speaker,
                                    start: word.start,
                                    end: word.end
                                }));
                                
                                this.handleSpeakerDiarization({ speakers, isFinal });
                            }
                            
                            // Handle transcript
                            this.handleTranscript({
                                transcript,
                                isFinal,
                                confidence,
                                words: data.channel.alternatives[0].words || []
                            });
                        }
                    } else if (data.type === 'VAD') {
                        // Handle voice activity detection
                        this.handleVoiceActivityDetection({
                            isSpeaking: data.type === 'start'
                        });
                    } else if (data.type === 'UtteranceEnd') {
                        // Handle utterance detection
                        this.handleUtteranceDetection(data);
                    } else if (data.type === 'Error') {
                        console.error('TalkPilot: Deepgram error:', data.error);
                        this.showTranscriptionError('Deepgram error: ' + data.error);
                    }
                } catch (error) {
                    console.error('TalkPilot: Error parsing Deepgram message:', error);
                }
            };

            this.websocket.onerror = (error) => {
                console.error('TalkPilot: Deepgram WebSocket error:', error);
                this.isTranscribing = false;
                this.showTranscriptionError('WebSocket connection failed');
            };

            this.websocket.onclose = (event) => {
                console.log('TalkPilot: Deepgram WebSocket closed:', event.code, event.reason);
                this.isTranscribing = false;
                
                // Implement retry logic with exponential backoff
                if (event.code !== 1000) { // Not a normal closure
                    this.retryDeepgramConnection();
                }
            };
            
        } catch (error) {
            console.error('TalkPilot: Failed to start real-time transcription:', error);
            this.showTranscriptionError('Failed to start transcription: ' + error.message);
        }
    }

    getDeepgramApiKey() {
        // In production, this should be securely stored and retrieved
        // For now, we'll use a placeholder - you'll need to replace this
        return '12da8c243182af6511d33f65165d730b985973f2';
    }

    retryDeepgramConnection() {
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds
        
        if (!this.retryCount) this.retryCount = 0;
        
        if (this.retryCount < maxRetries) {
            this.retryCount++;
            console.log(`TalkPilot: Retrying Deepgram connection (${this.retryCount}/${maxRetries})...`);
            
            setTimeout(() => {
                this.startRealTimeTranscription();
            }, retryDelay * this.retryCount);
        } else {
            console.error('TalkPilot: Max retries reached for Deepgram connection');
            this.showTranscriptionError('Failed to connect to transcription service after multiple attempts');
        }
    }

    showTranscriptionError(message) {
        console.error('TalkPilot: Transcription error:', message);
        // Show user-visible error tooltip
        const errorDiv = document.createElement('div');
        errorDiv.id = 'talkpilot-transcription-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: #ff8800;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    processAudioChunk(audioData) {
        // Convert audio data to 16-bit PCM for Deepgram
        const pcmData = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        }
        
        // Send audio data directly to Deepgram WebSocket if connected
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN && this.isTranscribing) {
            try {
                const audioBuffer = Buffer.from(pcmData.buffer);
                this.websocket.send(JSON.stringify({
                    type: 'audio',
                    audioData: audioBuffer.toString('base64')
                }));
            } catch (error) {
                console.error('TalkPilot: Error sending audio data:', error);
            }
        }
        
        // Store audio chunk for backup
        this.audioChunks.push(pcmData);
        
        // Keep only last 10 chunks to prevent memory issues
        if (this.audioChunks.length > 10) {
            this.audioChunks.shift();
        }
        
        // For testing: simulate transcription if WebSocket is not working
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            this.simulateTranscriptionForTesting();
        }
    }



    audioBufferToWav(buffer) {
        const length = buffer.length;
        const arrayBuffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(arrayBuffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, 44100, true);
        view.setUint32(28, 44100 * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * 2, true);
        
        // Audio data
        const channelData = buffer.getChannelData(0);
        let offset = 44;
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
        
        return arrayBuffer;
    }

    async transcribeAudio() {
        if (this.audioChunks.length === 0) return;
        
        try {
            console.log('TalkPilot: Sending audio to Deepgram for real-time transcription...');
            
            // Combine audio chunks
            const combinedAudio = this.audioChunks.join('');
            this.audioChunks = []; // Clear chunks
            
            const response = await fetch(`${this.apiBaseUrl}/transcription/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audio: combinedAudio,
                    mimetype: 'audio/wav'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Update transcript buffer
            if (data.transcript) {
                this.transcriptBuffer += ' ' + data.transcript;
                this.updateTranscriptDisplay(data.transcript);
                
                // Real-time AI analysis and playbook tracking
                await this.analyzeConversation(data.transcript);
            }
            
        } catch (error) {
            console.error('Transcription error:', error);
        }
    }

    async analyzeConversation(newTranscript) {
        try {
            // Get current context and playbook
            const context = await this.getStoredContext();
            const playbookSteps = this.getPlaybookSteps(context.selectedPlaybook || 'General Sales');
            
            // Analyze the new transcript for playbook progress and insights
            const analysisResponse = await fetch(`${this.apiBaseUrl}/ai/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcript: newTranscript,
                    fullTranscript: this.transcriptBuffer,
                    context: context,
                    playbookSteps: playbookSteps,
                    currentProgress: this.getCurrentPlaybookProgress()
                })
            });

            if (analysisResponse.ok) {
                const analysis = await analysisResponse.json();
                
                // Update playbook progress
                if (analysis.completedSteps && analysis.completedSteps.length > 0) {
                    this.updatePlaybookProgress(analysis.completedSteps);
                }
                
                // Show proactive battle cards
                if (analysis.battleCard) {
                    this.showBattleCard(analysis.battleCard);
                }
                
                // Show proactive insights
                if (analysis.insight) {
                    this.showProactiveInsight(analysis.insight);
                }
            }
        } catch (error) {
            console.error('Conversation analysis error:', error);
        }
    }

    getCurrentPlaybookProgress() {
        const checkboxes = document.querySelectorAll('#talkpilot-incall-panel input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.id.replace('step-', ''));
    }

    updatePlaybookProgress(completedSteps) {
        completedSteps.forEach(stepId => {
            const checkbox = document.getElementById(`step-${stepId}`);
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                this.toggleStepLabel(checkbox);
                this.updateProgress();
            }
        });
    }

    showBattleCard(battleCard) {
        const battleCardElement = document.getElementById('talkpilot-battle-card');
        if (battleCardElement) {
            battleCardElement.innerHTML = `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                    <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">🎯 Battle Card</h4>
                    <p style="margin: 0; font-size: 13px; line-height: 1.4;">${battleCard}</p>
                </div>
            `;
            battleCardElement.style.display = 'block';
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                battleCardElement.style.display = 'none';
            }, 10000);
        }
    }

    showProactiveInsight(insight) {
        const insightElement = document.getElementById('talkpilot-ai-insight');
        const textElement = document.getElementById('talkpilot-insight-text');
        
        if (insightElement && textElement) {
            textElement.textContent = insight;
            insightElement.style.display = 'block';
            
            // Auto-hide after 15 seconds
            setTimeout(() => {
                insightElement.style.display = 'none';
            }, 15000);
        }
    }

    async handleTranscript(data) {
        const { transcript, isFinal, confidence } = data;
        
        if (transcript) {
            // Update transcript buffer
            if (isFinal) {
                this.transcriptBuffer += transcript + ' ';
                // Analyze conversation when we have final results
                this.analyzeConversation(transcript);
                
                // Forward final transcript to our backend for processing
                await this.forwardTranscriptToBackend(transcript, isFinal, confidence);
            }
            
            // Update display in real-time
            this.updateTranscriptDisplay(transcript, isFinal, confidence);
        }
    }

    async forwardTranscriptToBackend(transcript, isFinal, confidence) {
        try {
            const context = await this.getStoredContext();
            const playbookSteps = this.getCurrentPlaybookProgress();
            const currentProgress = this.getCurrentPlaybookProgress();
            
            const response = await fetch(`${this.apiBaseUrl}/transcription/receive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcript,
                    isFinal,
                    confidence,
                    context,
                    playbookSteps,
                    currentProgress
                })
            });

            if (!response.ok) {
                console.error('Failed to forward transcript to backend:', response.statusText);
            } else {
                const result = await response.json();
                console.log('Transcript forwarded successfully:', result);
            }
        } catch (error) {
            console.error('Error forwarding transcript to backend:', error);
        }
    }

    handleSpeakerDiarization(data) {
        const { speakers, isFinal } = data;
        
        if (speakers && speakers.length > 0) {
            // Update speaker information
            speakers.forEach(word => {
                if (word.speaker !== undefined) {
                    this.speakers.set(word.speaker, {
                        lastSeen: Date.now(),
                        words: (this.speakers.get(word.speaker)?.words || 0) + 1
                    });
                    
                    if (isFinal) {
                        this.currentSpeaker = word.speaker;
                        this.updateSpeakerDisplay(word.speaker);
                    }
                }
            });
        }
    }

    handleVoiceActivityDetection(data) {
        const { isSpeaking } = data;
        this.isSpeaking = isSpeaking;
        
        // Update UI to show voice activity
        this.updateVoiceActivityDisplay(isSpeaking);
        
        // If speech ended, trigger analysis
        if (!isSpeaking && this.transcriptBuffer.trim()) {
            console.log('TalkPilot: Speech ended, analyzing conversation...');
        }
    }

    handleUtteranceDetection(data) {
        const { utterance } = data;
        console.log('TalkPilot: New utterance detected:', utterance);
        
        // Could trigger specific analysis or actions based on utterance
        if (utterance && utterance.transcript) {
            this.handleUtteranceComplete(utterance.transcript);
        }
    }

    updateTranscriptDisplay(transcript, isFinal = false, confidence = null) {
        // Update the transcript display in the in-call panel
        const transcriptElement = document.getElementById('talkpilot-transcript');
        if (transcriptElement) {
            if (isFinal) {
                // Add final transcript
                const finalSpan = document.createElement('span');
                finalSpan.className = 'final-transcript';
                finalSpan.textContent = transcript + ' ';
                transcriptElement.appendChild(finalSpan);
            } else {
                // Update interim transcript
                let interimSpan = transcriptElement.querySelector('.interim-transcript');
                if (!interimSpan) {
                    interimSpan = document.createElement('span');
                    interimSpan.className = 'interim-transcript';
                    transcriptElement.appendChild(interimSpan);
                }
                interimSpan.textContent = transcript;
            }
            
            transcriptElement.scrollTop = transcriptElement.scrollHeight;
        }
    }

    updateSpeakerDisplay(speakerId) {
        const speakerElement = document.getElementById('talkpilot-current-speaker');
        if (speakerElement) {
            const speakerName = this.getSpeakerName(speakerId);
            speakerElement.textContent = `Speaker ${speakerName}`;
            speakerElement.className = `speaker-${speakerId}`;
        }
    }

    updateVoiceActivityDisplay(isSpeaking) {
        const vadElement = document.getElementById('talkpilot-vad-indicator');
        if (vadElement) {
            vadElement.className = isSpeaking ? 'vad-active' : 'vad-inactive';
            vadElement.textContent = isSpeaking ? '🎤 Speaking' : '🔇 Silent';
        }
    }

    getSpeakerName(speakerId) {
        // Map speaker IDs to names (you can customize this)
        const speakerNames = {
            0: 'You',
            1: 'Prospect',
            2: 'Colleague'
        };
        return speakerNames[speakerId] || `Speaker ${speakerId}`;
    }

    handleUtteranceComplete(transcript) {
        // Handle when an utterance is complete
        console.log('TalkPilot: Utterance complete:', transcript);
        // Could trigger specific actions based on utterance content
    }

    async endCall() {
        console.log('TalkPilot: Ending call and generating summary...');
        
        // Show loading state on the button
        const endCallButton = document.getElementById('talkpilot-end-call');
        if (endCallButton) {
            endCallButton.innerHTML = '<span style="font-size: 16px;">⏳</span> Generating Summary...';
            endCallButton.disabled = true;
            endCallButton.style.opacity = '0.7';
        }
        
        try {
            // Trigger the post-call flow
            await this.deactivateExtension();
        } catch (error) {
            console.error('TalkPilot: Error ending call:', error);
            
            // Reset button state on error
            if (endCallButton) {
                endCallButton.innerHTML = '<span style="font-size: 16px;">📞</span> End Call & Generate Summary';
                endCallButton.disabled = false;
                endCallButton.style.opacity = '1';
            }
        }
    }

    createFloatingButton() {
        // Create a floating button that appears when extension is active
        const button = document.createElement('div');
        button.id = 'talkpilot-floating-btn';
        button.innerHTML = '🎤';
        button.title = 'TalkPilot Extension';
        
        // Style the floating button
        Object.assign(button.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: '#2196F3',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            cursor: 'pointer',
            zIndex: '999999',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease',
            opacity: '0',
            transform: 'scale(0.8)'
        });

        // Add hover effects
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
            button.style.backgroundColor = '#1976D2';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.backgroundColor = '#2196F3';
        });

        // Add click handler
        button.addEventListener('click', () => {
            this.toggleSuggestionPanel();
        });

        document.body.appendChild(button);

        // Show button when extension becomes active
        this.showFloatingButton = () => {
            button.style.opacity = '1';
            button.style.transform = 'scale(1)';
        };

        this.hideFloatingButton = () => {
            button.style.opacity = '0';
            button.style.transform = 'scale(0.8)';
        };
    }

    createSuggestionPanel() {
        // Remove existing panel if it exists
        const existingPanel = document.getElementById('talkpilot-suggestion-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'talkpilot-suggestion-panel';
        
        // Style the panel as a fixed, draggable modal
        Object.assign(panel.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '400px',
            maxWidth: '90vw',
            backgroundColor: 'white',
            color: '#333',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            zIndex: '999999',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            lineHeight: '1.4',
            display: 'none',
            border: '1px solid rgba(0,0,0,0.1)',
            overflow: 'hidden'
        });

        // Create the content
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600;">TalkPilot Suggestions</h3>
                <button id="talkpilot-close-btn" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s ease;">×</button>
            </div>
            
            <div style="padding: 24px;">
                <ul id="talkpilot-suggestions-list" style="margin: 0 0 20px 0; padding: 0; list-style: none; min-height: 100px;">
                    <li style="padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px; color: #666; font-style: italic;">No suggestions yet. Click "What should I say?" to get started.</li>
                </ul>
                
                <button id="talkpilot-suggest-btn" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 20px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">What should I say?</button>
            </div>
        `;

        document.body.appendChild(panel);

        // Add click listeners
        const closeBtn = panel.querySelector('#talkpilot-close-btn');
        const suggestBtn = panel.querySelector('#talkpilot-suggest-btn');
        
        closeBtn.addEventListener('click', () => {
            this.toggleSuggestionPanel();
        });
        
        suggestBtn.addEventListener('click', () => {
            this.generateSuggestion();
        });

        // Make panel draggable
        this.makeDraggable(panel);
    }

    makeDraggable(panel) {
        const header = panel.querySelector('div');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener('mousedown', (e) => {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                
                panel.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    toggleSuggestionPanel() {
        const panel = document.getElementById('talkpilot-suggestion-panel');
        if (panel) {
            const isVisible = panel.style.display !== 'none';
            panel.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                // Animate in
                panel.style.opacity = '0';
                panel.style.transform = 'translate(-50%, -50%) scale(0.9)';
                setTimeout(() => {
                    panel.style.opacity = '1';
                    panel.style.transform = 'translate(-50%, -50%) scale(1)';
                }, 10);
            }
        }
    }

    generateSuggestion() {
        const suggestionsList = document.getElementById('talkpilot-suggestions-list');
        if (suggestionsList) {
            const suggestion = document.createElement('li');
            suggestion.style.cssText = 'padding: 12px; background: #e3f2fd; border-left: 4px solid #2196F3; border-radius: 8px; margin-bottom: 8px; color: #333;';
            suggestion.textContent = 'This is a sample suggestion. In a real implementation, this would be generated based on your context and AI analysis.';
            suggestionsList.appendChild(suggestion);
        }
    }

    showPreCallContext(context) {
        // Remove existing panel if it exists
        const existingPanel = document.getElementById('talkpilot-context-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        const panel = document.createElement('div');
        panel.id = 'talkpilot-context-panel';
        
        // Style the panel
        Object.assign(panel.style, {
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            width: '300px',
            backgroundColor: 'rgba(33, 150, 243, 0.95)',
            color: 'white',
            borderRadius: '12px',
            padding: '16px',
            zIndex: '999998',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            lineHeight: '1.4',
            transform: 'translateY(20px)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });

        // Create the content
        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Pre-Call Context</h3>
                <div style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; animation: pulse 2s infinite;"></div>
            </div>
            
            <div style="margin-bottom: 8px;">
                <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">Meeting With:</strong>
                <div style="margin-top: 2px; font-size: 13px;">${context.meetingWith || 'Not specified'}</div>
            </div>
            
            <div style="margin-bottom: 8px;">
                <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">Call Goal:</strong>
                <div style="margin-top: 2px; font-size: 13px;">${context.callGoal || 'Not specified'}</div>
            </div>
            
            <div style="margin-bottom: 8px;">
                <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">Tone:</strong>
                <div style="margin-top: 2px; font-size: 13px;">${context.tone || 'Not specified'}</div>
            </div>
            
            <div style="margin-bottom: 0;">
                <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">Extra Notes:</strong>
                <div style="margin-top: 2px; font-size: 13px; max-height: 60px; overflow-y: auto;">${context.extraNotes || 'No additional notes'}</div>
            </div>
        `;

        document.body.appendChild(panel);

        // Animate in
        setTimeout(() => {
            panel.style.transform = 'translateY(0)';
            panel.style.opacity = '1';
        }, 100);
    }

    async deactivateExtension() {
        // Show post-call summary modal
        await this.showPostCallModal();
        
        // Clean up WebSocket connection
        if (this.websocket) {
            this.websocket.send(JSON.stringify({ type: 'close' }));
            this.websocket.close();
            this.websocket = null;
            this.isTranscribing = false;
        }
        

        
        // Clean up audio capture
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        
        if (this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource = null;
        }
        
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
        }
        
        // Remove visual indicators
        document.body.classList.remove('talkpilot-active');
        
        const style = document.getElementById('talkpilot-active-style');
        if (style) {
            style.remove();
        }
        
        // Remove the pre-call context panel
        const contextPanel = document.getElementById('talkpilot-context-panel');
        if (contextPanel) {
            contextPanel.remove();
        }
        
        // Remove the suggestion panel
        const suggestionPanel = document.getElementById('talkpilot-suggestion-panel');
        if (suggestionPanel) {
            suggestionPanel.remove();
        }
        
        // Remove the in-call panel
        const inCallPanel = document.getElementById('talkpilot-incall-panel');
        if (inCallPanel) {
            inCallPanel.remove();
        }
        
        // Reset page margin
        document.body.style.marginRight = '';
        
        // Clear timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // Reset transcription state
        this.transcriptBuffer = '';
        this.audioChunks = [];
        this.speakers.clear();
        this.currentSpeaker = null;
        this.isSpeaking = false;
    }

    async showPostCallModal() {
        const modal = document.createElement('div');
        modal.id = 'talkpilot-postcall-modal';
        
        Object.assign(modal.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '1000000',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        });

        const context = await this.getStoredContext();
        const callDuration = this.getCallDuration();
        
        const modalContent = document.createElement('div');
        Object.assign(modalContent.style, {
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        });

        modalContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">✅</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Call Complete!</h2>
                <p style="margin: 0; font-size: 16px; color: #666;">Duration: ${callDuration}</p>
            </div>
            
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #333;">Call Summary</h3>
                <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <p style="margin: 0 0 8px 0;"><strong>Meeting with:</strong> ${context.meetingWith || 'N/A'}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Goal:</strong> ${context.callGoal || 'N/A'}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Playbook:</strong> ${context.selectedPlaybook || 'N/A'}</p>
                    <p style="margin: 0;"><strong>Transcript length:</strong> ${this.transcriptBuffer.split(' ').length} words</p>
                </div>
            </div>
            
            <div style="margin-bottom: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #333;">Send Follow-up Email</h3>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">To:</label>
                    <input type="email" id="postcall-email" placeholder="recipient@example.com" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Subject:</label>
                    <input type="text" id="postcall-subject" placeholder="Follow-up from our call" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 12px;">
                    <label style="display: block; margin-bottom: 4px; font-weight: 500;">Message:</label>
                    <textarea id="postcall-message" rows="6" placeholder="Thank you for the call today..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button id="postcall-send-btn" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">Send Email</button>
                <button id="postcall-skip-btn" style="background: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">Skip</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Add event listeners
        document.getElementById('postcall-send-btn').addEventListener('click', () => {
            this.sendPostCallEmail();
        });

        document.getElementById('postcall-skip-btn').addEventListener('click', () => {
            modal.remove();
        });
    }

    async sendPostCallEmail() {
        const email = document.getElementById('postcall-email').value;
        const subject = document.getElementById('postcall-subject').value;
        const message = document.getElementById('postcall-message').value;

        if (!email || !subject || !message) {
            alert('Please fill in all fields');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/email/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: email,
                    subject: subject,
                    content: message
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                alert('Email sent successfully!');
                document.getElementById('talkpilot-postcall-modal').remove();
            } else {
                throw new Error(data.error || 'Failed to send email');
            }
        } catch (error) {
            console.error('Email send error:', error);
            alert('Failed to send email: ' + error.message);
        }
    }

    getCallDuration() {
        // Calculate call duration from timer
        const now = new Date();
        const startTime = this.callStartTime || now;
        const duration = Math.floor((now - startTime) / 1000);
        
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Initialize content script
new ContentScript();
