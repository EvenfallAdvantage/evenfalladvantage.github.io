// De-Escalation Training Module
// Handles interactive scenario-based de-escalation training

// Current scenario state
let deescalationScenario = null;
let deescalationStep = null;
let emotionalMeter = 40; // 0-100%
let stepCount = 0;
let currentState = 'Distressed';

// Audio file mapping for scenarios
const scenarioAudio = {
    'lost-wristband': {
        'start': '../audio/de_escalation/s1/S.mp3',
        'good-path-step-2': '../audio/de_escalation/s1/G2.mp3',
        'good-path-step-3': '../audio/de_escalation/s1/G3.mp3',
        'bad-path-1-step-2': '../audio/de_escalation/s1/B12.mp3',
        'bad-path-1-step-3': '../audio/de_escalation/s1/B13.mp3',
        'bad-path-2-step-2': '../audio/de_escalation/s1/B22.mp3',
        'bad-path-2-step-3': '../audio/de_escalation/s1/B23.mp3',
        'bad-path-2-step-4': '../audio/de_escalation/s1/B24.mp3',
        'mixed-path-step-2': '../audio/de_escalation/s1/M2.mp3',
        'mixed-path-step-3-recovery': '../audio/de_escalation/s1/M3R.mp3',
        'mixed-path-step-3-proof': '../audio/de_escalation/s1/M3P.mp3',
        'success-happy': '../audio/de_escalation/s1/P.mp3',
        'fail-very-angry': '../audio/de_escalation/s1/F.mp3'
    },
    'intoxicated-patron': {
        'start': '../audio/de_escalation/s2/S.mp3',
        'good-path-step-2': '../audio/de_escalation/s2/G2.mp3',
        'good-path-step-3': '../audio/de_escalation/s2/G3.mp3',
        'bad-path-1-step-2': '../audio/de_escalation/s2/B12.mp3',
        'bad-path-1-step-3': '../audio/de_escalation/s2/B13.mp3',
        'bad-path-2-step-2': '../audio/de_escalation/s2/B22.mp3',
        'bad-path-2-step-3': '../audio/de_escalation/s2/B23.mp3',
        'bad-path-2-step-4': '../audio/de_escalation/s2/B24.mp3',
        'mixed-path-step-2': '../audio/de_escalation/s2/M2.mp3',
        'mixed-path-step-3-recovery': '../audio/de_escalation/s2/M3.mp3',
        'success-happy': '../audio/de_escalation/s2/P.mp3',
        'fail-very-angry': '../audio/de_escalation/s2/F.mp3'
    }
};

