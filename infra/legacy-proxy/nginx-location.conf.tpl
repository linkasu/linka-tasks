location = __WEBHOOK_PATH__ {
    limit_except POST { deny all; }

    proxy_pass https://tasks.nkolinka.ru/api/telegram/webhook;
    proxy_ssl_server_name on;
    proxy_set_header Host tasks.nkolinka.ru;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Linka-Proxy-Secret "__PROXY_SECRET__";
    proxy_pass_request_headers on;
}
