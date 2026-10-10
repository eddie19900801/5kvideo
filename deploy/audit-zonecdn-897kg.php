<?php
require '/www/wwwroot/game97/cdn/lib/db.php';

$pdo = db();
$columns = $pdo->query('SHOW COLUMNS FROM cdn_sites')->fetchAll(PDO::FETCH_COLUMN);
echo 'columns=' . implode(',', $columns) . PHP_EOL;
$stmt = $pdo->prepare('SELECT * FROM cdn_sites WHERE root_domain=? AND deleted_at IS NULL');
$stmt->execute(['897kg.cc']);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $row) {
    foreach (array_keys($row) as $key) {
        if (preg_match('/token|secret|password|api_key/i', $key)) {
            unset($row[$key]);
        }
    }
    echo json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL;
}
