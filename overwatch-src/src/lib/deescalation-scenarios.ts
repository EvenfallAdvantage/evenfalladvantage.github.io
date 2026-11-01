export type Choice = {
  text: string;
  next: string;
  meterChange: number;
};

export type Step = {
  state: string;
  dialogue: string;
  choices?: Choice[];
  isEnding?: boolean;
  success?: boolean;
  debrief?: string;
};

export type Scenario = {
  id: string;
  title: string;
  description: string;
  initialState: string;
  initialMeter: number;
  subjectId: number | null;
  /** Optional content note shown on the card and confirmed before the scenario starts. */
  contentNote?: string;
  audioMap: Record<string, string>;
  steps: Record<string, Step>;
};

const AUDIO_BASE = "/audio/de_escalation";
const IMAGE_BASE = "/images/de_escalation";

export function getSubjectImage(subjectId: number | null, state: string): string | null {
  if (!subjectId) return null;
  return `${IMAGE_BASE}/${subjectId}-${state}.jpg`;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "lost-wristband",
    title: "Lost Wristband at the Gate",
    description: "A patron claims they lost their entry wristband and wants to enter the venue.",
    initialState: "Distressed",
    initialMeter: 40,
    subjectId: 1,
    audioMap: {
      "start": `${AUDIO_BASE}/s1/S.mp3`,
      "good-path-step-2": `${AUDIO_BASE}/s1/G2.mp3`,
      "good-path-step-3": `${AUDIO_BASE}/s1/G3.mp3`,
      "bad-path-1-step-2": `${AUDIO_BASE}/s1/B12.mp3`,
      "bad-path-1-step-3": `${AUDIO_BASE}/s1/B13.mp3`,
      "bad-path-2-step-2": `${AUDIO_BASE}/s1/B22.mp3`,
      "bad-path-2-step-3": `${AUDIO_BASE}/s1/B23.mp3`,
      "bad-path-2-step-4": `${AUDIO_BASE}/s1/B24.mp3`,
      "mixed-path-step-2": `${AUDIO_BASE}/s1/M2.mp3`,
      "mixed-path-step-3-recovery": `${AUDIO_BASE}/s1/M3R.mp3`,
      "mixed-path-step-3-proof": `${AUDIO_BASE}/s1/M3P.mp3`,
      "success-happy": `${AUDIO_BASE}/s1/P.mp3`,
      "fail-very-angry": `${AUDIO_BASE}/s1/F.mp3`,
    },
    steps: {
      start: {
        state: "Distressed",
        dialogue: "Look man, I swear I had my wristband... I think it fell off when I was in the bathroom line. My friends are already inside. I paid $180 for this ticket. You gotta let me in, please.",
        choices: [
          { text: "No wristband, no entry. Step out of line.", next: "bad-path-1-step-2", meterChange: 20 },
          { text: "Sorry dude, rules are rules. You'll have to buy a new one or leave.", next: "mixed-path-step-2", meterChange: 10 },
          { text: "That really sucks. Can you tell me more about where you last saw it?", next: "good-path-step-2", meterChange: -10 },
          { text: "You smell like you've been drinking. I can't let you in like this anyway.", next: "bad-path-2-step-2", meterChange: 10 },
        ],
      },
      "good-path-step-2": {
        state: "Sad",
        dialogue: "Yeah... I was rushing because the opener was starting. I just wanna see my friends. They're gonna be so pissed if I miss the set.",
        choices: [
          { text: "I get it, but I can't make exceptions. Security cameras would catch me.", next: "mixed-path-step-2", meterChange: 10 },
          { text: "Let me radio lost & found real quick. What color was the wristband?", next: "good-path-step-3", meterChange: -10 },
          { text: "Stop whining and move along.", next: "bad-path-1-step-2", meterChange: 30 },
          { text: "Have you been drinking a lot? You seem unsteady.", next: "bad-path-2-step-2", meterChange: 10 },
        ],
      },
      "good-path-step-3": {
        state: "Sad",
        dialogue: "It was orange... thank you, man. I appreciate you even checking. I don't want to cause trouble.",
        choices: [
          { text: "No problem, but hurry up—line's getting long.", next: "good-path-step-2", meterChange: 10 },
          { text: "We can get you a replacement at guest services. I'll walk you there so you don't lose your spot.", next: "success-happy", meterChange: -20 },
          { text: "Next time, be more careful with your stuff.", next: "mixed-path-step-2", meterChange: 15 },
        ],
      },
      "bad-path-1-step-2": {
        state: "Angry",
        dialogue: "Are you serious? I'm not trying to sneak in! This is bullshit! I paid good money!",
        choices: [
          { text: "Watch your language or I'll call backup.", next: "bad-path-1-step-3", meterChange: 20 },
          { text: "I understand you're upset. Let's see if we can fix this.", next: "mixed-path-step-3-recovery", meterChange: -15 },
          { text: "Rules apply to everyone. Move along.", next: "bad-path-1-step-3", meterChange: 10 },
        ],
      },
      "bad-path-1-step-3": {
        state: "Angry",
        dialogue: "Backup? For what? I'm just asking to get in! You're ruining my night!",
        choices: [
          { text: "You're escalating this. Leave now.", next: "fail-very-angry", meterChange: 20 },
          { text: "Okay, let's calm down. Tell me about the wristband.", next: "good-path-step-2", meterChange: -20 },
        ],
      },
      "bad-path-2-step-2": {
        state: "Faded",
        dialogue: "What? I'm fine! I've only had a couple. You're just picking on me because I lost my band.",
        choices: [
          { text: "A couple? You're slurring. I can't risk it.", next: "bad-path-2-step-3", meterChange: 15 },
          { text: "Forget I said that. Let's focus on the wristband.", next: "mixed-path-step-3-recovery", meterChange: -10 },
          { text: "Hand over the bottle and step aside.", next: "bad-path-2-step-3", meterChange: 20 },
        ],
      },
      "bad-path-2-step-3": {
        state: "Angry",
        dialogue: "Slurring? I'm not drunk! Why are you accusing me? I just want in!",
        choices: [
          { text: "You're clearly altered. Policy says no entry.", next: "bad-path-2-step-4", meterChange: 25 },
          { text: "I apologize if that came off wrong. How can I help?", next: "good-path-step-2", meterChange: -25 },
        ],
      },
      "bad-path-2-step-4": {
        state: "Angry",
        dialogue: "Altered? Screw this— you're the problem!",
        choices: [
          { text: "That's it. Security!", next: "fail-very-angry", meterChange: 10 },
          { text: "I'm sorry. Let me start over. How can I help you get inside?", next: "mixed-path-step-3-recovery", meterChange: -15 },
        ],
      },
      "mixed-path-step-2": {
        state: "Distressed",
        dialogue: "Buy another one? Do you know how much that costs? I already paid! This isn't fair.",
        choices: [
          { text: "Life's not fair. Move or I'll move you.", next: "bad-path-1-step-2", meterChange: 30 },
          { text: "I hear you— that's frustrating. Let me check with my supervisor quick.", next: "mixed-path-step-3-recovery", meterChange: -15 },
          { text: "Show me proof of purchase then.", next: "mixed-path-step-3-proof", meterChange: 0 },
        ],
      },
      "mixed-path-step-3-recovery": {
        state: "Sad",
        dialogue: "Thanks... I have the email receipt on my phone if that helps.",
        choices: [
          { text: "Email? That's not proof— anyone can fake that.", next: "bad-path-1-step-2", meterChange: 30 },
          { text: "Great, pull it up. We can verify and get you a temp pass.", next: "success-happy", meterChange: -35 },
        ],
      },
      "mixed-path-step-3-proof": {
        state: "Distressed",
        dialogue: "Proof? Okay, yeah, I have the confirmation email. Let me find it...",
        choices: [
          { text: "Hurry up, you're holding up the line.", next: "bad-path-1-step-2", meterChange: 20 },
          { text: "Take your time. I'll step aside with you so we don't block the line.", next: "success-happy", meterChange: -30 },
        ],
      },
      "success-happy": {
        state: "Happy", dialogue: "Seriously? That would be awesome. Thanks dude, you just saved my night.",
        isEnding: true, success: true,
        debrief: "De-escalation successful! By showing empathy, asking open questions, and offering solutions, you broke the potential loop and resolved peacefully. You demonstrated excellent active listening and problem-solving skills.",
      },
      "fail-very-angry": {
        state: "Fail", dialogue: "Screw you! I'm not going anywhere!",
        isEnding: true, success: false,
        debrief: "Escalation failure! Confrontational commands created a loop and pushed to violence. Tip: Use 'I' statements and empathy to avoid defensiveness. Focus on de-escalation techniques rather than enforcement.",
      },
    },
  },
  {
    id: "intoxicated-patron",
    title: "Intoxicated Patron at Bar",
    description: "A female patron has been cut off from alcohol service and is becoming confrontational.",
    initialState: "Distressed",
    initialMeter: 45,
    subjectId: 2,
    audioMap: {
      "start": `${AUDIO_BASE}/s2/S.mp3`,
      "good-path-step-2": `${AUDIO_BASE}/s2/G2.mp3`,
      "good-path-step-3": `${AUDIO_BASE}/s2/G3.mp3`,
      "bad-path-1-step-2": `${AUDIO_BASE}/s2/B12.mp3`,
      "bad-path-1-step-3": `${AUDIO_BASE}/s2/B13.mp3`,
      "bad-path-2-step-2": `${AUDIO_BASE}/s2/B22.mp3`,
      "bad-path-2-step-3": `${AUDIO_BASE}/s2/B23.mp3`,
      "bad-path-2-step-4": `${AUDIO_BASE}/s2/B24.mp3`,
      "mixed-path-step-2": `${AUDIO_BASE}/s2/M2.mp3`,
      "mixed-path-step-3-recovery": `${AUDIO_BASE}/s2/M3.mp3`,
      "success-happy": `${AUDIO_BASE}/s2/P.mp3`,
      "fail-very-angry": `${AUDIO_BASE}/s2/F.mp3`,
    },
    steps: {
      start: {
        state: "Distressed",
        dialogue: "What do you mean I'm cut off? I'm fine! I've only had like... three drinks. Maybe four. I'm celebrating my birthday!",
        choices: [
          { text: "You're clearly drunk. Time to leave.", next: "bad-path-1-step-2", meterChange: 25 },
          { text: "Ma'am, it's venue policy. You need to stop drinking now.", next: "mixed-path-step-2", meterChange: 15 },
          { text: "Happy birthday! I understand you're celebrating. Can we get you some water?", next: "good-path-step-2", meterChange: -10 },
          { text: "You're slurring and stumbling. You're done for the night.", next: "bad-path-2-step-2", meterChange: 20 },
        ],
      },
      "good-path-step-2": {
        state: "Sad",
        dialogue: "Water? I don't want water... I just wanted to have fun tonight. My friends ditched me and now you're kicking me out too?",
        choices: [
          { text: "I'm not kicking you out, just cutting you off from alcohol.", next: "mixed-path-step-2", meterChange: 10 },
          { text: "I'm sorry your friends left. Let's get you some water and you can stay and enjoy the music.", next: "good-path-step-3", meterChange: -15 },
          { text: "That's not my problem. You need to leave.", next: "bad-path-1-step-2", meterChange: 30 },
        ],
      },
      "good-path-step-3": {
        state: "Sad",
        dialogue: "Really? You'd let me stay? I just... I don't want to be alone on my birthday.",
        choices: [
          { text: "Yeah, but if you cause any trouble, you're out.", next: "mixed-path-step-3-recovery", meterChange: 10 },
          { text: "Of course. Here's some water. Would you like me to help you find your friends?", next: "success-happy", meterChange: -25 },
          { text: "Actually, on second thought, you should probably go home.", next: "bad-path-1-step-2", meterChange: 35 },
        ],
      },
      "bad-path-1-step-2": {
        state: "Angry",
        dialogue: "Drunk? You don't know me! I'm perfectly fine! This is discrimination!",
        choices: [
          { text: "It's not discrimination, it's safety. Leave now.", next: "bad-path-1-step-3", meterChange: 20 },
          { text: "I apologize if it came across that way. Let's talk about this calmly.", next: "mixed-path-step-3-recovery", meterChange: -20 },
          { text: "Stop making a scene or I'll call the police.", next: "bad-path-1-step-3", meterChange: 25 },
        ],
      },
      "bad-path-1-step-3": {
        state: "Angry",
        dialogue: "The police? For what? Having a good time? This is ridiculous!",
        choices: [
          { text: "You're causing a disturbance. Security!", next: "fail-very-angry", meterChange: 20 },
          { text: "I don't want to call them. Can we start over? What can I do to help?", next: "good-path-step-2", meterChange: -25 },
        ],
      },
      "bad-path-2-step-2": {
        state: "Faded",
        dialogue: "Slurring? I'm not... okay maybe a little. But it's my birthday! Can't you make an exception?",
        choices: [
          { text: "No exceptions. Policy is policy.", next: "bad-path-2-step-3", meterChange: 20 },
          { text: "I wish I could, but I need to keep you safe. How about some water and food?", next: "mixed-path-step-3-recovery", meterChange: -15 },
          { text: "You should have thought about that before drinking so much.", next: "bad-path-2-step-3", meterChange: 25 },
        ],
      },
      "bad-path-2-step-3": {
        state: "Angry",
        dialogue: "You're being so mean! I didn't do anything wrong! Why are you targeting me?",
        choices: [
          { text: "I'm not targeting you. You're intoxicated and it's time to go.", next: "bad-path-2-step-4", meterChange: 20 },
          { text: "I'm not trying to be mean. I'm concerned about your safety. Let me help you.", next: "good-path-step-3", meterChange: -20 },
        ],
      },
      "bad-path-2-step-4": {
        state: "Angry",
        dialogue: "Fine! I'll leave! But I'm never coming back here!",
        choices: [
          { text: "Good. Don't let the door hit you.", next: "fail-very-angry", meterChange: 15 },
          { text: "Wait, please. I don't want you to leave upset. Can we talk?", next: "mixed-path-step-3-recovery", meterChange: -20 },
        ],
      },
      "mixed-path-step-2": {
        state: "Distressed",
        dialogue: "Policy? That's such BS! I'm a paying customer! I deserve to be treated with respect!",
        choices: [
          { text: "Respect goes both ways. You're being disrespectful right now.", next: "bad-path-1-step-2", meterChange: 25 },
          { text: "You're absolutely right. I apologize. Let me explain the policy better.", next: "mixed-path-step-3-recovery", meterChange: -15 },
          { text: "If you don't comply, you'll be escorted out.", next: "bad-path-1-step-3", meterChange: 20 },
        ],
      },
      "mixed-path-step-3-recovery": {
        state: "Sad",
        dialogue: "I'm sorry... I just wanted tonight to be special. Everything's going wrong.",
        choices: [
          { text: "Well, drinking more won't fix that.", next: "bad-path-1-step-2", meterChange: 25 },
          { text: "I understand. Let's make the rest of your night better. Water, food, and you can still enjoy the show.", next: "success-happy", meterChange: -30 },
        ],
      },
      "success-happy": {
        state: "Happy", dialogue: "Thank you so much... I really appreciate you being kind. I'm sorry for getting upset.",
        isEnding: true, success: true,
        debrief: "De-escalation successful! By showing empathy, validating her feelings, and offering alternatives, you turned a potentially volatile situation into a positive outcome. Excellent use of active listening and compassion.",
      },
      "fail-very-angry": {
        state: "Fail", dialogue: "You know what? Screw this place! I'm calling my lawyer!",
        isEnding: true, success: false,
        debrief: "Escalation failure! Dismissive and confrontational responses escalated the situation. Remember: people under the influence need extra patience and clear, calm communication. Focus on safety and empathy, not enforcement.",
      },
    },
  },
  {
    id: "denied-entry-id",
    title: "Denied Entry - Invalid ID",
    description: "A patron is being denied entry because his ID appears to be fake or expired.",
    initialState: "Distressed",
    initialMeter: 40,
    subjectId: 3,
    audioMap: {
      "start": `${AUDIO_BASE}/s3/S.mp3`,
      "good-path-step-2": `${AUDIO_BASE}/s3/G2.mp3`,
      "good-path-step-3": `${AUDIO_BASE}/s3/G3.mp3`,
      "good-path-step-4": `${AUDIO_BASE}/s3/G4.mp3`,
      "bad-path-1-step-2": `${AUDIO_BASE}/s3/B12.mp3`,
      "bad-path-1-step-3": `${AUDIO_BASE}/s3/B13.mp3`,
      "bad-path-2-step-2": `${AUDIO_BASE}/s3/B22.mp3`,
      "bad-path-2-step-3": `${AUDIO_BASE}/s3/B23.mp3`,
      "bad-path-2-step-4": `${AUDIO_BASE}/s3/B24.mp3`,
      "mixed-path-step-2": `${AUDIO_BASE}/s3/M2.mp3`,
      "mixed-path-step-3-recovery": `${AUDIO_BASE}/s3/M3R.mp3`,
      "success-happy": `${AUDIO_BASE}/s3/P.mp3`,
      "fail-very-angry": `${AUDIO_BASE}/s3/F.mp3`,
    },
    steps: {
      start: {
        state: "Distressed",
        dialogue: "What? My ID is real! I use it everywhere! Why are you giving me a hard time?",
        choices: [
          { text: "This ID is obviously fake. Get out of here.", next: "bad-path-1-step-2", meterChange: 30 },
          { text: "Sir, the expiration date shows this ID is no longer valid.", next: "mixed-path-step-2", meterChange: 10 },
          { text: "I understand this is frustrating. Can I take a closer look at your ID?", next: "good-path-step-2", meterChange: -10 },
          { text: "You trying to use a fake ID? That's illegal, you know.", next: "bad-path-2-step-2", meterChange: 25 },
        ],
      },
      "good-path-step-2": {
        state: "Sad",
        dialogue: "Yeah, sure... I know it's expired but it's still me! I've been meaning to renew it but I've been busy with work.",
        choices: [
          { text: "Expired is expired. Can't let you in.", next: "mixed-path-step-2", meterChange: 15 },
          { text: "I get it, life gets busy. Do you have any other form of ID we could use?", next: "good-path-step-3", meterChange: -10 },
          { text: "That's your problem, not mine. Step aside.", next: "bad-path-1-step-2", meterChange: 30 },
        ],
      },
      "good-path-step-3": {
        state: "Sad",
        dialogue: "Um... I have my work badge? It has my photo and name on it. Would that work?",
        choices: [
          { text: "A work badge? That's not a government ID. No.", next: "mixed-path-step-2", meterChange: 15 },
          { text: "Let me check with my supervisor. If it's valid, we might be able to make an exception.", next: "good-path-step-4", meterChange: -15 },
          { text: "Nice try, but that won't work. Leave.", next: "bad-path-1-step-2", meterChange: 25 },
        ],
      },
      "good-path-step-4": {
        state: "Sad",
        dialogue: "Really? Thank you! I really appreciate you trying to help me out here.",
        choices: [
          { text: "Don't thank me yet. If my supervisor says no, you're out.", next: "mixed-path-step-3-recovery", meterChange: 10 },
          { text: "No problem. Let me verify this and we'll get you in if everything checks out.", next: "success-happy", meterChange: -20 },
        ],
      },
      "bad-path-1-step-2": {
        state: "Angry",
        dialogue: "Fake? Are you calling me a liar? I've had this ID for years! This is insulting!",
        choices: [
          { text: "I don't care how long you've had it. It's not getting you in tonight.", next: "bad-path-1-step-3", meterChange: 20 },
          { text: "I apologize if that sounded accusatory. Let me explain what I'm seeing.", next: "mixed-path-step-3-recovery", meterChange: -15 },
          { text: "If you don't like it, take it up with management. Move along.", next: "bad-path-1-step-3", meterChange: 25 },
        ],
      },
      "bad-path-1-step-3": {
        state: "Angry",
        dialogue: "This is discrimination! I'm going to report you! What's your name?",
        choices: [
          { text: "Go ahead and report me. I'm doing my job.", next: "fail-very-angry", meterChange: 20 },
          { text: "I'm sorry this escalated. Let's start over. I'm here to help, not fight.", next: "good-path-step-2", meterChange: -25 },
        ],
      },
      "bad-path-2-step-2": {
        state: "Faded",
        dialogue: "Illegal? I'm not trying to break the law! It's just expired, that's all!",
        choices: [
          { text: "Expired or fake, same difference. You're not getting in.", next: "bad-path-2-step-3", meterChange: 20 },
          { text: "I understand. I shouldn't have said that. Let's figure this out together.", next: "mixed-path-step-3-recovery", meterChange: -15 },
        ],
      },
      "bad-path-2-step-3": {
        state: "Angry",
        dialogue: "Same difference? That's ridiculous! I'm not a criminal!",
        choices: [
          { text: "I didn't say you were. But rules are rules.", next: "bad-path-2-step-4", meterChange: 15 },
          { text: "You're right, I was out of line. I apologize. How can we solve this?", next: "good-path-step-2", meterChange: -20 },
        ],
      },
      "bad-path-2-step-4": {
        state: "Angry",
        dialogue: "Rules? You're just on a power trip! This is bullshit!",
        choices: [
          { text: "Watch your language or you're banned.", next: "fail-very-angry", meterChange: 20 },
          { text: "I can see you're really frustrated. Let me see if there's another way.", next: "mixed-path-step-3-recovery", meterChange: -20 },
        ],
      },
      "mixed-path-step-2": {
        state: "Distressed",
        dialogue: "Not valid? But I'm 25! I'm clearly old enough! This is so stupid!",
        choices: [
          { text: "Stupid or not, those are the rules. Leave.", next: "bad-path-1-step-2", meterChange: 30 },
          { text: "I hear you. Age isn't the issue - it's the expired ID. Do you have anything else?", next: "mixed-path-step-3-recovery", meterChange: -10 },
          { text: "You should have renewed it. Not my fault.", next: "bad-path-1-step-2", meterChange: 25 },
        ],
      },
      "mixed-path-step-3-recovery": {
        state: "Sad",
        dialogue: "I... I have my passport in my car. Would that work? It's just a few blocks away.",
        choices: [
          { text: "By the time you get back, the line will be even longer. Your loss.", next: "bad-path-1-step-2", meterChange: 25 },
          { text: "Absolutely! Go grab it and I'll hold your spot in line. Just show it when you get back.", next: "success-happy", meterChange: -30 },
        ],
      },
      "success-happy": {
        state: "Happy", dialogue: "Wow, thank you! I really appreciate you working with me on this. You're awesome!",
        isEnding: true, success: true,
        debrief: "De-escalation successful! By staying calm, showing empathy, and offering solutions, you turned a tense situation into a positive interaction. Great job using problem-solving skills and maintaining professionalism.",
      },
      "fail-very-angry": {
        state: "Fail", dialogue: "You know what? Forget it! I'm leaving and I'm never coming back to this dump!",
        isEnding: true, success: false,
        debrief: "Escalation failure! Rigid enforcement without empathy created unnecessary conflict. Remember: the goal is safety and compliance, not punishment. Use 'we' language and offer alternatives to build cooperation.",
      },
    },
  },
  {
    id: "assault-disclosure",
    title: "Guest Discloses a Sexual Assault",
    description: "A shaken guest approaches you near the restrooms and says someone touched her without consent and she doesn't know what to do.",
    initialState: "Distressed",
    initialMeter: 50,
    subjectId: 4,
    contentNote: "Content note: this scenario involves a guest disclosing unwanted sexual touching. It focuses on a supportive first response. If you need support, RAINN is available 24/7 at 800-656-HOPE (4673).",
    audioMap: {
      "start": `${AUDIO_BASE}/s4/S.mp3`,
      "good-path-step-2": `${AUDIO_BASE}/s4/G2.mp3`,
      "good-path-step-3": `${AUDIO_BASE}/s4/G3.mp3`,
      "good-path-step-4": `${AUDIO_BASE}/s4/G4.mp3`,
      "bad-path-1-step-2": `${AUDIO_BASE}/s4/B12.mp3`,
      "bad-path-1-step-3": `${AUDIO_BASE}/s4/B13.mp3`,
      "bad-path-2-step-2": `${AUDIO_BASE}/s4/B22.mp3`,
      "bad-path-2-step-3": `${AUDIO_BASE}/s4/B23.mp3`,
      "mixed-path-step-2": `${AUDIO_BASE}/s4/M2.mp3`,
      "mixed-path-step-3-recovery": `${AUDIO_BASE}/s4/M3R.mp3`,
      "success-happy": `${AUDIO_BASE}/s4/P.mp3`,
      "fail-very-angry": `${AUDIO_BASE}/s4/F.mp3`,
    },
    steps: {
      start: {
        state: "Distressed",
        dialogue: "Excuse me... um, someone in the crowd, he grabbed me. Like, under my skirt. I don't... I don't know what to do.",
        choices: [
          { text: "I'm really sorry that happened. I believe you. Let's step over somewhere quieter where you're safe. Is that okay?", next: "good-path-step-2", meterChange: -15 },
          { text: "Okay, which guy? Point him out. What exactly did he do?", next: "mixed-path-step-2", meterChange: 10 },
          { text: "Are you sure? It's packed in there, people bump into each other all the time.", next: "bad-path-1-step-2", meterChange: 25 },
          { text: "How much have you had to drink tonight?", next: "bad-path-2-step-2", meterChange: 25 },
        ],
      },
      "good-path-step-2": {
        state: "Sad",
        dialogue: "Yeah... okay. Thank you. I just feel so stupid. I should have stayed with my friends.",
        choices: [
          { text: "You didn't do anything wrong. This is not your fault. Are you hurt anywhere, or do you feel safe right now?", next: "good-path-step-3", meterChange: -15 },
          { text: "Yeah, it's always smarter to stick with your group.", next: "bad-path-2-step-2", meterChange: 20 },
          { text: "Let's not worry about that. Walk me through everything from the start.", next: "mixed-path-step-2", meterChange: 10 },
        ],
      },
      "good-path-step-3": {
        state: "Sad",
        dialogue: "I'm not hurt, I think. I just want my friend Jess. And I don't want to see him again.",
        choices: [
          { text: "We can get Jess here. You can decide what happens next: I can bring in my supervisor, our medical team, or police if you want, and I have a 24/7 support line, 800-656-HOPE. None of it is required.", next: "good-path-step-4", meterChange: -20 },
          { text: "I need to call the police either way, so just wait here.", next: "mixed-path-step-3-recovery", meterChange: 15 },
          { text: "If you're not hurt, you're probably fine to head back in with your friend.", next: "bad-path-1-step-3", meterChange: 20 },
        ],
      },
      "good-path-step-4": {
        state: "Sad",
        dialogue: "Can you... can you just get Jess, and maybe tell someone so he doesn't do it to anyone else? I'm not sure about police yet.",
        choices: [
          { text: "Absolutely. I'll stay with you, radio for Jess and my supervisor, and pass on a description so our team can watch for him. Police stays your choice, now or later.", next: "success-happy", meterChange: -25 },
          { text: "Without a police report there's not much we can do about him.", next: "mixed-path-step-3-recovery", meterChange: 15 },
        ],
      },
      "bad-path-1-step-2": {
        state: "Angry",
        dialogue: "Bumped? He put his hand up my skirt! I knew nobody would take this seriously.",
        choices: [
          { text: "Look, I can't do anything about something I didn't see.", next: "bad-path-1-step-3", meterChange: 20 },
          { text: "You're right, I'm sorry. That was the wrong thing to say. I believe you, and I want to help.", next: "mixed-path-step-3-recovery", meterChange: -20 },
        ],
      },
      "bad-path-1-step-3": {
        state: "Faded",
        dialogue: "...Forget it. It doesn't matter. I'll just go.",
        choices: [
          { text: "Okay, take care of yourself.", next: "fail-very-angry", meterChange: 25 },
          { text: "Please wait. It does matter, and I'm sorry I made you feel otherwise. Can I get you somewhere safe and call your friend?", next: "mixed-path-step-3-recovery", meterChange: -20 },
        ],
      },
      "bad-path-2-step-2": {
        state: "Angry",
        dialogue: "What does that have to do with anything? So it's my fault now?",
        choices: [
          { text: "I'm just saying it affects what people remember.", next: "bad-path-2-step-3", meterChange: 20 },
          { text: "No, it's not your fault, no matter what. I'm sorry. Let's get you somewhere safe.", next: "mixed-path-step-3-recovery", meterChange: -15 },
        ],
      },
      "bad-path-2-step-3": {
        state: "Faded",
        dialogue: "Wow. I can't believe this. I'm done.",
        choices: [
          { text: "Your call. Let me know if you see him again.", next: "fail-very-angry", meterChange: 20 },
          { text: "I was wrong to say that. You deserve support. Can I stay with you and get my supervisor?", next: "mixed-path-step-3-recovery", meterChange: -20 },
        ],
      },
      "mixed-path-step-2": {
        state: "Distressed",
        dialogue: "I... I don't know, it was dark, it happened so fast. Why are you asking me all this?",
        choices: [
          { text: "You don't have to give me details. I'm sorry for pushing. What do you need right now?", next: "mixed-path-step-3-recovery", meterChange: -15 },
          { text: "If you can't describe him, how am I supposed to find him?", next: "bad-path-1-step-2", meterChange: 20 },
        ],
      },
      "mixed-path-step-3-recovery": {
        state: "Sad",
        dialogue: "Okay... I just want to sit down somewhere and have my friend with me.",
        choices: [
          { text: "Let's do that. I'll stay with you, get your friend and my supervisor, and share some support options. You decide what's next.", next: "success-happy", meterChange: -25 },
          { text: "Fine, but I have to file a report with your full statement first.", next: "bad-path-1-step-3", meterChange: 15 },
        ],
      },
      "success-happy": {
        state: "Happy",
        dialogue: "Thank you for believing me. I feel a little safer now.",
        isEnding: true, success: true,
        debrief: "Supportive response! You believed her, moved her somewhere safe and private, told her it wasn't her fault, and let her choose next steps: friend, supervisor, medical, police, or the RAINN hotline (800-656-HOPE). You didn't investigate the details yourself; you passed a description to the team. Follow your venue's policy: notify a supervisor, document only basic facts, and preserve CCTV.",
      },
      "fail-very-angry": {
        state: "Fail",
        dialogue: "Nobody here cares. I'm leaving.",
        isEnding: true, success: false,
        debrief: "She left unsupported and alone. Doubting, questioning her drinking, or pressing for details are blaming responses that make survivors less likely to seek help. Lead with 'I believe you' and 'It's not your fault', get her to a safe place with someone she trusts, offer choices rather than demands, and escalate to a supervisor so the venue can act.",
      },
    },
  },

  {
    id: "service-dog-entry",
    title: "Service Dog at the Gate",
    description: "A guest arrives at entry with a dog in a harness. The venue has a no-pets policy, and the guest is already tense from being stopped before.",
    initialState: "Distressed",
    initialMeter: 45,
    subjectId: 5,
    audioMap: {
      "start": `${AUDIO_BASE}/s5/S.mp3`,
      "good-path-step-2": `${AUDIO_BASE}/s5/G2.mp3`,
      "good-path-step-3": `${AUDIO_BASE}/s5/G3.mp3`,
      "bad-path-1-step-2": `${AUDIO_BASE}/s5/B12.mp3`,
      "bad-path-1-step-3": `${AUDIO_BASE}/s5/B13.mp3`,
      "bad-path-2-step-2": `${AUDIO_BASE}/s5/B22.mp3`,
      "bad-path-2-step-3": `${AUDIO_BASE}/s5/B23.mp3`,
      "mixed-path-step-2": `${AUDIO_BASE}/s5/M2.mp3`,
      "mixed-path-step-3-recovery": `${AUDIO_BASE}/s5/M3R.mp3`,
      "success-happy": `${AUDIO_BASE}/s5/P.mp3`,
      "fail-very-angry": `${AUDIO_BASE}/s5/F.mp3`,
    },
    steps: {
      start: {
        state: "Distressed",
        dialogue: "Before you say anything - yes, he's coming in with me. Every single event, someone gives me a hard time about my dog.",
        choices: [
          { text: "Welcome! Just two quick questions: is he a service animal required because of a disability, and what work or task is he trained to perform?", next: "good-path-step-2", meterChange: -15 },
          { text: "No pets allowed. Do you have his service dog papers or certification?", next: "bad-path-1-step-2", meterChange: 25 },
          { text: "What's your disability? You don't look like you need a service dog.", next: "bad-path-2-step-2", meterChange: 30 },
          { text: "Is that a pit bull? We can't allow that breed in here.", next: "mixed-path-step-2", meterChange: 20 },
        ],
      },
      "good-path-step-2": {
        state: "Sad",
        dialogue: "...Yeah. He's a service dog. He alerts me before seizures so I can get somewhere safe and sit down.",
        choices: [
          { text: "Thanks for telling me. You're all set. If you'd like, the accessible viewing area near section B has more room for him.", next: "good-path-step-3", meterChange: -20 },
          { text: "Can you have him show me how he does that?", next: "bad-path-1-step-2", meterChange: 20 },
          { text: "How often do you have seizures? Is it safe for you to be here?", next: "bad-path-2-step-2", meterChange: 20 },
        ],
      },
      "good-path-step-3": {
        state: "Sad",
        dialogue: "Really? That's it? Usually I get twenty questions and a lecture.",
        choices: [
          { text: "That's it. He just needs to stay under your control, and if anything comes up, flag any of us in a yellow shirt. Enjoy the show.", next: "success-happy", meterChange: -25 },
          { text: "That's it for now, but you'll need to show me his service dog paperwork before I can let him past the gate.", next: "bad-path-1-step-3", meterChange: 30 },
        ],
      },
      "bad-path-1-step-2": {
        state: "Angry",
        dialogue: "Papers? There's no such thing as required papers! The ADA doesn't make me prove anything to you.",
        choices: [
          { text: "No certificate, no entry. That's our policy.", next: "bad-path-1-step-3", meterChange: 25 },
          { text: "You're right, I'm sorry. I'm not allowed to ask for that. Is he required because of a disability, and what task is he trained to do?", next: "mixed-path-step-3-recovery", meterChange: -15 },
        ],
      },
      "bad-path-1-step-3": {
        state: "Angry",
        dialogue: "This is illegal and you know it! Get me your supervisor right now.",
        choices: [
          { text: "My supervisor will tell you the same thing. Step out of line.", next: "fail-very-angry", meterChange: 25 },
          { text: "I'll get my supervisor, and I apologize - I was wrong to demand papers. Let's sort this out now.", next: "mixed-path-step-3-recovery", meterChange: -20 },
        ],
      },
      "bad-path-2-step-2": {
        state: "Angry",
        dialogue: "Excuse me? My medical history is none of your business. Not every disability is visible.",
        choices: [
          { text: "I just need to know it's legit. People fake this all the time.", next: "bad-path-2-step-3", meterChange: 20 },
          { text: "You're absolutely right, I'm sorry. I shouldn't have asked that. I only need to know what task he's trained to perform.", next: "mixed-path-step-3-recovery", meterChange: -15 },
        ],
      },
      "bad-path-2-step-3": {
        state: "Faded",
        dialogue: "So I'm a liar now. I'm so tired of this. Every time.",
        choices: [
          { text: "If you've got nothing to hide, just answer the question.", next: "fail-very-angry", meterChange: 25 },
          { text: "No, you're not. I handled that badly and I apologize. He's welcome here.", next: "mixed-path-step-3-recovery", meterChange: -20 },
        ],
      },
      "mixed-path-step-2": {
        state: "Angry",
        dialogue: "He's a mixed breed, and it doesn't matter. Breed bans don't apply to service dogs.",
        choices: [
          { text: "Rules are rules. That breed is too risky.", next: "bad-path-1-step-3", meterChange: 20 },
          { text: "You're right, breed isn't a factor. My apologies. Is he a service animal, and what task is he trained for?", next: "mixed-path-step-3-recovery", meterChange: -15 },
        ],
      },
      "mixed-path-step-3-recovery": {
        state: "Sad",
        dialogue: "Fine. Yes, he's a service dog. He's trained to alert me before a seizure.",
        choices: [
          { text: "Thank you. You're both welcome. He just needs to stay under your control. Enjoy the show, and sorry for the hassle.", next: "success-happy", meterChange: -25 },
          { text: "Okay, but if he so much as sniffs someone, he's out.", next: "bad-path-2-step-3", meterChange: 15 },
        ],
      },
      "success-happy": {
        state: "Happy",
        dialogue: "Thank you. Honestly, that's the best a gate has ever gone for us.",
        isEnding: true, success: true,
        debrief: "ADA-compliant entry! When a disability isn't obvious, staff may ask only two questions: (1) Is the dog a service animal required because of a disability? (2) What work or task has it been trained to perform? You cannot ask for papers or certification, a demonstration, or details of the disability, and breed bans don't apply. No vest, ID tag, or registration is required; online certificates prove nothing. A dog may be removed only if it is out of control and the handler doesn't take effective action, it isn't housebroken, or its actual behavior poses a direct threat. Even then, offer the guest entry without the dog. Emotional-support animals are not service animals under the ADA; check state or local law and venue policy for those.",
      },
      "fail-very-angry": {
        state: "Fail",
        dialogue: "Forget it. I'm leaving, and I'm filing an ADA complaint against this venue.",
        isEnding: true, success: false,
        debrief: "Unlawful refusal. Demanding papers, asking about the disability, requesting a demonstration, or banning by breed all violate the ADA and expose the venue to complaints and liability. Ask only the two permitted questions, accept the answer, and welcome the team in. Remove a dog only for its actual behavior (out of control and not corrected, not housebroken, or a direct threat), never for its breed or your assumptions, and still offer the guest entry without the dog.",
      },
    },
  },
];

export const STATE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Distressed: { bg: "bg-amber-500/15", text: "text-amber-600", border: "border-amber-500/30" },
  Sad: { bg: "bg-blue-500/15", text: "text-blue-600", border: "border-blue-500/30" },
  Angry: { bg: "bg-red-500/15", text: "text-red-600", border: "border-red-500/30" },
  Faded: { bg: "bg-purple-500/15", text: "text-purple-600", border: "border-purple-500/30" },
  Happy: { bg: "bg-green-500/15", text: "text-green-600", border: "border-green-500/30" },
  Fail: { bg: "bg-red-500/15", text: "text-red-600", border: "border-red-500/30" },
};
