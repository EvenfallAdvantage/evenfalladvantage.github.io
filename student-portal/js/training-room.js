// Training Room JavaScript
// Connects to Cloud Run backend for Agent Westwood AI responses

// Configuration
const BACKEND_URL = 'https://evenfall-meet-addon-717441135149.us-central1.run.app/';

// DOM Elements - will be initialized after DOM loads
let roomUrlInput;
let displayNameInput;
let joinMeetingBtn;
let cluntSidebar;
let toggleCluntBtn;
let closeSidebarBtn;
let exitRoomBtn;
let chatMessages;
let questionInput;
let sendQuestionBtn;
let quickBtns;
let meetInfo;
let dailyVideoDiv;

// State
let sidebarVisible = true;
let dailyCallObject = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎓 Training Room initialized');
    
    // Initialize DOM elements
    roomUrlInput = document.getElementById('roomUrl');
    displayNameInput = document.getElementById('displayName');
    joinMeetingBtn = document.getElementById('joinMeeting');
    cluntSidebar = document.getElementById('cluntSidebar');
    toggleCluntBtn = document.getElementById('toggleClunt');
    closeSidebarBtn = document.getElementById('closeSidebar');
    exitRoomBtn = document.getElementById('exitRoom');
    chatMessages = document.getElementById('chatMessages');
    questionInput = document.getElementById('questionInput');
    sendQuestionBtn = document.getElementById('sendQuestion');
    quickBtns = document.querySelectorAll('.quick-btn');
    meetInfo = document.getElementById('meetInfo');
    dailyVideoDiv = document.getElementById('dailyVideo');
    
    console.log('DOM elements loaded:', {
        roomUrlInput: !!roomUrlInput,
        displayNameInput: !!displayNameInput,
        joinMeetingBtn: !!joinMeetingBtn,
        cluntSidebar: !!cluntSidebar,
        dailyVideoDiv: !!dailyVideoDiv
    });
    
    // Check for room URL in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const roomUrl = urlParams.get('room');
    const displayName = urlParams.get('name');
    if (roomUrl && roomUrlInput) {
        roomUrlInput.value = roomUrl;
        if (displayName && displayNameInput) {
            displayNameInput.value = displayName;
        }
        joinMeeting();
    }
    
    // Event listeners
    if (joinMeetingBtn) {
        joinMeetingBtn.addEventListener('click', (e) => {
            console.log('Join button clicked!');
            e.preventDefault();
            joinMeeting();
        });
    }
    
    if (roomUrlInput) {
        roomUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinMeeting();
            }
        });
    }
    
    if (displayNameInput) {
        displayNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinMeeting();
            }
        });
    }
    
    if (toggleCluntBtn) {
        toggleCluntBtn.addEventListener('click', toggleSidebar);
    }
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
    }
    
    if (exitRoomBtn) {
        exitRoomBtn.addEventListener('click', exitRoom);
    }
    
    if (sendQuestionBtn) {
        sendQuestionBtn.addEventListener('click', sendQuestion);
    }
    
    if (questionInput) {
        questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendQuestion();
            }
        });
    }
    
    // Quick question buttons
    if (quickBtns) {
        quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.getAttribute('data-question');
                if (questionInput) {
                    questionInput.value = question;
                    sendQuestion();
                }
            });
        });
    }
});

// Join Daily.co Meeting
async function joinMeeting() {
    const roomUrl = roomUrlInput.value.trim();
    const displayName = displayNameInput.value.trim() || 'Student';
    
    if (!roomUrl) {
        alert('Please enter a room URL');
        return;
    }
    
    console.log('🚪 Joining Daily.co room:', roomUrl);
    
    // Hide join form
    if (meetInfo) {
        meetInfo.classList.add('hidden');
    }
    
    // Show Daily container
    if (dailyVideoDiv) {
        dailyVideoDiv.classList.add('active');
    }
    
    try {
        // Create Daily call object
        dailyCallObject = window.DailyIframe.createFrame(dailyVideoDiv, {
            showLeaveButton: true,
            showFullscreenButton: true,
            iframeStyle: {
                width: '100%',
                height: '100%',
                border: 'none'
            }
        });
        
        // Join the room
        await dailyCallObject.join({
            url: roomUrl,
            userName: displayName
        });
        
        console.log('✅ Joined Daily.co meeting');
        addSystemMessage(`Joined training room`);
        addSystemMessage('Google Meet is now open in a new tab. Use this sidebar to ask Agent Westwood questions during your training!');
        
        // Event listeners
        dailyCallObject.on('joined-meeting', () => {
            console.log('Meeting joined successfully');
        });
        
        dailyCallObject.on('left-meeting', () => {
            console.log('👋 Left meeting');
            cleanupCall();
        });
        
        dailyCallObject.on('error', (error) => {
            console.error('Daily.co error:', error);
            alert('Error joining meeting. Please check the room URL.');
            cleanupCall();
        });
        
        // Listen for shared chat messages
        dailyCallObject.on('app-message', (event) => {
            console.log('📨 Received app message:', event);
            if (event.data.type === 'chat-question') {
                addMessage(event.data.question, 'user', event.data.userName);
            } else if (event.data.type === 'chat-answer') {
                addMessage(event.data.answer, 'ai');
            }
        });
        
    } catch (error) {
        console.error('❌ Error joining meeting:', error);
        alert('Failed to join meeting. Please check the room URL and try again.');
        
        // Show form again
        if (meetInfo) {
            meetInfo.classList.remove('hidden');
        }
        if (dailyVideoDiv) {
            dailyVideoDiv.classList.remove('active');
        }
    }
}

