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
                       <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                           <button id="signin-btn" style="flex: 1; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">Sign In</button>
                           <button id="signup-btn" style="flex: 1; background: #f8f9fa; color: #666; border: 1px solid #ddd; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">Sign Up</button>
                       </div>
                       <p style="margin: 0 0 16px 0; font-size: 12px; color: #999;">Sign in on a video call page to get started</p>
                   </div>
               `;
           }

               setupEventListeners() {
               document.addEventListener('click', (e) => {
                   if (e.target.id === 'signout-btn') {
                       this.signOut();
                   } else if (e.target.id === 'signin-btn') {
                       this.showSignInForm();
                   } else if (e.target.id === 'signup-btn') {
                       this.showSignUpForm();
                   } else if (e.target.id === 'submit-signin') {
                       this.handleSignIn();
                   } else if (e.target.id === 'submit-signup') {
                       this.handleSignUp();
                   } else if (e.target.id === 'back-to-main') {
                       this.checkAuthStatus();
                   }
               });
           }

               signOut() {
               chrome.storage.local.clear(() => {
                   this.showUnauthenticatedState();
               });
           }

           showSignInForm() {
               document.getElementById('auth-status').innerHTML = `
                   <div style="text-align: center; padding: 20px;">
                       <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🔐</div>
                       <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">Sign In</h3>
                       <form id="signin-form" style="text-align: left;">
                           <div style="margin-bottom: 12px;">
                               <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Email:</label>
                               <input type="email" id="signin-email" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                           </div>
                           <div style="margin-bottom: 16px;">
                               <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Password:</label>
                               <input type="password" id="signin-password" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                           </div>
                           <button type="button" id="submit-signin" style="width: 100%; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; border: none; padding: 10px; border-radius: 6px; font-size: 12px; cursor: pointer; margin-bottom: 8px;">Sign In</button>
                           <button type="button" id="back-to-main" style="width: 100%; background: #f8f9fa; color: #666; border: 1px solid #ddd; padding: 8px; border-radius: 6px; font-size: 12px; cursor: pointer;">Back</button>
                       </form>
                   </div>
               `;
           }

           showSignUpForm() {
               document.getElementById('auth-status').innerHTML = `
                   <div style="text-align: center; padding: 20px;">
                       <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; font-size: 20px;">📝</div>
                       <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">Create Account</h3>
                       <form id="signup-form" style="text-align: left;">
                           <div style="margin-bottom: 12px;">
                               <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Email:</label>
                               <input type="email" id="signup-email" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                           </div>
                           <div style="margin-bottom: 12px;">
                               <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Password:</label>
                               <input type="password" id="signup-password" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                           </div>
                           <div style="margin-bottom: 16px;">
                               <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #666;">Confirm Password:</label>
                               <input type="password" id="signup-confirm-password" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;">
                           </div>
                           <button type="button" id="submit-signup" style="width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 10px; border-radius: 6px; font-size: 12px; cursor: pointer; margin-bottom: 8px;">Create Account</button>
                           <button type="button" id="back-to-main" style="width: 100%; background: #f8f9fa; color: #666; border: 1px solid #ddd; padding: 8px; border-radius: 6px; font-size: 12px; cursor: pointer;">Back</button>
                       </form>
                   </div>
               `;
           }

           async handleSignIn() {
               const email = document.getElementById('signin-email').value;
               const password = document.getElementById('signin-password').value;
               
               if (!email || !password) {
                   alert('Please fill in all fields');
                   return;
               }

               try {
                   const response = await fetch('https://talkpilot-extension-uc6a.vercel.app/api/auth/login', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ email, password })
                   });

                   const data = await response.json();
                   
                   if (data.success) {
                       chrome.storage.local.set({
                           authToken: data.token,
                           userEmail: data.user.email
                       }, () => {
                           this.showAuthenticatedState(data.user.email);
                       });
                   } else {
                       alert(data.error || 'Login failed');
                   }
               } catch (error) {
                   console.error('Sign in error:', error);
                   alert('Login failed. Please try again.');
               }
           }

           async handleSignUp() {
               const email = document.getElementById('signup-email').value;
               const password = document.getElementById('signup-password').value;
               const confirmPassword = document.getElementById('signup-confirm-password').value;
               
               if (!email || !password || !confirmPassword) {
                   alert('Please fill in all fields');
                   return;
               }

               if (password !== confirmPassword) {
                   alert('Passwords do not match');
                   return;
               }

               if (password.length < 6) {
                   alert('Password must be at least 6 characters long');
                   return;
               }

               try {
                   const response = await fetch('https://talkpilot-extension-uc6a.vercel.app/api/auth/register', {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ email, password })
                   });

                   const data = await response.json();
                   
                   if (data.success) {
                       alert('Account created successfully! Please sign in.');
                       this.showSignInForm();
                   } else {
                       alert(data.error || 'Registration failed');
                   }
               } catch (error) {
                   console.error('Sign up error:', error);
                   alert('Registration failed. Please try again.');
               }
           }
       }

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Popup();
});

