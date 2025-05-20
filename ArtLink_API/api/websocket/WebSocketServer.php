<?php
namespace ArtLink\WebSocket;

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use SplObjectStorage;
use PDO;

class WebSocketServer implements MessageComponentInterface {
    protected $clients;
    private $subscriptions;
    private $userConnections;
    private $db;

    public function __construct() {
        $this->clients = new SplObjectStorage;
        $this->subscriptions = [];
        $this->userConnections = [];
        
        // Initialize database connection
        try {
            $this->db = new PDO(
                'mysql:host=localhost;dbname=artlink_db',
                'root',
                '',
                array(PDO::ATTR_PERSISTENT => true)
            );
            $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch (\PDOException $e) {
            echo "Database connection failed: " . $e->getMessage() . "\n";
        }
    }

    public function onOpen(ConnectionInterface $conn) {
        $this->clients->attach($conn);
        echo "New connection! ({$conn->resourceId})\n";
    }

    public function onMessage(ConnectionInterface $from, $msg) {
        $data = json_decode($msg);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            echo "ERROR: JSON decode failed: " . json_last_error_msg() . "\n";
            return;
        }

        // Add debug logging for all received messages
        echo "RECEIVED: " . print_r($data, true) . "\n";

        switch ($data->type) {
            case 'auth':
                $this->handleAuthentication($from, $data->userId);
                break;
            
            case 'message':
                if (isset($data->to) && isset($data->content)) {
                    // Pass conversationId and listingId if they exist
                    $conversationId = isset($data->conversationId) ? $data->conversationId : null;
                    $listingId = isset($data->listingId) ? $data->listingId : null;
                    
                    echo "DEBUG: Processing message - conversationId=$conversationId, listingId=$listingId\n";
                    $this->handleDirectMessage($from, $data->to, $data->content, $conversationId, $listingId);
                }
                break;
            
            case 'notification':
                $this->handleNotification($from, $data);
                break;

            case 'subscribe':
                $this->handleSubscription($from, $data->channel);
                break;
        }
    }

    protected function handleAuthentication($conn, $userId) {
        $this->userConnections[$userId] = $conn;
        $conn->userId = $userId;
        
        echo "Client authenticated with user ID: {$userId}\n";
        
        $conn->send(json_encode([
            'type' => 'auth',
            'status' => 'success'
        ]));
    }

