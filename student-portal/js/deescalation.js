// De-Escalation Training Module
// Handles interactive scenario-based de-escalation training

// Current scenario state
let currentScenario = null;
let currentStep = null;
let emotionalMeter = 40; // 0-100%
let stepCount = 0;
let currentState = 'Distressed';

// Scenario data structure
const scenarios = {
    'lost-wristband': {
        title: 'Lost Wristband at the Gate',
        description: 'A patron claims they lost their entry wristband and wants to enter the venue.',
        initialState: 'Distressed',
        initialMeter: 40,
        steps: {
            'start': {
                state: 'Distressed',
                dialogue: "Look man, I swear I had my wristband... I think it fell off when I was in the bathroom line. My friends are already inside. I paid $180 for this ticket. You gotta let me in, please.",
                choices: [
                    {
                        text: "No wristband, no entry. Step out of line.",
                        next: 'bad-path-1-step-2',
                        meterChange: 20
                    },
                    {
                        text: "Sorry dude, rules are rules. You'll have to buy a new one or leave.",
                        next: 'mixed-path-step-2',
                        meterChange: 10
                    },
                    {
                        text: "That really sucks. Can you tell me more about where you last saw it?",
                        next: 'good-path-step-2',
                        meterChange: -10
                    },
                    {
                        text: "You smell like you've been drinking. I can't let you in like this anyway.",
                        next: 'bad-path-2-step-2',
                        meterChange: 10
                    }
                ]
            },
            'good-path-step-2': {
                state: 'Sad',
                dialogue: "Yeah... I was rushing because the opener was starting. I just wanna see my friends. They're gonna be so pissed if I miss the set.",
                choices: [
                    {
                        text: "I get it, but I can't make exceptions. Security cameras would catch me.",
                        next: 'mixed-path-step-2',
                        meterChange: 10
                    },
                    {
                        text: "Let me radio lost & found real quick. What color was the wristband?",
                        next: 'good-path-step-3',
                        meterChange: -10
                    },
                    {
                        text: "Stop whining and move along.",
                        next: 'bad-path-1-step-2',
                        meterChange: 30
                    },
                    {
                        text: "Have you been drinking a lot? You seem unsteady.",
                        next: 'bad-path-2-step-2',
                        meterChange: 10
                    }
                ]
            },
            'good-path-step-3': {
                state: 'Sad',
                dialogue: "It was orange... thank you, man. I appreciate you even checking. I don't want to cause trouble.",
                choices: [
                    {
                        text: "No problem, but hurry up—line's getting long.",
                        next: 'good-path-step-2',
                        meterChange: 10
                    },
                    {
                        text: "We can get you a replacement at guest services. I'll walk you there so you don't lose your spot.",
                        next: 'success-happy',
                        meterChange: -20
                    },
                    {
                        text: "Next time, be more careful with your stuff.",
                        next: 'mixed-path-step-2',
                        meterChange: 15
                    }
                ]
            },
            'bad-path-1-step-2': {
                state: 'Angry',
                dialogue: "Are you serious? I'm not trying to sneak in! This is bullshit! I paid good money!",
                choices: [
                    {
                        text: "Watch your language or I'll call backup.",
                        next: 'bad-path-1-step-3',
                        meterChange: 20
                    },
                    {
                        text: "I understand you're upset. Let's see if we can fix this.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -15
                    },
                    {
                        text: "Rules apply to everyone. Move along.",
                        next: 'bad-path-1-step-3',
                        meterChange: 10
                    }
                ]
            },
            'bad-path-1-step-3': {
                state: 'Angry',
                dialogue: "Backup? For what? I'm just asking to get in! You're ruining my night!",
                choices: [
                    {
                        text: "You're escalating this. Leave now.",
                        next: 'fail-very-angry',
                        meterChange: 20
                    },
                    {
                        text: "Okay, let's calm down. Tell me about the wristband.",
                        next: 'good-path-step-2',
                        meterChange: -20
                    }
                ]
            },
            'bad-path-2-step-2': {
                state: 'Faded',
                dialogue: "What? I'm fine! I've only had a couple. You're just picking on me because I lost my band.",
                choices: [
                    {
                        text: "A couple? You're slurring. I can't risk it.",
                        next: 'bad-path-2-step-3',
                        meterChange: 15
                    },
                    {
                        text: "Forget I said that. Let's focus on the wristband.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -10
                    },
                    {
                        text: "Hand over the bottle and step aside.",
                        next: 'bad-path-2-step-3',
                        meterChange: 20
                    }
                ]
            },
            'bad-path-2-step-3': {
                state: 'Angry',
                dialogue: "Slurring? I'm not drunk! Why are you accusing me? I just want in!",
                choices: [
                    {
                        text: "You're clearly altered. Policy says no entry.",
                        next: 'bad-path-2-step-4',
                        meterChange: 25
                    },
                    {
                        text: "I apologize if that came off wrong. How can I help?",
                        next: 'good-path-step-2',
                        meterChange: -25
                    }
                ]
            },
            'bad-path-2-step-4': {
                state: 'Angry',
                dialogue: "Altered? Screw this— you're the problem!",
                choices: [
                    {
                        text: "That's it. Security!",
                        next: 'fail-very-angry',
                        meterChange: 10
                    },
                    {
                        text: "I'm sorry. Let me start over. How can I help you get inside?",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -15
                    }
                ]
            },
            'mixed-path-step-2': {
                state: 'Distressed',
                dialogue: "Buy another one? Do you know how much that costs? I already paid! This isn't fair.",
                choices: [
                    {
                        text: "Life's not fair. Move or I'll move you.",
                        next: 'bad-path-1-step-2',
                        meterChange: 30
                    },
                    {
                        text: "I hear you— that's frustrating. Let me check with my supervisor quick.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -15
                    },
                    {
                        text: "Show me proof of purchase then.",
                        next: 'mixed-path-step-3-proof',
                        meterChange: 0
                    }
                ]
            },
            'mixed-path-step-3-recovery': {
                state: 'Sad',
                dialogue: "Thanks... I have the email receipt on my phone if that helps.",
                choices: [
                    {
                        text: "Email? That's not proof— anyone can fake that.",
                        next: 'bad-path-1-step-2',
                        meterChange: 30
                    },
                    {
                        text: "Great, pull it up. We can verify and get you a temp pass.",
                        next: 'success-happy',
                        meterChange: -35
                    }
                ]
            },
            'mixed-path-step-3-proof': {
                state: 'Distressed',
                dialogue: "Proof? Okay, yeah, I have the confirmation email. Let me find it...",
                choices: [
                    {
                        text: "Hurry up, you're holding up the line.",
                        next: 'bad-path-1-step-2',
                        meterChange: 20
                    },
                    {
                        text: "Take your time. I'll step aside with you so we don't block the line.",
                        next: 'success-happy',
                        meterChange: -30
                    }
                ]
            },
            'success-happy': {
                state: 'Happy',
                dialogue: "Seriously? That would be awesome. Thanks dude, you just saved my night.",
                isEnding: true,
                success: true,
                debrief: "De-escalation successful! By showing empathy, asking open questions, and offering solutions, you broke the potential loop and resolved peacefully. You demonstrated excellent active listening and problem-solving skills."
            },
            'fail-very-angry': {
                state: 'Fail',
                dialogue: "Screw you! I'm not going anywhere!",
                isEnding: true,
                success: false,
                debrief: "Escalation failure! Confrontational commands created a loop and pushed to violence. Tip: Use 'I' statements and empathy to avoid defensiveness. Focus on de-escalation techniques rather than enforcement."
            }
        }
    }
};

