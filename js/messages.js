// Student Portal - Messaging System

// Load messages when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    // Wait a bit for other scripts to initialize
    setTimeout(async () => {
        const messagesSection = document.getElementById('messages');
        if (messagesSection) {
            await loadMessages();
        }
    }, 500);
});

// Load messages and conversations
async function loadMessages() {
    const currentUser = await Auth.getCurrentUser();
    if (!currentUser) {
        console.log('No current user');
        return;
    }
    
    console.log('Loading messages for student:', currentUser.id);
    
    // Get all message threads for current user
    const { data: threads, error } = await supabase
        .from('message_threads')
        .select('*')
        .or(`participant_1.eq.${currentUser.id},participant_2.eq.${currentUser.id}`)
        .order('last_message_at', { ascending: false });
    
    console.log('Threads query result:', { threads, error });
    
    if (error) {
        console.error('Error loading threads:', error);
        document.getElementById('conversationsList').innerHTML = '<p class="empty-state">Error loading messages</p>';
        return;
    }
    
    if (!threads || threads.length === 0) {
        console.log('No threads found');
        document.getElementById('conversationsList').innerHTML = '<p class="empty-state">No messages yet</p>';
        return;
    }
    
    // Get user info for all participants (clients)
    const participantIds = new Set();
    threads.forEach(thread => {
        participantIds.add(thread.participant_1);
        participantIds.add(thread.participant_2);
    });
    participantIds.delete(currentUser.id); // Remove current user
    
    // Get client info for participants
    console.log('Fetching client info for:', Array.from(participantIds));
    let { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, company_name, contact_name, email')
        .in('id', Array.from(participantIds));
    
    console.log('Clients query result:', { clients, clientsError });
    
    if (clientsError) {
        console.error('Error loading clients:', clientsError);
        document.getElementById('conversationsList').innerHTML = '<p class="empty-state">Error loading client information</p>';
        return;
    }
    
    // If no clients found, check if they're students (for testing/debugging)
    let participants = clients || [];
    if (!clients || clients.length === 0) {
        console.log('No clients found - checking if participants are students');
        const { data: students } = await supabase
            .from('students')
            .select('id, first_name, last_name, email')
            .in('id', Array.from(participantIds));
        
        console.log('Students found:', students);
        
        // Convert students to client-like format
        participants = students?.map(s => ({
            id: s.id,
            company_name: `${s.first_name} ${s.last_name}`,
            contact_name: `${s.first_name} ${s.last_name}`,
            email: s.email
        })) || [];
    }
    
    if (participants.length === 0) {
        console.log('No participants found at all');
        document.getElementById('conversationsList').innerHTML = '<p class="empty-state">No messages yet</p>';
        return;
    }
    
    console.log('Final participants:', participants);
    
    // Get last message for each thread
    const threadMessages = await Promise.all(threads.map(async (thread) => {
        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .or(`and(from_user_id.eq.${thread.participant_1},to_user_id.eq.${thread.participant_2}),and(from_user_id.eq.${thread.participant_2},to_user_id.eq.${thread.participant_1})`)
            .order('created_at', { ascending: false })
            .limit(1);
        
        const lastMessage = messages && messages.length > 0 ? messages[0] : null;
        
        // Get unread count
        const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('to_user_id', currentUser.id)
            .eq('read', false)
            .or(`from_user_id.eq.${thread.participant_1},from_user_id.eq.${thread.participant_2}`);
        
        return { thread, lastMessage, unreadCount };
    }));
    
    // Build conversations HTML
    const conversationsHTML = threadMessages.map(({ thread, lastMessage, unreadCount }) => {
        const otherUserId = thread.participant_1 === currentUser.id ? thread.participant_2 : thread.participant_1;
        const participant = participants?.find(p => p.id === otherUserId);
        
        if (!participant) {
            console.log('No participant found for user:', otherUserId);
            return '';
        }
        
        const preview = lastMessage ? lastMessage.message.substring(0, 60) + '...' : 'No messages yet';
        const timeAgo = lastMessage ? getTimeAgo(new Date(lastMessage.created_at)) : '';
        
        return `
            <div class="conversation-item ${unreadCount > 0 ? 'unread' : ''}" onclick="viewConversation('${otherUserId}', '${participant.company_name}')">
                <div class="conversation-avatar">
                    <i class="fas fa-building"></i>
                </div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <h4>${participant.company_name}</h4>
                        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                    </div>
                    <p class="conversation-preview">${preview}</p>
                    <span class="conversation-time">${timeAgo}</span>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('conversationsList').innerHTML = conversationsHTML || '<p class="empty-state">No messages yet</p>';
}

// View conversation with a specific user
async function viewConversation(userId, companyName) {
    const currentUser = await Auth.getCurrentUser();
    if (!currentUser) return;
    
    // Get all messages in this conversation
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(from_user_id.eq.${currentUser.id},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('Error loading messages:', error);
        return;
    }
    
    // Mark messages as read
    await supabase
        .from('messages')
        .update({ read: true })
        .eq('to_user_id', currentUser.id)
        .eq('from_user_id', userId);
    
    // Store current conversation
    currentConversationUserId = userId;
    currentConversationUserName = companyName;
    
    // Build messages HTML
    const messagesHTML = messages.map(msg => {
        const isFromMe = msg.from_user_id === currentUser.id;
        const time = new Date(msg.created_at);
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="message-bubble ${isFromMe ? 'sent' : 'received'}">
                <div class="bubble-content">
                    ${msg.message}
                </div>
                <div class="bubble-time">${timeStr}</div>
            </div>
        `;
    }).join('');
    
    // Update message view
    const messageView = document.querySelector('.message-view');
    messageView.innerHTML = `
        <div class="conversation-header">
            <div class="conversation-header-info">
                <div class="conversation-avatar">
                    <i class="fas fa-building"></i>
                </div>
                <h3>${companyName}</h3>
            </div>
        </div>
        <div class="messages-list" id="messagesList">
            ${messagesHTML || '<p class="empty-state">No messages yet. Start the conversation!</p>'}
        </div>
        <div class="message-input-container">
            <input type="text" id="messageInput" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendMessageInline()">
            <button class="btn btn-primary send-btn" onclick="sendMessageInline()">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    `;
    
    // Scroll to bottom
    setTimeout(() => {
        const messagesList = document.getElementById('messagesList');
        if (messagesList) {
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    }, 100);
    
    // Refresh conversations list to update unread counts
    await loadMessages();
}

// Store current conversation
let currentConversationUserId = null;
let currentConversationUserName = null;

// Reply to a client (now just opens the conversation)
async function replyToClient(clientId, companyName) {
    await viewConversation(clientId, companyName);
}

// Send message from inline input
async function sendMessageInline() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message || !currentConversationUserId) return;
    
    const currentUser = await Auth.getCurrentUser();
    if (!currentUser) {
        alert('You must be logged in to send messages');
        return;
    }
    
    // Disable input while sending
    messageInput.disabled = true;
    
    // Create or get thread
    const { data: existingThread } = await supabase
        .from('message_threads')
        .select('id')
        .or(`and(participant_1.eq.${currentUser.id},participant_2.eq.${currentConversationUserId}),and(participant_1.eq.${currentConversationUserId},participant_2.eq.${currentUser.id})`)
        .maybeSingle();
    
    if (!existingThread) {
        // Create new thread
        await supabase
            .from('message_threads')
            .insert({
                participant_1: currentUser.id,
                participant_2: currentConversationUserId
            });
    }
    
    // Send message
    const { error } = await supabase
        .from('messages')
        .insert({
            from_user_id: currentUser.id,
            to_user_id: currentConversationUserId,
            subject: 'Direct Message',
            message: message
        });
    
    if (error) {
        alert('Error sending message: ' + error.message);
        messageInput.disabled = false;
        return;
    }
    
    // Clear input
    messageInput.value = '';
    messageInput.disabled = false;
    messageInput.focus();
    
    // Reload conversation to show new message
    await viewConversation(currentConversationUserId, currentConversationUserName);
    
    // Refresh conversations list
    await loadMessages();
}

// Helper function to get time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString();
}

// Export functions
window.loadMessages = loadMessages;
window.viewConversation = viewConversation;
window.replyToClient = replyToClient;
window.sendMessageInline = sendMessageInline;
