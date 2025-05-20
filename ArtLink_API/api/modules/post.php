<?php

/**
 * Post Class
 *
 * This PHP class provides methods for adding employees and jobs.
 *
 * Usage:
 * 1. Include this class in your project.
 * 2. Create an instance of the class to access the provided methods.
 * 3. Call the appropriate method to add new employees or jobs with the provided data.
 *
 * Example Usage:
 * ```
 * $post = new Post();
 * $employeeData = ... // prepare employee data as an associative array or object
 * $addedEmployee = $post->add_employees($employeeData);
 *
 * $jobData = ... // prepare job data as an associative array or object
 * $addedJob = $post->add_jobs($jobData);
 * ```
 *
 * Note: Customize the methods as needed to handle the addition of data to your actual data source (e.g., database, API).
 */

require_once "global.php";

class Post extends GlobalMethods
{
    private $pdo;

    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Register a new user with the provided data.
     *
     * @param array|object $data
     *   The data representing the new user.
     *
     * @return array|object
     *   The Registered user data.
     */
    public function register($data)
    {
        // Validate passwords match
        if ($data->password !== $data->confirmPassword) {
            return $this->sendPayload(null, "failed", "Passwords do not match", 400);
        }

        $hashedPassword = password_hash($data->password, PASSWORD_BCRYPT);

        $sql = "INSERT INTO user (name, username, email, password) VALUES (?, ?, ?, ?)";
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$data->name, $data->username, $data->email, $hashedPassword]);

            $userPayload = [
                'name' => $data->name,
                'username' => $data->username,
                'email' => $data->email,
            ];

            return $this->sendPayload($userPayload, "success", "Registration successful", 201);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Registration failed: " . $e->getMessage(), 400);
        }
    }

    public function createPost($data)
    {
        $sql = "INSERT INTO post (createdAt, updatedAt, title, content, published, authorId) VALUES (?, ?, ?, ?, ?, ?)";
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                date('Y-m-d H:i:s'),
                date('Y-m-d H:i:s'),
                $data->title,
                $data->content,
                $data->published ? 1 : 0, // published status
                $data->authorId
            ]);

            $postId = $this->pdo->lastInsertId(); // Get the ID of the newly created post

            // Handle media insertion if provided (e.g., for images or videos linked to this post)
            if (!empty($data->media)) {
                $this->createMediaForPost($postId, $data->media);
            }

            return $this->sendPayload(['postId' => $postId], "success", "Post created successfully", 201);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Post creation failed: " . $e->getMessage(), 400);
        }
    }

    public function deletePost($data)
    {
        $postId = $data->postId;
        $userId = $data->userId;

        // Check if the user is the owner of the post
        $stmt = $this->pdo->prepare("SELECT authorId FROM post WHERE id = :postId");
        $stmt->execute(['postId' => $postId]);
        $post = $stmt->fetch();

        if ($post && $post['authorId'] == $userId) {
            $stmt = $this->pdo->prepare("DELETE FROM post WHERE id = :postId");
            $stmt->execute(['postId' => $postId]);
            return ['success' => true];
        } else {
            return ['success' => false, 'message' => 'Unauthorized'];
        }
    }

    // Function to handle inserting media for a post
    private function createMediaForPost($postId, $mediaArray)
    {
        $sql = "INSERT INTO media (url, mediaType, createdAt, postId) VALUES (?, ?, ?, ?)";
        foreach ($mediaArray as $media) {
            // Decode base64 data and save it as a file
            $base64Data = $media->url;
            $filePath = $this->saveBase64File($base64Data, $media->mediaType);

            if ($filePath) {
                // Insert the file path into the database
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([
                    $filePath, // Save the file path instead of the base64 string
                    $media->mediaType,
                    date('Y-m-d H:i:s'),
                    $postId
                ]);
            } else {
                // Log an error if the file could not be saved
                error_log("Failed to save media file for post ID: $postId");
            }
        }
    }

    // Helper function to save base64 data as a file
    private function saveBase64File($base64Data, $mediaType = 'image/jpeg')
    {
        // Rest of the function stays the same
        $uploadDir = __DIR__ . '/../../uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        // Extract the file extension from the base64 data (if available)
        if (preg_match('/^data:image\/(\w+);base64/', $base64Data, $matches)) {
            $fileExtension = $matches[1]; // Extract the extension (e.g., jpeg, png)
        } else {
            // Use the mediaType to determine the file extension
            $fileExtension = $this->getFileExtension($mediaType);
        }

        // Generate a unique file name
        $fileName = uniqid() . '.' . $fileExtension;
        $filePath = $uploadDir . $fileName;

        // Decode the base64 data
        $fileData = base64_decode(preg_replace('#^data:image/\w+;base64,#i', '', $base64Data));

        // Save the file
        if (file_put_contents($filePath, $fileData)) {
            return $filePath; // Return the file path
        } else {
            return false; // Return false if the file could not be saved
        }
    }

    private function getFileExtension($mediaType)
    {
        switch ($mediaType) {
            case 'image/jpeg':
                return 'jpg';
            case 'image/png':
                return 'png';
            case 'image/gif':
                return 'gif';
            case 'image/webp':
                return 'webp';
            case 'video/mp4':
                return 'mp4';
            case 'video/webm':
                return 'webm';
            default:
                // If the media type is unknown, default to the original file extension
                // Extract the extension from the base64 data (if available)
                if (preg_match('/^data:image\/(\w+);base64/', $mediaType, $matches)) {
                    return $matches[1]; // Return the extracted extension (e.g., jpeg, png)
                }
                return 'bin'; // Fallback to .bin if no extension can be determined
        }
    }

    public function createListing($data)
    {
        // Validate required fields
        if (!isset($data->title) || !isset($data->content) || !isset($data->authorId) || !isset($data->listingDetails)) {
            return $this->sendPayload(null, "failed", "Missing required fields", 400);
        }

        // Validate listing details
        if (!isset($data->listingDetails->price) || !isset($data->listingDetails->category) || 
            !isset($data->listingDetails->condition) || !isset($data->listingDetails->location)) {
            return $this->sendPayload(null, "failed", "Missing listing details", 400);
        }

        $sql = "INSERT INTO listing (createdAt, updatedAt, title, content, published, authorId) VALUES (?, ?, ?, ?, ?, ?)";
        try {
            $this->pdo->beginTransaction();

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                date('Y-m-d H:i:s'),
                date('Y-m-d H:i:s'),
                $data->title,
                $data->content,
                $data->published ? 1 : 0,
                $data->authorId
            ]);

            $listingId = $this->pdo->lastInsertId();

            // Handle listing details
            $detailsSql = "INSERT INTO listing_details (listingId, price, category, `condition`, location) VALUES (?, ?, ?, ?, ?)";
            $detailsStmt = $this->pdo->prepare($detailsSql);
            $detailsStmt->execute([
                $listingId,
                $data->listingDetails->price,
                $data->listingDetails->category,
                $data->listingDetails->condition,
                $data->listingDetails->location
            ]);

            // Handle media insertion if provided
            if (!empty($data->media)) {
                $this->createMediaForListing($listingId, $data->media);
            }

            $this->pdo->commit();
            return $this->sendPayload(['listingId' => $listingId], "success", "Listing created successfully", 201);

        } catch (\PDOException $e) {
            $this->pdo->rollBack();
            return $this->sendPayload(null, "failed", "Listing creation failed: " . $e->getMessage(), 400);
        }
    }

    // Function to handle deleting a listing
    public function deleteListing($listingId)
    {
        try {
            // First, delete related media files
            $mediaSql = "SELECT url FROM media WHERE listingId = ?";
            $mediaStmt = $this->pdo->prepare($mediaSql);
            $mediaStmt->execute([$listingId]);
            $mediaFiles = $mediaStmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($mediaFiles as $url) {
                if (file_exists($url)) {
                    unlink($url);
                }
            }

            // Delete the listing (cascading delete will handle related records)
            $sql = "DELETE FROM listing WHERE id = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$listingId]);

            if ($stmt->rowCount() > 0) {
                return $this->sendPayload(null, "success", "Listing deleted successfully", 200);
            } else {
                return $this->sendPayload(null, "failed", "Listing not found", 404);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error deleting listing: " . $e->getMessage(), 400);
        }
    }

    // Function to handle inserting media for a listing
    private function createMediaForListing($listingId, $mediaArray)
    {
        $sql = "INSERT INTO media (url, mediaType, createdAt, listingId) VALUES (?, ?, ?, ?)";
        foreach ($mediaArray as $media) {
            // Decode base64 data and save it as a file
            $base64Data = $media->url;
            $filePath = $this->saveBase64File($base64Data, $media->mediaType);

            if ($filePath) {
                // Insert the file path into the database
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([
                    $filePath, // Save the file path instead of the base64 string
                    $media->mediaType,
                    date('Y-m-d H:i:s'),
                    $listingId
                ]);
            } else {
                // Log an error if the file could not be saved
                error_log("Failed to save media file for listing ID: $listingId");
            }
        }
    }

    // Function to create a notification
    private function createNotification($type, $content, $recipientId, $senderId, $postId = null, $commentId = null, $followId = null, $messageId = null) {
        $sql = "INSERT INTO notification (type, content, recipientId, senderId, postId, commentId, followId, messageId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())";
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$type, $content, $recipientId, $senderId, $postId, $commentId, $followId, $messageId]);
        } catch (\PDOException $e) {
            error_log("Failed to create notification: " . $e->getMessage());
        }
    }

    // Updated likePost method to include WebSocket notification
    public function likePost($data) {
        try {
            $userId = $data->userId;
            $postId = $data->postId;

            // Check if the user has already liked the post
            $stmt = $this->pdo->prepare("SELECT * FROM `like` WHERE userId = ? AND postId = ?");
            $stmt->execute([$userId, $postId]);
            $existingLike = $stmt->fetch();

            if ($existingLike) {
                // Unlike the post if already liked
                $stmt = $this->pdo->prepare("DELETE FROM `like` WHERE userId = ? AND postId = ?");
                $stmt->execute([$userId, $postId]);
                return ["status" => "success", "message" => "Post unliked"];
            } else {
                // Like the post
                $stmt = $this->pdo->prepare("INSERT INTO `like` (userId, postId) VALUES (?, ?)");
                $stmt->execute([$userId, $postId]);

                // Fetch the post author and user info to notify
                $postStmt = $this->pdo->prepare("
                    SELECT p.authorId, p.title, u.username 
                    FROM post p 
                    JOIN user u ON u.id = ? 
                    WHERE p.id = ?
                ");
                $postStmt->execute([$userId, $postId]);
                $postInfo = $postStmt->fetch();

                if ($postInfo && $postInfo['authorId'] != $userId) { // Don't notify if user likes their own post
                    // Create notification in database
                    $this->createNotification(
                        "LIKE", 
                        $postInfo['username'] . " liked your post: " . substr($postInfo['title'], 0, 30) . "...", 
                        $postInfo['authorId'], 
                        $userId, 
                        $postId
                    );

                    // Send WebSocket notification
                    global $webSocketServer;
                    if (isset($webSocketServer)) {
                        $notificationData = [
                            'type' => 'notification',
                            'to' => $postInfo['authorId'],
                            'content' => [
                                'type' => 'LIKE',
                                'message' => $postInfo['username'] . " liked your post: " . substr($postInfo['title'], 0, 30) . "...",
                                'postId' => $postId,
                                'userId' => $userId,
                                'timestamp' => date('Y-m-d H:i:s')
                            ]
                        ];
                        
                        // Broadcast to specific user
                        foreach ($webSocketServer->clients as $client) {
                            if (isset($client->userId) && $client->userId == $postInfo['authorId']) {
                                $client->send(json_encode($notificationData));
                                break;
                            }
                        }
                    }
                }

                return ["status" => "success", "message" => "Post liked"];
            }
        } catch (PDOException $e) {
            error_log("PDOException: " . $e->getMessage());
            return ["status" => "error", "message" => "Database error"];
        }
    }

    // Updated addComment method to properly send WebSocket notifications
    public function addComment($data) {
        try {
            ob_clean();
            error_reporting(E_ERROR);
            
            if (!isset($data->content) || !isset($data->postId) || !isset($data->authorId)) {
                header('Content-Type: application/json');
                return $this->sendPayload(null, "failed", "Missing required fields", 400);
            }

            $parentId = property_exists($data, 'parentId') ? $data->parentId : null;

            $sql = "INSERT INTO comment (content, postId, authorId, parentId, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                $data->content,
                $data->postId,
                $data->authorId,
                $parentId
            ]);

            $commentId = $this->pdo->lastInsertId();

            // Fetch complete comment data with author info
            $fetchSql = "SELECT c.*, u.name as authorName, u.username as authorUsername,
                               p.imageProfile as authorProfileImage
                        FROM comment c 
                        JOIN user u ON c.authorId = u.id 
                        LEFT JOIN profile p ON u.id = p.userId
                        WHERE c.id = ?";
            $fetchStmt = $this->pdo->prepare($fetchSql);
            $fetchStmt->execute([$commentId]);
            $comment = $fetchStmt->fetch();

            // Format the comment response
            $commentData = [
                'id' => $commentId,
                'content' => $data->content,
                'createdAt' => $comment['createdAt'],
                'updatedAt' => $comment['updatedAt'],
                'postId' => $data->postId,
                'parentId' => $parentId,
                'author' => [
                    'id' => $data->authorId,
                    'name' => $comment['authorName'],
                    'username' => $comment['authorUsername'],
                    'profileImage' => $comment['authorProfileImage'] ? $this->convertToHttpUrl($comment['authorProfileImage']) : null
                ],
                'likes' => 0,
                'likedByUser' => false
            ];

            // Handle notifications for post author
            $postStmt = $this->pdo->prepare("SELECT p.authorId, p.title, u.username 
                                           FROM post p 
                                           JOIN user u ON u.id = ? 
                                           WHERE p.id = ?");
            $postStmt->execute([$data->authorId, $data->postId]);
            $postInfo = $postStmt->fetch();

            if ($postInfo && $postInfo['authorId'] != $data->authorId) {
                $notificationContent = $comment['authorUsername'] . " commented on your post";
                
                // Create database notification
                $this->createNotification(
                    "COMMENT",
                    $notificationContent,
                    $postInfo['authorId'],
                    $data->authorId,
                    $data->postId,
                    $commentId
                );

                // Send WebSocket notification
                global $webSocketServer;
                if (isset($webSocketServer)) {
                    $notificationData = [
                        'type' => 'notification',
                        'to' => $postInfo['authorId'],
                        'content' => [
                            'type' => 'COMMENT',
                            'message' => $notificationContent,
                            'userId' => $data->authorId,
                            'postId' => $data->postId,
                            'commentId' => $commentId,
                            'comment' => $commentData,
                            'timestamp' => date('Y-m-d H:i:s')
                        ]
                    ];
                    
                    foreach ($webSocketServer->clients as $client) {
                        if (isset($client->userId) && $client->userId == $postInfo['authorId']) {
                            $client->send(json_encode($notificationData));
                            break;
                        }
                    }
                }
            }

            // Handle notifications for comment replies
            if ($parentId) {
                $parentStmt = $this->pdo->prepare("SELECT authorId, (SELECT username FROM user WHERE id = comment.authorId) as username FROM comment WHERE id = ?");
                $parentStmt->execute([$parentId]);
                $parentComment = $parentStmt->fetch();

                if ($parentComment && $parentComment['authorId'] != $data->authorId) {
                    $replyContent = $comment['authorUsername'] . " replied to your comment";
                    
                    // Create database notification for reply
                    $this->createNotification(
                        "COMMENT",
                        $replyContent,
                        $parentComment['authorId'],
                        $data->authorId,
                        $data->postId,
                        $commentId
                    );

                    // Send WebSocket notification for reply
                    global $webSocketServer;
                    if (isset($webSocketServer)) {
                        $replyNotificationData = [
                            'type' => 'notification',
                            'to' => $parentComment['authorId'],
                            'content' => [
                                'type' => 'COMMENT',
                                'message' => $replyContent,
                                'userId' => $data->authorId,
                                'postId' => $data->postId,
                                'commentId' => $commentId,
                                'comment' => $commentData,
                                'timestamp' => date('Y-m-d H:i:s')
                            ]
                        ];
                        
                        foreach ($webSocketServer->clients as $client) {
                            if (isset($client->userId) && $client->userId == $parentComment['authorId']) {
                                $client->send(json_encode($replyNotificationData));
                                break;
                            }
                        }
                    }
                }
            }

            header('Content-Type: application/json');
            return $this->sendPayload($commentData, "success", "Comment added successfully", 200);
        } catch (\PDOException $e) {
            header('Content-Type: application/json');
            return $this->sendPayload(null, "failed", "Error adding comment: " . $e->getMessage(), 500);
        }
    }

    // Updated likeComment method to include notification
    public function likeComment($data) {
        try {
            $commentSql = "SELECT postId, authorId FROM comment WHERE id = ?";
            $commentStmt = $this->pdo->prepare($commentSql);
            $commentStmt->execute([$data->commentId]);
            $comment = $commentStmt->fetch();

            if (!$comment) {
                return $this->sendPayload(null, "failed", "Comment not found", 404);
            }

            $checkSql = "SELECT id FROM `like` WHERE commentId = ? AND userId = ?";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([$data->commentId, $data->userId]);
            $existing = $checkStmt->fetch();

            if ($existing) {
                $sql = "DELETE FROM `like` WHERE id = ?";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$existing['id']]);

                return $this->sendPayload(["liked" => false], "success", "Comment unliked successfully", 200);
            } else {
                $sql = "INSERT INTO `like` (commentId, userId, postId) VALUES (?, ?, ?)";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$data->commentId, $data->userId, $comment['postId']]);

                $this->createNotification("LIKE", "Someone liked your comment!", $comment['authorId'], $data->userId, $comment['postId'], $data->commentId);

                return $this->sendPayload(["liked" => true], "success", "Comment liked successfully", 200);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error liking comment: " . $e->getMessage(), 500);
        }
    }

    // Updated toggleFollow method to include notification
    public function toggleFollow($data) {
        try {
            $checkSql = "SELECT id FROM follow WHERE followerId = ? AND followingId = ?";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([$data->userId, $data->followingId]);
            $existing = $checkStmt->fetch();

            if ($existing) {
                $sql = "DELETE FROM follow WHERE followerId = ? AND followingId = ?";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$data->userId, $data->followingId]);

                return $this->sendPayload(["following" => false], "success", "Unfollowed successfully", 200);
            } else {
                $sql = "INSERT INTO follow (followerId, followingId) VALUES (?, ?)";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$data->userId, $data->followingId]);

                $this->createNotification("FOLLOW", "You have a new follower!", $data->followingId, $data->userId);

                return $this->sendPayload(["following" => true], "success", "Followed successfully", 200);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error toggling follow: " . $e->getMessage(), 500);
        }
    }

    // Method to save a post
    public function savePost($data)
    {
        try {
            $userId = $data->userId;
            $postId = $data->postId;

            // Check if the user has already saved the post
            $stmt = $this->pdo->prepare("SELECT * FROM save WHERE userId = ? AND postId = ?");
            $stmt->execute([$userId, $postId]);
            $existingSave = $stmt->fetch();

            if ($existingSave) {
                // Unsave the post if already saved
                $stmt = $this->pdo->prepare("DELETE FROM save WHERE userId = ? AND postId = ?");
                $stmt->execute([$userId, $postId]);
                return ["status" => "success", "message" => "Post unsaved"];
            } else {
                // Save the post
                $stmt = $this->pdo->prepare("INSERT INTO save (userId, postId) VALUES (?, ?)");
                $stmt->execute([$userId, $postId]);
                return ["status" => "success", "message" => "Post saved"];
            }
        } catch (PDOException $e) {
            // Log the error and return a valid JSON response
            error_log("PDOException: " . $e->getMessage());
            return ["status" => "error", "message" => "Database error"];
        }
    }

    public function deleteComment($data) {
        try {
            // First get the comment and post info to check authorization
            $sql = "SELECT c.*, p.authorId as postAuthorId 
                   FROM comment c 
                   JOIN post p ON c.postId = p.id 
                   WHERE c.id = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$data->commentId]);
            $comment = $stmt->fetch();

            if (!$comment) {
                return $this->sendPayload(null, "failed", "Comment not found", 404);
            }

            // Check if user is authorized to delete the comment
            // Only comment author or post author can delete
            if ($data->userId != $comment['authorId'] && $data->userId != $comment['postAuthorId']) {
                return $this->sendPayload(null, "failed", "Unauthorized to delete this comment", 403);
            }

            // Delete all replies first (recursive deletion)
            $this->deleteReplies($data->commentId);

            // Delete the comment's likes
            $deleteLikesSql = "DELETE FROM `like` WHERE commentId = ?";
            $stmt = $this->pdo->prepare($deleteLikesSql);
            $stmt->execute([$data->commentId]);

            // Delete the comment
            $sql = "DELETE FROM comment WHERE id = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$data->commentId]);

            return $this->sendPayload(null, "success", "Comment deleted successfully", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error deleting comment: " . $e->getMessage(), 500);
        }
    }

    private function deleteReplies($commentId) {
        // Get all replies
        $sql = "SELECT id FROM comment WHERE parentId = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$commentId]);
        $replies = $stmt->fetchAll();

        foreach ($replies as $reply) {
            // Recursively delete nested replies
            $this->deleteReplies($reply['id']);

            // Delete likes for this reply
            $deleteLikesSql = "DELETE FROM `like` WHERE commentId = ?";
            $stmt = $this->pdo->prepare($deleteLikesSql);
            $stmt->execute([$reply['id']]);

            // Delete the reply
            $deleteReplySql = "DELETE FROM comment WHERE id = ?";
            $stmt = $this->pdo->prepare($deleteReplySql);
            $stmt->execute([$reply['id']]);
        }
    }

    // Helper function to convert local file paths to HTTP URLs
    private function convertToHttpUrl($localPath)
    {
        // Replace backslashes with forward slashes
        $localPath = str_replace('\\', '/', $localPath);

        // Extract the relative path (e.g., "uploads/67dc4a543ec7d.bin")
        $relativePath = substr($localPath, strpos($localPath, 'uploads/'));

        // Construct the full HTTP URL using consistent casing
        return "http://localhost/artlink/artlink_api/" . $relativePath;
    }

    public function markNotificationAsRead($notificationId, $userId) {
        try {
            // First verify the notification belongs to the user
            $stmt = $this->pdo->prepare("SELECT * FROM notification WHERE id = ? AND recipientId = ?");
            $stmt->execute([$notificationId, $userId]);
            $notification = $stmt->fetch();

            if (!$notification) {
                return [
                    "status" => "failed",
                    "message" => "Notification not found or unauthorized"
                ];
            }

            // Update the notification to mark it as read
            $stmt = $this->pdo->prepare("UPDATE notification SET `read` = 1 WHERE id = ?");
            $stmt->execute([$notificationId]);

            return [
                "status" => "success",
                "message" => "Notification marked as read",
                "payload" => [
                    "id" => $notificationId,
                    "read" => true
                ]
            ];
        } catch (PDOException $e) {
            return [
                "status" => "failed",
                "message" => "Database error: " . $e->getMessage()
            ];
        }
    }

    // Add the delete notification method
    public function deleteNotification($data) {
        try {
            if (!isset($data->notificationId) || !isset($data->userId)) {
                return $this->sendPayload(null, "failed", "Missing required fields", 400);
            }

            // First verify the notification belongs to the user
            $stmt = $this->pdo->prepare("SELECT * FROM notification WHERE id = ? AND recipientId = ?");
            $stmt->execute([$data->notificationId, $data->userId]);
            $notification = $stmt->fetch();

            if (!$notification) {
                return $this->sendPayload(null, "failed", "Notification not found or unauthorized", 404);
            }

            // Delete the notification
            $stmt = $this->pdo->prepare("DELETE FROM notification WHERE id = ?");
            $stmt->execute([$data->notificationId]);

            return $this->sendPayload(null, "success", "Notification deleted successfully", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error deleting notification: " . $e->getMessage(), 500);
        }
    }

    // Create a new conversation between two users
    public function createConversation($data) {
        try {
            $user1Id = isset($data->user1Id) ? $data->user1Id : null;
            $user2Id = isset($data->recipientId) ? $data->recipientId : null;
            $listingId = isset($data->listingId) ? $data->listingId : null;
            
            if (!$user1Id) {
                $user1Id = $this->getCurrentUserId();
            }
            
            if (!$user1Id || !$user2Id) {
                return $this->sendPayload(null, "failed", "Missing required user IDs", 400);
            }

            // Check if a conversation already exists between these users FOR THIS SPECIFIC LISTING
            // If listingId is provided, we look for a conversation that has this exact listingId
            // If listingId is null, we look for a conversation with null listingId
            $checkSql = "SELECT id FROM conversation 
                        WHERE ((user1Id = ? AND user2Id = ?) 
                        OR (user1Id = ? AND user2Id = ?))";
            
            // Add listing ID condition
            $params = [$user1Id, $user2Id, $user2Id, $user1Id];
            if ($listingId) {
                $checkSql .= " AND listingId = ?";
                $params[] = $listingId;
            } else {
                $checkSql .= " AND listingId IS NULL";
            }
                        
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute($params);
            $existingConversation = $checkStmt->fetch();
            
            if ($existingConversation) {
                // Return the existing conversation
                $conversationId = $existingConversation['id'];
                
                // Update the updatedAt timestamp
                $updateSql = "UPDATE conversation SET updatedAt = NOW() WHERE id = ?";
                $updateStmt = $this->pdo->prepare($updateSql);
                $updateStmt->execute([$conversationId]);
            } else {
                // Create a new conversation
                $sql = "INSERT INTO conversation (user1Id, user2Id, listingId, createdAt, updatedAt) 
                        VALUES (?, ?, ?, NOW(), NOW())";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$user1Id, $user2Id, $listingId]);
                
                $conversationId = $this->pdo->lastInsertId();
            }

            // Get the complete conversation with the other user's details
            $sql = "SELECT 
                    c.*,
                    (CASE 
                        WHEN c.user1Id = ? THEN c.user2Id
                        ELSE c.user1Id
                    END) as otherUserId
                    FROM conversation c
                    WHERE c.id = ?";
                    
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$user1Id, $conversationId]);
            $conversation = $stmt->fetch(\PDO::FETCH_ASSOC);
            
            // Rest of your method to fetch user details...
            
            return $this->sendPayload($conversation, "success", "Conversation created/retrieved successfully", 200);
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error creating conversation: " . $e->getMessage(), 500);
        }
    }
    
    // Mark all messages in a conversation as read
    public function markConversationAsRead($data) {
        try {
            if (!isset($data->userId) || !isset($data->conversationId)) {
                return $this->sendPayload(null, "failed", "Missing required fields", 400);
            }
            
            $sql = "UPDATE message 
                    SET readAt = NOW() 
                    WHERE conversationId = ? 
                    AND receiverId = ? 
                    AND readAt IS NULL";
                    
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$data->conversationId, $data->userId]);
            
            // Update conversation's updatedAt timestamp
            $updateSql = "UPDATE conversation 
                         SET updatedAt = NOW() 
                         WHERE id = ?";
                         
            $updateStmt = $this->pdo->prepare($updateSql);
            $updateStmt->execute([$data->conversationId]);
            
            return $this->sendPayload(
                ['conversationId' => $data->conversationId], 
                "success", 
                "Messages marked as read", 
                200
            );
            
        } catch (\PDOException $e) {
            return $this->sendPayload(
                null, 
                "failed", 
                "Error marking messages as read: " . $e->getMessage(), 
                500
            );
        }
    }
    
    // Send a message (HTTP fallback when WebSocket is unavailable)
    public function sendMessage($data) {
        try {
            if (!isset($data->senderId) || !isset($data->receiverId) || !isset($data->content)) {
                return $this->sendPayload(null, "failed", "Missing required fields", 400);
            }
            
            $conversationId = null;
            
            // Use provided conversation ID if available
            if (isset($data->conversationId)) {
                $conversationId = $data->conversationId;
                
                // Verify the conversation exists and involves both users
                $checkSql = "SELECT id FROM conversation 
                            WHERE id = ? 
                            AND ((user1Id = ? AND user2Id = ?) 
                            OR (user1Id = ? AND user2Id = ?))";
                $checkStmt = $this->pdo->prepare($checkSql);
                $checkStmt->execute([$conversationId, $data->senderId, $data->receiverId, 
                                   $data->receiverId, $data->senderId]);
                $validConversation = $checkStmt->fetch();
                
                if (!$validConversation) {
                    $conversationId = null; // Reset if conversation is invalid
                }
            }
            
            // If no valid conversation ID was provided, find or create one
            if (!$conversationId) {
                $conversationSql = "SELECT id FROM conversation 
                                  WHERE ((user1Id = ? AND user2Id = ?) 
                                  OR (user1Id = ? AND user2Id = ?))";
                
                $conversationStmt = $this->pdo->prepare($conversationSql);
                $conversationStmt->execute([
                    $data->senderId, $data->receiverId, 
                    $data->receiverId, $data->senderId
                ]);
                $conversation = $conversationStmt->fetch();
                
                if ($conversation) {
                    $conversationId = $conversation['id'];
                    
                    // Update the conversation's updatedAt timestamp
                    $updateSql = "UPDATE conversation SET updatedAt = NOW() WHERE id = ?";
                    $updateStmt = $this->pdo->prepare($updateSql);
                    $updateStmt->execute([$conversationId]);
                } else {
                    // Create a new conversation if none exists
                    $createSql = "INSERT INTO conversation (user1Id, user2Id, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())";
                    $createStmt = $this->pdo->prepare($createSql);
                    $createStmt->execute([$data->senderId, $data->receiverId]);
                    $conversationId = $this->pdo->lastInsertId();
                }
            }
            
            // Insert the message with the correct conversation ID
            $messageSql = "INSERT INTO message (conversationId, content, authorId, receiverId, createdAt) 
                         VALUES (?, ?, ?, ?, NOW())";
            $messageStmt = $this->pdo->prepare($messageSql);
            $messageStmt->execute([
                $conversationId,
                $data->content,
                $data->senderId,
                $data->receiverId
            ]);
            $messageId = $this->pdo->lastInsertId();
            
            // Create notification for message
            $senderInfoSql = "SELECT name FROM user WHERE id = ?";
            $senderStmt = $this->pdo->prepare($senderInfoSql);
            $senderStmt->execute([$data->senderId]);
            $sender = $senderStmt->fetch();
            
            $notificationContent = ($sender ? $sender['name'] : "Someone") . " sent you a message: " . 
                               (strlen($data->content) > 30 ? substr($data->content, 0, 30) . "..." : $data->content);
            
            $this->createNotification(
                "MESSAGE", 
                $notificationContent, 
                $data->receiverId, 
                $data->senderId, 
                null, null, null, 
                $messageId
            );
            
            $message = [
                'id' => $messageId,
                'content' => $data->content,
                'conversationId' => $conversationId,
                'authorId' => $data->senderId,
                'receiverId' => $data->receiverId,
                'createdAt' => date('Y-m-d H:i:s'),
                'updatedAt' => date('Y-m-d H:i:s'),
                'readAt' => null
            ];
            
            return $this->sendPayload($message, "success", "Message sent successfully", 201);
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error sending message: " . $e->getMessage(), 500);
        }
    }

    private function getCurrentUserId() {
        if (isset($_SESSION['user_id'])) {
            return $_SESSION['user_id'];
        }
        return null;
    }

    public function updateProfile($data) {
        try {
            if (!isset($data->userId) || !isset($data->imageData)) {
                return $this->sendPayload(null, "failed", "Missing required fields", 400);
            }

            $userId = $data->userId;
            $imageData = $data->imageData;
            
            $imagePath = $this->saveBase64File($imageData, 'image/jpeg');
            
            if (!$imagePath) {
                return $this->sendPayload(null, "failed", "Failed to save image. Make sure it's valid base64 data.", 500);
            }
        
        // Check if profile exists for user
        $checkSql = "SELECT id FROM profile WHERE userId = ?";
        $checkStmt = $this->pdo->prepare($checkSql);
        $checkStmt->execute([$userId]);
        $profile = $checkStmt->fetch();
        
        if ($profile) {
            // Update existing profile
            $sql = "UPDATE profile SET imageProfile = ? WHERE userId = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$imagePath, $userId]);
        } else {
            // Create new profile
            $sql = "INSERT INTO profile (userId, imageProfile, bio) VALUES (?, ?, '')";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$userId, $imagePath]);
        }
        
        // Return the HTTP URL of the profile image
        $imageUrl = $this->convertToHttpUrl($imagePath);
        
        return $this->sendPayload(
            ["imageProfile" => $imageUrl], 
            "success", 
            "Profile picture updated successfully", 
            200
        );
        
        } catch (\PDOException $e) {
            return $this->sendPayload(
                null, 
                "failed", 
                "Error updating profile: " . $e->getMessage(), 
                500
            );
        }
    }

    public function updateBio($data) {
        try {
            if (!isset($data->userId) || !isset($data->bio)) {
                return $this->sendPayload(null, "failed", "Missing required fields", 400);
            }

            $userId = $data->userId;
            $bio = $data->bio;

            // Check if profile exists for user
            $checkSql = "SELECT id FROM profile WHERE userId = ?";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([$userId]);
            $profile = $checkStmt->fetch();

            if ($profile) {
                // Update existing profile
                $sql = "UPDATE profile SET bio = ? WHERE userId = ?";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$bio, $userId]);
            } else {
                // Create new profile
                $sql = "INSERT INTO profile (userId, imageProfile, bio) VALUES (?, '', ?)";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$userId, $bio]);
            }

            return $this->sendPayload(
                null, 
                "success", 
                "Bio updated successfully", 
                200
            );
        } catch (\PDOException $e) {
            return $this->sendPayload(
                null, 
                "failed", 
                "Error updating bio: " . $e->getMessage(), 
                500
            );
        }
    }

    // Function to update an existing listing
    public function updateListing($listingId, $data)
    {
        try {
            // Validate required fields
            if (!isset($data->title) || !isset($data->content) || !isset($data->authorId) || !isset($data->listingDetails)) {
                return $this->sendPayload(null, "failed", "Missing required fields", 400);
            }

            // Validate listing details
            if (!isset($data->listingDetails->price) || !isset($data->listingDetails->category) || 
                !isset($data->listingDetails->condition) || !isset($data->listingDetails->location)) {
                return $this->sendPayload(null, "failed", "Missing listing details", 400);
            }

            // Verify the user is the owner of the listing
            $checkSql = "SELECT authorId FROM listing WHERE id = ?";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([$listingId]);
            $listing = $checkStmt->fetch();

            if (!$listing) {
                return $this->sendPayload(null, "failed", "Listing not found", 404);
            }

            if ($listing['authorId'] != $data->authorId) {
                return $this->sendPayload(null, "failed", "You are not authorized to update this listing", 403);
            }

            // Begin transaction
            $this->pdo->beginTransaction();

            // Update listing
            $sql = "UPDATE listing 
                    SET title = ?, content = ?, updatedAt = ?, published = ? 
                    WHERE id = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                $data->title,
                $data->content,
                date('Y-m-d H:i:s'),
                $data->published ? 1 : 0,
                $listingId
            ]);

            // Update listing details
            $detailsSql = "UPDATE listing_details 
                          SET price = ?, category = ?, `condition` = ?, location = ? 
                          WHERE listingId = ?";
            $detailsStmt = $this->pdo->prepare($detailsSql);
            $detailsStmt->execute([
                $data->listingDetails->price,
                $data->listingDetails->category,
                $data->listingDetails->condition,
                $data->listingDetails->location,
                $listingId
            ]);
            
            // Handle image updates
            if (isset($data->media) && is_array($data->media)) {
                // 1. Get IDs of existing images to keep
                $keepMediaIds = [];
                $newMediaItems = [];
                
                foreach ($data->media as $media) {
                    if (isset($media->id)) {
                        // This is an existing image to keep
                        $keepMediaIds[] = $media->id;
                    } else {
                        // This is a new image to add
                        $newMediaItems[] = $media;
                    }
                }
                
                // 2. Delete media that's not in the keep list
                if (!empty($keepMediaIds)) {
                    $placeholders = implode(',', array_fill(0, count($keepMediaIds), '?'));
                    $deleteSql = "DELETE FROM media WHERE listingId = ? AND id NOT IN ($placeholders)";
                    $params = array_merge([$listingId], $keepMediaIds);
                    $deleteStmt = $this->pdo->prepare($deleteSql);
                    $deleteStmt->execute($params);
                } else {
                    // If no media to keep, delete all media for this listing
                    $deleteAllSql = "DELETE FROM media WHERE listingId = ?";
                    $deleteAllStmt = $this->pdo->prepare($deleteAllSql);
                    $deleteAllStmt->execute([$listingId]);
                }
                
                // 3. Add new media items using the existing method
                if (!empty($newMediaItems)) {
                    $this->createMediaForListing($listingId, $newMediaItems);
                }
            }

            $this->pdo->commit();
            return $this->sendPayload(['listingId' => $listingId], "success", "Listing updated successfully", 200);

        } catch (\PDOException $e) {
            $this->pdo->rollBack();
            return $this->sendPayload(null, "failed", "Error updating listing: " . $e->getMessage(), 500);
        }
    }
}
