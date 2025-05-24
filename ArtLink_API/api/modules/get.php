<?php

/**
 * Get Class
 *
 * This PHP class provides methods for retrieving data related to employees and jobs.
 *
 * Usage:
 * 1. Include this class in your project.
 * 2. Create an instance of the class to access the provided methods.
 * 3. Call the appropriate method to retrieve the desired data.
 *
 * Example Usage:
 * ```
 * $get = new Get();
 * $employeesData = $get->get_employees();
 * $jobsData = $get->get_jobs();
 * ```
 *
 * Note: Customize the methods as needed to fetch data from your actual data source (e.g., database, API).
 */

require_once "global.php";

class Get extends GlobalMethods
{
    private $pdo;

    // HTTP status code constants
    const HTTP_OK = 200;
    const HTTP_NOT_FOUND = 404;
    const HTTP_FORBIDDEN = 403;
    const HTTP_SERVER_ERROR = 500;

    public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    // Secure version of executeQuery using prepared statements
    public function executeQuery($sql, $params = [])
    {
        $data = array(); // place to store records retrieved from the DB
        $errmsg = ""; // initialize error message variable
        $code = 0; // initialize status code variable

        try {
            $stmt = $this->pdo->prepare($sql); // prepared statement
            $stmt->execute($params); // bind params securely
            $result = $stmt->fetchAll(); // fetch the result

            if ($result) { // records found
                $code = self::HTTP_OK;
                foreach ($result as $record) {
                    array_push($data, $record);
                }
                return array("code" => $code, "data" => $data);
            } else { // no records found
                $errmsg = "No records found";
                $code = self::HTTP_NOT_FOUND;
            }
        } catch (\PDOException $e) {
            // Catch any PDO errors
            $errmsg = $e->getMessage();
            $code = self::HTTP_FORBIDDEN;
        }

        return array("code" => $code, "errmsg" => $errmsg);
    }

    public function get_records($table, $condition = null, $params = [])
    {
        $sqlString = "SELECT * FROM $table";
        if ($condition != null) {
            $sqlString .= " WHERE " . $condition;
        }

        $result = $this->executeQuery($sqlString, $params);

        if ($result['code'] == self::HTTP_OK) {
            return $this->sendPayload($result['data'], "success", "Successfully retrieved records.", $result['code']);
        }

        return $this->sendPayload(null, "failed", $result['errmsg'], $result['code']);
    }


    public function getPosts($userId)
    {
        $sql = "SELECT p.*, 
                u.name AS authorName, 
                u.username AS authorUsername,
                (SELECT imageProfile FROM profile WHERE userId = p.authorId LIMIT 1) as authorProfileImage
                FROM post p 
                JOIN user u ON p.authorId = u.id 
                ORDER BY p.createdAt DESC";
                
        $posts = $this->executeQuery($sql);

        if ($posts['code'] == self::HTTP_OK) {
            foreach ($posts['data'] as &$post) {
                $postId = $post['id'];
                
                // Author data structuring
                $post['author'] = [
                    'id' => $post['authorId'],
                    'name' => $post['authorName'],
                    'username' => $post['authorUsername'],
                    'profileImage' => $post['authorProfileImage'] ? $this->convertToHttpUrl($post['authorProfileImage']) : null
                ];
                
                // Remove duplicate fields
                unset($post['authorName']);
                unset($post['authorUsername']);
                unset($post['authorProfileImage']);

                // Attach media
                $mediaSql = "SELECT * FROM media WHERE postId = ?";
                $media = $this->executeQuery($mediaSql, [$postId]);
                if ($media['code'] == self::HTTP_OK) {
                    foreach ($media['data'] as &$mediaItem) {
                        $mediaItem['url'] = $this->convertToHttpUrl($mediaItem['url']);
                    }
                    $post['media'] = $media['data'];
                } else {
                    $post['media'] = [];
                }

                // Count likes (only where commentId is NULL) and saves
                $likeCount = $this->executeQuery("SELECT COUNT(*) as count FROM `like` WHERE postId = ? AND commentId IS NULL", [$postId]);
                $saveCount = $this->executeQuery("SELECT COUNT(*) as count FROM save WHERE postId = ?", [$postId]);
                $post['likeCount'] = $likeCount['data'][0]['count'] ?? 0;
                $post['saveCount'] = $saveCount['data'][0]['count'] ?? 0;

                // Check if current user liked/saved this post (only check likes where commentId is NULL)
                if ($userId) {
                    $liked = $this->executeQuery("SELECT 1 FROM `like` WHERE postId = ? AND userId = ? AND commentId IS NULL", [$postId, $userId]);
                    $saved = $this->executeQuery("SELECT 1 FROM save WHERE postId = ? AND userId = ?", [$postId, $userId]);
                    $post['likedByUser'] = $liked['code'] === self::HTTP_OK && !empty($liked['data']);
                    $post['savedByUser'] = $saved['code'] === self::HTTP_OK && !empty($saved['data']);
                }
            }
            return $this->sendPayload($posts['data'], "success", "Posts retrieved successfully.", self::HTTP_OK);
        }

        return $this->sendPayload(null, "failed", "No posts found.", self::HTTP_NOT_FOUND);
    }

