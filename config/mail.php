<?php

function loadMailConfig() {
    $debugMode = getenv('APP_ENV') === 'development' ? 2 : 0;
    if (getenv('MAIL_SMTP_DEBUG') !== false) {
        $debugMode = intval(getenv('MAIL_SMTP_DEBUG'));
    }

    return [
        // Gmail SMTP default
        'host' => getenv('MAIL_HOST') ?: 'smtp.gmail.com',
        'port' => intval(getenv('MAIL_PORT') ?: 587),
        'encryption' => getenv('MAIL_ENCRYPTION') ?: 'tls', // tls | ssl
        'smtp_auth' => true,

        // Jangan hardcode credential, isi via environment/hosting panel
        'username' => getenv('MAIL_USERNAME') ?: 'permintaandof@gmail.com',
        'password' => getenv('MAIL_PASSWORD') ?: 'sjeh dqxi kkbt anye', // Gmail App Password

        'from_email' => getenv('MAIL_FROM_EMAIL') ?: (getenv('MAIL_USERNAME') ?: 'permintaandof@gmail.com'),
        'from_name' => getenv('MAIL_FROM_NAME') ?: 'Permintaan DOF',
        'reply_to' => getenv('MAIL_REPLY_TO') ?: '',

        // Dev: 2, Prod: 0
        'debug' => $debugMode
    ];
}
