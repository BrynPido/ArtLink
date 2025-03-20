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
    private function saveBase64File($base64Data, $mediaType)
    {
        // Define the upload directory
        $uploadDir = __DIR__ . '/../../uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true); // Create the directory if it doesn't exist
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
        $sql = "INSERT INTO listing (createdAt, updatedAt, title, content, published, authorId) VALUES (?, ?, ?, ?, ?, ?)";
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                date('Y-m-d H:i:s'),
                date('Y-m-d H:i:s'),
                $data->title,
                $data->content,
                $data->published ? 1 : 0,
                $data->authorId
            ]);

            $listingId = $this->pdo->lastInsertId(); // Get the ID of the newly created listing

            // Handle media insertion if provided
            if (!empty($data->media)) {
                $this->createMediaForListing($listingId, $data->media);
            }

            return $this->sendPayload(['listingId' => $listingId], "success", "Listing created successfully", 201);
        } catch (\PDOException $e) {
            return $this->sendPayload(null, "failed", "Listing creation failed: " . $e->getMessage(), 400);
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

    // Method to like a post
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
                return ["status" => "success", "message" => "Post liked"];
            }
        } catch (PDOException $e) {
            // Log the error and return a valid JSON response
            error_log("PDOException: " . $e->getMessage());
            return ["status" => "error", "message" => "Database error"];
        }
    }

    // Method to save a post
    public function savePost($data)
    {
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
    }
}
