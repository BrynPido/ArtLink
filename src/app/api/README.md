# ArtLink Node.js API

A robust REST API backend for the ArtLink application built with Node.js, Express, and MySQL.

## Features

- **Authentication & Authorization**: JWT-based authentication with secure password hashing
- **Posts Management**: Create, read, update, delete posts with media support
- **User Profiles**: User registration, profiles, following system
- **Listings**: Art marketplace functionality
- **Messaging**: Real-time messaging between users
- **Notifications**: System notifications for user interactions
- **File Uploads**: Image uploads for posts, profiles, and listings
- **Security**: Rate limiting, input validation, CORS protection

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MySQL database
- npm or yarn

### Installation

1. Navigate to the API directory:
```bash
cd src/app/api
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env` (if available)
   - Update database credentials and JWT secret in `.env`

4. Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Database Setup

Make sure your MySQL database is running and the credentials in `.env` are correct:

```env
DB_HOST=localhost
DB_NAME=artlink_db
DB_USER=root
DB_PASS=
DB_DRIVER=mysql

JWT_SECRET=your_jwt_secret_here
JWT_ISSUER=ArtlinkAdmin
JWT_EXPIRATION=3600
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - User logout

### Posts
- `GET /api/posts/getPosts` - Get all posts
- `POST /api/posts/createPost` - Create new post
- `GET /api/posts/post/:id` - Get specific post
- `POST /api/posts/likePost` - Like/unlike post
- `POST /api/posts/savePost` - Save/unsave post
- `POST /api/posts/deletePost` - Delete post
- `POST /api/posts/addComment` - Add comment to post
- `POST /api/posts/likeComment` - Like/unlike comment
- `POST /api/posts/deleteComment` - Delete comment
- `GET /api/posts/getSavedPosts` - Get saved posts
- `GET /api/posts/getLikedPosts` - Get liked posts
- `GET /api/posts/search` - Search posts

### Users
- `GET /api/users/user/:id` - Get user profile
- `POST /api/users/toggleFollow` - Follow/unfollow user
- `GET /api/users/following/:userId` - Check follow status
- `GET /api/users/:userId/following` - Get following users
- `GET /api/users/:userId/followers` - Get followers
- `POST /api/users/updateProfile` - Update profile picture
- `POST /api/users/updateBio` - Update user bio
- `GET /api/users/search` - Search users

### Listings
- `GET /api/listings` - Get all listings
- `POST /api/listings/create` - Create new listing
- `GET /api/listings/:id` - Get specific listing
- `GET /api/listings/user/:userId` - Get user listings
- `POST /api/listings/:id/update` - Update listing
- `DELETE /api/listings/:id` - Delete listing
- `GET /api/listings/search` - Search listings
- `GET /api/listings/categories` - Get listing categories

### Messages
- `GET /api/messages/conversations/:userId` - Get user conversations
- `GET /api/messages/conversations/:conversationId/messages` - Get conversation messages
- `POST /api/messages/conversations/create` - Create new conversation
- `POST /api/messages/send` - Send message
- `POST /api/messages/conversations/:conversationId/read` - Mark conversation as read
- `GET /api/messages/unread-count/:userId` - Get unread messages count
- `DELETE /api/messages/conversations/:conversationId` - Delete conversation
- `DELETE /api/messages/:messageId` - Delete message

### Notifications
- `GET /api/notifications/getNotifications` - Get user notifications
- `GET /api/notifications/unread-count` - Get unread notifications count
- `POST /api/notifications/:notificationId/read` - Mark notification as read
- `POST /api/notifications/mark-all-read` - Mark all notifications as read
- `POST /api/notifications/:notificationId/delete` - Delete notification
- `DELETE /api/notifications/clear-all` - Clear all notifications

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage
- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configured for allowed origins
- **Helmet Security**: Additional security headers
- **File Upload Security**: Type validation and size limits

## File Uploads

The API supports file uploads for:
- Profile pictures (`/uploads/profiles/`)
- Post media (`/uploads/`)
- Listing images (`/uploads/listings/`)

Files are validated for type and size before upload.

## Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

### Project Structure

```
api/
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── validation.js        # Input validation middleware
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── posts.js             # Posts routes
│   ├── users.js             # Users routes
│   ├── listings.js          # Listings routes
│   ├── messages.js          # Messages routes
│   └── notifications.js     # Notifications routes
├── uploads/                 # File upload directory
├── .env                     # Environment variables
├── server.js                # Main server file
└── package.json             # Dependencies and scripts
```

## Error Handling

The API returns consistent error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "errors": [] // Validation errors if applicable
}
```

## Success Responses

Successful responses follow this format:

```json
{
  "status": "success",
  "message": "Operation successful",
  "payload": {} // Response data
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.