    public function getSavedPosts($userId)
    {
        // Fetch saved posts with media and counts
        $sql = "SELECT p.*, 
                       m.id AS mediaId, m.url AS mediaUrl, m.mediaType,
                       (SELECT COUNT(*) FROM `like` WHERE postId = p.id AND commentId IS NULL) as likeCount,
                       (SELECT COUNT(*) FROM comment WHERE postId = p.id) as commentCount 
                FROM save s 
                JOIN post p ON s.postId = p.id 
                LEFT JOIN media m ON p.id = m.postId 
                WHERE s.userId = ?";
                
        $savedPosts = $this->executeQuery($sql, [$userId]);

        if ($savedPosts['code'] == self::HTTP_OK) {
            // Group media by post
            $postsWithMedia = [];
            foreach ($savedPosts['data'] as $post) {
                $postId = $post['id'];
                if (!isset($postsWithMedia[$postId])) {
                    $postsWithMedia[$postId] = [
                        'id' => $post['id'],
                        'title' => $post['title'],
                        'content' => $post['content'],
                        'createdAt' => $post['createdAt'],
                        'updatedAt' => $post['updatedAt'],
                        'authorId' => $post['authorId'],
                        'published' => $post['published'],
                        'likes' => intval($post['likeCount']),
                        'comments' => intval($post['commentCount']),
                        'media' => []
                    ];
                }
                // Add media if it exists
                if ($post['mediaId']) {
                    $postsWithMedia[$postId]['media'][] = [
                        'id' => $post['mediaId'],
                        'url' => $this->convertToHttpUrl($post['mediaUrl']),
                        'mediaType' => $post['mediaType']
                    ];
                }
            }

            return $this->sendPayload(array_values($postsWithMedia), "success", "Saved posts retrieved successfully.", self::HTTP_OK);
        }

        return $this->sendPayload(null, "failed", "No saved posts found.", self::HTTP_NOT_FOUND);
    }

    public function getLikedPosts($userId)
    {
        $sql = "SELECT p.*, 
                       GROUP_CONCAT(m.url) as mediaUrls,
                       GROUP_CONCAT(m.mediaType) as mediaTypes,
                       (SELECT COUNT(*) FROM `like` WHERE postId = p.id AND commentId IS NULL) as likeCount,
                       (SELECT COUNT(*) FROM comment WHERE postId = p.id) as commentCount
                FROM `like` l
                JOIN post p ON l.postId = p.id
                LEFT JOIN media m ON p.id = m.postId
                WHERE l.userId = ? AND l.commentId IS NULL
                GROUP BY p.id
                ORDER BY p.createdAt DESC";

        $likedPosts = $this->executeQuery($sql, [$userId]);

        if ($likedPosts['code'] == self::HTTP_OK) {
            $posts = array_map(function ($post) {
                $mediaUrls = $post['mediaUrls'] ? explode(',', $post['mediaUrls']) : [];
                $mediaTypes = $post['mediaTypes'] ? explode(',', $post['mediaTypes']) : [];
                $media = array_map(function ($url, $type) {
                    return [
                        'url' => $this->convertToHttpUrl($url),
                        'mediaType' => $type
                    ];
                }, $mediaUrls, $mediaTypes);

                return [
                    'id' => $post['id'],
                    'title' => $post['title'],
                    'content' => $post['content'],
                    'createdAt' => $post['createdAt'],
                    'media' => $media,
                    'likes' => intval($post['likeCount']),
                    'comments' => intval($post['commentCount'])
                ];
            }, $likedPosts['data']);

            return $this->sendPayload($posts, "success", "Liked posts retrieved successfully", self::HTTP_OK);
        }

        return $this->sendPayload(null, "failed", "No liked posts found.", self::HTTP_NOT_FOUND);
    }

