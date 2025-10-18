// Instructor Training Room JavaScript

// Configuration - You'll need to add your Daily.co API key here
const DAILY_API_KEY = 'YOUR_DAILY_API_KEY'; // Get from https://dashboard.daily.co/developers

// DOM Elements
let roomUrlInput;
let instructorNameInput;
let startSessionBtn;
let requirePasswordCheckbox;
let roomPasswordInput;
let recordSessionCheckbox;
let muteOnEntryCheckbox;
let meetInfo;
let dailyVideoDiv;
let sessionInfoCard;
let displayRoomName;
let studentLinkInput;
let participantsList;
let participantCountSpan;
let sessionDurationSpan;
let sessionStatus;
let copyLinkBtn;
let exitRoomBtn;

// State
let dailyCallObject = null;
let sessionStartTime = null;
let durationInterval = null;
let participants = new Map();
let currentRoomUrl = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎓 Instructor Room initialized');
    
    // Initialize DOM elements
    roomUrlInput = document.getElementById('roomUrl');
    instructorNameInput = document.getElementById('instructorName');
    startSessionBtn = document.getElementById('startSession');
    requirePasswordCheckbox = document.getElementById('requirePassword');
    roomPasswordInput = document.getElementById('roomPassword');
    recordSessionCheckbox = document.getElementById('recordSession');
    muteOnEntryCheckbox = document.getElementById('muteOnEntry');
    meetInfo = document.getElementById('meetInfo');
    dailyVideoDiv = document.getElementById('dailyVideo');
    sessionInfoCard = document.getElementById('sessionInfoCard');
    displayRoomName = document.getElementById('displayRoomName');
    studentLinkInput = document.getElementById('studentLink');
    participantsList = document.getElementById('participantsList');
    participantCountSpan = document.getElementById('participantCount');
    sessionDurationSpan = document.getElementById('sessionDuration');
    sessionStatus = document.getElementById('sessionStatus');
    copyLinkBtn = document.getElementById('copyLink');
    exitRoomBtn = document.getElementById('exitRoom');
    
    // Event listeners
    if (startSessionBtn) {
        startSessionBtn.addEventListener('click', startSession);
    }
    
    if (requirePasswordCheckbox) {
        requirePasswordCheckbox.addEventListener('change', (e) => {
            roomPasswordInput.style.display = e.target.checked ? 'block' : 'none';
        });
    }
    
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', copyStudentLink);
    }
    
    if (exitRoomBtn) {
        exitRoomBtn.addEventListener('click', exitRoom);
    }
    
    // Enter key support
    [roomUrlInput, instructorNameInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    startSession();
                }
            });
        }
    });
});

