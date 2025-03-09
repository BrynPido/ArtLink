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

class Post extends GlobalMethods{
    private $pdo;

    public function __construct(\PDO $pdo){
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
    public function register($data) {
        // Validate passwords match
        if ($data->password !== $data->confirmPassword) {
            return $this->sendPayload(null, "failed", "Passwords do not match", 400);
        }

        $hashedPassword = password_hash($data->password, PASSWORD_BCRYPT);

        $sql = "INSERT INTO users (name, username, email, password) VALUES (?, ?, ?, ?)";
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
}
