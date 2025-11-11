# ArtLink - Recent Changes & Current Context

**Last Updated:** December 21, 2025  
**Branch:** main  
**Database:** PostgreSQL (Supabase)

---

## 📋 Table of Contents
1. [Recent UI/UX Improvements](#recent-uiux-improvements)
2. [Database Schema Overview](#database-schema-overview)
3. [Project Structure](#project-structure)
4. [Component Changes](#component-changes)
5. [Service Layer](#service-layer)
6. [API Endpoints](#api-endpoints)
7. [Authentication Flow](#authentication-flow)
8. [Known Issues & TODOs](#known-issues--todos)

---

## 🎨 Recent UI/UX Improvements

### 1. **Post Card Component** (`src/app/components/ui/post-card/`)
**Recent Changes:**
- ✅ Fixed navigation button positioning (now appear on sides of photos)
- ✅ Removed `position: relative` from button CSS that was causing layout issues
- ✅ Removed `overflow-hidden` from main container to allow dropdown menus
- ✅ Added three-dot menu with delete functionality
- ✅ Implemented SweetAlert2 for delete confirmations
- ✅ Enhanced button styling with proper z-index layering
- ✅ Added carousel navigation with Instagram/Facebook-style side buttons
- ✅ Implemented post reporting system with modal

**Key Features:**
```typescript
// Navigation Buttons
- Position: left-2/right-2 (sides of image)
- Size: w-10 h-10 (40px × 40px)
- Z-index: z-20
- Hover effect: scale-110
- Active effect: scale-95

// Dropdown Menu
- Z-index: z-50 (appears above all content)
- Header section: z-30 (proper stacking)
- Click-outside handler for closing menu
```

**CSS Fixes Applied:**
```css
/* post-card.component.css */
.post-card button.rounded-full {
  transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s;
  /* NOT transition: all (prevents border-radius changes) */
}
```

### 2. **Post Detail Component** (`src/app/components/pages/post/`)
**Recent Changes:**
- ✅ Added delete post functionality (three-dot menu)
- ✅ Optimized layout to fit on one page
- ✅ Reduced media aspect ratio from 75% to 56.25% (16:9)
- ✅ Added scrollable comments section (max-height: 400px)
- ✅ Custom scrollbar styling for both light/dark modes
- ✅ Implemented click-outside handler for dropdown menu
- ✅ Navigation to home after successful deletion

**Layout Optimization:**
```html
<!-- Media Section: More compact -->
<div style="padding-bottom: 56.25%"> <!-- Was 75% -->

<!-- Comments Section: Scrollable -->
<div class="max-h-[400px] overflow-y-auto pr-2">
```

**New Methods Added:**
```typescript
toggleMenu(): void
openDeleteConfirmation(): void
deletePost(): void
@HostListener('document:click') handleClickOutside(): void
```

### 3. **Authentication Forms** (`src/app/_auth/`)
**Recent Changes:**
- ✅ Fixed autofill text visibility (white text on white background issue)
- ✅ Implemented `-webkit-box-shadow` inset trick for autofill styling
- ✅ Added `-webkit-text-fill-color` for consistent text color
- ✅ Removed global `!important` rules that forced text color

**Autofill CSS Solution:**
```css
input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0px 1000px rgba(255, 255, 255, 0.9) inset !important;
  -webkit-text-fill-color: #0f172a !important;
}
```

### 4. **Listing Management** (`src/app/components/pages/listing-edit/`)
**Recent Changes:**
- ✅ Fixed listing update 500 error (connection.execute → connection.query)
- ✅ Added Supabase Storage integration for media uploads
- ✅ Implemented media deletion feature with confirmation
- ✅ Removed photo requirement for text-only edits
- ✅ Changed from JSON to FormData for file uploads

**Backend Fixes:**
```javascript
// listings.js
router.post('/:id/update', authenticateToken, upload.array('media', 10), async (req, res) => {
  // Fixed: connection.query() instead of connection.execute()
  // Added: Supabase storage upload for new media
  // Removed: validateListing middleware
});

router.delete('/:id/media/:mediaId', authenticateToken, async (req, res) => {
  // New route for deleting individual media items
});
```

---

## 🗄️ Database Schema Overview

### **Core Tables**

#### **User Management**
```sql
user
├── id (PK)
├── email (UNIQUE, NOT NULL)
├── name (NOT NULL)
├── username (UNIQUE)
├── password (NOT NULL)
├── email_verified (DEFAULT false)
├── email_verified_at
├── deletedAt (soft delete)
└── deletedBy (FK → user.id)

profile
├── id (PK)
├── userId (FK → user.id, UNIQUE)
├── profilePictureUrl
├── bio (DEFAULT '')
├── deletedAt
└── deletedBy (FK → user.id)

user_restriction
├── id (PK)
├── userId (FK → user.id)
├── type (ban, suspend, etc.)
├── reason (NOT NULL)
├── adminId (FK → user.id)
├── metadata (JSONB)
└── expiresAt
```

#### **Content Management**
```sql
post
├── id (PK)
├── title (NOT NULL)
├── content
├── published (DEFAULT true)
├── authorId (FK → user.id)
├── deletedAt
└── deletedBy (FK → user.id)

listing
├── id (PK)
├── title (NOT NULL)
├── content
├── published (DEFAULT true)
├── authorId (FK → user.id)
├── status ('available', 'reserved', 'sold')
├── deletedAt
└── deletedBy (FK → user.id)

listing_details
├── id (PK)
├── listingId (FK → listing.id, UNIQUE)
├── price (NUMERIC, NOT NULL)
├── category (NOT NULL)
├── condition (NOT NULL)
└── location (NOT NULL)

media
├── id (PK)
├── mediaUrl (NOT NULL)
├── mediaType (NOT NULL)
├── postId (FK → post.id, NULLABLE)
├── listingId (FK → listing.id, NULLABLE)
├── deletedAt
└── deletedBy (FK → user.id)
```

#### **Engagement**
```sql
like
├── id (PK)
├── postId (FK → post.id, NULLABLE)
├── userId (FK → user.id)
└── commentId (FK → comment.id, NULLABLE)

comment
├── id (PK)
├── content (NOT NULL)
├── postId (FK → post.id)
├── authorId (FK → user.id)
├── parentId (FK → comment.id, NULLABLE) -- For nested replies
├── deletedAt
└── deletedBy (FK → user.id)

save
├── id (PK)
├── postId (FK → post.id)
└── userId (FK → user.id)

follow
├── id (PK)
├── followerId (FK → user.id)
└── followingId (FK → user.id)
```

#### **Messaging**
```sql
conversation
├── id (PK)
├── user1Id (FK → user.id)
├── user2Id (FK → user.id)
└── listingId (FK → listing.id, NULLABLE)

message
├── id (PK)
├── content (NOT NULL)
├── conversationId (FK → conversation.id)
├── authorId (FK → user.id)
├── receiverId (FK → user.id)
├── readAt
├── deletedAt
└── deletedBy (FK → user.id)
```

#### **Reporting & Moderation**
```sql
report
├── id (PK)
├── postId (FK → post.id)
├── reporterId (FK → user.id)
├── reason (NOT NULL)
├── description
├── status ('pending', 'reviewed', 'resolved')
├── createdAt
└── updatedAt

message_report
├── id (PK)
├── messageId (FK → message.id)
├── conversationId (FK → conversation.id)
├── reporterId (FK → user.id)
├── reason (NOT NULL)
├── description
└── status ('pending', 'reviewed', 'resolved')

admin_action_log
├── id (PK)
├── adminId (FK → user.id)
├── action (NOT NULL)
├── targetTable (NOT NULL)
├── targetId (NOT NULL)
├── reason
└── metadata (JSONB)
```

#### **Transactions**
```sql
listing_transaction
├── id (PK)
├── listingid (FK → listing.id)
├── buyerid (FK → user.id)
├── sellerid (FK → user.id)
├── conversationid (FK → conversation.id)
├── finalprice (NUMERIC)
├── status ('pending', 'completed', 'cancelled')
├── notes
└── completedat
```

#### **Email Verification**
```sql
email_verification
├── id (PK)
├── email (NOT NULL)
├── otp_code (NOT NULL)
├── purpose (ENUM: 'registration', 'password_reset')
├── expires_at (NOT NULL)
├── is_verified (DEFAULT false)
├── attempts (DEFAULT 0)
└── max_attempts (DEFAULT 5)
```

#### **Notifications**
```sql
notification
├── id (PK)
├── content (NOT NULL)
├── type (ENUM: like, comment, follow, message, etc.)
├── recipientId (FK → user.id)
├── senderId (FK → user.id)
├── postId (FK → post.id, NULLABLE)
├── commentId (FK → comment.id, NULLABLE)
├── followId (FK → follow.id, NULLABLE)
├── messageId (FK → message.id, NULLABLE)
├── read (DEFAULT false)
└── createdAt
```

### **Key Relationships**

1. **Soft Deletes Pattern:**
   - All major tables have `deletedAt` and `deletedBy` fields
   - Admin actions logged in `admin_action_log`

2. **Polymorphic Relationships:**
   - `media` can belong to `post` OR `listing`
   - `like` can belong to `post` OR `comment`

3. **Hierarchical Data:**
   - Comments support nested replies via `parentId` self-referencing FK

4. **Audit Trail:**
   - `admin_action_log` tracks all admin modifications
   - User restrictions tracked with metadata and expiration

---

## 📁 Project Structure

```
src/
├── app/
│   ├── _auth/                    # Authentication module
│   │   ├── auth-layout/          # Auth wrapper layout
│   │   ├── login/                # Login component
│   │   ├── register/             # Registration component
│   │   └── verify-email/         # Email OTP verification
│   │
│   ├── admin/                    # Admin panel module
│   │   ├── guards/               # Admin route guards
│   │   ├── pages/
│   │   │   ├── admin-dashboard/
│   │   │   ├── user-management/
│   │   │   ├── post-management/
│   │   │   ├── listing-management/
│   │   │   ├── message-management/
│   │   │   ├── report-management/
│   │   │   └── archive-management/
│   │   └── services/
│   │       ├── admin.service.ts
│   │       └── sweetalert.service.ts
│   │
│   ├── api/                      # Backend API (Node.js/Express)
│   │   ├── config/
│   │   │   └── database.js       # PostgreSQL connection
│   │   ├── routes/
│   │   │   ├── auth.js           # Login, register, OTP
│   │   │   ├── posts.js          # Post CRUD
│   │   │   ├── listings.js       # Listing CRUD (RECENTLY FIXED)
│   │   │   ├── messages.js       # Messaging
│   │   │   ├── notifications.js
│   │   │   ├── users.js
│   │   │   ├── admin.js
│   │   │   └── analytics.js
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT authentication
│   │   │   └── validation.js
│   │   └── services/
│   │       ├── email.service.js
│   │       ├── otp.service.js
│   │       └── supabase-storage.js
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header/
│   │   │   ├── sidebar/
│   │   │   └── main-layout/
│   │   ├── pages/
│   │   │   ├── home/
│   │   │   ├── explore/
│   │   │   ├── post/             # RECENTLY UPDATED
│   │   │   ├── profile/
│   │   │   ├── listing/
│   │   │   ├── listing-edit/     # RECENTLY FIXED
│   │   │   ├── messages/
│   │   │   └── notifications/
│   │   └── ui/
│   │       ├── post-card/        # RECENTLY UPDATED
│   │       ├── listing-card/
│   │       └── user-card/
│   │
│   ├── services/
│   │   ├── data.service.ts       # Main API service
│   │   ├── websocket.service.ts  # Real-time updates
│   │   ├── toast.service.ts      # Toast notifications
│   │   ├── messaging.service.ts
│   │   └── notification-state.service.ts
│   │
│   ├── interceptors/
│   │   └── cancel-on-navigation.interceptor.ts
│   │
│   ├── pipes/
│   │   └── time-ago.pipe.ts
│   │
│   └── types/
│       ├── user.ts
│       ├── listing.ts
│       └── media.ts
│
└── environments/
    ├── environment.ts
    └── environment.prod.ts
```

---

## 🔧 Component Changes

### **Post Card Component**
**File:** `src/app/components/ui/post-card/post-card.component.ts`

**State Management:**
```typescript
likedPosts: { [key: number]: boolean } = {};
savedPosts: { [key: number]: boolean } = {};
reportedPosts: { [key: number]: boolean } = {};
likesCountMap: { [key: number]: number } = {};
imageLoaded: { [key: string]: boolean } = {};
menuOpenPostId: number | null = null;
showReportModal: boolean = false;
```

**Key Methods:**
```typescript
toggleLike(postId: number, authorId: number): void
toggleSave(postId: number): void
deletePost(postId: number): void
openConfirmationModal(postId: number): void
openReportModal(postId: number): void
submitReport(): void
navigateToPost(postId: number): void
goToAuthorProfile(authorId: number): void
```

### **Post Detail Component**
**File:** `src/app/components/pages/post/post.component.ts`

**New Properties:**
```typescript
menuOpen: boolean = false;
```

**New Methods:**
```typescript
toggleMenu(): void
openDeleteConfirmation(): void
deletePost(): void
@HostListener('document:click') handleClickOutside(event: MouseEvent): void
```

**Layout Changes:**
- Media aspect ratio: 75% → 56.25%
- Comments max-height: unlimited → 400px with scroll
- Header z-index: none → z-30
- Dropdown z-index: z-20 → z-50

---

## 🔌 Service Layer

### **Data Service** (`data.service.ts`)

**Recent Method Updates:**
```typescript
// Listing Management
updateListing(listingId: string, listingData: any): Observable<any>
  // Changed from JSON to FormData
  // URL: POST /api/listings/:id/update

deleteListingMedia(listingId: string, mediaId: number): Observable<any>
  // New method for deleting individual media
  // URL: DELETE /api/listings/:id/media/:mediaId

// Post Management
deletePost(postId: number, userId: number): Observable<any>
  // URL: POST /api/posts/deletePost

// Reporting
reportPost(postId: number, reason: string, description?: string): Observable<any>
  // URL: POST /api/posts/report

checkPostReport(postId: number): Observable<any>
  // URL: GET /api/posts/report/check/:postId
```

**Authentication Flow:**
```typescript
login(credentials: { email: string; password: string }): Observable<any>
  // Stores JWT token and user data
  // Updates currentUserSubject

verifyOTP(email: string, otpCode: string, purpose: string): Observable<any>
  // Email verification with OTP
  // Auto-login after successful verification

resendOTP(email: string, purpose: string): Observable<any>
  // Resend verification code
```

---

## 🌐 API Endpoints

### **Authentication** (`/api/auth`)
```
POST   /auth/login              # Login with email/password
POST   /auth/register           # Register new user
POST   /auth/verify-otp         # Verify email with OTP
POST   /auth/resend-otp         # Resend OTP code
GET    /auth/verify-token       # Verify JWT token validity
POST   /auth/refresh            # Refresh JWT token
```

### **Posts** (`/api/posts`)
```
GET    /posts/getPosts          # Get all posts (feed)
POST   /posts/createPost        # Create new post
POST   /posts/likePost          # Toggle like on post
POST   /posts/savePost          # Toggle save on post
POST   /posts/deletePost        # Delete post (soft delete)
GET    /posts/:id               # Get single post by ID
POST   /posts/report            # Report a post
GET    /posts/report/check/:id  # Check if user reported post
```

### **Listings** (`/api/listings`)
```
POST   /listings/create                # Create listing
GET    /listings                       # Get all listings (with filters)
GET    /listings/:id                   # Get single listing
GET    /listings/user/:userId          # Get user's listings
POST   /listings/:id/update            # Update listing (RECENTLY FIXED)
DELETE /listings/:id                   # Delete listing
DELETE /listings/:id/media/:mediaId    # Delete media (NEW)
POST   /listings/:id/mark-sold         # Mark as sold
PATCH  /listings/:id/status            # Update status (available/reserved)
GET    /listings/transactions          # Get user transactions
```

### **Comments** (`/api/posts`)
```
POST   /posts/addComment        # Add comment to post
POST   /posts/likeComment       # Toggle like on comment
POST   /posts/deleteComment     # Delete comment
```

### **Messages** (`/api/messages`)
```
GET    /messages/conversations  # Get all conversations
GET    /messages/:conversationId# Get messages in conversation
POST   /messages/send           # Send message
POST   /messages/conversation   # Create conversation
PUT    /messages/read/:conversationId # Mark as read
DELETE /messages/:id            # Delete message
```

### **Users** (`/api/users`)
```
GET    /users/profile/:id       # Get user profile
PUT    /users/profile           # Update profile
PUT    /users/bio               # Update bio
POST   /users/follow            # Toggle follow
GET    /users/following/:id     # Check follow status
GET    /users/search            # Search users
```

### **Notifications** (`/api/notifications`)
```
GET    /notifications           # Get user notifications
PUT    /notifications/:id/read  # Mark as read
DELETE /notifications/:id       # Delete notification
```

### **Admin** (`/api/admin`)
```
GET    /admin/stats             # Dashboard statistics
GET    /admin/users             # User management
GET    /admin/posts             # Post management
GET    /admin/listings          # Listing management
GET    /admin/reports           # Report management
PUT    /admin/reports/:id       # Update report status
POST   /admin/users/:id/restrict# Restrict user
```

---

## 🔐 Authentication Flow

### **1. Registration**
```
User submits registration form
  ↓
POST /api/auth/register
  ↓
OTP sent to email
  ↓
User redirected to verify-email page
  ↓
User enters OTP
  ↓
POST /api/auth/verify-otp
  ↓
Email verified, auto-login
  ↓
JWT token stored in localStorage
  ↓
Redirect to /home
```

### **2. Login**
```
User submits login form
  ↓
POST /api/auth/login
  ↓
JWT token received
  ↓
Token stored in localStorage
  ↓
User data stored in currentUserSubject
  ↓
400ms delay for toast visibility
  ↓
Redirect to /home
```

### **3. JWT Token**
```typescript
// Token structure
{
  id: number,
  email: string,
  username: string,
  iat: number,
  exp: number  // 7 days expiration
}

// Middleware: authenticateToken
Authorization: Bearer <token>
```

---

## ⚠️ Known Issues & TODOs

### **High Priority**
- [ ] Add image compression before upload
- [ ] Implement infinite scroll for posts feed
- [ ] Add WebSocket reconnection logic
- [ ] Optimize database queries with proper indexing
- [ ] Add rate limiting to API endpoints

### **Medium Priority**
- [ ] Implement post editing functionality
- [ ] Add user blocking feature
- [ ] Create admin dashboard analytics
- [ ] Add email notifications for important events
- [ ] Implement post scheduling

### **Low Priority**
- [ ] Add dark mode toggle persistence
- [ ] Implement advanced search filters
- [ ] Add post tagging system
- [ ] Create user badges/achievements
- [ ] Add multi-language support

### **Bug Fixes Completed**
- ✅ Fixed autofill white text on white background
- ✅ Fixed listing update 500 error
- ✅ Fixed navigation buttons appearing at bottom instead of sides
- ✅ Fixed dropdown menu not appearing (z-index issue)
- ✅ Fixed listing update requiring new photos

---

## 🚀 Recent Performance Optimizations

1. **Image Loading:**
   - Implemented lazy loading for images
   - Added blurred placeholder backgrounds
   - Optimized image aspect ratios

2. **Change Detection:**
   - Using `ChangeDetectionStrategy.OnPush` where applicable
   - Manual `markForCheck()` after async operations

3. **Bundle Size:**
   - Standalone components for better tree-shaking
   - Lazy-loaded routes for admin panel

4. **Database:**
   - Using connection pooling
   - Proper indexing on foreign keys
   - Soft deletes instead of hard deletes

---

## 📝 Code Patterns & Best Practices

### **SweetAlert2 Configuration**
```typescript
Swal.fire({
  title: 'Action Title',
  text: 'Description text',
  icon: 'warning',
  showCancelButton: true,
  confirmButtonColor: '#d33',
  cancelButtonColor: '#3085d6',
  confirmButtonText: 'Yes, do it!',
  cancelButtonText: 'Cancel',
  backdrop: true,
  customClass: {
    container: 'swal-container',
    popup: 'swal-popup',
  },
});
```

### **FormData for File Uploads**
```typescript
const formData = new FormData();
formData.append('title', this.formData.title);
formData.append('content', this.formData.content);
formData.append('listingDetails', JSON.stringify(this.formData.listingDetails));

// Append files
this.imageFiles.forEach(file => {
  formData.append('media', file);
});

this.dataService.updateListing(listingId, formData).subscribe(/*...*/);
```

### **Soft Delete Pattern**
```sql
-- Set deletedAt instead of DELETE
UPDATE post 
SET deletedAt = NOW(), deletedBy = $1 
WHERE id = $2;

-- Query excludes soft-deleted records
SELECT * FROM post 
WHERE deletedAt IS NULL;
```

### **Error Handling**
```typescript
this.dataService.someMethod().subscribe({
  next: (response) => {
    // Success handling
    this.toastService.showToast('Success!', 'success');
  },
  error: (error) => {
    console.error('Error:', error);
    this.toastService.showToast(
      error.error?.message || 'An error occurred',
      'error'
    );
  }
});
```

---

## 🎯 Next Steps

1. **Immediate Actions:**
   - Test all recent changes thoroughly
   - Add unit tests for critical components
   - Document API endpoints in Swagger/OpenAPI

2. **Upcoming Features:**
   - Real-time notifications via WebSocket
   - Advanced search with filters
   - User analytics dashboard
   - Mobile app (React Native)

3. **Infrastructure:**
   - Set up CI/CD pipeline
   - Implement automated backups
   - Add monitoring and logging (Sentry, LogRocket)
   - Set up staging environment

---

**End of Context Document**

*This document should be updated whenever significant changes are made to the codebase.*