// Scenario data structure
const deescalationScenarios = {
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
    },
    'intoxicated-patron': {
        title: 'Intoxicated Patron at Bar',
        description: 'A female patron has been cut off from alcohol service and is becoming confrontational.',
        initialState: 'Distressed',
        initialMeter: 45,
        steps: {
            'start': {
                state: 'Distressed',
                dialogue: "What do you mean I'm cut off? I'm fine! I've only had like... three drinks. Maybe four. I'm celebrating my birthday!",
                choices: [
                    {
                        text: "You're clearly drunk. Time to leave.",
                        next: 'bad-path-1-step-2',
                        meterChange: 25
                    },
                    {
                        text: "Ma'am, it's venue policy. You need to stop drinking now.",
                        next: 'mixed-path-step-2',
                        meterChange: 15
                    },
                    {
                        text: "Happy birthday! I understand you're celebrating. Can we get you some water?",
                        next: 'good-path-step-2',
                        meterChange: -10
                    },
                    {
                        text: "You're slurring and stumbling. You're done for the night.",
                        next: 'bad-path-2-step-2',
                        meterChange: 20
                    }
                ]
            },
            'good-path-step-2': {
                state: 'Sad',
                dialogue: "Water? I don't want water... I just wanted to have fun tonight. My friends ditched me and now you're kicking me out too?",
                choices: [
                    {
                        text: "I'm not kicking you out, just cutting you off from alcohol.",
                        next: 'mixed-path-step-2',
                        meterChange: 10
                    },
                    {
                        text: "I'm sorry your friends left. Let's get you some water and you can stay and enjoy the music.",
                        next: 'good-path-step-3',
                        meterChange: -15
                    },
                    {
                        text: "That's not my problem. You need to leave.",
                        next: 'bad-path-1-step-2',
                        meterChange: 30
                    }
                ]
            },
            'good-path-step-3': {
                state: 'Sad',
                dialogue: "Really? You'd let me stay? I just... I don't want to be alone on my birthday.",
                choices: [
                    {
                        text: "Yeah, but if you cause any trouble, you're out.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: 10
                    },
                    {
                        text: "Of course. Here's some water. Would you like me to help you find your friends?",
                        next: 'success-happy',
                        meterChange: -25
                    },
                    {
                        text: "Actually, on second thought, you should probably go home.",
                        next: 'bad-path-1-step-2',
                        meterChange: 35
                    }
                ]
            },
            'bad-path-1-step-2': {
                state: 'Angry',
                dialogue: "Drunk? You don't know me! I'm perfectly fine! This is discrimination!",
                choices: [
                    {
                        text: "It's not discrimination, it's safety. Leave now.",
                        next: 'bad-path-1-step-3',
                        meterChange: 20
                    },
                    {
                        text: "I apologize if it came across that way. Let's talk about this calmly.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -20
                    },
                    {
                        text: "Stop making a scene or I'll call the police.",
                        next: 'bad-path-1-step-3',
                        meterChange: 25
                    }
                ]
            },
            'bad-path-1-step-3': {
                state: 'Angry',
                dialogue: "The police? For what? Having a good time? This is ridiculous!",
                choices: [
                    {
                        text: "You're causing a disturbance. Security!",
                        next: 'fail-very-angry',
                        meterChange: 20
                    },
                    {
                        text: "I don't want to call them. Can we start over? What can I do to help?",
                        next: 'good-path-step-2',
                        meterChange: -25
                    }
                ]
            },
            'bad-path-2-step-2': {
                state: 'Faded',
                dialogue: "Slurring? I'm not... okay maybe a little. But it's my birthday! Can't you make an exception?",
                choices: [
                    {
                        text: "No exceptions. Policy is policy.",
                        next: 'bad-path-2-step-3',
                        meterChange: 20
                    },
                    {
                        text: "I wish I could, but I need to keep you safe. How about some water and food?",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -15
                    },
                    {
                        text: "You should have thought about that before drinking so much.",
                        next: 'bad-path-2-step-3',
                        meterChange: 25
                    }
                ]
            },
            'bad-path-2-step-3': {
                state: 'Angry',
                dialogue: "You're being so mean! I didn't do anything wrong! Why are you targeting me?",
                choices: [
                    {
                        text: "I'm not targeting you. You're intoxicated and it's time to go.",
                        next: 'bad-path-2-step-4',
                        meterChange: 20
                    },
                    {
                        text: "I'm not trying to be mean. I'm concerned about your safety. Let me help you.",
                        next: 'good-path-step-3',
                        meterChange: -20
                    }
                ]
            },
            'bad-path-2-step-4': {
                state: 'Angry',
                dialogue: "Fine! I'll leave! But I'm never coming back here!",
                choices: [
                    {
                        text: "Good. Don't let the door hit you.",
                        next: 'fail-very-angry',
                        meterChange: 15
                    },
                    {
                        text: "Wait, please. I don't want you to leave upset. Can we talk?",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -20
                    }
                ]
            },
            'mixed-path-step-2': {
                state: 'Distressed',
                dialogue: "Policy? That's such BS! I'm a paying customer! I deserve to be treated with respect!",
                choices: [
                    {
                        text: "Respect goes both ways. You're being disrespectful right now.",
                        next: 'bad-path-1-step-2',
                        meterChange: 25
                    },
                    {
                        text: "You're absolutely right. I apologize. Let me explain the policy better.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -15
                    },
                    {
                        text: "If you don't comply, you'll be escorted out.",
                        next: 'bad-path-1-step-3',
                        meterChange: 20
                    }
                ]
            },
            'mixed-path-step-3-recovery': {
                state: 'Sad',
                dialogue: "I'm sorry... I just wanted tonight to be special. Everything's going wrong.",
                choices: [
                    {
                        text: "Well, drinking more won't fix that.",
                        next: 'bad-path-1-step-2',
                        meterChange: 25
                    },
                    {
                        text: "I understand. Let's make the rest of your night better. Water, food, and you can still enjoy the show.",
                        next: 'success-happy',
                        meterChange: -30
                    }
                ]
            },
            'success-happy': {
                state: 'Happy',
                dialogue: "Thank you so much... I really appreciate you being kind. I'm sorry for getting upset.",
                isEnding: true,
                success: true,
                debrief: "De-escalation successful! By showing empathy, validating her feelings, and offering alternatives, you turned a potentially volatile situation into a positive outcome. Excellent use of active listening and compassion."
            },
            'fail-very-angry': {
                state: 'Fail',
                dialogue: "You know what? Screw this place! I'm calling my lawyer!",
                isEnding: true,
                success: false,
                debrief: "Escalation failure! Dismissive and confrontational responses escalated the situation. Remember: people under the influence need extra patience and clear, calm communication. Focus on safety and empathy, not enforcement."
            }
        }
    },
    'denied-entry-id': {
        title: 'Denied Entry - Invalid ID',
        description: 'A patron is being denied entry because his ID appears to be fake or expired.',
        initialState: 'Distressed',
        initialMeter: 40,
        steps: {
            'start': {
                state: 'Distressed',
                dialogue: "What? My ID is real! I use it everywhere! Why are you giving me a hard time?",
                choices: [
                    {
                        text: "This ID is obviously fake. Get out of here.",
                        next: 'bad-path-1-step-2',
                        meterChange: 30
                    },
                    {
                        text: "Sir, the expiration date shows this ID is no longer valid.",
                        next: 'mixed-path-step-2',
                        meterChange: 10
                    },
                    {
                        text: "I understand this is frustrating. Can I take a closer look at your ID?",
                        next: 'good-path-step-2',
                        meterChange: -10
                    },
                    {
                        text: "You trying to use a fake ID? That's illegal, you know.",
                        next: 'bad-path-2-step-2',
                        meterChange: 25
                    }
                ]
            },
            'good-path-step-2': {
                state: 'Sad',
                dialogue: "Yeah, sure... I know it's expired but it's still me! I've been meaning to renew it but I've been busy with work.",
                choices: [
                    {
                        text: "Expired is expired. Can't let you in.",
                        next: 'mixed-path-step-2',
                        meterChange: 15
                    },
                    {
                        text: "I get it, life gets busy. Do you have any other form of ID we could use?",
                        next: 'good-path-step-3',
                        meterChange: -10
                    },
                    {
                        text: "That's your problem, not mine. Step aside.",
                        next: 'bad-path-1-step-2',
                        meterChange: 30
                    }
                ]
            },
            'good-path-step-3': {
                state: 'Sad',
                dialogue: "Um... I have my work badge? It has my photo and name on it. Would that work?",
                choices: [
                    {
                        text: "A work badge? That's not a government ID. No.",
                        next: 'mixed-path-step-2',
                        meterChange: 15
                    },
                    {
                        text: "Let me check with my supervisor. If it's valid, we might be able to make an exception.",
                        next: 'good-path-step-4',
                        meterChange: -15
                    },
                    {
                        text: "Nice try, but that won't work. Leave.",
                        next: 'bad-path-1-step-2',
                        meterChange: 25
                    }
                ]
            },
            'good-path-step-4': {
                state: 'Sad',
                dialogue: "Really? Thank you! I really appreciate you trying to help me out here.",
                choices: [
                    {
                        text: "Don't thank me yet. If my supervisor says no, you're out.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: 10
                    },
                    {
                        text: "No problem. Let me verify this and we'll get you in if everything checks out.",
                        next: 'success-happy',
                        meterChange: -20
                    }
                ]
            },
            'bad-path-1-step-2': {
                state: 'Angry',
                dialogue: "Fake? Are you calling me a liar? I've had this ID for years! This is insulting!",
                choices: [
                    {
                        text: "I don't care how long you've had it. It's not getting you in tonight.",
                        next: 'bad-path-1-step-3',
                        meterChange: 20
                    },
                    {
                        text: "I apologize if that sounded accusatory. Let me explain what I'm seeing.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -15
                    },
                    {
                        text: "If you don't like it, take it up with management. Move along.",
                        next: 'bad-path-1-step-3',
                        meterChange: 25
                    }
                ]
            },
            'bad-path-1-step-3': {
                state: 'Angry',
                dialogue: "This is discrimination! I'm going to report you! What's your name?",
                choices: [
                    {
                        text: "Go ahead and report me. I'm doing my job.",
                        next: 'fail-very-angry',
                        meterChange: 20
                    },
                    {
                        text: "I'm sorry this escalated. Let's start over. I'm here to help, not fight.",
                        next: 'good-path-step-2',
                        meterChange: -25
                    }
                ]
            },
            'bad-path-2-step-2': {
                state: 'Faded',
                dialogue: "Illegal? I'm not trying to break the law! It's just expired, that's all!",
                choices: [
                    {
                        text: "Expired or fake, same difference. You're not getting in.",
                        next: 'bad-path-2-step-3',
                        meterChange: 20
                    },
                    {
                        text: "I understand. I shouldn't have said that. Let's figure this out together.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -15
                    }
                ]
            },
            'bad-path-2-step-3': {
                state: 'Angry',
                dialogue: "Same difference? That's ridiculous! I'm not a criminal!",
                choices: [
                    {
                        text: "I didn't say you were. But rules are rules.",
                        next: 'bad-path-2-step-4',
                        meterChange: 15
                    },
                    {
                        text: "You're right, I was out of line. I apologize. How can we solve this?",
                        next: 'good-path-step-2',
                        meterChange: -20
                    }
                ]
            },
            'bad-path-2-step-4': {
                state: 'Angry',
                dialogue: "Rules? You're just on a power trip! This is bullshit!",
                choices: [
                    {
                        text: "Watch your language or you're banned.",
                        next: 'fail-very-angry',
                        meterChange: 20
                    },
                    {
                        text: "I can see you're really frustrated. Let me see if there's another way.",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -20
                    }
                ]
            },
            'mixed-path-step-2': {
                state: 'Distressed',
                dialogue: "Not valid? But I'm 25! I'm clearly old enough! This is so stupid!",
                choices: [
                    {
                        text: "Stupid or not, those are the rules. Leave.",
                        next: 'bad-path-1-step-2',
                        meterChange: 30
                    },
                    {
                        text: "I hear you. Age isn't the issue - it's the expired ID. Do you have anything else?",
                        next: 'mixed-path-step-3-recovery',
                        meterChange: -10
                    },
                    {
                        text: "You should have renewed it. Not my fault.",
                        next: 'bad-path-1-step-2',
                        meterChange: 25
                    }
                ]
            },
            'mixed-path-step-3-recovery': {
                state: 'Sad',
                dialogue: "I... I have my passport in my car. Would that work? It's just a few blocks away.",
                choices: [
                    {
                        text: "By the time you get back, the line will be even longer. Your loss.",
                        next: 'bad-path-1-step-2',
                        meterChange: 25
                    },
                    {
                        text: "Absolutely! Go grab it and I'll hold your spot in line. Just show it when you get back.",
                        next: 'success-happy',
                        meterChange: -30
                    }
                ]
            },
            'success-happy': {
                state: 'Happy',
                dialogue: "Wow, thank you! I really appreciate you working with me on this. You're awesome!",
                isEnding: true,
                success: true,
                debrief: "De-escalation successful! By staying calm, showing empathy, and offering solutions, you turned a tense situation into a positive interaction. Great job using problem-solving skills and maintaining professionalism."
            },
            'fail-very-angry': {
                state: 'Fail',
                dialogue: "You know what? Forget it! I'm leaving and I'm never coming back to this dump!",
                isEnding: true,
                success: false,
                debrief: "Escalation failure! Rigid enforcement without empathy created unnecessary conflict. Remember: the goal is safety and compliance, not punishment. Use 'we' language and offer alternatives to build cooperation."
            }
        }
    }
};

