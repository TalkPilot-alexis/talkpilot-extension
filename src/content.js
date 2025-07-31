// Simplified TalkPilot Content Script
console.log('TalkPilot Extension: Content script loaded');

class ContentScript {
    constructor() {
        this.isActive = false;
        this.hasShownModal = false;
        this.timerInterval = null;
        this.audioContext = null;
        this.audioProcessor = null;
        this.audioSource = null;
        this.transcriptBuffer = '';
        this.apiBaseUrl = 'https://talkpilot-extension-uc6a.vercel.app/api';
        this.websocket = null;
        this.isTranscribing = false;
        this.playbookSteps = [];
        this.analysisInterval = null;
        this.init();
    }

    init() {
        this.checkURLAndShowModal();
        console.log('TalkPilot Extension: Initialized on', window.location.href);
    }

    checkURLAndShowModal() {
        console.log('TalkPilot: Checking URL:', window.location.href);
        
        if (this.hasShownModal) {
            console.log('TalkPilot: Modal already shown, skipping');
            return;
        }

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
        const modal = document.createElement('div');
        modal.id = 'talkpilot-url-modal';
        
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

        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 32px; max-width: 400px; width: 90%; text-align: center; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🧠</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Ready to launch TalkPilot?</h2>
                <p style="margin: 0 0 24px 0; font-size: 16px; color: #666; line-height: 1.5;">We detected you're on a video call. Would you like to activate your AI sales assistant?</p>
                
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button id="talkpilot-yes-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">Yes, let's go!</button>
                    <button id="talkpilot-no-btn" style="background: #f8f9fa; color: #666; border: 1px solid #ddd; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">No, thanks</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('talkpilot-yes-btn').addEventListener('click', () => {
            this.handleYesClick();
        });

        document.getElementById('talkpilot-no-btn').addEventListener('click', () => {
            this.handleNoClick();
        });
    }

    async handleYesClick() {
        // Check if user is authenticated
        chrome.storage.local.get(['authToken'], (result) => {
            if (result.authToken) {
                this.showActivateButton();
            } else {
                this.showLoginForm();
            }
        });
    }

    handleNoClick() {
        const modal = document.getElementById('talkpilot-url-modal');
        if (modal) {
            modal.remove();
        }
        this.hasShownModal = true;
    }

