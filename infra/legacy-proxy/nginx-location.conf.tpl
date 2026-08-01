server {
    listen 80;
    listen [::]:80;
    server_name __PUBLIC_HOST__;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/linka-tasks-acme;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name __PUBLIC_HOST__;

    ssl_certificate /etc/letsencrypt/live/__PUBLIC_HOST__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__PUBLIC_HOST__/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

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

    location / {
        return 404;
    }
}