    protected function handleDirectMessage($from, $toUserId, $content, $conversationId = null, $listingId = null) {
        try {
            // echo "CRITICAL DEBUG - Received message params:\n";
            // echo "  from: " . $from->userId . "\n";
            // echo "  to: " . $toUserId . "\n";
            // echo "  content: " . $content . "\n";
            // echo "  conversationId: " . ($conversationId === null ? "NULL" : $conversationId) . "\n";
            // echo "  listingId: " . ($listingId === null ? "NULL" : $listingId) . "\n";
            
            // IMPORTANT: Use the provided conversationId instead of looking up
            if ($conversationId) {
                // echo "Using provided conversationId: $conversationId\n";
                
                // Verify the conversation exists and matches users
                $verifyStmt = $this->db->prepare("
                    SELECT id, user1Id, user2Id, listingId FROM conversation 
                    WHERE id = :conversationId
                    LIMIT 1
                ");
                $verifyStmt->execute([':conversationId' => $conversationId]);
                $conv = $verifyStmt->fetch(PDO::FETCH_ASSOC);

                if (!$conv) {
                    // echo "ERROR: Conversation ID $conversationId does not exist! Creating new one...\n";
                    $conversationId = $this->getOrCreateConversation($from->userId, $toUserId, $listingId);
                } else {
                    // echo "FOUND conversation ID $conversationId: user1Id={$conv['user1Id']}, user2Id={$conv['user2Id']}, listingId=" . 
                         ($conv['listingId'] === null ? 'NULL' : $conv['listingId']) . "\n";
                    
                    // Check if users match
                    $usersMatch = ($conv['user1Id'] == $from->userId && $conv['user2Id'] == $toUserId) || 
                                  ($conv['user1Id'] == $toUserId && $conv['user2Id'] == $from->userId);
                    
                    if (!$usersMatch) {
                        // echo "ERROR: Conversation users don't match! Using new conversation...\n";
                        $conversationId = $this->getOrCreateConversation($from->userId, $toUserId, $listingId);
                    }
                }
            } else {
                // echo "No conversationId provided, getting or creating one\n";
                $conversationId = $this->getOrCreateConversation($from->userId, $toUserId, $listingId);
                // echo "Using new/found conversationId: $conversationId\n";
            }

            // Insert the message
            $stmt = $this->db->prepare("
                INSERT INTO message (content, conversationId, authorId, receiverId, createdAt, updatedAt)
                VALUES (:content, :conversationId, :authorId, :receiverId, NOW(), NOW())
            ");

            $stmt->execute([
                ':content' => $content,
                ':conversationId' => $conversationId,
                ':authorId' => $from->userId,
                ':receiverId' => $toUserId
            ]);

            $messageId = $this->db->lastInsertId();
            
            // Send to recipient if online
            if (isset($this->userConnections[$toUserId])) {
                $recipient = $this->userConnections[$toUserId];
                $message = [
                    'type' => 'message',
                    'id' => $messageId,
                    'from' => $from->userId,
                    'content' => $content,
                    'timestamp' => date('Y-m-d H:i:s'),
                    'conversationId' => $conversationId
                ];
                
                $recipient->send(json_encode($message));
                
                // Send delivery confirmation to sender
                $from->send(json_encode([
                    'type' => 'message_delivered',
                    'id' => $messageId,
                    'to' => $toUserId,
                    'timestamp' => date('Y-m-d H:i:s')
                ]));
            }
        } catch (\Exception $e) {
            // echo "Error handling message: " . $e->getMessage() . "\n";
            $from->send(json_encode([
                'type' => 'error',
                'message' => 'Failed to deliver message'
            ]));
        }
    }

    private function getOrCreateConversation($user1Id, $user2Id, $listingId = null) {
        // echo "DEBUG: getOrCreateConversation called with user1Id=$user1Id, user2Id=$user2Id, listingId=" . 
             ($listingId === null ? 'NULL' : $listingId) . "\n";
        
        // Try with a more explicit handling of NULL values
        if ($listingId === null) {
            $stmt = $this->db->prepare("
                SELECT id FROM conversation 
                WHERE ((user1Id = :user1 AND user2Id = :user2)
                   OR (user1Id = :user2 AND user2Id = :user1))
                   AND listingId IS NULL
                LIMIT 1
            ");
            $stmt->execute([
                ':user1' => $user1Id,
                ':user2' => $user2Id
            ]);
        } else {
            $stmt = $this->db->prepare("
                SELECT id FROM conversation 
                WHERE ((user1Id = :user1 AND user2Id = :user2)
                   OR (user1Id = :user2 AND user2Id = :user1))
                   AND listingId = :listingId
                LIMIT 1
            ");
            $stmt->execute([
                ':user1' => $user1Id,
                ':user2' => $user2Id,
                ':listingId' => $listingId
            ]);
        }
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            // echo "DEBUG: Found existing conversation id=" . $result['id'] . "\n";
            return $result['id'];
        }
        
        // echo "DEBUG: No matching conversation found, creating new one\n";
        
        // Create new conversation
        $stmt = $this->db->prepare("
            INSERT INTO conversation (user1Id, user2Id, listingId, createdAt, updatedAt)
            VALUES (:user1, :user2, :listingId, NOW(), NOW())
        ");
        
        $stmt->execute([
            ':user1' => $user1Id,
            ':user2' => $user2Id,
            ':listingId' => $listingId
        ]);
        
        $newId = $this->db->lastInsertId();
        // echo "DEBUG: Created new conversation with id=$newId\n";
        return $newId;
    }

    protected function handleNotification($from, $data) {
        if (isset($data->to) && isset($data->content)) {
            if (isset($this->userConnections[$data->to])) {
                $recipient = $this->userConnections[$data->to];
                $recipient->send(json_encode([
                    'type' => 'notification',
                    'from' => $from->userId,
                    'content' => $data->content
                ]));
            }
        }
    }

    protected function handleSubscription($conn, $channel) {
        if (!isset($this->subscriptions[$channel])) {
            $this->subscriptions[$channel] = new SplObjectStorage;
        }
        $this->subscriptions[$channel]->attach($conn);
        
        $conn->send(json_encode([
            'type' => 'subscribe',
            'status' => 'success',
            'channel' => $channel
        ]));
    }

    public function onClose(ConnectionInterface $conn) {
        $this->clients->detach($conn);
        
        if (isset($conn->userId)) {
            unset($this->userConnections[$conn->userId]);
        }
        
        echo "Connection {$conn->resourceId} has disconnected\n";
    }

    public function onError(ConnectionInterface $conn, \Exception $e) {
        echo "An error has occurred: {$e->getMessage()}\n";
        $conn->close();
    }
}