    showLoginForm() {
        const modalContent = document.querySelector('#talkpilot-url-modal > div');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔐</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Sign In</h2>
                <p style="margin: 0 0 24px 0; font-size: 16px; color: #666; line-height: 1.5;">Enter your credentials to continue</p>
                
                <form id="talkpilot-login-form" style="text-align: left;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #333;">Email:</label>
                        <input type="email" id="talkpilot-email" placeholder="your@email.com" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #333;">Password:</label>
                        <input type="password" id="talkpilot-password" placeholder="Enter password" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <button type="submit" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; margin-bottom: 12px;">Sign In</button>
                    <button type="button" id="talkpilot-signup-btn" style="width: 100%; background: #f8f9fa; color: #666; border: 1px solid #ddd; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">Create Account</button>
                </form>
            `;

            document.getElementById('talkpilot-login-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });

            document.getElementById('talkpilot-signup-btn').addEventListener('click', () => {
                this.showSignUpForm();
            });
        }
    }

    async handleLogin() {
        const email = document.getElementById('talkpilot-email').value;
        const password = document.getElementById('talkpilot-password').value;

        try {
            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (result.success) {
                // Store auth token
                chrome.storage.local.set({
                    authToken: result.token,
                    userEmail: result.user.email
                }, () => {
                    this.showActivateButton();
                });
            } else {
                alert('Login failed: ' + result.error);
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    }

    showSignUpForm() {
        const modalContent = document.querySelector('#talkpilot-url-modal > div');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">📝</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Create Account</h2>
                <p style="margin: 0 0 24px 0; font-size: 16px; color: #666; line-height: 1.5;">Enter your details to create a new account</p>
                
                <form id="talkpilot-signup-form" style="text-align: left;">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #333;">Email:</label>
                        <input type="email" id="talkpilot-signup-email" placeholder="your@email.com" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #333;">Password:</label>
                        <input type="password" id="talkpilot-signup-password" placeholder="Enter password" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #333;">Confirm Password:</label>
                        <input type="password" id="talkpilot-signup-confirm-password" placeholder="Confirm password" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                    </div>
                    <button type="submit" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; margin-bottom: 12px;">Create Account</button>
                    <button type="button" id="talkpilot-back-to-login" style="width: 100%; background: #f8f9fa; color: #666; border: 1px solid #ddd; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">Back to Sign In</button>
                </form>
            `;

            document.getElementById('talkpilot-signup-form').addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSignUp();
            });

            document.getElementById('talkpilot-back-to-login').addEventListener('click', () => {
                this.showLoginForm();
            });
        }
    }

    async handleSignUp() {
        const email = document.getElementById('talkpilot-signup-email').value;
        const password = document.getElementById('talkpilot-signup-password').value;
        const confirmPassword = document.getElementById('talkpilot-signup-confirm-password').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (result.success) {
                alert('Account created successfully! Please sign in.');
                this.showLoginForm();
            } else {
                alert('Registration failed: ' + result.error);
            }
        } catch (error) {
            console.error('Sign up error:', error);
            alert('Registration failed. Please try again.');
        }
    }

    showActivateButton() {
        const modalContent = document.querySelector('#talkpilot-url-modal > div');
        if (modalContent) {
            modalContent.innerHTML = `
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 24px;">✅</div>
                <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #333;">Ready to Go!</h2>
                <p style="margin: 0 0 24px 0; font-size: 16px; color: #666; line-height: 1.5;">You're signed in and ready to activate TalkPilot.</p>
                
                <button id="talkpilot-activate-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.3s ease;">Activate Assistant</button>
            `;

            document.getElementById('talkpilot-activate-btn').addEventListener('click', () => {
                this.activateAssistant();
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

        // Start the call configuration flow
        this.showCallContextModal();
    }

    showCallContextModal() {
        const modal = document.createElement('div');
        modal.id = 'talkpilot-context-modal';
        
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

        const playbookOptions = [
            { key: 'meddic', name: 'MEDDIC' },
            { key: 'spin', name: 'SPIN' },
            { key: 'bant', name: 'BANT' },
            { key: 'sandler', name: 'Sandler' }
        ];

        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 32px; max-width: 500px; width: 90%; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
                <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #333; text-align: center;">Call Configuration</h2>
                
                <form id="talkpilot-context-form">
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Call Objectives:</label>
                        <textarea id="talkpilot-objectives" placeholder="What do you want to achieve in this call?" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; resize: vertical; min-height: 80px; box-sizing: border-box; font-family: inherit;"></textarea>
                    </div>
                    
                    <div style="margin-bottom: 24px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">Playbook:</label>
                        <select id="talkpilot-playbook" required style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; box-sizing: border-box;">
                            <option value="">Select a playbook...</option>
                            ${playbookOptions.map(playbook => `<option value="${playbook.key}">${playbook.name}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button type="submit" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">Start Call</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('talkpilot-context-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleContextSubmit();
        });
    }

    handleContextSubmit() {
        const objectives = document.getElementById('talkpilot-objectives').value;
        const playbook = document.getElementById('talkpilot-playbook').value;

        // Store context
        chrome.storage.local.set({
            callObjectives: objectives,
            selectedPlaybook: playbook
        }, () => {
            // Close modal
            const modal = document.getElementById('talkpilot-context-modal');
            if (modal) {
                modal.remove();
            }

            // Start the call
            this.startCall();
        });
    }

    startCall() {
        this.isActive = true;
        this.showInCallPanel();
        this.startAudioCapture();
    }

    showInCallPanel() {
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

        // Get playbook steps
        this.playbookSteps = this.getPlaybookSteps();
        
        panel.innerHTML = `
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="width: 32px; height: 32px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px;">🧠</div>
                    <div>
                        <div style="font-weight: 600; font-size: 16px;">TalkPilot</div>
                        <div style="font-size: 12px; opacity: 0.9;">AI Sales Assistant</div>
                    </div>
                </div>
                
                <!-- Live Call Status -->
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
                    <div style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; animation: pulse 2s infinite;"></div>
                    <span style="font-size: 12px; font-weight: 500; color: #4CAF50;">Live Call Active</span>
                    <span id="talkpilot-timer" style="font-size: 12px; opacity: 0.9; margin-left: auto;">00:00</span>
                </div>
            </div>

            <!-- Playbook Steps -->
            <div style="flex: 1; padding: 20px; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #333;">PLAYBOOK STEPS</h3>
                    <span id="talkpilot-progress" style="font-size: 12px; color: #666;">0/${this.playbookSteps.length}</span>
                </div>
                
                <div id="talkpilot-steps-list" style="display: flex; flex-direction: column; gap: 12px;">
                    ${this.playbookSteps.map((step, index) => `
                        <div class="talkpilot-step" data-step="${step.key}" style="display: flex; align-items: flex-start; gap: 12px;">
                            <input type="checkbox" id="step-${index}" class="talkpilot-step-checkbox" style="margin-top: 2px;">
                            <label for="step-${index}" class="talkpilot-step-label" style="font-size: 13px; color: #333; cursor: pointer; display: block; flex: 1;">${step.name}</label>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Live Transcript -->
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                    <h4 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #333;">LIVE TRANSCRIPT</h4>
                    <div id="talkpilot-transcript" style="background: #f8f9fa; padding: 12px; border-radius: 8px; min-height: 100px; max-height: 200px; overflow-y: auto; font-size: 12px; line-height: 1.4; color: #666;">
                        <div style="color: #999; font-style: italic;">Waiting for speech...</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        this.setupInCallEventListeners();
        this.startCallTimer();
    }

    getPlaybookSteps() {
        const playbooks = {
            meddic: [
                { key: 'metrics', name: 'Metrics' },
                { key: 'economic_buyer', name: 'Economic Buyer' },
                { key: 'decision_criteria', name: 'Decision Criteria' },
                { key: 'decision_process', name: 'Decision Process' },
                { key: 'identify_pain', name: 'Identify Pain' },
                { key: 'champion', name: 'Champion' }
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
            ],
            sandler: [
                { key: 'budget', name: 'Budget' },
                { key: 'authority', name: 'Authority' },
                { key: 'need', name: 'Need' },
                { key: 'timeline', name: 'Timeline' },
                { key: 'money', name: 'Money' },
                { key: 'decision', name: 'Decision' }
            ]
        };
        
        // For now, return MEDDIC as default
        // In a real implementation, you'd get this from storage
        return playbooks.meddic;
    }

    setupInCallEventListeners() {
        // Checkbox listeners for manual toggling
        const checkboxes = document.querySelectorAll('.talkpilot-step-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateProgress();
                this.toggleStepLabel(checkbox);
            });
        });
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
        const label = checkbox.nextElementSibling;
        if (checkbox.checked) {
            label.style.textDecoration = 'line-through';
            label.style.color = '#999';
        } else {
            label.style.textDecoration = 'none';
            label.style.color = '#333';
        }
    }

    async startAudioCapture() {
        try {
            console.log('TalkPilot: Starting audio capture...');
            
            let stream = null;
            
            // Try microphone capture
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        sampleRate: 16000
                    } 
                });
                console.log('TalkPilot: Microphone capture successful');
            } catch (micError) {
                console.log('TalkPilot: Microphone capture failed:', micError.message);
                
                // Try tab capture as fallback
                try {
                    const response = await chrome.runtime.sendMessage({ action: 'captureTab' });
                    if (response.success && response.streamId) {
                        stream = await navigator.mediaDevices.getUserMedia({
                            audio: {
                                mandatory: {
                                    chromeMediaSource: 'tab',
                                    chromeMediaSourceId: response.streamId
                                }
                            },
                            video: false
                        });
                        console.log('TalkPilot: Tab capture successful');
                    }
                } catch (tabError) {
                    console.error('TalkPilot: Tab capture failed:', tabError);
                    alert('Unable to capture audio. Please ensure microphone permissions are granted.');
                    return;
                }
            }
            
            if (!stream) {
                alert('Unable to capture audio. Please ensure microphone permissions are granted.');
                return;
            }
            
            // Set up audio processing
            this.audioContext = new AudioContext({ sampleRate: 16000 });
            const source = this.audioContext.createMediaStreamSource(stream);
            const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            source.connect(processor);
            processor.connect(this.audioContext.destination);
            
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                this.processAudioChunk(inputData);
            };
            
            this.audioProcessor = processor;
            this.audioSource = source;
            
            console.log('TalkPilot: Audio capture started successfully');
            
            // Start real-time transcription
            await this.startRealTimeTranscription();
            
        } catch (error) {
            console.error('TalkPilot: Failed to start audio capture:', error);
            alert('Error starting audio capture: ' + error.message);
        }
    }

    async startRealTimeTranscription() {
        try {
            console.log('TalkPilot: Starting real-time transcription with Deepgram...');
            
            const deepgramUrl = 'wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1&model=nova-2&interim_results=true&endpointing=200&vad_events=true&diarize=true&utterances=true&smart_format=true&punctuate=true';
            
            this.websocket = new WebSocket(deepgramUrl);
            
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
                        if (data.channel?.alternatives?.[0]?.transcript) {
                            const transcript = data.channel.alternatives[0].transcript;
                            const isFinal = data.is_final;
                            
                            this.handleTranscript({
                                transcript,
                                isFinal,
                                confidence: data.channel.alternatives[0].confidence
                            });
                        }
                    }
                } catch (error) {
                    console.error('TalkPilot: Error parsing Deepgram message:', error);
                }
            };

            this.websocket.onerror = (error) => {
                console.error('TalkPilot: Deepgram WebSocket error:', error);
                this.isTranscribing = false;
            };

            this.websocket.onclose = (event) => {
                console.log('TalkPilot: Deepgram WebSocket closed:', event.code, event.reason);
                this.isTranscribing = false;
            };
            
        } catch (error) {
            console.error('TalkPilot: Failed to start real-time transcription:', error);
        }
    }

    getDeepgramApiKey() {
        return '12da8c243182af6511d33f65165d730b985973f2';
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
                this.websocket.send(pcmData.buffer);
            } catch (error) {
                console.error('TalkPilot: Error sending audio data:', error);
            }
        }
    }

    async handleTranscript(data) {
        const { transcript, isFinal } = data;
        
        if (transcript) {
            // Update transcript buffer
            if (isFinal) {
                this.transcriptBuffer += transcript + ' ';
                
                // Analyze for playbook completion every 5 seconds
                if (!this.analysisInterval) {
                    this.analysisInterval = setInterval(() => {
                        this.analyzePlaybookProgress();
                    }, 5000);
                }
            }
            
            // Update display in real-time
            this.updateTranscriptDisplay(transcript, isFinal);
        }
    }

    updateTranscriptDisplay(transcript, isFinal = false) {
        const transcriptElement = document.getElementById('talkpilot-transcript');
        if (transcriptElement) {
            if (isFinal) {
                // Add final transcript
                const finalDiv = document.createElement('div');
                finalDiv.className = 'final-transcript';
                finalDiv.style.cssText = 'font-weight: 600; color: #333; margin-bottom: 4px;';
                finalDiv.textContent = transcript;
                transcriptElement.appendChild(finalDiv);
            } else {
                // Update interim transcript
                let interimDiv = transcriptElement.querySelector('.interim-transcript');
                if (!interimDiv) {
                    interimDiv = document.createElement('div');
                    interimDiv.className = 'interim-transcript';
                    interimDiv.style.cssText = 'font-style: italic; color: #666;';
                    transcriptElement.appendChild(interimDiv);
                }
                interimDiv.textContent = transcript;
            }
            
            // Auto-scroll to bottom
            transcriptElement.scrollTop = transcriptElement.scrollHeight;
            
            // Keep only last 20 transcript segments
            const segments = transcriptElement.children;
            if (segments.length > 20) {
                transcriptElement.removeChild(segments[0]);
            }
        }
    }

    async analyzePlaybookProgress() {
        if (!this.transcriptBuffer.trim()) return;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/ai/playbook-analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcript: this.transcriptBuffer,
                    playbookSteps: this.playbookSteps
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.completedSteps && result.completedSteps.length > 0) {
                    this.updatePlaybookProgress(result.completedSteps);
                }
            }
        } catch (error) {
            console.error('Playbook analysis error:', error);
        }
    }

    updatePlaybookProgress(completedSteps) {
        completedSteps.forEach(stepIndex => {
            const checkbox = document.getElementById(`step-${stepIndex}`);
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                this.toggleStepLabel(checkbox);
                this.updateProgress();
            }
        });
    }
}

// Initialize the content script
new ContentScript();
