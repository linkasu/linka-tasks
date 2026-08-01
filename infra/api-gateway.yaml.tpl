openapi: 3.0.0
info:
  title: Linka Tasks
  version: 1.0.0
x-yc-apigateway:
  service_account_id: __GATEWAY_SA_ID__
paths:
  /api/realtime:
    x-yc-apigateway-websocket-connect:
      x-yc-apigateway-integration:
        type: serverless_containers
        container_id: __CONTAINER_ID__
        service_account_id: __GATEWAY_SA_ID__
    x-yc-apigateway-websocket-message:
      x-yc-apigateway-integration:
        type: serverless_containers
        container_id: __CONTAINER_ID__
        service_account_id: __GATEWAY_SA_ID__
    x-yc-apigateway-websocket-disconnect:
      x-yc-apigateway-integration:
        type: serverless_containers
        container_id: __CONTAINER_ID__
        service_account_id: __GATEWAY_SA_ID__
  /:
    x-yc-apigateway-any-method:
      x-yc-apigateway-integration:
        type: serverless_containers
        container_id: __CONTAINER_ID__
        service_account_id: __GATEWAY_SA_ID__
  /{proxy+}:
    x-yc-apigateway-any-method:
      parameters:
        - explode: false
          in: path
          name: proxy
          required: false
          schema:
            default: '-'
            type: string
          style: simple
      x-yc-apigateway-integration:
        type: serverless_containers
        container_id: __CONTAINER_ID__
        service_account_id: __GATEWAY_SA_ID__
