-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 20, 2025 at 04:15 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `artlink_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `comment`
--

CREATE TABLE `comment` (
  `id` int(11) NOT NULL,
  `content` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `postId` int(11) DEFAULT NULL,
  `authorId` int(11) NOT NULL,
  `parentId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `comment`
--

INSERT INTO `comment` (`id`, `content`, `createdAt`, `updatedAt`, `postId`, `authorId`, `parentId`) VALUES
(3, 'HI', '2025-04-18 01:25:25.000', '2025-04-18 01:25:25.000', 19, 11, NULL),
(17, 'Commenty', '2025-04-18 02:07:37.000', '2025-04-18 02:07:37.000', 17, 11, NULL),
(20, 'hi hi', '2025-04-18 19:23:46.000', '2025-04-18 19:23:46.000', 24, 11, NULL),
(21, 'asdf', '2025-04-18 19:33:22.000', '2025-04-18 19:33:22.000', 24, 11, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `conversation`
--

CREATE TABLE `conversation` (
  `id` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `user1Id` int(11) NOT NULL,
  `user2Id` int(11) NOT NULL,
  `listingId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `conversation`
--

INSERT INTO `conversation` (`id`, `createdAt`, `updatedAt`, `user1Id`, `user2Id`, `listingId`) VALUES
(1, '2025-04-19 00:38:38.000', '2025-04-19 02:46:06.000', 11, 1, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `follow`
--

CREATE TABLE `follow` (
  `id` int(11) NOT NULL,
  `followerId` int(11) NOT NULL,
  `followingId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `follow`
--

INSERT INTO `follow` (`id`, `followerId`, `followingId`) VALUES
(9, 1, 8),
(12, 1, 11),
(8, 8, 1),
(10, 11, 1);

-- --------------------------------------------------------

--
-- Table structure for table `like`
--

CREATE TABLE `like` (
  `id` int(11) NOT NULL,
  `postId` int(11) DEFAULT NULL,
  `userId` int(11) DEFAULT NULL,
  `commentId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `like`
--

INSERT INTO `like` (`id`, `postId`, `userId`, `commentId`) VALUES
(81, 24, 7, NULL),
(109, 17, 8, NULL),
(132, 19, 1, NULL),
(150, 19, 11, NULL),
(154, 24, 11, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `listing`
--

CREATE TABLE `listing` (
  `id` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `title` varchar(191) NOT NULL,
  `content` varchar(191) DEFAULT NULL,
  `published` tinyint(1) NOT NULL DEFAULT 0,
  `authorId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `listing_details`
--

CREATE TABLE `listing_details` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `listingId` int(11) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `category` varchar(50) NOT NULL,
  `condition` varchar(50) NOT NULL,
  `location` varchar(191) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `listing_details_listingId_fkey` (`listingId`),
  CONSTRAINT `listing_details_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `listing` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `media`
--

CREATE TABLE `media` (
  `id` int(11) NOT NULL,
  `url` varchar(191) NOT NULL,
  `mediaType` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `postId` int(11) DEFAULT NULL,
  `listingId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `media`
--

INSERT INTO `media` (`id`, `url`, `mediaType`, `createdAt`, `postId`, `listingId`) VALUES
(24, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e6f023074.png', 'image', '2025-03-29 20:26:24.000', 17, NULL),
(25, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e6f024377.png', 'image', '2025-03-29 20:26:24.000', 17, NULL),
(26, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e6f025137.png', 'image', '2025-03-29 20:26:24.000', 17, NULL),
(27, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e6f025fdc.png', 'image', '2025-03-29 20:26:24.000', 17, NULL),
(28, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e6f026e09.png', 'image', '2025-03-29 20:26:24.000', 17, NULL),
(29, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e6f0278f5.png', 'image', '2025-03-29 20:26:24.000', 17, NULL),
(33, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e8960f54b.png', 'image', '2025-03-29 20:33:26.000', 19, NULL),
(34, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e89610d5a.png', 'image', '2025-03-29 20:33:26.000', 19, NULL),
(35, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e8961211b.png', 'image', '2025-03-29 20:33:26.000', 19, NULL),
(36, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e89613d3c.png', 'image', '2025-03-29 20:33:26.000', 19, NULL),
(37, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e89615586.png', 'image', '2025-03-29 20:33:26.000', 19, NULL),
(42, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e95ece6c5.png', 'image', '2025-03-29 20:36:46.000', 24, NULL),
(43, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e95ecf99f.png', 'image', '2025-03-29 20:36:46.000', 24, NULL),
(44, 'C:\\xampp\\htdocs\\ArtLink\\ArtLink_API\\api\\modules/../../uploads/67e7e95ed0fe0.png', 'image', '2025-03-29 20:36:46.000', 24, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `message`
--

CREATE TABLE `message` (
  `id` int(11) NOT NULL,
  `content` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `conversationId` int(11) NOT NULL,
  `authorId` int(11) NOT NULL,
  `receiverId` int(11) NOT NULL,
  `readAt` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `message`
--

INSERT INTO `message` (`id`, `content`, `createdAt`, `updatedAt`, `conversationId`, `authorId`, `receiverId`, `readAt`) VALUES
(1, 'hi', '2025-04-19 00:39:05.000', '2025-04-19 00:39:05.000', 1, 11, 1, '2025-04-19 00:39:05'),
(2, 'kamusta ka po', '2025-04-19 00:39:29.000', '2025-04-19 00:39:29.000', 1, 1, 11, '2025-04-19 00:39:29'),
(3, 'okay lang', '2025-04-19 01:45:19.000', '2025-04-19 01:45:19.000', 1, 11, 1, '2025-04-19 01:45:19'),
(4, 'bruh', '2025-04-19 01:45:34.000', '2025-04-19 01:45:34.000', 1, 1, 11, '2025-04-19 01:45:34'),
(5, 'mamaw', '2025-04-19 01:45:51.000', '2025-04-19 01:45:51.000', 1, 11, 1, '2025-04-19 01:45:51'),
(6, '123123123', '2025-04-19 01:46:13.000', '2025-04-19 01:46:13.000', 1, 1, 11, '2025-04-19 01:46:13'),
(7, '123123123', '2025-04-19 01:46:23.000', '2025-04-19 01:46:23.000', 1, 1, 11, '2025-04-19 01:46:23'),
(8, 'test', '2025-04-19 01:48:15.000', '2025-04-19 01:48:15.000', 1, 11, 1, '2025-04-19 01:48:15'),
(9, 'bobo kaba', '2025-04-19 01:52:56.000', '2025-04-19 01:52:56.000', 1, 1, 11, '2025-04-19 01:52:56'),
(10, '123123123123123', '2025-04-19 01:53:18.000', '2025-04-19 01:53:18.000', 1, 1, 11, '2025-04-19 01:53:18'),
(11, '123123123123123123', '2025-04-19 01:53:28.000', '2025-04-19 01:53:28.000', 1, 11, 1, '2025-04-19 01:53:28'),
(12, '234234234', '2025-04-19 01:54:04.000', '2025-04-19 01:54:04.000', 1, 11, 1, '2025-04-19 01:54:04'),
(13, 'erwedfdfsdfgsdfgsdfgsdfgsdfgsdfg', '2025-04-19 01:54:12.000', '2025-04-19 01:54:12.000', 1, 1, 11, '2025-04-19 01:54:12'),
(14, '12312312312', '2025-04-19 02:00:08.000', '2025-04-19 02:00:08.000', 1, 1, 11, '2025-04-19 02:00:08'),
(15, 'hellooo bro', '2025-04-19 02:00:30.000', '2025-04-19 02:00:30.000', 1, 1, 11, '2025-04-19 02:00:30'),
(16, 'kamusta ka', '2025-04-19 02:00:33.000', '2025-04-19 02:00:33.000', 1, 11, 1, '2025-04-19 02:00:33'),
(17, 'suntukan nga', '2025-04-19 02:00:41.000', '2025-04-19 02:00:41.000', 1, 1, 11, '2025-04-19 02:00:41'),
(18, 'bali kaba', '2025-04-19 02:00:46.000', '2025-04-19 02:00:46.000', 1, 11, 1, '2025-04-19 02:00:46'),
(19, 'banat ', '2025-04-19 02:01:46.000', '2025-04-19 02:01:46.000', 1, 11, 1, '2025-04-19 02:01:46'),
(20, 'amp', '2025-04-19 02:01:50.000', '2025-04-19 02:01:50.000', 1, 1, 11, '2025-04-19 02:01:50'),
(21, '1231231231231231', '2025-04-19 02:02:06.000', '2025-04-19 02:02:06.000', 1, 1, 11, '2025-04-19 02:02:06'),
(22, '123123123', '2025-04-19 02:02:08.000', '2025-04-19 02:02:08.000', 1, 1, 11, '2025-04-19 02:02:08'),
(23, 'wdefwdf234 sdf', '2025-04-19 02:02:10.000', '2025-04-19 02:02:10.000', 1, 11, 1, '2025-04-19 02:02:10'),
(24, 'asdf23rqwef', '2025-04-19 02:02:13.000', '2025-04-19 02:02:13.000', 1, 11, 1, '2025-04-19 02:02:13'),
(25, '234234', '2025-04-19 02:04:01.000', '2025-04-19 02:04:01.000', 1, 11, 1, '2025-04-19 02:04:01'),
(26, '234234234', '2025-04-19 02:04:03.000', '2025-04-19 02:04:03.000', 1, 1, 11, '2025-04-19 02:04:03'),
(27, 'hi', '2025-04-19 02:05:41.000', '2025-04-19 02:05:41.000', 1, 1, 11, '2025-04-19 02:05:41'),
(28, '123', '2025-04-19 02:09:19.000', '2025-04-19 02:09:19.000', 1, 1, 11, '2025-04-19 02:09:19'),
(29, 'kamsuta ka', '2025-04-19 02:09:22.000', '2025-04-19 02:09:22.000', 1, 11, 1, '2025-04-19 02:09:23'),
(30, 'hi tropa', '2025-04-19 02:10:07.000', '2025-04-19 02:10:07.000', 1, 1, 11, '2025-04-19 02:10:07'),
(31, '123123123', '2025-04-19 02:45:36.000', '2025-04-19 02:45:36.000', 1, 11, 1, '2025-04-19 02:45:40'),
(32, '123123', '2025-04-19 02:45:43.000', '2025-04-19 02:45:43.000', 1, 1, 11, '2025-04-19 02:45:43'),
(33, 'dfgdfgnjkdfgnjdfgnjdfghnjdfgjkldfg\'', '2025-04-19 02:45:53.000', '2025-04-19 02:45:53.000', 1, 11, 1, '2025-04-19 02:45:53');

-- --------------------------------------------------------

--
-- Table structure for table `notification`
--

CREATE TABLE `notification` (
  `id` int(11) NOT NULL,
  `content` varchar(191) NOT NULL,
  `type` enum('LIKE','COMMENT','FOLLOW','REPLY','MESSAGE') NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `recipientId` int(11) NOT NULL,
  `senderId` int(11) NOT NULL,
  `postId` int(11) DEFAULT NULL,
  `commentId` int(11) DEFAULT NULL,
  `followId` int(11) DEFAULT NULL,
  `messageId` int(11) DEFAULT NULL,
  `read` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notification`
--

INSERT INTO `notification` (`id`, `content`, `type`, `createdAt`, `recipientId`, `senderId`, `postId`, `commentId`, `followId`, `messageId`, `read`) VALUES
(13, 'You have a new follower!', 'FOLLOW', '2025-04-18 00:48:08.000', 8, 1, NULL, NULL, NULL, NULL, 0),
(15, 'You have a new follower!', 'FOLLOW', '2025-04-18 01:06:16.000', 11, 1, NULL, NULL, NULL, NULL, 1),
(19, 'Someone liked your comment!', 'LIKE', '2025-04-18 01:33:29.000', 8, 11, 17, NULL, NULL, NULL, 0),
(55, 'You have a new follower!', 'FOLLOW', '2025-04-19 00:32:47.000', 11, 1, NULL, NULL, NULL, NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `post`
--

CREATE TABLE `post` (
  `id` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `title` varchar(191) NOT NULL,
  `content` varchar(191) DEFAULT NULL,
  `published` tinyint(1) NOT NULL DEFAULT 0,
  `authorId` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `post`
--

INSERT INTO `post` (`id`, `createdAt`, `updatedAt`, `title`, `content`, `published`, `authorId`) VALUES
(17, '2025-03-29 20:26:24.000', '2025-03-29 20:26:24.000', 'Kiyoshi', 'Herere', 0, 1),
(19, '2025-03-29 20:33:26.000', '2025-03-29 20:33:26.000', 'Jin', '', 0, 1),
(24, '2025-03-29 20:36:46.000', '2025-03-29 20:36:46.000', 'asd', '', 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `profile`
--

CREATE TABLE `profile` (
  `id` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `imageProfile` varchar(191) NOT NULL,
  `bio` varchar(191) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `save`
--

CREATE TABLE `save` (
  `id` int(11) NOT NULL,
  `postId` int(11) DEFAULT NULL,
  `userId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `save`
--

INSERT INTO `save` (`id`, `postId`, `userId`) VALUES
(24, 24, 7),
(31, 24, 1),
(36, 17, 8);

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `email` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `username` varchar(191) DEFAULT NULL,
  `password` varchar(191) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user`
--

INSERT INTO `user` (`id`, `email`, `name`, `username`, `password`) VALUES
(1, 'Kiyoshi@gmail.com', 'Kiyoshi', 'Kyo', '$2y$10$C3gEv3xOQNVlE2vZtdSx9uX7lj2VHEuuWra.nmp0ox7jxC0e.vJcO'),
(7, 'pastormharvieann@gmail.com', 'Mharvie Pastor', 'mabi\'sART', '$2y$10$ITIjzQCXYdOAMoTcdMPBIeF3vhBXu9KbiyLfkLaF6589/jUghOlQS'),
(8, 'jose.angelique00@gmail.com', 'Angelique Jose', 'alec_00', '$2y$10$cW4S/rHI/./RZfmLQxvjSugIjfy5KFlJ3NtVfCF/HCw4aKZiOK6Y6'),
(11, 'bryn.pido0@gmail.com', 'Bryn Bryx S. Pido', 'ronsae_0', '$2y$10$d37ctolcY9tbqmcqAY/UROM2LN9S7eQ44NmrB/jnPMk/WMNTOUq/C');

-- --------------------------------------------------------

--
-- Table structure for table `_prisma_migrations`
--

CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_prisma_migrations`
--

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('d82a3fe4-9f77-4b23-ae4c-8ebb474ff452', 'cf600a67b2b99564e1d60f8f27df97bdbc98a39cc2bbe277ab44d5b13abf5fbc', '2025-03-18 20:38:30.020', '20250318203828_init', NULL, NULL, '2025-03-18 20:38:28.773', 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `comment`
--
ALTER TABLE `comment`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Comment_postId_fkey` (`postId`),
  ADD KEY `Comment_authorId_fkey` (`authorId`),
  ADD KEY `Comment_parentId_fkey` (`parentId`);

--
-- Indexes for table `conversation`
--
ALTER TABLE `conversation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Conversation_user1Id_fkey` (`user1Id`),
  ADD KEY `Conversation_user2Id_fkey` (`user2Id`),
  ADD KEY `Conversation_listingId_fkey` (`listingId`);

--
-- Indexes for table `follow`
--
ALTER TABLE `follow`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Follow_followerId_followingId_key` (`followerId`,`followingId`),
  ADD KEY `Follow_followingId_fkey` (`followingId`);

--
-- Indexes for table `like`
--
ALTER TABLE `like`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Like_postId_fkey` (`postId`),
  ADD KEY `Like_userId_fkey` (`userId`),
  ADD KEY `Like_commentId_fkey` (`commentId`);

--
-- Indexes for table `listing`
--
ALTER TABLE `listing`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Listing_authorId_fkey` (`authorId`);

--
-- Indexes for table `listing_details`
--
ALTER TABLE `listing_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `listing_details_listingId_fkey` (`listingId`);

--
-- Indexes for table `media`
--
ALTER TABLE `media`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Media_postId_idx` (`postId`),
  ADD KEY `Media_listingId_idx` (`listingId`);

--
-- Indexes for table `message`
--
ALTER TABLE `message`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Message_conversationId_fkey` (`conversationId`),
  ADD KEY `Message_authorId_fkey` (`authorId`),
  ADD KEY `Message_receiverId_fkey` (`receiverId`);

--
-- Indexes for table `notification`
--
ALTER TABLE `notification`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Notification_recipientId_fkey` (`recipientId`),
  ADD KEY `Notification_senderId_fkey` (`senderId`),
  ADD KEY `Notification_postId_fkey` (`postId`),
  ADD KEY `Notification_commentId_fkey` (`commentId`),
  ADD KEY `Notification_followId_fkey` (`followId`),
  ADD KEY `Notification_messageId_fkey` (`messageId`);

--
-- Indexes for table `post`
--
ALTER TABLE `post`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Post_authorId_fkey` (`authorId`);

--
-- Indexes for table `profile`
--
ALTER TABLE `profile`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Profile_userId_key` (`userId`);

--
-- Indexes for table `save`
--
ALTER TABLE `save`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Save_postId_fkey` (`postId`),
  ADD KEY `Save_userId_fkey` (`userId`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `User_email_key` (`email`),
  ADD UNIQUE KEY `User_username_key` (`username`),
  ADD KEY `User_email_idx` (`email`),
  ADD KEY `User_username_idx` (`username`);

--
-- Indexes for table `_prisma_migrations`
--
ALTER TABLE `_prisma_migrations`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `comment`
--
ALTER TABLE `comment`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `conversation`
--
ALTER TABLE `conversation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `follow`
--
ALTER TABLE `follow`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `like`
--
ALTER TABLE `like`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=155;

--
-- AUTO_INCREMENT for table `listing`
--
ALTER TABLE `listing`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `listing_details`
--
ALTER TABLE `listing_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `media`
--
ALTER TABLE `media`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=45;

--
-- AUTO_INCREMENT for table `message`
--
ALTER TABLE `message`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `notification`
--
ALTER TABLE `notification`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=56;

--
-- AUTO_INCREMENT for table `post`
--
ALTER TABLE `post`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `profile`
--
ALTER TABLE `profile`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `save`
--
ALTER TABLE `save`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `comment`
--
ALTER TABLE `comment`
  ADD CONSTRAINT `Comment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `Comment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `comment` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Comment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `conversation`
--
ALTER TABLE `conversation`
  ADD CONSTRAINT `Conversation_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `listing` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Conversation_user1Id_fkey` FOREIGN KEY (`user1Id`) REFERENCES `user` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `Conversation_user2Id_fkey` FOREIGN KEY (`user2Id`) REFERENCES `user` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `follow`
--
ALTER TABLE `follow`
  ADD CONSTRAINT `Follow_followerId_fkey` FOREIGN KEY (`followerId`) REFERENCES `user` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `Follow_followingId_fkey` FOREIGN KEY (`followingId`) REFERENCES `user` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `like`
--
ALTER TABLE `like`
  ADD CONSTRAINT `Like_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `comment` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Like_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Like_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `listing`
--
ALTER TABLE `listing`
  ADD CONSTRAINT `Listing_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `listing_details`
--
ALTER TABLE `listing_details`
  ADD CONSTRAINT `listing_details_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `listing` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `media`
--
ALTER TABLE `media`
  ADD CONSTRAINT `Media_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `listing` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `Media_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `message`
--
ALTER TABLE `message`
  ADD CONSTRAINT `Message_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `Message_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversation` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `Message_receiverId_fkey` FOREIGN KEY (`receiverId`) REFERENCES `user` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `notification`
--
ALTER TABLE `notification`
  ADD CONSTRAINT `Notification_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `comment` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Notification_followId_fkey` FOREIGN KEY (`followId`) REFERENCES `follow` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Notification_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `message` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Notification_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Notification_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `user` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `Notification_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `user` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `post`
--
ALTER TABLE `post`
  ADD CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `user` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `profile`
--
ALTER TABLE `profile`
  ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `save`
--
ALTER TABLE `save`
  ADD CONSTRAINT `Save_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `post` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Save_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