// State to photo mapping by scenario
const scenarioPhotos = {
    'lost-wristband': {
        'Distressed': '/images/de_escalation/1-Distressed.jpg',
        'Sad': '/images/de_escalation/1-Sad.jpg',
        'Angry': '/images/de_escalation/1-Angry.jpg',
        'Faded': '/images/de_escalation/1-Faded.jpg',
        'Happy': '/images/de_escalation/1-Happy.jpg',
        'Fail': '/images/de_escalation/1-Fail.jpg'
    },
    'intoxicated-patron': {
        'Distressed': '/images/de_escalation/2-Distressed.jpg',
        'Sad': '/images/de_escalation/2-Sad.jpg',
        'Angry': '/images/de_escalation/2-Angry.jpg',
        'Faded': '/images/de_escalation/2-Faded.jpg',
        'Happy': '/images/de_escalation/2-Happy.jpg',
        'Fail': '/images/de_escalation/2-Fail.jpg'
    },
    'denied-entry-id': {
        'Distressed': '/images/de_escalation/3-Distressed.jpg',
        'Sad': '/images/de_escalation/3-Sad.jpg',
        'Angry': '/images/de_escalation/3-Angry.jpg',
        'Faded': '/images/de_escalation/3-Faded.jpg',
        'Happy': '/images/de_escalation/3-Happy.jpg',
        'Fail': '/images/de_escalation/3-Fail.jpg'
    }
};

