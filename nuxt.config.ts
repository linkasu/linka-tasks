export default defineNuxtConfig({
  compatibilityDate: '2026-08-01',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@vueuse/nuxt', 'vuetify-nuxt-module'],
  css: ['@mdi/font/css/materialdesignicons.css', '~/assets/styles/main.scss'],
  runtimeConfig: {
    sessionSecret: '',
    telegramBotToken: '',
    telegramWebhookSecret: '',
    telegramProxySecret: '',
    internalJobSecret: '',
    ydbEndpoint: '',
    ydbDatabase: '',
    objectStorageBucket: '',
    objectStorageAccessKeyId: '',
    objectStorageSecretAccessKey: '',
    apiGatewayId: '',
    public: {
      appName: 'Задачи Линки',
      websocketUrl: '',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'Задачи Линки',
      meta: [
        { name: 'description', content: 'Управление проектами и задачами команды Линки' },
        { name: 'theme-color', content: '#1867c0' },
      ],
    },
  },
  nitro: {
    preset: 'node-server',
    externals: {
      traceInclude: [
        'ydb-sdk',
      ],
    },
    routeRules: {
      '/api/**': { cors: false },
    },
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  vuetify: {
    vuetifyOptions: {
      theme: {
        defaultTheme: 'linkaLight',
        themes: {
          linkaLight: {
            dark: false,
            colors: {
              primary: '#1867c0',
              secondary: '#455a64',
              surface: '#ffffff',
              background: '#f5f7fa',
              error: '#b3261e',
              success: '#2e7d32',
              warning: '#ed6c02',
            },
          },
        },
      },
    },
  },
})