    public function search($query)
    {
        try {
            // Search in posts with proper media handling
            $postSql = "SELECT p.*, 
                       u.name as authorName, 
                       u.username as authorUsername,
                       GROUP_CONCAT(DISTINCT m.url) as mediaUrls,
                       GROUP_CONCAT(DISTINCT m.mediaType) as mediaTypes,
                       (SELECT COUNT(*) FROM `like` l WHERE l.postId = p.id) as likeCount,
                       (SELECT COUNT(*) FROM comment c WHERE c.postId = p.id) as commentCount
                       FROM post p 
                       LEFT JOIN user u ON p.authorId = u.id 
                       LEFT JOIN media m ON m.postId = p.id 
                       WHERE p.title LIKE ? OR p.content LIKE ?
                       GROUP BY p.id
                       ORDER BY p.createdAt DESC";

            // Search in users with proper profile image handling
            $userSql = "SELECT u.id, u.name, u.username, 
                       m.url as profileImage,
                       (SELECT COUNT(*) FROM post WHERE authorId = u.id) as postCount,
                       (SELECT COUNT(*) FROM follow WHERE followingId = u.id) as followers,
                       (SELECT COUNT(*) FROM follow WHERE followerId = u.id) as following
                       FROM user u 
                       LEFT JOIN media m ON m.url LIKE '%profile%' AND m.postId IS NULL AND m.listingId IS NULL
                       WHERE u.name LIKE ? OR u.username LIKE ?
                       GROUP BY u.id";

            $searchTerm = "%$query%";

            // Execute post search
            $postStmt = $this->pdo->prepare($postSql);
            $postStmt->execute([$searchTerm, $searchTerm]);
            $posts = $postStmt->fetchAll();

            // Execute user search
            $userStmt = $this->pdo->prepare($userSql);
            $userStmt->execute([$searchTerm, $searchTerm]);
            $users = $userStmt->fetchAll();

            // Format results with proper URL conversion
            $results = [
                'posts' => array_map(function ($post) {
                    $mediaUrls = $post['mediaUrls'] ? explode(',', $post['mediaUrls']) : [];
                    $mediaTypes = $post['mediaTypes'] ? explode(',', $post['mediaTypes']) : [];

                    $media = array_map(function ($url, $type) {
                        return [
                            'url' => $this->convertToHttpUrl($url),
                            'mediaType' => $type
                        ];
                    }, $mediaUrls, $mediaTypes);

                    return [
                        'id' => $post['id'],
                        'type' => 'post',
                        'title' => $post['title'],
                        'content' => $post['content'],
                        'author' => [
                            'name' => $post['authorName'],
                            'username' => $post['authorUsername']
                        ],
                        'media' => $media,
                        'likes' => intval($post['likeCount']),
                        'comments' => intval($post['commentCount']),
                        'createdAt' => $post['createdAt']
                    ];
                }, $posts),
                'users' => array_map(function ($user) {
                    return [
                        'id' => $user['id'],
                        'type' => 'user',
                        'name' => $user['name'],
                        'username' => $user['username'],
                        'profileImage' => $user['profileImage'] ? $this->convertToHttpUrl($user['profileImage']) : null,
                        'stats' => [
                            'posts' => intval($user['postCount']),
                            'followers' => intval($user['followers']),
                            'following' => intval($user['following'])
                        ]
                    ];
                }, $users)
            ];

            return $this->sendPayload($results, "success", "Search results retrieved successfully", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error performing search: " . $e->getMessage(), 500);
        }
    }

    public function getUserProfile($userId)
    {
        try {
            // First get the current user's ID from query parameters
            $currentUserId = isset($_GET['userId']) ? $_GET['userId'] : null;
            
            // DEBUG: Add direct check to verify follow status
            if ($currentUserId) {
                $checkSql = "SELECT COUNT(*) > 0 as is_following FROM follow WHERE followerId = ? AND followingId = ?";
                $checkStmt = $this->pdo->prepare($checkSql);
                $checkStmt->execute([$currentUserId, $userId]);
                $followStatus = $checkStmt->fetch();
                error_log("DEBUG FOLLOW CHECK: User $currentUserId following $userId = " . 
                         ($followStatus['is_following'] ? 'TRUE' : 'FALSE'));
            }
            
            $sql = "SELECT u.*, 
                    (SELECT COUNT(*) FROM post WHERE authorId = u.id) as postCount,
                    (SELECT COUNT(*) FROM follow WHERE followingId = u.id) as followers,
                    (SELECT COUNT(*) FROM follow WHERE followerId = u.id) as following,
                    (SELECT imageProfile FROM profile WHERE userId = u.id LIMIT 1) as profileImage,
                    (SELECT bio FROM profile WHERE userId = u.id LIMIT 1) as bio,
                    " . ($currentUserId ? "(SELECT COUNT(*) FROM follow WHERE followerId = ? AND followingId = u.id) as followCount" : "0 as followCount") . "
                    FROM user u 
                    WHERE u.id = ?";

            $stmt = $this->pdo->prepare($sql);
            if ($currentUserId) {
                $stmt->execute([$currentUserId, $userId]);
            } else {
                $stmt->execute([$userId]);
            }
            $user = $stmt->fetch();

            if ($user) {
                // Get user's posts with counts
                $postsSql = "SELECT p.*, 
                            GROUP_CONCAT(m.url) as mediaUrls,
                            GROUP_CONCAT(m.mediaType) as mediaTypes,
                            (SELECT COUNT(*) FROM `like` WHERE postId = p.id AND commentId IS NULL) as likeCount,
                            (SELECT COUNT(*) FROM comment WHERE postId = p.id) as commentCount
                            FROM post p 
                            LEFT JOIN media m ON p.id = m.postId
                            WHERE p.authorId = ?
                            GROUP BY p.id
                            ORDER BY p.createdAt DESC";

                $postsStmt = $this->pdo->prepare($postsSql);
                $postsStmt->execute([$userId]);
                $posts = $postsStmt->fetchAll();

                // Format posts data
                $formattedPosts = array_map(function ($post) {
                    $mediaUrls = $post['mediaUrls'] ? explode(',', $post['mediaUrls']) : [];
                    $mediaTypes = $post['mediaTypes'] ? explode(',', $post['mediaTypes']) : [];

                    $media = array_map(function ($url, $type) {
                        return [
                            'url' => $this->convertToHttpUrl($url),
                            'mediaType' => $type
                        ];
                    }, $mediaUrls, $mediaTypes);

                    return [
                        'id' => $post['id'],
                        'title' => $post['title'],
                        'content' => $post['content'],
                        'createdAt' => $post['createdAt'],
                        'media' => $media,
                        'likes' => intval($post['likeCount']),
                        'comments' => intval($post['commentCount'])
                    ];
                }, $posts);

                $result = [
                    'id' => $user['id'],
                    'name' => $user['name'],
                    'username' => $user['username'],
                    'bio' => $user['bio'] ?? '',
                    'profileImage' => $user['profileImage'] ? $this->convertToHttpUrl($user['profileImage']) : null,
                    'postCount' => $user['postCount'],
                    'followers' => $user['followers'],
                    'following' => $user['following'],
                    'isFollowing' => ($user['followCount'] > 0),
                    'posts' => $formattedPosts
                ];

                return $this->sendPayload($result, "success", "User profile retrieved successfully", 200);
            }

            return $this->sendPayload(null, "failed", "User not found", 404);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving user profile: " . $e->getMessage(), 500);
        }
    }

    public function getPost($postId, $userId = null)
    {
        try {
            $sql = "SELECT p.*, 
                    u.name as authorName, 
                    u.username as authorUsername,
                    (SELECT imageProfile FROM profile WHERE profile.userId = u.id LIMIT 1) as authorProfileImage,
                    COUNT(DISTINCT CASE WHEN l.commentId IS NULL THEN l.id END) as likeCount,
                    COUNT(DISTINCT s.id) as saveCount
                    FROM post p 
                    LEFT JOIN user u ON p.authorId = u.id
                    LEFT JOIN `like` l ON p.id = l.postId
                    LEFT JOIN save s ON p.id = s.postId
                    WHERE p.id = ?
                    GROUP BY p.id";

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$postId]);
            $post = $stmt->fetch();

            if ($post) {
                // Fetch media separately
                $mediaSql = "SELECT url, COALESCE(mediaType, 'unknown') as mediaType FROM media WHERE postId = ?";
                $mediaStmt = $this->pdo->prepare($mediaSql);
                $mediaStmt->execute([$postId]);
                $media = $mediaStmt->fetchAll();

                // Check if the user has liked or saved the post
                $likedByUser = false;
                $savedByUser = false;
                if ($userId) {
                    // Only check for post likes (where commentId is NULL)
                    $liked = $this->executeQuery("SELECT 1 FROM `like` WHERE postId = ? AND userId = ? AND commentId IS NULL", [$postId, $userId]);
                    $saved = $this->executeQuery("SELECT 1 FROM save WHERE postId = ? AND userId = ?", [$postId, $userId]);
                    $likedByUser = $liked['code'] === self::HTTP_OK && !empty($liked['data']);
                    $savedByUser = $saved['code'] === self::HTTP_OK && !empty($saved['data']);
                }

                // Get comments with their like counts and nested replies
                $commentsSql = "WITH RECURSIVE CommentHierarchy AS (
                    -- Base case: top-level comments (no parent)
                    SELECT 
                        c.*, 
                        u.name as authorName, 
                        u.username as authorUsername,
                        (SELECT imageProfile FROM profile WHERE profile.userId = u.id LIMIT 1) as authorProfileImage,
                        0 as level
                    FROM comment c
                    JOIN user u ON c.authorId = u.id
                    WHERE c.postId = ? AND c.parentId IS NULL
                    
                    UNION ALL
                    
                    -- Recursive case: replies to comments
                    SELECT 
                        c.*, 
                        u.name as authorName, 
                        u.username as authorUsername,
                        (SELECT imageProfile FROM profile WHERE profile.userId = u.id LIMIT 1) as authorProfileImage,
                        ch.level + 1
                    FROM comment c
                    JOIN CommentHierarchy ch ON c.parentId = ch.id
                    JOIN user u ON c.authorId = u.id
                )
                SELECT 
                    ch.*,
                    COUNT(DISTINCT l.id) as likeCount,
                    EXISTS(SELECT 1 FROM `like` WHERE commentId = ch.id AND userId = ?) as likedByUser
                FROM CommentHierarchy ch
                LEFT JOIN `like` l ON ch.id = l.commentId
                GROUP BY ch.id
                ORDER BY ch.parentId ASC, ch.createdAt DESC";

                $commentsStmt = $this->pdo->prepare($commentsSql);
                $commentsStmt->execute([$postId, $userId]);
                $commentsFlat = $commentsStmt->fetchAll();

                // Convert flat comments array to nested structure
                $comments = $this->buildCommentTree($commentsFlat);

                $result = [
                    'id' => $post['id'],
                    'title' => $post['title'],
                    'content' => $post['content'],
                    'createdAt' => $post['createdAt'],
                    'author' => [
                        'id' => $post['authorId'],
                        'name' => $post['authorName'],
                        'username' => $post['authorUsername'],
                        'profileImage' => $post['authorProfileImage'] ? $this->convertToHttpUrl($post['authorProfileImage']) : null
                    ],
                    'media' => array_map(function ($mediaItem) {
                        return [
                            'url' => $this->convertToHttpUrl($mediaItem['url']),
                            'mediaType' => $mediaItem['mediaType']
                        ];
                    }, $media),
                    'likes' => intval($post['likeCount']),
                    'saves' => intval($post['saveCount']),
                    'likedByUser' => $likedByUser,
                    'savedByUser' => $savedByUser,
                    'comments' => $comments
                ];

                return $this->sendPayload($result, "success", "Post retrieved successfully", 200);
            }