// Current scenario ID
let currentScenarioId = null;

// Initialize de-escalation training
function startDeescalation(scenarioId) {
    currentScenarioId = scenarioId;
    deescalationScenario = deescalationScenarios[scenarioId];
    deescalationStep = 'start';
    emotionalMeter = deescalationScenario.initialMeter;
    stepCount = 1;
    currentState = deescalationScenario.initialState;
    
    // Update scenario title
    const titleElement = document.getElementById('scenario-title');
    if (titleElement) {
        titleElement.textContent = deescalationScenario.title;
    }
    
    // Hide menu, show training
    document.getElementById('deescalation-menu').classList.add('hidden');
    document.getElementById('deescalation-training').classList.remove('hidden');
    
    // Load first step
    loadStep(deescalationStep);
}

// Load a step in the scenario
function loadStep(stepId) {
    const step = deescalationScenario.steps[stepId];
    
    // Update state
    currentState = step.state;
    deescalationStep = stepId;
    
    // Update UI
    updateSubjectPhoto(step.state);
    updateSubjectDialogue(step.dialogue);
    updateEmotionalMeter();
    updateProgressIndicator();
    
    // Play audio for this step
    playStepAudio(stepId);
    
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
    
    // Get the correct photo for the current scenario
    const photoMap = scenarioPhotos[currentScenarioId] || scenarioPhotos['lost-wristband'];
    img.src = photoMap[state];
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

// Play audio for current step
function playStepAudio(stepId) {
    // Get audio file for this step
    const audioMap = scenarioAudio[currentScenarioId];
    if (!audioMap || !audioMap[stepId]) {
        return; // No audio for this step
    }
    
    // Stop any currently playing audio
    const existingAudio = document.getElementById('step-audio');
    if (existingAudio) {
        existingAudio.pause();
        existingAudio.remove();
    }
    
    // Create and play new audio
    const audio = document.createElement('audio');
    audio.id = 'step-audio';
    audio.src = audioMap[stepId];
    audio.style.display = 'none'; // Hide audio element
    document.body.appendChild(audio);
    
    // Play audio with slight delay for dialogue fade-in
    setTimeout(() => {
        audio.play().catch(err => {
            console.log('Audio playback failed:', err);
        });
    }, 400);
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
        
        // Save completion with step count
        const scenarioId = Object.keys(deescalationScenarios).find(id => deescalationScenarios[id] === deescalationScenario);
        
        if (scenarioId && typeof progressData !== 'undefined') {
            // Initialize scenarioResults if it doesn't exist
            if (!progressData.scenarioResults) {
                progressData.scenarioResults = {};
            }
            
            // Add to completedScenarios if not already there (do this regardless of personal best)
            if (!progressData.completedScenarios.includes(scenarioId)) {
                progressData.completedScenarios.push(scenarioId);
                console.log('📝 Added to completedScenarios');
            }
            
            // Save or update personal best (lowest step count)
            const currentBest = progressData.scenarioResults[scenarioId];
            console.log('📈 Current best for', scenarioId, ':', currentBest);
            
            if (!currentBest || stepCount < currentBest.steps) {
                progressData.scenarioResults[scenarioId] = {
                    steps: stepCount,
                    date: new Date().toISOString(),
                    success: true
                };
            } else {
                console.log('⏭️ Not a new personal best, but scenario still completed');
            }
            
            // Always save progress and update display when scenario is completed
            if (typeof saveProgress !== 'undefined') {
                saveProgress();
                console.log('💾 Progress saved to localStorage');
            }
            
            // Update progress display to reflect scenario completion
            if (typeof updateProgressDisplay !== 'undefined') {
                updateProgressDisplay();
            }
        } else {
            console.warn('⚠️ Could not save scenario result - scenarioId:', scenarioId, 'progressData available:', typeof progressData !== 'undefined');
        }
    } else {
        icon.className = 'results-icon fail';
        icon.innerHTML = '<i class="fas fa-times-circle"></i>';
        title.textContent = 'De-escalation Failure';
        forceAvoided.textContent = '0%';
    }
    
    // Get the correct photo for the current scenario
    const photoMap = scenarioPhotos[currentScenarioId] || scenarioPhotos['lost-wristband'];
    image.src = photoMap[step.state];
    message.textContent = step.debrief;
    finalState.textContent = step.state;
    stepsTaken.textContent = stepCount;
}