// Cleanup Daily call
function cleanupCall() {
    if (dailyCallObject) {
        dailyCallObject.destroy();
        dailyCallObject = null;
    }
    
    if (dailyVideoDiv) {
        dailyVideoDiv.classList.remove('active');
    }
    
    if (meetInfo) {
        meetInfo.classList.remove('hidden');
    }
}

// Toggle Sidebar
function toggleSidebar(show = null) {
    if (show === null) {
        sidebarVisible = !sidebarVisible;
    } else {
        sidebarVisible = show;
    }
    
    if (sidebarVisible) {
        cluntSidebar.classList.remove('hidden');
        toggleCluntBtn.innerHTML = '<i class="fas fa-robot"></i> Hide Agent Westwood';
    } else {
        cluntSidebar.classList.add('hidden');
        toggleCluntBtn.innerHTML = '<i class="fas fa-robot"></i> Ask Agent Westwood';
    }
}

// Send Question to Agent Westwood (Shared Chat)
async function sendQuestion() {
    const question = questionInput.value.trim();
    
    if (!question) return;
    
    console.log('❓ Asking Agent Westwood:', question);
    
    // Get user's display name
    const userName = displayNameInput ? displayNameInput.value.trim() || 'Student' : 'Student';
    
    // Clear input
    questionInput.value = '';
    
    // Add user message locally
    addMessage(question, 'user', userName);
    
    // Broadcast question to all participants via Daily.co
    if (dailyCallObject) {
        dailyCallObject.sendAppMessage({
            type: 'chat-question',
            question: question,
            userName: userName
        }, '*');
    }
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        // Call backend API
        const response = await fetch(`${BACKEND_URL}ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question })
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        if (data.answer) {
            // Add AI response locally
            addMessage(data.answer, 'ai');
            
            // Broadcast answer to all participants
            if (dailyCallObject) {
                dailyCallObject.sendAppMessage({
                    type: 'chat-answer',
                    answer: data.answer
                }, '*');
            }
        } else {
            addMessage('Sorry, I couldn\'t process that question.', 'ai');
        }
    } catch (error) {
        console.error('Error asking Agent Westwood:', error);
        removeTypingIndicator(typingId);
        addMessage('Error connecting to Agent Westwood. Please try again.', 'ai');
    }
}

// Add Message to Chat
function addMessage(text, type, userName = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (type === 'user' && userName) {
        const nameSpan = document.createElement('strong');
        nameSpan.textContent = userName;
        nameSpan.style.display = 'block';
        nameSpan.style.marginBottom = '0.25rem';
        nameSpan.style.fontSize = '0.85rem';
        nameSpan.style.color = '#4caf50';
        messageDiv.appendChild(nameSpan);
    }
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.parentElement.scrollTop = chatMessages.parentElement.scrollHeight;
}

// Add System Message
function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.style.textAlign = 'center';
    messageDiv.style.padding = '0.5rem';
    messageDiv.style.color = '#999';
    messageDiv.style.fontSize = '0.85rem';
    messageDiv.textContent = text;
    
    chatMessages.appendChild(messageDiv);
}

// Show Typing Indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai';
    typingDiv.id = 'typing-indicator';
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    
    typingDiv.appendChild(indicator);
    chatMessages.appendChild(typingDiv);
    
    // Scroll to bottom
    chatMessages.parentElement.scrollTop = chatMessages.parentElement.scrollHeight;
    
    return 'typing-indicator';
}

// Remove Typing Indicator
function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

// Exit Room
function exitRoom() {
    if (confirm('Are you sure you want to leave the training room?')) {
        // Cleanup Daily call
        cleanupCall();
        window.location.href = 'index.html';
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    if (window.innerWidth <= 768 && sidebarVisible) {
        // On mobile, sidebar should overlay
        cluntSidebar.style.position = 'absolute';
    } else {
        cluntSidebar.style.position = 'relative';
    }
});
