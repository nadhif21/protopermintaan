<?php

function loadMailConfig() {
    $debugMode = getenv('APP_ENV') === 'development' ? 2 : 0;
    if (getenv('MAIL_SMTP_DEBUG') !== false) {
        $debugMode = intval(getenv('MAIL_SMTP_DEBUG'));
    }

    return [
        // Hostinger SMTP default (tetap bisa dioverride via env)
        'host' => getenv('MAIL_HOST') ?: 'smtp.hostinger.com',
        'port' => intval(getenv('MAIL_PORT') ?: 465),
        'encryption' => getenv('MAIL_ENCRYPTION') ?: 'ssl', // tls | ssl
        'smtp_auth' => true,

        // Jangan hardcode credential, isi via environment/hosting panel
        'username' => getenv('MAIL_USERNAME') ?: '',
        'password' => getenv('MAIL_PASSWORD') ?: '',

        'from_email' => getenv('MAIL_FROM_EMAIL') ?: (getenv('MAIL_USERNAME') ?: ''),
        'from_name' => getenv('MAIL_FROM_NAME') ?: 'Permintaan DOF',
        'reply_to' => getenv('MAIL_REPLY_TO') ?: '',

        // Dev: 2, Prod: 0
        'debug' => $debugMode
    ];
}
