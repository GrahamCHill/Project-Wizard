<?php
declare(strict_types=1);

$options = getopt('', ['help', 'name:']);
if (isset($options['help'])) {
    echo 'Usage: php main.php [--name=NAME]', PHP_EOL;
    exit(0);
}

$name = $options['name'] ?? 'World';
if (!is_string($name)) {
    fwrite(STDERR, 'Pass --name once.', PHP_EOL === "\r\n" ? 17 : 16);
    exit(1);
}
echo "Hello, {$name}, from __PROJECT_NAME__!", PHP_EOL;
