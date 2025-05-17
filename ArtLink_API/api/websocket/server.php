<?php
require __DIR__ . '/../vendor/autoload.php';

use Ratchet\Server\IoServer;
use Ratchet\Http\HttpServer;
use Ratchet\WebSocket\WsServer;
use ArtLink\WebSocket\WebSocketServer;

$server = IoServer::factory(
    new HttpServer(
        new WsServer(
            new WebSocketServer()
        )
    ),
     8080,
    '127.0.0.1'
);

echo "WebSocket server started on port 8080\n";
$server->run();