// State to photo mapping
const statePhotos = {
    'Distressed': '/images/de_escalation/1-Distressed.jpg',
    'Sad': '/images/de_escalation/1-Sad.jpg',
    'Angry': '/images/de_escalation/1-Angry.jpg',
    'Faded': '/images/de_escalation/1-Faded.jpg',
    'Happy': '/images/de_escalation/1-Happy.jpg',
    'Fail': '/images/de_escalation/1-Fail.jpg'
};

// Initialize de-escalation training
function startDeescalation(scenarioId) {
    currentScenario = scenarios[scenarioId];
    currentStep = 'start';
    emotionalMeter = currentScenario.initialMeter;
    stepCount = 1;
    currentState = currentScenario.initialState;
    
    // Hide menu, show training
    document.getElementById('deescalation-menu').classList.add('hidden');
    document.getElementById('deescalation-training').classList.remove('hidden');
    
    // Load first step
    loadStep(currentStep);
}

// Load a step in the scenario
function loadStep(stepId) {
    const step = currentScenario.steps[stepId];
    
    // Update state
    currentState = step.state;
    currentStep = stepId;
    
    // Update UI
    updateSubjectPhoto(step.state);
    updateSubjectDialogue(step.dialogue);
    updateEmotionalMeter();
    updateProgressIndicator();
    
    // Check if this is an ending
    if (step.isEnding) {
        setTimeout(() => showResults(step), 1000);
        return;
    }
    
    // Render choices
    renderChoices(step.choices);
}

