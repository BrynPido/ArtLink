<?php
require_once "./modules/global.php";
require_once "vendor/autoload.php"; // For JWT
use \Firebase\JWT\JWT;

class Auth extends GlobalMethods {
    private $pdo;
    private $key;
    private $issuer;
    private $expiration;

    public function __construct(\PDO $pdo) {
        $this->pdo = $pdo;
        
        // Load JWT-related values from environment variables
        $this->key = $_ENV['JWT_SECRET'];
        $this->issuer = $_ENV['JWT_ISSUER'];
        $this->expiration = $_ENV['JWT_EXPIRATION'];
    }

    /**
     * Login method to authenticate users.
     */
    public function login($data) {
        $email = $data->email;
        $password = $data->password;
    
        $sql = "SELECT * FROM user WHERE email = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$email]);
        $user = $stmt->fetch();
    
        if ($user && password_verify($password, $user['password'])) {
            $token = $this->generateJWT($user);
    
            $userPayload = [
                "token" => $token,
                "user" => [
                    "id" => $user['id'],
                    "name" => $user['name'],
                    "username" => $user['username'],
                    "email" => $user['email']
                ]
            ];
    
            return $this->sendPayload($userPayload, "success", "Login successful", 200);
        } else {
            return $this->sendPayload(null, "failed", "Invalid credentials", 401);
        }
    }

    /**
     * Generates a JWT for the authenticated user.
     *
     * @param array $user User data to include in the token.
     * @return string Encoded JWT.
     */
    private function generateJWT($user) {
        $payload = [
            "iss" => $this->issuer,         // Issuer
            "sub" => $user['id'],           // Subject (user id)
            "email" => $user['email'],
            "iat" => time(),                // Issued at time
            "exp" => time() + $this->expiration // Token expiration time
        ];

        // Return the encoded JWT
        return JWT::encode($payload, $this->key, 'HS256');
    }

    /**
     * Method to validate and decode the JWT.
     *
     * @param string $token JWT token to validate.
     * @return mixed Decoded token data or false on failure.
     */
    public function validateJWT($token) {
        try {
            $decoded = JWT::decode($token, new \Firebase\JWT\Key($this->key, 'HS256'));
            return $decoded;
        } catch (\Exception $e) {
            return false;
        }
    }
}