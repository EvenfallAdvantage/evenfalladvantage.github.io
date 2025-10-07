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
    const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, company_name, contact_name, email')
        .in('id', Array.from(participantIds));
    
    console.log('Clients query result:', { clients, clientsError });
    
    if (clientsError) {
        console.error('Error loading clients:', clientsError);
        document.getElementById('conversationsList').innerHTML = '<p class="empty-state">Error loading client information</p>';
        return;
    }
    
    // If no clients found, they might be students (shouldn't happen but handle it)
    if (!clients || clients.length === 0) {
        console.log('No clients found - checking if participants are students');
        const { data: students } = await supabase
            .from('students')
            .select('id, first_name, last_name, email')
            .in('id', Array.from(participantIds));
        
        console.log('Students found:', students);
        
        if (!students || students.length === 0) {
            console.log('No participants found at all');
            document.getElementById('conversationsList').innerHTML = '<p class="empty-state">No messages yet</p>';
            return;
        }
    }
    
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
        const client = clients?.find(c => c.id === otherUserId);
        
        if (!client) return '';
        
        const preview = lastMessage ? lastMessage.message.substring(0, 60) + '...' : 'No messages yet';
        const timeAgo = lastMessage ? getTimeAgo(new Date(lastMessage.created_at)) : '';
        
        return `
            <div class="conversation-item ${unreadCount > 0 ? 'unread' : ''}" onclick="viewConversation('${otherUserId}', '${client.company_name}')">
                <div class="conversation-avatar">
                    <i class="fas fa-building"></i>
                </div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <h4>${client.company_name}</h4>
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
    
    // Build messages HTML
    const messagesHTML = messages.map(msg => {
        const isFromMe = msg.from_user_id === currentUser.id;
        const time = new Date(msg.created_at).toLocaleString();
        
        return `
            <div class="message ${isFromMe ? 'message-sent' : 'message-received'}">
                <div class="message-content">
                    <div class="message-header">
                        <strong>${isFromMe ? 'You' : companyName}</strong>
                        <span class="message-time">${time}</span>
                    </div>
                    <p>${msg.message}</p>
                </div>
            </div>
        `;
    }).join('');
    
    // Update message view
    const messageView = document.querySelector('.message-view');
    messageView.innerHTML = `
        <div class="conversation-header">
            <h3>${companyName}</h3>
            <button class="btn btn-small btn-primary" onclick="replyToClient('${userId}', '${companyName}')">
                <i class="fas fa-reply"></i> Reply
            </button>
        </div>
        <div class="messages-list">
            ${messagesHTML}
        </div>
    `;
    
    // Refresh conversations list to update unread counts
    await loadMessages();
}

// Reply to a client
async function replyToClient(clientId, companyName) {
    // Show compose message modal
    const modalHTML = `
        <div class="modal-overlay" id="messageModal" onclick="closeMessageModal()">
            <div class="modal-content message-modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Send Message to ${companyName}</h2>
                    <button class="close-btn" onclick="closeMessageModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="messageForm" onsubmit="sendMessage(event, '${clientId}')">
                        <div class="form-group">
                            <label for="messageSubject">Subject</label>
                            <input type="text" id="messageSubject" required placeholder="Enter subject...">
                        </div>
                        <div class="form-group">
                            <label for="messageContent">Message</label>
                            <textarea id="messageContent" rows="8" required placeholder="Type your message here..."></textarea>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="closeMessageModal()">Cancel</button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-paper-plane"></i> Send Message
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    if (modal) modal.remove();
}

async function sendMessage(event, toUserId) {
    event.preventDefault();
    
    const subject = document.getElementById('messageSubject').value;
    const message = document.getElementById('messageContent').value;
    const currentUser = await Auth.getCurrentUser();
    
    if (!currentUser) {
        alert('You must be logged in to send messages');
        return;
    }
    
    // Create or get thread
    const { data: existingThread } = await supabase
        .from('message_threads')
        .select('id')
        .or(`and(participant_1.eq.${currentUser.id},participant_2.eq.${toUserId}),and(participant_1.eq.${toUserId},participant_2.eq.${currentUser.id})`)
        .single();
    
    if (!existingThread) {
        // Create new thread
        await supabase
            .from('message_threads')
            .insert({
                participant_1: currentUser.id,
                participant_2: toUserId
            });
    }
    
    // Send message
    const { error } = await supabase
        .from('messages')
        .insert({
            from_user_id: currentUser.id,
            to_user_id: toUserId,
            subject: subject,
            message: message
        });
    
    if (error) {
        alert('Error sending message: ' + error.message);
        return;
    }
    
    alert('Message sent successfully!');
    closeMessageModal();
    
    // Refresh messages
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
window.closeMessageModal = closeMessageModal;
window.sendMessage = sendMessage;