// Restart current scenario
function restartDeescalation() {
    // Hide results, show training
    document.getElementById('deescalation-results').classList.add('hidden');
    
    // Reset and start
    const scenarioId = Object.keys(deescalationScenarios).find(id => deescalationScenarios[id] === deescalationScenario);
    startDeescalation(scenarioId);
}

// Exit to scenario menu
function exitDeescalation() {
    // Hide all screens
    document.getElementById('deescalation-training').classList.add('hidden');
    document.getElementById('deescalation-results').classList.add('hidden');
    
    // Show menu
    document.getElementById('deescalation-menu').classList.remove('hidden');
    
    // Update scenario cards with personal bests
    updateScenarioCards();
    
    // Reset state
    deescalationScenario = null;
    deescalationStep = null;
    emotionalMeter = 40;
    stepCount = 0;
    currentState = 'Distressed';
}

// Update scenario cards with personal best scores
function updateScenarioCards() {
    // Check if progressData is available
    if (typeof progressData === 'undefined') {
        console.warn('⚠️ progressData is not defined yet, retrying in 100ms...');
        setTimeout(updateScenarioCards, 100);
        return;
    }
    
    const scenarioCards = document.querySelectorAll('.scenario-card');
    
    scenarioCards.forEach(card => {
        const scenarioId = card.getAttribute('data-scenario');
        const scenarioResults = progressData?.scenarioResults?.[scenarioId];
        console.log(`📋 Card ${scenarioId}:`, scenarioResults);
        
        // Remove existing personal best badge if any
        const existingBadge = card.querySelector('.personal-best-badge');
        if (existingBadge) {
            existingBadge.remove();
            console.log(`🗑️ Removed existing badge for ${scenarioId}`);
        }
        
        // Add personal best badge if user has completed this scenario
        if (scenarioResults && scenarioResults.success) {
            const badge = document.createElement('div');
            badge.className = 'personal-best-badge';
            badge.innerHTML = `
                <i class="fas fa-trophy"></i>
                <span>Personal Best: ${scenarioResults.steps} steps</span>
            `;
            
            // Insert after the scenario description
            const description = card.querySelector('p');
            if (description) {
                description.after(badge);
                console.log(`✅ Added badge for ${scenarioId}: ${scenarioResults.steps} steps`);
            } else {
                console.warn(`⚠️ No description element found for ${scenarioId}`);
            }
        } else {
            console.log(`⏭️ No personal best for ${scenarioId}`);
        }
    });
}

// Initialize event listeners
function initializeDeescalationListeners() {
    // Attach click handlers to scenario cards
    const scenarioCards = document.querySelectorAll('.scenario-card');
    console.log('Found scenario cards:', scenarioCards.length);
    scenarioCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const scenarioId = card.dataset.scenario;
            console.log('Scenario card clicked:', scenarioId);
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
    
    // Update scenario cards with personal bests on load
    updateScenarioCards();
}

// Initialize when DOM is ready (or immediately if already loaded)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDeescalationListeners);
} else {
    // DOM already loaded, initialize immediately
    initializeDeescalationListeners();
}

// Make functions globally accessible
window.startDeescalation = startDeescalation;
window.exitDeescalation = exitDeescalation;
window.restartDeescalation = restartDeescalation;