// Start Training Session
async function startSession() {
    const roomUrl = roomUrlInput.value.trim();
    const instructorName = instructorNameInput.value.trim() || 'Instructor';
    
    if (!roomUrl) {
        alert('Please enter a Daily.co room URL');
        return;
    }
    
    if (!roomUrl.includes('daily.co')) {
        alert('Invalid Daily.co room URL. Must be from daily.co');
        return;
    }
    
    console.log('🚀 Starting training session:', roomUrl);
    currentRoomUrl = roomUrl;
    
    // Extract room name from URL for display
    const roomName = roomUrl.split('/').pop() || 'training-room';
    
    // Hide setup form
    if (meetInfo) {
        meetInfo.classList.add('hidden');
    }
    
    // Show Daily container
    if (dailyVideoDiv) {
        dailyVideoDiv.classList.add('active');
    }
    
    // Show session info
    if (sessionInfoCard) {
        sessionInfoCard.style.display = 'block';
    }
    
    // Update session details
    if (displayRoomName) {
        displayRoomName.textContent = roomName;
    }
    
    // Generate and display student link
    const studentLink = `${window.location.origin}/student-portal/training-room.html?room=${encodeURIComponent(roomUrl)}`;
    if (studentLinkInput) {
        studentLinkInput.value = studentLink;
    }
    
    // Show copy link button
    if (copyLinkBtn) {
        copyLinkBtn.style.display = 'flex';
    }
    
    // Update status
    if (sessionStatus) {
        sessionStatus.textContent = '● Live';
        sessionStatus.style.color = '#4caf50';
    }
    
    // Start session timer
    sessionStartTime = Date.now();
    startDurationTimer();
    
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
        
        // Join as owner/moderator
        await dailyCallObject.join({
            url: roomUrl,
            userName: instructorName
        });
        
        console.log('✅ Instructor joined session');
        
        // Event listeners
        dailyCallObject.on('joined-meeting', (event) => {
            console.log('Meeting joined successfully', event);
        });
        
        dailyCallObject.on('participant-joined', (event) => {
            console.log('👤 Participant joined:', event);
            if (event.participant && event.participant.user_name) {
                addParticipant(event.participant.session_id, event.participant.user_name);
            }
        });
        
        dailyCallObject.on('participant-left', (event) => {
            console.log('👋 Participant left:', event);
            if (event.participant) {
                removeParticipant(event.participant.session_id);
            }
        });
        
        dailyCallObject.on('left-meeting', () => {
            console.log('🚪 Session ended');
            endSession();
        });
        
        dailyCallObject.on('error', (error) => {
            console.error('Daily.co error:', error);
            alert('Error in video session: ' + error.errorMsg);
        });
        
        // Get initial participants after a delay
        setTimeout(() => {
            const participants = dailyCallObject.participants();
            console.log('Initial participants:', participants);
            Object.keys(participants).forEach(id => {
                const p = participants[id];
                if (p && p.user_name && !p.local) {
                    addParticipant(id, p.user_name);
                }
            });
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error starting session:', error);
        alert('Failed to start session. Please check the room URL.');
        endSession();
    }
}

// Add Participant to List
function addParticipant(id, name) {
    if (participants.has(id)) return;
    
    participants.set(id, { name, muted: false });
    updateParticipantsList();
    updateParticipantCount();
}

// Remove Participant from List
function removeParticipant(id) {
    participants.delete(id);
    updateParticipantsList();
    updateParticipantCount();
}

// Update Participants List UI
function updateParticipantsList() {
    if (!participantsList) return;
    
    if (participants.size === 0) {
        participantsList.innerHTML = '<p class="empty-state">No participants yet</p>';
        return;
    }
    
    participantsList.innerHTML = '';
    participants.forEach((participant, id) => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        item.innerHTML = `
            <i class="fas fa-${participant.muted ? 'microphone-slash' : 'microphone'}"></i>
            <span>${participant.name}</span>
        `;
        participantsList.appendChild(item);
    });
}

// Update Participant Count
function updateParticipantCount() {
    if (participantCountSpan) {
        const count = participants.size;
        participantCountSpan.textContent = `${count} Participant${count !== 1 ? 's' : ''}`;
    }
}

// Start Duration Timer
function startDurationTimer() {
    durationInterval = setInterval(() => {
        if (!sessionStartTime) return;
        
        const elapsed = Date.now() - sessionStartTime;
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        
        const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (sessionDurationSpan) {
            sessionDurationSpan.textContent = timeStr;
        }
    }, 1000);
}

// Copy Student Link
function copyStudentLink() {
    if (studentLinkInput) {
        studentLinkInput.select();
        document.execCommand('copy');
        
        // Show feedback
        const btn = copyLinkBtn;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.style.background = '#4caf50';
        
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = '';
        }, 2000);
    }
}

// Quick Actions
function muteAll() {
    if (dailyCallObject) {
        console.log('Muting all participants');
        alert('Use the Daily.co interface controls to manage participant audio.');
    }
}

function toggleLobby() {
    if (dailyCallObject) {
        console.log('Toggling lobby');
        alert('Lobby features can be configured in your Daily.co room settings.');
    }
}

function shareScreen() {
    if (dailyCallObject) {
        dailyCallObject.startScreenShare();
    }
}

// End Session
function endSession() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
    
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
    
    participants.clear();
    sessionStartTime = null;
    currentRoomUrl = null;
}

// Exit Room
function exitRoom() {
    if (confirm('Are you sure you want to end the training session? All participants will be disconnected.')) {
        endSession();
        window.location.href = 'index.html';
    }
}

// Make functions globally accessible
window.copyStudentLink = copyStudentLink;
window.muteAll = muteAll;
window.toggleLobby = toggleLobby;
window.shareScreen = shareScreen;
