# Fix Email Verification Redirect

## Problem
Email verification links redirect to `localhost:3000` instead of your actual site.

## Solution

### 1. Update Supabase URL Configuration

**Go to Supabase Dashboard:**
1. Visit https://supabase.com/dashboard
2. Select your project: `vaagvairvwmgyzsmymhs`
3. Navigate to: **Authentication** → **URL Configuration**

**Update Site URL:**
- For production: `https://yourdomain.com`
- For GitHub Pages: `https://yourusername.github.io/EvenfallAdvantageWebMobile`
- For local testing: `http://127.0.0.1:5500`

**Add Redirect URLs (add all that apply):**
```
http://127.0.0.1:5500/student-portal/index.html
http://localhost:5500/student-portal/index.html
https://yourdomain.com/student-portal/index.html
https://yourusername.github.io/EvenfallAdvantageWebMobile/student-portal/index.html
```

### 2. Code Updates (Already Done)

✅ Updated `auth-check.js` to handle email verification callback
- Detects when user returns from verification email
- Shows success message
- Cleans up URL parameters

### 3. Test the Fix

1. **Update Supabase settings** (Step 1 above)
2. **Create a new test account** with a different email
3. **Check the verification email** - link should now point to correct URL
4. **Click verification link** - should redirect properly and show success message

## How It Works Now

**Before:**
- Verification email → `localhost:3000` ❌
- User sees error page

**After:**
- Verification email → Your actual site URL ✅
- User lands on student portal
- Sees "Email verified successfully!" message
- Automatically logged in

## Important Notes

- **Existing users** who already verified are fine - they can log in normally
- **New signups** will get correct verification links after Supabase update
- **Multiple URLs** can be added for different environments (local, staging, production)

## Verification Email Template

The email users receive will look like:
```
Subject: Confirm Your Email

Click here to confirm your email:
https://yourdomain.com/student-portal/index.html#access_token=...

If you didn't request this, ignore this email.
```

## Troubleshooting

**Still redirecting to localhost?**
- Clear browser cache
- Check Supabase settings saved correctly
- Try with incognito/private window

**Users can't verify?**
- Check spam folder
- Verify email service is enabled in Supabase
- Check Supabase logs for delivery issues

**URL has token but not logging in?**
- Check browser console for errors
- Verify `auth-check.js` is loading
- Check Supabase session is being created

---

After updating Supabase settings, all new verification emails will work correctly! 🎉
