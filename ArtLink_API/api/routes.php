<?php

/**
 * API Endpoint Router
 *
 * This PHP script serves as a simple API endpoint router, handling GET and POST requests for specific resources.
 *
 *
 * Usage:
 * 1. Include this script in your project.
 * 2. Define resource-specific logic in the 'get.php' and 'post.php' modules.
 * 3. Send requests to the appropriate endpoints defined in the 'switch' cases below.
 *
 * Example Usage:
 * - API_URL: http://localhost/demoproject/api
 * - GET request for employees: API_URL/employees
 * - GET request for jobs: API_URL/jobs
 * - POST request for adding employees: API_URL/addemployee (with JSON data in the request body)
 * - POST request for adding jobs: API_URL/addjob (with JSON data in the request body)
 *
 */

// API routes
$method = $_SERVER['REQUEST_METHOD'];
$request = explode('/', trim($_REQUEST['request'], '/'));
$input = json_decode(file_get_contents('php://input'), true);

// Add CORS headers
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

// Handle preflight (OPTIONS) requests
if ($method == 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Initialize database connection and modules
require_once "./config/database.php";
require_once "./modules/get.php";
require_once "./modules/post.php";
require_once "./auth/auth.php";
require_once "./vendor/autoload.php";

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/config');
$dotenv->load();

$con = new Connection();
$pdo = $con->connect();
$get = new Get($pdo);
$post = new Post($pdo);
$auth = new Auth($pdo);

// Handle routes based on HTTP method
switch ($method) {
    case 'GET':
        switch ($request[0]) {
            case 'messages':
                if (isset($request[1]) && $request[1] === 'unread-count' && isset($request[2])) {
                    $userId = intval($request[2]);
                    echo json_encode($get->getUnreadMessagesCount($userId));
                }
                break;
            case 'conversations':
                if (isset($request[1])) {
                    // Get all conversations for a user
                    if (is_numeric($request[1]) && !isset($request[2])) {
                        $userId = intval($request[1]);
                        echo json_encode($get->getUserConversations($userId));
                    } 
                    // Get messages for a specific conversation
                    else if (is_numeric($request[1]) && isset($request[2]) && $request[2] === 'messages') {
                        $conversationId = intval($request[1]);
                        echo json_encode($get->getConversationMessages($conversationId));
                    }
                }
                break;
            case 'getPosts':
                $userId = isset($_GET['userId']) ? intval($_GET['userId']) : null;
                $response = $get->getPosts($userId);
                echo json_encode($response, JSON_UNESCAPED_SLASHES); // Encode the response here
                break;
            case 'getSavedPosts':
                // Extract userId from query parameters
                $userId = isset($_GET['userId']) ? intval($_GET['userId']) : null; // Get user ID from query parameters
                if ($userId !== null) {
                    $response = $get->getSavedPosts($userId); // Pass user ID to the method
                    echo json_encode($response, JSON_UNESCAPED_SLASHES); // Encode the response here
                } else {
                    echo json_encode(["status" => "failed", "message" => "User ID is required."]);
                    http_response_code(400); // Bad Request
                }
                break;
            case 'getLikedPosts':
                $userId = isset($_GET['userId']) ? intval($_GET['userId']) : null;
                if ($userId !== null) {
                    $response = $get->getLikedPosts($userId);
                    echo json_encode($response, JSON_UNESCAPED_SLASHES);
                } else {
                    echo json_encode(["status" => "failed", "message" => "User ID is required"]);
                }
                break;
            case 'getNotifications':
                $userId = isset($_GET['userId']) ? intval($_GET['userId']) : null;
                if ($userId !== null) {
                    $response = $get->getNotifications($userId);
                    echo json_encode($response, JSON_UNESCAPED_SLASHES);
                } else {
                    echo json_encode(["status" => "failed", "message" => "User ID is required"]);
                    http_response_code(400);
                }
                break;
            case 'search':
                if (isset($_GET['query'])) {
                    echo json_encode($get->search($_GET['query']));
                } else {
                    http_response_code(400);
                    echo json_encode(["status" => "failed", "message" => "Query parameter is required"]);
                }
                break;
            case 'user':
                if (isset($request[1])) {
                    echo json_encode($get->getUserProfile($request[1]));
                } else {
                    http_response_code(400);
                    echo json_encode(["status" => "failed", "message" => "User ID is required"]);
                }
                break;
            case 'post':
                if (isset($request[1])) {
                    $postId = $request[1];
                    $userId = isset($_GET['userId']) ? $_GET['userId'] : null;
                    echo json_encode($get->getPost($postId, $userId));
                } else {
                    http_response_code(400);
                    echo json_encode(["status" => "failed", "message" => "Post ID is required"]);
                }
                break;
            case 'following':
                if (isset($request[1])) {
                    $followingId = $request[1];
                    $userId = isset($_GET['userId']) ? $_GET['userId'] : null;
                    if (!$userId) {
                        http_response_code(400);
                        echo json_encode(["status" => "failed", "message" => "userId parameter is required"]);
                        break;
                    }
                    $response = $get->checkFollowingStatus($followingId, $userId);
                    echo json_encode($response);
                } else {
                    http_response_code(400);
                    echo json_encode(["status" => "failed", "message" => "User ID is required"]);
                }
                break;
            case 'listings':
                if (isset($request[1])) {
                    if ($request[1] === 'user' && isset($request[2])) {
                        // Get listings for specific user
                        echo json_encode($get->getUserListings($request[2]));
                    } else {
                        // Get specific listing
                        echo json_encode($get->getListingById($request[1]));
                    }
                } else {
                    // Get all listings
                    echo json_encode($get->getListings());
                }
                break;
            case 'users':
                if (isset($request[1])) {
                    $userId = $request[1];
                    if (isset($request[2]) && $request[2] === 'following') {
                        echo json_encode($get->getUserFollowing($userId));
                        break;
                    }
                }
                break;
            default:
                // Return a 403 response for unsupported requests
                echo "This is forbidden";
                http_response_code(403);
                break;
        }
        break;
    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        switch ($request[0]) {
            case 'listings':
                if (isset($request[1]) && $request[1] === 'create') {
                    echo json_encode($post->createListing($data));
                } else if (isset($request[1]) && isset($request[2]) && $request[2] === 'update') {

                    echo json_encode($post->updateListing($request[1], $data));
                } else {
                    http_response_code(400);
                    echo json_encode(["status" => "failed", "message" => "Invalid listings endpoint"]);
                }
                break;
            case 'login':
                echo json_encode($auth->login($data));
                break;
            case 'register':
                echo json_encode($post->register($data));
                break;
            case 'createPost':
                echo json_encode($post->createPost($data));
                break;
            case 'likePost':
                echo json_encode($post->likePost($data));
                break;
            case 'savePost':
                echo json_encode($post->savePost($data));
                break;
            case 'deletePost':
                echo json_encode($post->deletePost($data));
                break;
            case 'addComment':
                echo json_encode($post->addComment($data));
                break;
            case 'likeComment':
                echo json_encode($post->likeComment($data));
                break;
            case 'toggleFollow':
                echo json_encode($post->toggleFollow($data));
                break;
            case 'deleteComment':
                echo json_encode($post->deleteComment($data));
                break;
            case 'notifications':
                if (isset($request[1])) {
                    $notificationId = intval($request[1]);
                    if (isset($request[2])) {
                        switch ($request[2]) {
                            case 'read':
                                // Handle marking as read
                                $userId = isset($data->userId) ? intval($data->userId) : null;
                                echo json_encode($post->markNotificationAsRead($notificationId, $userId));
                                break;
                            case 'delete':
                                // Handle deletion via POST
                                $data->notificationId = $notificationId;
                                echo json_encode($post->deleteNotification($data));
                                break;
                            default:
                                http_response_code(400);
                                echo json_encode(["status" => "failed", "message" => "Invalid notification action"]);
                        }
                    } else {
                        http_response_code(400);
                        echo json_encode(["status" => "failed", "message" => "Invalid notification action"]);
                    }
                } else {
                    http_response_code(400);
                    echo json_encode(["status" => "failed", "message" => "Invalid notification ID"]);
                }
                break;
            case 'conversations':
                if (isset($request[1])) {
                    if ($request[1] === 'create') {
                        // Create a new conversation
                        if (!isset($data['user1Id']) || !isset($data['recipientId'])) {
                            http_response_code(400);
                            echo json_encode([
                                'status' => ['remarks' => 'failed', 'message' => 'Missing required user IDs'],
                                'payload' => null,
                                'prepared_by' => 'JFV',
                                'timestamp' => [
                                    'date' => date('Y-m-d H:i:s.u'),
                                    'timezone_type' => 3,
                                    'timezone' => 'Asia/Manila'
                                ]
                            ]);
                            return;
                        }
                        echo json_encode($post->createConversation($data));
                    }
                    else if (is_numeric($request[1]) && isset($request[2]) && $request[2] === 'read') {
                        // Mark a conversation as read
                        echo json_encode($post->markConversationAsRead($data));
                    }
                } else {
                    // Handle basic conversation creation
                    if (!isset($data['recipientId'])) {
                        http_response_code(400);
                        echo json_encode([
                            'status' => ['remarks' => 'failed', 'message' => 'Missing recipientId'],
                            'payload' => null,
                            'prepared_by' => 'JFV',
                            'timestamp' => [
                                'date' => date('Y-m-d H:i:s.u'),
                                'timezone_type' => 3,
                                'timezone' => 'Asia/Manila'
                            ]
                        ]);
                        return;
                    }
                    echo json_encode($post->createConversation($data));
                }
                break;
            case 'messages':
                if (isset($request[1]) && $request[1] === 'send') {
                    // Send a message (HTTP fallback when WebSocket is unavailable)
                    echo json_encode($post->sendMessage($data));
                }
                break;
            case 'updateProfile':
                    echo json_encode($post->updateProfile($data));
                break;
            case 'updateBio':
                    echo json_encode($post->updateBio($data));
                break;

            default:
                // Return a 403 response for unsupported requests
                echo "This is forbidden";
                http_response_code(403);
                break;
        }
        break;
    case 'DELETE':
        switch ($request[0]) {
            case 'listings':
                if (isset($request[1])) {
                    echo json_encode($post->deleteListing($request[1]));
                } else {
                    http_response_code(400);
                    echo json_encode(["status" => "failed", "message" => "Listing ID is required"]);
                }
                break;
            default:
                // Return a 403 response for unsupported requests
                echo "This is forbidden";
                http_response_code(403);
                break;
        }
        break;

    default:
        // Return a 404 response for unsupported HTTP methods
        echo "Method not available";
        http_response_code(404);
        break;
}
