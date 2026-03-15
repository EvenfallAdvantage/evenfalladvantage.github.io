// Evenfall Advantage Meet Add-on - Sidebar JavaScript

// Configuration
const BACKEND_URL = 'https://evenfall-meet-addon-717441135149.us-central1.run.app/';

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const questionInput = document.getElementById('questionInput');
const sendBtn = document.getElementById('sendBtn');
const quickBtns = document.querySelectorAll('.quick-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎓 Evenfall Advantage Add-on loaded');
    
    // Send button click
    sendBtn.addEventListener('click', handleSendQuestion);
    
    // Enter key to send
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendQuestion();
        }
    });
    
    // Quick question buttons
    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.getAttribute('data-question');
            questionInput.value = question;
            handleSendQuestion();
        });
    });
});

// Handle sending a question
async function handleSendQuestion() {
    const question = questionInput.value.trim();
    
    if (!question) {
        return;
    }
    
    // Disable input while processing
    questionInput.disabled = true;
    sendBtn.disabled = true;
    
    // Add user message to chat
    addMessage(question, 'user');
    
    // Clear input
    questionInput.value = '';
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    try {
        // Call backend
        const response = await askCluntWestwood(question);
        
        // Remove typing indicator
        removeTypingIndicator(typingId);
        
        // Add AI response
        addMessage(response, 'ai');
        
    } catch (error) {
        console.error('Error getting response:', error);
        removeTypingIndicator(typingId);
        addMessage('Sorry, I encountered an error. Please try again.', 'ai');
    } finally {
        // Re-enable input
        questionInput.disabled = false;
        sendBtn.disabled = false;
        questionInput.focus();
    }
}

// Call backend API
async function askCluntWestwood(question) {
    const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            question: question,
            context: {
                meetingId: getMeetingId(),
                timestamp: new Date().toISOString()
            }
        })
    });
    
    if (!response.ok) {
        throw new Error('Backend request failed');
    }
    
    const data = await response.json();
    return data.answer || data.response || 'No response received';
}

// Add message to chat
function addMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai';
    typingDiv.id = 'typing-indicator';
    
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    
    typingDiv.appendChild(indicator);
    chatContainer.appendChild(typingDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    return 'typing-indicator';
}

// Remove typing indicator
function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

// Get current meeting ID (if available from Meet API)
function getMeetingId() {
    // This would come from Google Meet Add-on API
    // For now, return placeholder
    return 'meeting-' + Date.now();
}

// Log activity
function logActivity(action, data) {
    console.log(`[Evenfall Add-on] ${action}:`, data);
}
