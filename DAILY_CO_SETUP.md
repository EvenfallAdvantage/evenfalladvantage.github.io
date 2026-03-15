# Daily.co Integration Setup

## Step 1: Sign Up for Daily.co

1. Go to: https://dashboard.daily.co/signup
2. Sign up for a free account
3. Verify your email

## Step 2: Get Your API Key

1. Go to: https://dashboard.daily.co/developers
2. Click "Create API Key"
3. Copy your API key (starts with a long string)

## Step 3: Create Your Domain

1. In the Daily.co dashboard, go to "Domains"
2. Your default domain will be something like: `yourcompany.daily.co`
3. You can customize this or use the default

## Step 4: Add API Key to Environment

Add this to your `.env` file:

```
DAILY_API_KEY=your_api_key_here
```

## Step 5: Test the Integration

### For Instructors:
1. Go to: https://evenfalladvantage.github.io/student-portal/instructor-room.html
2. Enter a room name (e.g., "training-oct-18")
3. Click "Start Training Session"
4. The system will create a Daily.co room automatically
5. Copy the student link and share it

### For Students:
1. Click the link provided by instructor
2. Enter your name
3. Join the training with Clunt AI available

## Free Tier Limits

- **Unlimited meetings**
- **Up to 10 participants per meeting**
- **10,000 participant minutes per month**

Example: 10 students × 1 hour training = 600 minutes used

## Room Creation

Rooms can be created two ways:

### Option 1: Pre-create Rooms (Recommended)
1. Go to Daily.co dashboard
2. Click "Rooms" → "Create Room"
3. Name it (e.g., "evenfall-training-oct-18")
4. Copy the room URL
5. Share with students

### Option 2: Dynamic Room Creation (Requires Backend)
- Requires API key in backend
- Rooms created automatically when instructor starts session
- More convenient but needs server-side code

## Current Implementation

The current code uses **Option 1** - instructors need to:
1. Create room in Daily.co dashboard
2. Copy the room URL
3. Share with students

## Next Steps

If you want automatic room creation (Option 2), I can:
1. Add Daily.co API integration to your Cloud Run backend
2. Instructors just enter a room name
3. System creates the room automatically

Let me know if you want Option 2!
