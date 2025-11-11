# Unverified Email Password Reset Fix

## Problem
Users who registered but didn't verify their email were getting blocked when trying to reset their password with the error:
```
"Please verify your email before requesting a password reset"
```

This created poor UX as users were stuck with no clear next action.

## Solution
Implemented a graceful fallback that automatically triggers the email verification flow when an unverified user attempts password reset.

## Changes Made

### 1. Backend (`src/app/api/routes/auth.js`)
**Location:** Lines 373-408 in the POST `/forgot-password` endpoint

**New Behavior:**
- Detects if user's email is not verified
- Automatically generates a new registration OTP
- Sends verification email to the user
- Returns enhanced error response with actionable flags

**Code:**
```javascript
// Check if email is verified
if (!user.email_verified) {
  // Generate registration OTP for email verification
  const registrationOTP = await otpService.createOTP(email, 'registration', 10);
  
  if (registrationOTP.success) {
    await emailService.sendRegistrationOTP(email, registrationOTP.otpCode, user.name);
  }
  
  return res.status(400).json({
    status: 'error',
    message: 'Please verify your email first. We have sent a new verification code to your email.',
    requiresVerification: true,
    email: email
  });
}
```

### 2. Frontend (`src/app/_auth/reset-password/reset-password.component.ts`)
**Location:** `submitEmail()` method error handler

**New Behavior:**
- Catches 400 errors from forgot-password endpoint
- Checks for `requiresVerification` flag
- Shows SweetAlert2 modal with clear message
- Redirects to `/verify-email` with email query parameter on confirmation

**Code:**
```typescript
error: (error) => {
  console.error('Forgot password error:', error);
  this.isSubmitting = false;

  // Check if email verification is required
  if (error.error?.requiresVerification) {
    Swal.fire({
      icon: 'warning',
      title: 'Email Not Verified',
      html: `
        <p class="mb-3">${error.message || 'Please verify your email first.'}</p>
        <p class="text-sm text-gray-600 dark:text-gray-400">A verification code has been sent to your email.</p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Verify Email',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#6b7280'
    }).then((result) => {
      if (result.isConfirmed) {
        // Redirect to email verification with email as query param
        this.router.navigate(['/verify-email'], { 
          queryParams: { email: this.email } 
        });
      }
    });
  } else {
    this.errorMessage = error.message || 'Failed to send reset email';
    this.toastService.showToast(this.errorMessage || 'An error occurred', 'error');
  }
}
```

## User Flow

### Before Fix:
1. Unverified user enters email → 
2. Gets error message → 
3. **Stuck** (no clear action)

### After Fix:
1. Unverified user enters email → 
2. Backend auto-sends verification OTP → 
3. SweetAlert modal appears with clear explanation → 
4. User clicks "Verify Email" → 
5. Redirected to verification page with email pre-filled → 
6. Enters OTP from email → 
7. Email verified → 
8. Can now reset password

## Security Considerations
- ✅ Maintains "don't reveal if email exists" policy for non-existent emails
- ✅ Only helps users with actual accounts
- ✅ Enforces email verification requirement
- ✅ Uses existing OTP system (10-minute expiration)
- ✅ All security validations remain intact

## Testing Checklist
- [ ] Unverified user tries password reset → gets verification modal
- [ ] Clicking "Verify Email" redirects to `/verify-email?email=...`
- [ ] Verification page auto-fills email from query param
- [ ] User receives verification OTP email
- [ ] After verification, user can successfully reset password
- [ ] Verified users can reset password normally (no interruption)
- [ ] Non-existent email still gets generic success message (security)

## Files Modified
1. `src/app/api/routes/auth.js` - Enhanced forgot-password endpoint
2. `src/app/_auth/reset-password/reset-password.component.ts` - Added error handler

## Dependencies
- Existing: `otpService`, `emailService`, SweetAlert2, Angular Router
- No new dependencies added

## Notes
- Reuses existing email verification infrastructure
- No database schema changes required
- Backward compatible with existing verification flow
- User-friendly error messages with clear actions
