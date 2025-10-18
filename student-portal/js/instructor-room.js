// Instructor Training Room JavaScript

// DOM Elements
let roomNameInput;
let instructorNameInput;
let startSessionBtn;
let requirePasswordCheckbox;
let roomPasswordInput;
let recordSessionCheckbox;
let muteOnEntryCheckbox;
let meetInfo;
let jitsiMeetDiv;
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
let jitsiApi = null;
let sessionStartTime = null;
let durationInterval = null;
let participants = new Map();

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎓 Instructor Room initialized');
    
    // Initialize DOM elements
    roomNameInput = document.getElementById('roomName');
    instructorNameInput = document.getElementById('instructorName');
    startSessionBtn = document.getElementById('startSession');
    requirePasswordCheckbox = document.getElementById('requirePassword');
    roomPasswordInput = document.getElementById('roomPassword');
    recordSessionCheckbox = document.getElementById('recordSession');
    muteOnEntryCheckbox = document.getElementById('muteOnEntry');
    meetInfo = document.getElementById('meetInfo');
    jitsiMeetDiv = document.getElementById('jitsiMeet');
    sessionInfoCard = document.getElementById('sessionInfoCard');
    displayRoomName = document.getElementById('displayRoomName');
    studentLinkInput = document.getElementById('studentLink');
    participantsList = document.getElementById('participantsList');
    participantCountSpan = document.getElementById('participantCount');
    sessionDurationSpan = document.getElementById('sessionDuration');
    sessionStatus = document.getElementById('sessionStatus');
    copyLinkBtn = document.getElementById('copyLink');
    exitRoomBtn = document.getElementById('exitRoom');
    
    // Generate default room name
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}-${today.getDate()}`;
    roomNameInput.value = `evenfall-training-${dateStr}`;
    
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
    [roomNameInput, instructorNameInput, roomPasswordInput].forEach(input => {
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
function startSession() {
    const roomName = roomNameInput.value.trim();
    const instructorName = instructorNameInput.value.trim() || 'Instructor';
    
    if (!roomName) {
        alert('Please enter a room name');
        return;
    }
    
    console.log('🚀 Starting training session:', roomName);
    
    // Hide setup form
    if (meetInfo) {
        meetInfo.classList.add('hidden');
    }
    
    // Show Jitsi container
    if (jitsiMeetDiv) {
        jitsiMeetDiv.classList.add('active');
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
    const studentLink = `${window.location.origin}/student-portal/training-room.html?room=${encodeURIComponent(roomName)}`;
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
    
    // Initialize Jitsi Meet with moderator privileges
    const domain = 'meet.jit.si';
    const options = {
        roomName: roomName,
        width: '100%',
        height: '100%',
        parentNode: jitsiMeetDiv,
        userInfo: {
            displayName: instructorName,
            email: 'instructor@evenfalladvantage.com'
        },
        configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableWelcomePage: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startAudioOnly: false,
            enableNoisyMicDetection: true,
            enableLobbyChat: false,
            disableInviteFunctions: false,
            doNotStoreRoom: false,
            enableInsecureRoomNameWarning: false
        },
        interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
                'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                'videoquality', 'filmstrip', 'feedback', 'stats', 'shortcuts',
                'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
                'security'
            ],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            DEFAULT_REMOTE_DISPLAY_NAME: 'Student'
        }
    };
    
    jitsiApi = new JitsiMeetExternalAPI(domain, options);
    
    // Event listeners for session management
    jitsiApi.addEventListener('videoConferenceJoined', (event) => {
        console.log('✅ Instructor joined session');
        
        // Apply initial settings
        if (muteOnEntryCheckbox && muteOnEntryCheckbox.checked) {
            // Mute on entry will be handled per participant
            console.log('Mute on entry enabled');
        }
    });
    
    jitsiApi.addEventListener('participantJoined', (event) => {
        console.log('👤 Participant joined:', event);
        addParticipant(event.id, event.displayName || 'Student');
        
        // Mute new participant if setting is enabled
        if (muteOnEntryCheckbox && muteOnEntryCheckbox.checked) {
            setTimeout(() => {
                // Note: Jitsi doesn't allow muting others directly via API in free version
                console.log('Would mute participant:', event.displayName);
            }, 1000);
        }
    });
    
    jitsiApi.addEventListener('participantLeft', (event) => {
        console.log('👋 Participant left:', event);
        removeParticipant(event.id);
    });
    
    jitsiApi.addEventListener('videoConferenceLeft', () => {
        console.log('🚪 Session ended');
        endSession();
    });
    
    jitsiApi.addEventListener('readyToClose', () => {
        endSession();
    });
    
    // Get initial participant list
    setTimeout(() => {
        jitsiApi.getParticipantsInfo().then(participants => {
            console.log('Initial participants:', participants);
            participants.forEach(p => {
                if (p.participantId) {
                    addParticipant(p.participantId, p.displayName || 'Student');
                }
            });
        });
    }, 2000);
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
    if (jitsiApi) {
        // Note: This requires moderator privileges
        console.log('Muting all participants');
        alert('Mute all feature requires moderator privileges. Use the Jitsi interface to mute participants.');
    }
}

function toggleLobby() {
    if (jitsiApi) {
        console.log('Toggling lobby');
        alert('Lobby feature is available in the Jitsi security settings (shield icon in toolbar).');
    }
}

function shareScreen() {
    if (jitsiApi) {
        jitsiApi.executeCommand('toggleShareScreen');
    }
}

// End Session
function endSession() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
    
    if (jitsiApi) {
        jitsiApi.dispose();
        jitsiApi = null;
    }
    
    participants.clear();
    sessionStartTime = null;
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