// Update subject photo
function updateSubjectPhoto(state) {
    const img = document.getElementById('subject-image');
    const label = document.getElementById('subject-state');
    
    img.src = statePhotos[state];
    label.textContent = state;
    
    // Add animation
    img.style.opacity = '0';
    setTimeout(() => {
        img.style.transition = 'opacity 0.5s ease';
        img.style.opacity = '1';
    }, 50);
}

// Update subject dialogue
function updateSubjectDialogue(dialogue) {
    const bubble = document.getElementById('subject-dialogue');
    
    // Fade out
    bubble.style.opacity = '0';
    
    setTimeout(() => {
        bubble.textContent = dialogue;
        bubble.style.transition = 'opacity 0.5s ease';
        bubble.style.opacity = '1';
    }, 300);
}

// Update emotional meter
function updateEmotionalMeter() {
    const fill = document.getElementById('meter-fill');
    const percentage = document.getElementById('meter-percentage');
    
    // Clamp meter between 0-100
    emotionalMeter = Math.max(0, Math.min(100, emotionalMeter));
    
    fill.style.width = emotionalMeter + '%';
    percentage.textContent = emotionalMeter + '%';
}

// Update progress indicator
function updateProgressIndicator() {
    document.getElementById('current-step').textContent = stepCount;
}

// Render response choices
function renderChoices(choices) {
    const container = document.getElementById('response-choices');
    container.innerHTML = '';
    
    choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.setAttribute('data-choice', String.fromCharCode(65 + index)); // A, B, C, D
        button.textContent = choice.text;
        button.onclick = () => selectChoice(choice);
        container.appendChild(button);
    });
}

// Handle choice selection
function selectChoice(choice) {
    // Update meter
    emotionalMeter += choice.meterChange;
    stepCount++;
    
    // Check for auto-fail at 90%+
    if (emotionalMeter >= 90 && choice.next !== 'fail-very-angry') {
        // Force fail if meter too high
        loadStep('fail-very-angry');
        return;
    }
    
    // Load next step
    loadStep(choice.next);
}

// Show results screen
function showResults(step) {
    // Hide training, show results
    document.getElementById('deescalation-training').classList.add('hidden');
    document.getElementById('deescalation-results').classList.remove('hidden');
    
    // Update results
    const icon = document.getElementById('results-icon');
    const title = document.getElementById('results-title');
    const image = document.getElementById('results-image');
    const message = document.getElementById('results-message');
    const finalState = document.getElementById('final-state');
    const stepsTaken = document.getElementById('steps-taken');
    const forceAvoided = document.getElementById('force-avoided');
    
    if (step.success) {
        icon.className = 'results-icon success';
        icon.innerHTML = '<i class="fas fa-check-circle"></i>';
        title.textContent = 'De-escalation Successful!';
        forceAvoided.textContent = '100%';
    } else {
        icon.className = 'results-icon fail';
        icon.innerHTML = '<i class="fas fa-times-circle"></i>';
        title.textContent = 'Escalation Failure';
        forceAvoided.textContent = '0%';
    }
    
    image.src = statePhotos[step.state];
    message.textContent = step.debrief;
    finalState.textContent = step.state;
    stepsTaken.textContent = stepCount;
}

// Restart current scenario
function restartDeescalation() {
    // Hide results, show training
    document.getElementById('deescalation-results').classList.add('hidden');
    
    // Reset and start
    const scenarioId = Object.keys(scenarios).find(id => scenarios[id] === currentScenario);
    startDeescalation(scenarioId);
}

// Exit to scenario menu
function exitDeescalation() {
    // Hide all screens
    document.getElementById('deescalation-training').classList.add('hidden');
    document.getElementById('deescalation-results').classList.add('hidden');
    
    // Show menu
    document.getElementById('deescalation-menu').classList.remove('hidden');
    
    // Reset state
    currentScenario = null;
    currentStep = null;
    emotionalMeter = 40;
    stepCount = 0;
    currentState = 'Distressed';
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Attach click handlers to scenario cards
    const scenarioCards = document.querySelectorAll('.scenario-card');
    scenarioCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const scenarioId = card.dataset.scenario;
            if (scenarioId) {
                startDeescalation(scenarioId);
            }
        });
    });
    
    // Attach click handlers to control buttons
    const exitBtn = document.getElementById('exit-scenario-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', exitDeescalation);
    }
    
    const restartBtn = document.getElementById('restart-scenario-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', restartDeescalation);
    }
    
    const exitResultsBtn = document.getElementById('exit-results-btn');
    if (exitResultsBtn) {
        exitResultsBtn.addEventListener('click', exitDeescalation);
    }
});

// Make functions globally accessible
window.startDeescalation = startDeescalation;
window.exitDeescalation = exitDeescalation;
window.restartDeescalation = restartDeescalation;
