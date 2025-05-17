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
            return;
        }

        switch ($data->type) {
            case 'auth':
                $this->handleAuthentication($from, $data->userId);
                break;
            
            case 'message':
                if (isset($data->to) && isset($data->content)) {
                    $this->handleDirectMessage($from, $data->to, $data->content);
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

    protected function handleDirectMessage($from, $toUserId, $content) {
        try {
            // Store message in database
            $stmt = $this->db->prepare("
                INSERT INTO message (content, conversationId, authorId, receiverId, createdAt, updatedAt)
                VALUES (:content, :conversationId, :authorId, :receiverId, NOW(), NOW())
            ");

            // Get or create conversation
            $conversationId = $this->getOrCreateConversation($from->userId, $toUserId);

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
            echo "Error handling message: " . $e->getMessage() . "\n";
            $from->send(json_encode([
                'type' => 'error',
                'message' => 'Failed to deliver message'
            ]));
        }
    }

    private function getOrCreateConversation($user1Id, $user2Id) {
        // First try to find existing conversation
        $stmt = $this->db->prepare("
            SELECT id FROM conversation 
            WHERE (user1Id = :user1 AND user2Id = :user2)
            OR (user1Id = :user2 AND user2Id = :user1)
            LIMIT 1
        ");
        
        $stmt->execute([
            ':user1' => $user1Id,
            ':user2' => $user2Id
        ]);
        
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            return $result['id'];
        }
        
        // Create new conversation if none exists
        $stmt = $this->db->prepare("
            INSERT INTO conversation (user1Id, user2Id, createdAt, updatedAt)
            VALUES (:user1, :user2, NOW(), NOW())
        ");
        
        $stmt->execute([
            ':user1' => $user1Id,
            ':user2' => $user2Id
        ]);
        
        return $this->db->lastInsertId();
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