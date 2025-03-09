<?php
// Load the environment variables
require_once 'vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Set default time zone
date_default_timezone_set("Asia/Manila");

// Set time limit for requests
set_time_limit(1000);

class Connection {
    private $connectionString;
    private $options = [
        \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
        \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
        \PDO::ATTR_EMULATE_PREPARES => false
    ];

    public function __construct() {
        // Load credentials from environment variables
        $this->connectionString = $_ENV['DB_DRIVER'] . ":host=" . $_ENV['DB_HOST'] . ";dbname=" . $_ENV['DB_NAME'] . ";charset=utf8mb4";
    }

    public function connect() {
        try {
            return new \PDO($this->connectionString, $_ENV['DB_USER'], $_ENV['DB_PASS'], $this->options);
        } catch (\PDOException $e) {
            die("Database connection failed: " . $e->getMessage());
        }
    }
}
?>