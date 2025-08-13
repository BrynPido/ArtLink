-- Supabase PostgreSQL Schema for ArtLink
-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS notification CASCADE;
DROP TABLE IF EXISTS message CASCADE;
DROP TABLE IF EXISTS conversation CASCADE;
DROP TABLE IF EXISTS save CASCADE;
DROP TABLE IF EXISTS "like" CASCADE;
DROP TABLE IF EXISTS comment CASCADE;
DROP TABLE IF EXISTS media CASCADE;
DROP TABLE IF EXISTS listing_details CASCADE;
DROP TABLE IF EXISTS listing CASCADE;
DROP TABLE IF EXISTS follow CASCADE;
DROP TABLE IF EXISTS profile CASCADE;
DROP TABLE IF EXISTS post CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- Create user table
CREATE TABLE "user" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  username VARCHAR(191) UNIQUE,
  password VARCHAR(191) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create profile table
CREATE TABLE profile (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  "profilePictureUrl" VARCHAR(191),
  bio VARCHAR(500) DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create post table
CREATE TABLE post (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

-- Create listing table
CREATE TABLE listing (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

-- Create listing_details table
CREATE TABLE listing_details (
  id SERIAL PRIMARY KEY,
  "listingId" INTEGER NOT NULL UNIQUE REFERENCES listing(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  condition VARCHAR(50) NOT NULL,
  location VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create media table
CREATE TABLE media (
  id SERIAL PRIMARY KEY,
  "mediaUrl" VARCHAR(500) NOT NULL,
  "mediaType" VARCHAR(100) NOT NULL,
  "postId" INTEGER REFERENCES post(id) ON DELETE CASCADE,
  "listingId" INTEGER REFERENCES listing(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create comment table
CREATE TABLE comment (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  "postId" INTEGER REFERENCES post(id) ON DELETE CASCADE,
  "authorId" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "parentId" INTEGER REFERENCES comment(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create like table
CREATE TABLE "like" (
  id SERIAL PRIMARY KEY,
  "postId" INTEGER REFERENCES post(id) ON DELETE CASCADE,
  "userId" INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  "commentId" INTEGER REFERENCES comment(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("postId", "userId"),
  UNIQUE("commentId", "userId")
);

-- Create save table
CREATE TABLE save (
  id SERIAL PRIMARY KEY,
  "postId" INTEGER REFERENCES post(id) ON DELETE CASCADE,
  "userId" INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("postId", "userId")
);

-- Create follow table
CREATE TABLE follow (
  id SERIAL PRIMARY KEY,
  "followerId" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "followingId" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("followerId", "followingId")
);

-- Create conversation table
CREATE TABLE conversation (
  id SERIAL PRIMARY KEY,
  "user1Id" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "user2Id" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "listingId" INTEGER REFERENCES listing(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create message table
CREATE TABLE message (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  "conversationId" INTEGER NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  "authorId" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "receiverId" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create notification type enum
CREATE TYPE notification_type AS ENUM ('LIKE', 'COMMENT', 'FOLLOW', 'REPLY', 'MESSAGE');

-- Create notification table
CREATE TABLE notification (
  id SERIAL PRIMARY KEY,
  content VARCHAR(500) NOT NULL,
  type notification_type NOT NULL,
  "recipientId" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "senderId" INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "postId" INTEGER REFERENCES post(id) ON DELETE CASCADE,
  "commentId" INTEGER REFERENCES comment(id) ON DELETE CASCADE,
  "followId" INTEGER REFERENCES follow(id) ON DELETE CASCADE,
  "messageId" INTEGER REFERENCES message(id) ON DELETE CASCADE,
  read BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_user_username ON "user"(username);
CREATE INDEX idx_post_author ON post("authorId");
CREATE INDEX idx_post_created ON post("createdAt");
CREATE INDEX idx_listing_author ON listing("authorId");
CREATE INDEX idx_listing_created ON listing("createdAt");
CREATE INDEX idx_comment_post ON comment("postId");
CREATE INDEX idx_comment_author ON comment("authorId");
CREATE INDEX idx_comment_created ON comment("createdAt");
CREATE INDEX idx_like_created ON "like"("createdAt");
CREATE INDEX idx_follow_created ON follow("createdAt");
CREATE INDEX idx_conversation_updated ON conversation("updatedAt");
CREATE INDEX idx_message_conversation ON message("conversationId");
CREATE INDEX idx_message_created ON message("createdAt");
CREATE INDEX idx_notification_recipient ON notification("recipientId", read);

-- Insert sample data
INSERT INTO "user" (id, email, name, username, password, "createdAt", "updatedAt") VALUES
(1, 'admin@artlink.com', 'Admin User', 'admin', '$2y$10$zb3VbeF2DnRiuak/4HbGkuM.9y76QxdVxZxjyPUXZ69Neih/jb/hO', '2025-08-12 19:20:06.004', '2025-08-14 00:10:50.159'),
(2, 'kiyoshi@gmail.com', 'Kiyoshi', 'Kiyo', '$2a$12$ZUurHGL1SjXEqA.LuK7bj.pohFYMvV7MJwDSKX/Eyt8Pd2tpd7mA6', '2025-08-13 03:27:48.338', '2025-08-13 03:27:48.338'),
(3, 'whitecat@gmail.com', 'WhiteCat', 'WhiteCat', '$2a$12$wOde4w02IczSEvGCPnAaceEQivbtaiNrdIFA8.YT/GBlPF06TGEie', '2025-08-13 05:42:13.496', '2025-08-13 05:42:13.496');

INSERT INTO profile (id, "userId", "profilePictureUrl", bio, "createdAt", "updatedAt") VALUES
(1, 1, NULL, 'System Administrator', '2025-08-12 19:20:06.027', '2025-08-12 19:20:06.027'),
(2, 2, '/uploads/profiles/profile-1755031793172-358290972.jpeg', '', '2025-08-13 03:27:48.342', '2025-08-13 04:49:53.000'),
(3, 3, NULL, '', '2025-08-13 05:42:13.500', '2025-08-13 05:42:13.500');

INSERT INTO post (id, title, content, published, "createdAt", "updatedAt", "authorId") VALUES
(3, 'Jay', 'Content', true, '2025-08-13 03:47:44.000', '2025-08-13 03:47:44.000', 2),
(4, 'Jay Hyun', ' I just want to flex it ', true, '2025-08-13 06:04:18.000', '2025-08-13 06:04:18.000', 2);

INSERT INTO listing (id, title, content, published, "createdAt", "updatedAt", "authorId") VALUES
(2, 'Jay Jo', 'hey', true, '2025-08-13 05:26:23.000', '2025-08-13 05:26:23.000', 2);

INSERT INTO listing_details (id, "listingId", price, category, condition, location, "createdAt", "updatedAt") VALUES
(2, 2, 1111.00, 'art', 'like-new', 'Olongapo', '2025-08-13 05:26:23.000', '2025-08-13 05:26:23.000');

INSERT INTO media (id, "mediaUrl", "mediaType", "postId", "listingId", "createdAt", "updatedAt") VALUES
(1, '/uploads/1755028064365-166360792.jpeg', 'image/jpeg', 3, NULL, '2025-08-13 03:47:44.000', '2025-08-13 03:47:44.000'),
(2, '/uploads/listings/listing-1755033983521-859523518.jpg', 'image/jpeg', NULL, 2, '2025-08-13 05:26:23.000', '2025-08-13 05:26:23.000'),
(3, '/uploads/1755036258215-322868643.jpeg', 'image/jpeg', 4, NULL, '2025-08-13 06:04:18.000', '2025-08-13 06:04:18.000');

INSERT INTO comment (id, content, "postId", "authorId", "parentId", "createdAt", "updatedAt") VALUES
(1, 'Hello Nice Drawing', 3, 3, NULL, '2025-08-13 05:42:39.000', '2025-08-13 05:42:39.000');

INSERT INTO conversation (id, "user1Id", "user2Id", "listingId", "createdAt", "updatedAt") VALUES
(1, 3, 2, NULL, '2025-08-13 19:38:07.000', '2025-08-13 20:48:57.000'),
(2, 3, 2, 2, '2025-08-13 21:40:25.000', '2025-08-13 21:41:31.000');

INSERT INTO follow (id, "followerId", "followingId", "createdAt", "updatedAt") VALUES
(1, 3, 2, '2025-08-13 05:43:51.000', '2025-08-13 05:43:51.000'),
(9, 2, 3, '2025-08-13 19:32:49.000', '2025-08-13 19:32:49.000');

INSERT INTO "like" (id, "postId", "userId", "commentId", "createdAt", "updatedAt") VALUES
(3, 3, 3, NULL, '2025-08-13 05:42:27.000', '2025-08-13 05:42:27.000'),
(6, 4, 2, NULL, '2025-08-13 18:35:19.000', '2025-08-13 18:35:19.000');

INSERT INTO save (id, "postId", "userId", "createdAt", "updatedAt") VALUES
(1, 3, 3, '2025-08-13 05:42:29.000', '2025-08-13 05:42:29.000');

INSERT INTO message (id, content, "conversationId", "authorId", "receiverId", "readAt", "createdAt", "updatedAt") VALUES
(1, 'hi!', 1, 3, 2, '2025-08-13 20:18:39.000', '2025-08-13 20:17:32.000', '2025-08-13 20:18:39.484'),
(2, 'bro', 1, 3, 2, '2025-08-13 20:39:37.000', '2025-08-13 20:27:13.000', '2025-08-13 20:39:37.676'),
(3, 'sup?', 1, 2, 3, '2025-08-13 20:39:04.000', '2025-08-13 20:27:33.000', '2025-08-13 20:39:04.344'),
(12, 'bro', 2, 3, 2, NULL, '2025-08-13 21:40:34.000', '2025-08-13 21:40:34.000'),
(13, '1000 nalang boss', 2, 2, 3, '2025-08-13 21:41:53.000', '2025-08-13 21:41:31.000', '2025-08-13 21:41:53.274');

INSERT INTO notification (id, content, type, "recipientId", "senderId", "postId", "commentId", "followId", "messageId", read, "createdAt") VALUES
(5, 'Kiyoshi (@Kiyo) started following you', 'FOLLOW', 3, 2, NULL, NULL, 9, NULL, true, '2025-08-13 19:32:49.000');

-- Reset sequences to continue from current max values
SELECT setval(pg_get_serial_sequence('"user"', 'id'), (SELECT MAX(id) FROM "user"));
SELECT setval(pg_get_serial_sequence('profile', 'id'), (SELECT MAX(id) FROM profile));
SELECT setval(pg_get_serial_sequence('post', 'id'), (SELECT MAX(id) FROM post));
SELECT setval(pg_get_serial_sequence('listing', 'id'), (SELECT MAX(id) FROM listing));
SELECT setval(pg_get_serial_sequence('listing_details', 'id'), (SELECT MAX(id) FROM listing_details));
SELECT setval(pg_get_serial_sequence('media', 'id'), (SELECT MAX(id) FROM media));
SELECT setval(pg_get_serial_sequence('comment', 'id'), (SELECT MAX(id) FROM comment));
SELECT setval(pg_get_serial_sequence('"like"', 'id'), (SELECT MAX(id) FROM "like"));
SELECT setval(pg_get_serial_sequence('save', 'id'), (SELECT MAX(id) FROM save));
SELECT setval(pg_get_serial_sequence('follow', 'id'), (SELECT MAX(id) FROM follow));
SELECT setval(pg_get_serial_sequence('conversation', 'id'), (SELECT MAX(id) FROM conversation));
SELECT setval(pg_get_serial_sequence('message', 'id'), (SELECT MAX(id) FROM message));
SELECT setval(pg_get_serial_sequence('notification', 'id'), (SELECT MAX(id) FROM notification));