            return $this->sendPayload(null, "failed", "Post not found", 404);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving post: " . $e->getMessage(), 500);
        }
    }

    private function buildCommentTree($comments, $parentId = null)
    {
        $branch = [];

        foreach ($comments as $comment) {
            if ($comment['parentId'] == $parentId) {
                $children = $this->buildCommentTree($comments, $comment['id']);

                $commentData = [
                    'id' => $comment['id'],
                    'content' => $comment['content'],
                    'createdAt' => $comment['createdAt'],
                    'author' => [
                        'id' => $comment['authorId'],
                        'name' => $comment['authorName'],
                        'username' => $comment['authorUsername'],
                        'profileImage' => $comment['authorProfileImage'] ? $this->convertToHttpUrl($comment['authorProfileImage']) : null
                    ],
                    'likes' => intval($comment['likeCount']),
                    'likedByUser' => (bool)$comment['likedByUser']
                ];

                if (!empty($children)) {
                    $commentData['replies'] = $children;
                }

                $branch[] = $commentData;
            }
        }

        return $branch;
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

    public function checkFollowingStatus($followingId, $userId) {
        try {
            if (!$userId) {
                return $this->sendPayload(
                    ["following" => false],
                    "success",
                    "Not following (user not logged in)",
                    200
                );
            }

            // Check if userId is following followingId
            $sql = "SELECT id FROM follow WHERE followerId = ? AND followingId = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$userId, $followingId]);
            $result = $stmt->fetch();

            return $this->sendPayload(
                ["following" => !!$result],
                "success",
                "Follow status retrieved successfully",
                200
            );
        } catch (\PDOException $e) {
            return $this->sendPayload(
                null,
                "failed",
                "Error checking follow status: " . $e->getMessage(),
                500
            );
        }
    }

    // Function to fetch notifications for a user
    public function getNotifications($userId) {
        $sql = "SELECT n.*, n.read AS `read`, u.name AS senderName, u.username AS senderUsername
                FROM notification n
                JOIN user u ON n.senderId = u.id
                WHERE n.recipientId = ?
                ORDER BY n.createdAt DESC";
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$userId]);
            $notifications = $stmt->fetchAll();

            if ($notifications) {
                // Convert read status to boolean
                foreach ($notifications as &$notification) {
                    $notification['read'] = (bool)$notification['read'];
                }
                return $this->sendPayload($notifications, "success", "Notifications retrieved successfully", 200);
            } else {
                return $this->sendPayload([], "success", "No notifications found", 200);
            }
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving notifications: " . $e->getMessage(), 500);
        }
    }

    public function getUnreadMessagesCount($userId) {
        try {
            $sql = "SELECT COUNT(*) as count FROM message 
                    WHERE receiverId = ? 
                    AND readAt IS NULL";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$userId]);
            $result = $stmt->fetch();
            
            return $this->sendPayload(
                ['count' => (int)$result['count']], 
                "success", 
                "Unread messages count retrieved successfully",
                200 // Adding the required status code parameter
            );
        } catch (\PDOException $e) {
            return $this->sendPayload(
                null, 
                "failed", 
                "Error retrieving unread messages count: " . $e->getMessage(),
                500 // Adding the required status code parameter for error case
            );
        }
    }

    // Get conversations for a user
    public function getUserConversations($userId) {
        try {
            $sql = "SELECT 
                    c.*,
                    (CASE 
                        WHEN c.user1Id = ? THEN c.user2Id
                        ELSE c.user1Id
                    END) as otherUserId,
                    (SELECT m.content FROM message m WHERE m.conversationId = c.id ORDER BY m.createdAt DESC LIMIT 1) as lastMessage,
                    (SELECT COUNT(*) FROM message m WHERE m.conversationId = c.id AND m.receiverId = ? AND m.readAt IS NULL) as unreadCount
                FROM conversation c
                WHERE c.user1Id = ? OR c.user2Id = ?
                ORDER BY c.updatedAt DESC";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$userId, $userId, $userId, $userId]);
            $conversations = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            
            if ($conversations) {
                // Get other user details for each conversation
                foreach ($conversations as &$conversation) {
                    $otherUserId = $conversation['otherUserId'];
                    
                    $userSql = "SELECT 
                                u.id, u.name, u.username, u.email,
                                p.imageProfile
                                FROM user u
                                LEFT JOIN profile p ON u.id = p.userId
                                WHERE u.id = ?";
                    
                    $userStmt = $this->pdo->prepare($userSql);
                    $userStmt->execute([$otherUserId]);
                    $otherUser = $userStmt->fetch(\PDO::FETCH_ASSOC);
                    
                    if ($otherUser && $otherUser['imageProfile']) {
                        $otherUser['imageProfile'] = $this->convertToHttpUrl($otherUser['imageProfile']);
                    }
                    
                    $conversation['otherUser'] = $otherUser ?: ['id' => $otherUserId, 'name' => 'Unknown User'];
                    $conversation['unreadCount'] = (int)$conversation['unreadCount'];
                }
                
                return $this->sendPayload($conversations, "success", "Conversations retrieved successfully", 200);
            }
            
            return $this->sendPayload([], "success", "No conversations found", 200);
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving conversations: " . $e->getMessage(), 500);
        }
    }
    
    // Get messages for a specific conversation
    public function getConversationMessages($conversationId) {
        try {
            $sql = "SELECT 
                    m.*,
                    u1.name as authorName, u1.username as authorUsername,
                    u2.name as receiverName, u2.username as receiverUsername
                    FROM message m
                    JOIN user u1 ON m.authorId = u1.id
                    JOIN user u2 ON m.receiverId = u2.id
                    WHERE m.conversationId = ?
                    ORDER BY m.createdAt ASC";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$conversationId]);
            $messages = $stmt->fetchAll(\PDO::FETCH_ASSOC);
            
            // Mark messages as read
            $updateSql = "UPDATE message 
                       SET readAt = NOW() 
                       WHERE conversationId = ? 
                       AND receiverId = ? 
                       AND readAt IS NULL";
            
            // Get current user to mark their received messages as read
            $currentUser = isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;
            if ($currentUser) {
                $updateStmt = $this->pdo->prepare($updateSql);
                $updateStmt->execute([$conversationId, $currentUser]);
            }
            
            if ($messages) {
                // Format the messages
                foreach ($messages as &$message) {
                    $message['author'] = [
                        'id' => $message['authorId'],
                        'name' => $message['authorName'],
                        'username' => $message['authorUsername']
                    ];
                    
                    $message['receiver'] = [
                        'id' => $message['receiverId'],
                        'name' => $message['receiverName'],
                        'username' => $message['receiverUsername']
                    ];
                    
                    // Clean up duplicate data
                    unset($message['authorName'], $message['authorUsername'], 
                          $message['receiverName'], $message['receiverUsername']);
                }
                
                return $this->sendPayload($messages, "success", "Messages retrieved successfully", 200);
            }
            
            return $this->sendPayload([], "success", "No messages found", 200);
            
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving messages: " . $e->getMessage(), 500);
        }
    }

    public function getFollowingUsers($userId) {
        try {
            $sql = "SELECT u.id, u.name, u.username, p.imageProfile 
                    FROM follows f
                    JOIN user u ON f.followingId = u.id
                    LEFT JOIN profile p ON u.id = p.userId
                    WHERE f.followerId = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$userId]);
            $followingUsers = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            return $this->sendPayload($followingUsers, "success", "Following users retrieved successfully", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving following users: " . $e->getMessage(), 500);
        }
    }

    // Get users that a user is following
    public function getUserFollowing($userId) {
        try {
            $sql = "SELECT u.id, u.name, u.username, p.imageProfile 
                    FROM follow f
                    JOIN user u ON f.followingId = u.id
                    LEFT JOIN profile p ON u.id = p.userId
                    WHERE f.followerId = ?";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$userId]);
            $following = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Process profile images
            foreach ($following as &$user) {
                if (isset($user['imageProfile'])) {
                    $user['imageProfile'] = $this->convertToHttpUrl($user['imageProfile']);
                }
            }

            return $this->sendPayload($following, "success", "Following list retrieved successfully", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving following list: " . $e->getMessage(), 500);
        }
    }

    // Get all listings with their details
    public function getListings()
    {
        try {
            $sql = "SELECT l.*, u.name as authorName, u.username as authorUsername, 
                           ld.price, ld.category, ld.`condition`, ld.location,
                           p.imageProfile as authorProfileImage
                    FROM listing l
                    JOIN user u ON l.authorId = u.id
                    LEFT JOIN listing_details ld ON l.id = ld.listingId
                    LEFT JOIN profile p ON u.id = p.userId
                    WHERE l.published = 1
                    ORDER BY l.createdAt DESC";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute();
            $listings = $stmt->fetchAll();

            // Get media for each listing
            foreach ($listings as &$listing) {
                $listing['media'] = $this->getMediaForListing($listing['id']);
                if ($listing['authorProfileImage']) {
                    $listing['authorProfileImage'] = $this->convertToHttpUrl($listing['authorProfileImage']);
                }

                // Structure the listing details
                $listing['listingDetails'] = [
                    'price' => $listing['price'],
                    'category' => $listing['category'],
                    'condition' => $listing['condition'],
                    'location' => $listing['location']
                ];

                // Remove the redundant fields
                unset($listing['price'], $listing['category'], $listing['condition'], $listing['location']);
            }

            return $this->sendPayload($listings, "success", "Listings retrieved successfully", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving listings: " . $e->getMessage(), 500);
        }
    }

    // Get a specific listing by ID
    public function getListingById($id)
    {
        try {
            $sql = "SELECT l.*, u.name as authorName, u.username as authorUsername,
                           ld.price, ld.category, ld.`condition`, ld.location,
                           p.imageProfile as authorProfileImage
                    FROM listing l
                    JOIN user u ON l.authorId = u.id
                    LEFT JOIN listing_details ld ON l.id = ld.listingId
                    LEFT JOIN profile p ON u.id = p.userId
                    WHERE l.id = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$id]);
            $listing = $stmt->fetch();

            if (!$listing) {
                return $this->sendPayload(null, "failed", "Listing not found", 404);
            }

            // Structure the listing data
            $listing['media'] = $this->getMediaForListing($listing['id']);
            if ($listing['authorProfileImage']) {
                $listing['authorProfileImage'] = $this->convertToHttpUrl($listing['authorProfileImage']);
            }

            // Structure the author information
            $listing['author'] = [
                'id' => $listing['authorId'],
                'name' => $listing['authorName'],
                'username' => $listing['authorUsername'],
                'profileImage' => $listing['authorProfileImage']
            ];

            // Structure the listing details
            $listing['listingDetails'] = [
                'price' => $listing['price'],
                'category' => $listing['category'],
                'condition' => $listing['condition'],
                'location' => $listing['location']
            ];

            // Remove duplicate fields
            unset($listing['authorName'], $listing['authorUsername'], $listing['authorProfileImage'],
                  $listing['price'], $listing['category'], $listing['condition'], $listing['location']);

            return $this->sendPayload($listing, "success", "Listing retrieved successfully", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving listing: " . $e->getMessage(), 500);
        }
    }

    // Get listings for a specific user
    public function getUserListings($userId)
    {
        try {
            $sql = "SELECT l.*, u.name as authorName, u.username as authorUsername,
                           ld.price, ld.category, ld.`condition`, ld.location,
                           p.imageProfile as authorProfileImage
                    FROM listing l
                    JOIN user u ON l.authorId = u.id
                    LEFT JOIN listing_details ld ON l.id = ld.listingId
                    LEFT JOIN profile p ON u.id = p.userId
                    WHERE l.authorId = ? AND l.published = 1
                    ORDER BY l.createdAt DESC";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$userId]);
            $listings = $stmt->fetchAll();

            // Get media for each listing
            foreach ($listings as &$listing) {
                $listing['media'] = $this->getMediaForListing($listing['id']);
                if ($listing['authorProfileImage']) {
                    $listing['authorProfileImage'] = $this->convertToHttpUrl($listing['authorProfileImage']);
                }

                // Structure the listing details
                $listing['listingDetails'] = [
                    'price' => $listing['price'],
                    'category' => $listing['category'],
                    'condition' => $listing['condition'],
                    'location' => $listing['location']
                ];

                // Remove duplicate fields
                unset($listing['price'], $listing['category'], $listing['condition'], $listing['location']);
            }

            return $this->sendPayload($listings, "success", "User listings retrieved successfully", 200);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Error retrieving user listings: " . $e->getMessage(), 500);
        }
    }

    // Helper function to get media for a listing
    private function getMediaForListing($listingId)
    {
        $sql = "SELECT id, url, mediaType FROM media WHERE listingId = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$listingId]);
        $media = $stmt->fetchAll();

        foreach ($media as &$item) {
            $item['url'] = $this->convertToHttpUrl($item['url']);
        }

        return $media;
    }
}
